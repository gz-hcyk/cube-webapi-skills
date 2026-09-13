/**
 * 外键关联源字典加载器 —— 让 skill 自带 lookups 拉取能力（约定式 + 覆盖机制）
 * 落地为 src/api/useLookups.ts。配合 fieldRender.ts 的 labelOf / resolveOptions 使用。
 *
 * 背景：本 skill 的“字段映射双模式”依赖 lookups（{ 基名: { id: 名称 } }）来把
 * 纯 xxxID 外键字段（无 map/dataSource）在列表/详情回显名称、在表单/搜索栏渲染下拉。
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ★【2026-09-13 实测取证】外键控制器解析：用**菜单树**做权威目录，不再纯靠猜
 * ═══════════════════════════════════════════════════════════════════════════════
 * 修复前症状（在 CubeSkillLab 实测）：
 *   LabAsset 列表页每次加载产生 **6 条 404 脏请求** ——
 *     /api/Lab/Category  /api/Cube/Category
 *     /api/Lab/Parent    /api/Cube/Parent
 *     /api/Lab/Asset     /api/Cube/Asset
 *   并伴随 1 条控制台 error；同时**搜索栏「所属分类」下拉为空**（字典 dict 为空），
 *   即「按分类筛选」功能静默失效 —— 404 不是"无害噪音"，它直接吃掉了一个功能。
 *
 * 根因：旧实现把 `CategoryID` 去 ID 后缀得 `Category`，直接当成控制器名。
 *   但真实控制器是 **`LabCategory`** —— XCode 模型普遍采用 **`{Area}{Entity}`** 命名
 *   （LabAsset / LabCategory / LabAssetItem / LabOrder / LabOrderLine）。
 *   ⚠️ 无法从字段名反推真实控制器：`ParentID` 指向的是**同实体自身**（树形自关联），
 *      而 `AssetID` 在 LabAssetItem 里指向 `LabAsset`、在 LabOrderLine 里也指向 `LabAsset`。
 *
 * 修法：用 `/api/Admin/Index/GetMenuTree` 拿**权威目录**。它返回
 *   `[{ name:'Lab', children:[{ name:'LabCategory', url:'/Lab/LabCategory' }, …] }]`
 *   即 `area → 控制器名清单`。解析链：
 *     ① 自引用外键（Parent/ParentID…）→ 当前实体控制器（selfController）
 *     ② 同 area 目录内**后缀匹配**（`LabCategory`.endsWith('Category')）；多命中取最长
 *     ③ 精确名 base → `{Area}{base}` 兜底
 *     ④ 最后才试 `Cube` area（框架系统实体 Area/Dictionary 常挂 Cube）
 *   ⚠️ `GetMenuTree` 是**区域族**端点（控制器带 `[Area]`）→ **必须带 `/api` 前缀**，
 *      且须用 `getRaw`（`http` 实例 baseURL 已含 `/api`，用 getApi 会变成 `/api/api/...`）。
 *   目录一次拉取 + 模块级缓存，全应用共享（登录后侧边栏/Dashboard 本就会拉这棵树）。
 *
 * 另有**会话级负结果缓存**：同一 (area, controller) 确认 404 后不再重复探测，
 * 避免每次导航都刷同一批 404。
 */

import { ref } from 'vue';
import { getApi, getRaw } from './http';
import type { DataField } from './useEntityResource';
import { isEnumType, isMappedField } from './fieldRender';

/** 单个关联源的覆盖配置 */
export interface LookupSource {
  /** 关联实体所在 area，默认同当前实体 area */
  area?: string;
  /** 关联控制器名，默认用基名（如 Category） */
  controller?: string;
  /** 关联实体主键字段名（后端原始名），默认 "ID" */
  idField?: string;
  /** 关联实体显示字段名（后端原始名），默认 "Name" */
  nameField?: string;
}

/** 基名 → 覆盖配置 */
export type LookupOverrides = Record<string, LookupSource>;

/** 大小写不敏感地从行对象里找键（避免依赖具体的 camel 实现，如 "ID"→"id"/"iD"） */
function findKey(row: Record<string, any>, ...candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  const lower = keys.map((k) => k.toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(String(c).toLowerCase());
    if (idx >= 0) return keys[idx];
  }
  return undefined;
}

/**
 * 字段名去 ID/IDs 后缀得基名：CategoryID→Category、RoleIds→Role、ProductTypeId→ProductType。
 * 与 fieldRender.lookupBaseName 保持一致（复数外键也要能解析，用于多选下拉）。
 */
function baseNameOf(name: string): string {
  if (name.endsWith('IDs')) return name.slice(0, -3);
  if (name.endsWith('Ids')) return name.slice(0, -3);
  if (name.endsWith('ID')) return name.slice(0, -2);
  if (name.endsWith('Id')) return name.slice(0, -2);
  return name;
}

/** 自引用外键基名：树形 `ParentID` 指向同实体自身 */
const SELF_REF_BASES = ['parent', 'parentid', 'parents', 'parentids', 'parentcate', 'parentcategory'];

// ═══════════════════════════════════════════════════════════════════════════════
// 菜单目录（area → 控制器名清单）：模块级缓存，全应用只拉一次
// ═══════════════════════════════════════════════════════════════════════════════
let MENU_CATALOG: Promise<Record<string, string[]>> | null = null;

/** 会话级负结果缓存：`{area}/{controller}` 已确认 404 → 不再重复探测 */
const NOT_FOUND = new Set<string>();

function loadMenuCatalog(): Promise<Record<string, string[]>> {
  if (!MENU_CATALOG) {
    MENU_CATALOG = (async () => {
      const out: Record<string, string[]> = {};
      try {
        // ⚠️ 区域族端点必须带 /api；用 getRaw 避免 http 实例再叠一层 /api
        const r: any = await getRaw<any>('/api/Admin/Index/GetMenuTree');
        const tree = Array.isArray(r?.data) ? r.data : (r?.data?.list ?? r?.data?.rows ?? []);
        for (const top of tree || []) {
          const areaName = String(top?.name ?? '').trim();
          if (!areaName) continue;
          const kids = top?.children ?? top?.Childs ?? [];
          out[areaName] = (kids || [])
            .map((k: any) => String(k?.name ?? '').trim())
            .filter(Boolean);
        }
      } catch {
        // 目录不可用（未登录/老版本）→ 返回空表，解析退化为纯约定链（step ③④）
      }
      return out;
    })();
  }
  return MENU_CATALOG;
}

/**
 * 解析某外键基名对应的候选控制器名（按优先级排序）。
 * @param base 外键基名（如 Category / Parent / Asset）
 * @param area 当前实体 area
 * @param selfController 当前实体控制器名（自引用外键用）
 */
async function resolveControllers(
  base: string,
  area: string,
  selfController?: string,
): Promise<string[]> {
  const list: string[] = [];
  const push = (c?: string) => {
    const t = String(c ?? '').trim();
    if (t && !list.some((x) => x.toLowerCase() === t.toLowerCase())) list.push(t);
  };
  const bl = base.toLowerCase();

  // ① 自引用外键 → 当前实体控制器（避免先浪费 2 次 404）
  if (SELF_REF_BASES.includes(bl) || (selfController && selfController.toLowerCase() === bl)) {
    push(selfController);
  }

  // ② 同 area 目录内后缀匹配（`LabCategory`.endsWith('category')）
  let catalog: Record<string, string[]> = {};
  try {
    catalog = await loadMenuCatalog();
  } catch {
    catalog = {};
  }
  const inArea = catalog[area] ?? [];
  const hits = inArea.filter((c) => c.toLowerCase().endsWith(bl));
  if (hits.length) {
    // 多命中（如 Line 同时命中 LabOrderLine / 其它）→ 取最长，通常最具体
    hits.sort((a, b) => b.length - a.length).forEach(push);
  }

  // ③ 约定兜底：精确名 → {Area}{base}
  push(base);
  push(area + base);

  return list;
}

/**
 * 拉取官方 /Cube/Lookup 枚举字典：GET 返回 `{ code:0, data: { <枚举类型名>: [{Label, Value}] } }`，
 * data 的键即传入的 codes（枚举类型名），值为 Label/Value 列表。
 *
 * ★【2026-09-13 实测修正】`CubeController` 是**根族**控制器（无 `[Area]`），
 *   路由为 `/Cube/Lookup`（**不带** `/api`）—— 实测：
 *     GET /Cube/Lookup       → 200
 *     GET /api/Cube/Lookup   → 404
 *   故**必须先用 getRaw('/Cube/Lookup')**（旧实现反了：先试带 /api 的，必然 404 一次
 *   才回退，纯浪费）。带 /api 的形态仅作兼容探测，失败即静默退化，不阻断页面。
 */
async function fetchCubeLookup(codes: string[]): Promise<Record<string, any> | null> {
  const q = `?codes=${encodeURIComponent(codes.join(','))}`;
  // 首选根路径（魔方默认属性路由，无 /api 前缀）
  try {
    const r = await getRaw<any>(`/Cube/Lookup${q}`);
    if (r.code === 0 && r.data && typeof r.data === 'object') return r.data as Record<string, any>;
  } catch (e: any) {
    if (e?.response?.status !== 404) return null; // 非 404（401/500/网络）直接放弃，不回退
  }
  // 兼容回退：部分部署可能把根族控制器也挂到 /api 前缀下
  try {
    const r2 = await getApi<any>(`/Cube/Lookup${q}`);
    if (r2.code === 0 && r2.data && typeof r2.data === 'object') return r2.data as Record<string, any>;
  } catch {
    // 不可达 → null，静默退化
  }
  return null;
}

/**
 * @param area 当前实体 area（如 Lab）
 * @param overrides 基名 → 关联源覆盖配置
 * @param entityController 当前实体控制器名（如 LabAsset）—— 用于解析自引用外键（ParentID）
 */
export function useLookups(area: string, overrides?: LookupOverrides, entityController?: string) {
  const lookups = ref<Record<string, Record<string, string>>>({});
  const loading = ref(false);

  /**
   * 审计字段判定：CreateUserID/UpdateUserID（及复数变体）。它们**不是业务外键**——
   * 列表列显示后端已映射的名称字符串、表单只读（后端自动维护），无需 id→name 字典。
   * 若不排除，会按 xxxID 约定拉出 `/api/{area}/CreateUser`、`/api/{area}/UpdateUser`
   * 这类**不存在的控制器**请求（实测列表页多出 `?pageSize=1000` 无效请求）。
   */
  const isAuditField = (n: string) =>
    ['createuserid', 'updateuserid', 'createuserids', 'updateuserids'].includes(
      String(n ?? '').toLowerCase(),
    );

  /**
   * 根据实体字段集合中的映射/外键字段，拉取关联实体 Index，
   * 组装 { [baseName]: { [idValue]: name } } 字典写入 lookups。
   *
   * 需要拉取的字段：
   *   1) **映射字段（`mapField` 非空）**——用其原始字段名（mapField 值）取基名，
   *      如 CategoryName(mapField=CategoryID) → Category；
   *   2) 字段名本身是 xxxID/xxxIDs（无内联 map/dataSource 的）。
   *
   * ⚠️ 为什么映射字段也要拉：列表/详情确实**不需要**（后端已回传 `CategoryName` 名称列），
   *    但 **`search` 组下发的往往是裸 `CategoryID`**（实测 GetPage 的 `search`
   *    里 `CategoryID` 无 mapField、无 lovCode，仅 `typeName: Int32`）——
   *    搜索栏要渲染「所属分类」下拉就必须有这份字典。拉不到 → 下拉为空 → 筛选静默失效。
   *
   * 关联源基名优先级（后端显式契约 > 推断）：
   *   `lovCode`（GetPage 显式下发，如 search 组 RoleID.lovCode="Role"）> mapField 去 ID 后缀 > 自身名去 ID 后缀。
   */
  async function load(fields: DataField[]): Promise<void> {
    loading.value = true;
    const fkFields = fields.filter((f) => {
      // 审计字段（自身或 mapField 指向审计字段）一律不拉字典
      if (isAuditField(f.name) || (f.mapField && isAuditField(f.mapField))) return false;
      if (f.primaryKey || f.isIdentity || f.map || f.dataSource) return false;
      // 显式 lovCode 即为外键关联源
      if (f.lovCode && String(f.lovCode).trim()) return true;
      // 映射字段：mapField 非空即为映射字段（该值就是原始字段名）
      if (f.mapField && String(f.mapField).trim()) return true;
      const n = f.name.toLowerCase();
      return n.endsWith('ids') || n.endsWith('id');
    });
    // 基名：lovCode 优先（后端显式关联源编码），其次映射字段用 mapField、否则用自身字段名
    const bases = Array.from(
      new Set(
        fkFields.map((f) => {
          const lc = f.lovCode && String(f.lovCode).trim();
          if (lc) return baseNameOf(lc);
          const mapped = f.mapField && String(f.mapField).trim();
          const n = f.name.toLowerCase();
          const own = n.endsWith('ids') || n.endsWith('id');
          return baseNameOf(mapped && !own ? String(f.mapField).trim() : f.name);
        }),
      ),
    );

    const result: Record<string, Record<string, string>> = { ...lookups.value };

    // 通道1：纯枚举字段（无 lovCode / 无 map/dataSource / 非映射字段）走官方 /Cube/Lookup
    // （按枚举类型名解析），结果以 typeName 为键存入 lookups，供 resolveOptions/labelOf 在第 3 优先级回显。
    // 覆盖 sex/role/enable 等无实体表、约定式「去 ID 后缀猜控制器」天然失效的静态字典。
    const enumFields = fields.filter((f) => {
      if (f.lovCode && String(f.lovCode).trim()) return false; // 有 lovCode 走 LovController（通道2）
      if (f.map || f.dataSource) return false; // 内联选项源优先
      if (isMappedField(f)) return false; // 映射字段按外键处理（通道3）
      return isEnumType(f);
    });
    const enumCodes = Array.from(
      new Set(enumFields.map((f) => (f.typeName ?? '').trim()).filter(Boolean)),
    );
    if (enumCodes.length) {
      const cubeData = await fetchCubeLookup(enumCodes);
      if (cubeData) {
        for (const code of enumCodes) {
          const list = cubeData[code];
          if (Array.isArray(list) && list.length) {
            const dict: Record<string, string> = {};
            for (const o of list) {
              const v = o.Value ?? o.value;
              const l = o.Label ?? o.label;
              if (v == null) continue;
              dict[String(v)] = l != null ? String(l) : String(v);
            }
            if (Object.keys(dict).length) result[code] = dict;
          }
        }
      }
    }

    await Promise.all(
      bases.map(async (base) => {
        const ov = overrides?.[base] ?? {};
        const idField = ov.idField ?? 'ID';
        const nameField = ov.nameField ?? 'Name';

        // 控制器候选：overrides 显式指定 > 菜单目录解析（自引用/后缀匹配）> 约定兜底
        const ctrls = ov.controller
          ? [ov.controller]
          : await resolveControllers(base, area, entityController);

        for (const ctrl of ctrls) {
          // area 候选：ov.area 显式指定则只试该 area；否则当前 area 优先，404 兜底 `Cube`
          // （NewLife.Cube 标准布局——框架系统实体如 Area/Dictionary 常挂在 Cube area。
          //  实测 /api/Admin/Area 404、/api/Cube/Area 200）
          const areaCandidates = ov.area ? [ov.area] : Array.from(new Set([area, 'Cube']));
          let hit = false;
          for (const cand of areaCandidates) {
            const key = `${cand}/${ctrl}`.toLowerCase();
            if (NOT_FOUND.has(key)) continue; // 会话内已确认不存在 → 不再探测
            try {
              // 仅传实体路径（不含 /api），/api 由 http 实例 baseURL 统一承载
              const r = await getApi<any>(`/${cand}/${ctrl}?pageSize=1000`);
              if (r.code === 0 && Array.isArray(r.data)) {
                const dict: Record<string, string> = {};
                for (const row of r.data) {
                  const idKey = findKey(row, idField, 'id') ?? 'id';
                  const nameKey = findKey(row, nameField, 'name') ?? Object.keys(row)[1] ?? 'id';
                  const idv = row[idKey];
                  if (idv == null) continue;
                  dict[String(idv)] = row[nameKey] != null ? String(row[nameKey]) : String(idv);
                }
                result[base] = dict;
                hit = true;
                break; // 命中即止，不再探测下一 area / 下一控制器候选
              }
            } catch (e: any) {
              if (e?.response?.status === 404) {
                NOT_FOUND.add(key);
                continue; // 该 area 无此控制器 → 试下一候选
              }
              break; // 其它错误（401/500/网络）直接跳过该关联源
            }
          }
          if (hit) break;
        }
        // 全部候选不可达：跳过，该字段退化为原始 ID 显示（不阻断主页面）
      }),
    );
    lookups.value = result;
    loading.value = false;
  }

  return { lookups, loading, load };
}
