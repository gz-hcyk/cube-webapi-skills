<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getRaw } from '@/api/http';

/**
 * 角色菜单授权设置（对标 NewLife.Cube MVC 版 Role/SetPermission 表格，Element Plus 版）。
 *
 * 界面形态：四列表格 —— 名称 | 显示名 | 授权 | 操作权限。
 * · **授权**（仅父级行）：该菜单块是否对本角色开放。勾上 → 自身 + 全部子孙补足段
 *   （保留已有位，无位的补查看 1）；取消 → 整支删段（菜单对该角色不可见）。
 *   子级行的授权由操作位隐含：勾任一位即开放，全不勾即不开放。
 *   ⚠ 不能落 `id#0` 表示「开放但无操作」——XCode Role 保存/加载会丢弃 0 掩码段
 *   （实测 PUT `19#0` 读回为空），故开放的最小粒度只能是查看（1）。
 * · **操作权限**：开放后的具体动作位。
 *   - 父级行：只读 / 全部 两档（只读 → 整支仅查看；全部 → 整支全动作）；
 *   - 叶子行：逐位勾选，位列表由 GetMenuTree 节点 `permissions` 字典驱动
 *     （内置 1 查看 / 2 添加 / 4 修改 / 8 删除 + 后端自定义位 16/32/64/128…，由节点 permissions 字典给出）。
 *
 * 契约（NewLife.Cube 标准）：Role.Permission 为逗号分隔的 `菜单ID#权限位掩码`，
 * 例如 `1#3,2#7`（3=查看+添加；-1=全动作）。掩码 0 的段不落库。
 * 菜单源 `GET /api/Admin/Index/GetMenuTree`（区域族必带 /api；根族端点走 rawHttp）。
 */
const props = defineProps<{
  modelValue?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

interface BitItem {
  bit: number;
  label: string;
}
interface MenuRow {
  id: number;
  name: string;
  title: string;
  level: number;
  hasChildren: boolean;
  bits: BitItem[];
}

/** 节点无 permissions 字典时的内置兜底位（官方口径：1查看/2添加/4修改/8删除） */
const DEFAULT_BITS: BitItem[] = [
  { bit: 1, label: '查看' },
  { bit: 2, label: '添加' },
  { bit: 4, label: '修改' },
  { bit: 8, label: '删除' },
];

const loading = ref(false);
const menus = ref<any[]>([]);
/**
 * 菜单ID → 权限位掩码。**键存在即表示已授权**（菜单对该角色开放）：
 * >0=位掩码；-1=全动作。键不存在=未授权（菜单不显示）。0 段不出现（后端不保留）。
 */
const permMap = ref<Record<string, number>>({});
/** 已折叠的父节点 id 集合（默认空 = 全展开） */
const collapsed = ref<Set<number>>(new Set());

/** 解析 Permission 字符串 → permMap（0 段忽略：后端本就不保留，防御历史脏值） */
function parse(str?: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const seg of (str || '').split(',')) {
    const s = seg.trim();
    if (!s) continue;
    const [idp, permp] = s.split('#');
    const id = String(Number(idp) || idp.trim());
    if (!id) continue;
    const v = Number(permp);
    if (!Number.isFinite(v) || v === 0) continue;
    map[id] = v < 0 ? -1 : v;
  }
  return map;
}

/** permMap → Permission 字符串（只输出非 0 掩码，0 段后端不保留） */
function serialize(): string {
  const parts: string[] = [];
  for (const [id, perm] of Object.entries(permMap.value)) {
    if (perm > 0 || perm === -1) parts.push(`${id}#${perm}`);
  }
  return parts.join(',');
}

function sync() {
  const next = serialize();
  if (next === props.modelValue) return;
  emit('update:modelValue', next);
}

function toggleCollapse(id: number) {
  const s = new Set(collapsed.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  collapsed.value = s;
}
function expandAll() {
  collapsed.value = new Set();
}
function collapseAll() {
  collapsed.value = new Set(flatRows.value.filter((r) => r.hasChildren).map((r) => r.id));
}

/** 父 → 子 映射 */
const byParent = computed(() => {
  const m = new Map<number, any[]>();
  for (const x of menus.value) {
    const pid = Number(x.parentId ?? x.parentID ?? 0) || 0;
    if (!m.has(pid)) m.set(pid, []);
    m.get(pid)!.push(x);
  }
  return m;
});

/** 菜单ID → 可勾选权限位（后端 permissions 字典驱动；空则回退内置四位） */
const bitsById = computed(() => {
  const m = new Map<number, BitItem[]>();
  for (const x of menus.value) {
    const dict = x.permissions ?? x.Permissions;
    let bits: BitItem[] = [];
    if (dict && typeof dict === 'object') {
      bits = Object.entries(dict as Record<string, unknown>)
        .map(([k, v]) => ({ bit: Number(k), label: String(v) }))
        .filter((b) => Number.isFinite(b.bit) && b.bit > 0)
        .sort((a, b) => a.bit - b.bit);
    }
    if (!bits.length) bits = DEFAULT_BITS;
    m.set(Number(x.id), bits);
  }
  return m;
});

function collectDescendantIds(id: number, acc: number[] = []): number[] {
  for (const c of byParent.value.get(id) || []) {
    const cid = Number(c.id);
    acc.push(cid);
    collectDescendantIds(cid, acc);
  }
  return acc;
}

/** 某菜单全部可勾选位的按位或（-1 落地成具体掩码时用它，避免丢自定义位） */
function allMaskOf(id: number): number {
  const bits = bitsById.value.get(id) ?? DEFAULT_BITS;
  return bits.reduce((acc, b) => acc | b.bit, 0);
}

/** 父级块是否整体已授权：自身 + 全部子孙均有段 */
function isGranted(id: number): boolean {
  const ids = [id, ...collectDescendantIds(id)];
  return ids.length > 0 && ids.every((t) => String(t) in permMap.value);
}

/**
 * 父级「授权」整块开关：
 * 勾上 → 自身 + 全部子孙保证有段（已有位保留，无位的补查看 1，因后端不保留 0 掩码）；
 * 取消 → 自身 + 全部子孙整支删段（整块菜单对该角色不可见）。
 */
function toggleGrant(id: number, on: boolean) {
  const map = { ...permMap.value };
  for (const tid of [id, ...collectDescendantIds(id)]) {
    const k = String(tid);
    if (on) {
      const cur = Number(map[k] || 0);
      if (cur === 0) map[k] = 1; // 开放的最小粒度：至少可查看
    } else {
      delete map[k];
    }
  }
  permMap.value = map;
  sync();
}

/**
 * 切换某菜单的某权限位；父节点连同全部子孙一起授予/收回该位（MVC 联动）。
 * 勾位即自动授权（写段）；取消到掩码 0 时删段（= 该菜单不再开放，0 段后端不保留）。
 */
function toggleBit(id: number, bit: number, on: boolean) {
  const map = { ...permMap.value };
  const set = (tid: number) => {
    const k = String(tid);
    const all = allMaskOf(tid);
    const wasAll = map[k] === -1;
    // -1（全动作）时勾选其它位保持 -1；取消某位才落地为具体掩码
    const cur = wasAll ? -1 : Number(map[k] || 0);
    const nv = on ? (wasAll ? -1 : cur | bit) : wasAll ? all & ~bit : cur & ~bit;
    if (nv === 0) delete map[k];
    else map[k] = nv;
  };
  set(id);
  for (const d of collectDescendantIds(id)) set(d);
  permMap.value = map;
  sync();
}

/**
 * 父级「只读」：自身 + 全部子孙仅授予查看（1），其余位收回；取消 → 收回查看。
 * 落地走具体掩码（子孙为 -1 时先展开为全掩码再清位，不误伤）。
 */
function applyReadonly(id: number, on: boolean) {
  const map = { ...permMap.value };
  for (const tid of [id, ...collectDescendantIds(id)]) {
    const k = String(tid);
    const cur = map[k] === -1 ? allMaskOf(tid) : Number(map[k] || 0);
    const nv = on ? cur | 1 : cur & ~1;
    if (nv === 0) delete map[k];
    else map[k] = nv;
  }
  permMap.value = map;
  sync();
}

/**
 * 父级「全部」：自身 + 全部子孙授予全动作（-1，MVC 全动作语义，天然含未来自定义位）；
 * 取消 → 整支收回（掩码清 0 即删段，该块不再开放）。
 */
function applyAll(id: number, on: boolean) {
  const map = { ...permMap.value };
  for (const tid of [id, ...collectDescendantIds(id)]) {
    const k = String(tid);
    if (on) map[k] = -1;
    else delete map[k];
  }
  permMap.value = map;
  sync();
}

/** 父级是否处于「全部」态：自身 + 全部子孙均为全动作 */
function isAllChecked(id: number): boolean {
  const ids = [id, ...collectDescendantIds(id)];
  return ids.length > 0 && ids.every((t) => permMap.value[String(t)] === -1);
}

/** 父级是否处于「只读」态：非「全部」态，且自身 + 全部子孙均恰好仅查看（掩码=1） */
function isReadonlyChecked(id: number): boolean {
  if (isAllChecked(id)) return false;
  const ids = [id, ...collectDescendantIds(id)];
  return ids.length > 0 && ids.every((t) => permMap.value[String(t)] === 1);
}

/** 勾选框状态：-1 全动作视为全勾 */
function isChecked(id: number, bit: number): boolean {
  const v = permMap.value[String(id)] || 0;
  return v === -1 || (v & bit) !== 0;
}

/** 已授权菜单数（有段即授权） */
const grantedCount = computed(
  () => Object.values(permMap.value).filter((v) => v === -1 || v > 0).length,
);

/** DFS 平铺（跳过已折叠分支） */
const flatRows = computed<MenuRow[]>(() => {
  const out: MenuRow[] = [];
  const walk = (pid: number, level: number) => {
    for (const m of byParent.value.get(pid) || []) {
      const id = Number(m.id);
      const row: MenuRow = {
        id,
        name: m.name || '',
        title: m.displayName || m.name || `菜单${m.id}`,
        level,
        hasChildren: (byParent.value.get(id) || []).length > 0,
        bits: bitsById.value.get(id) ?? DEFAULT_BITS,
      };
      out.push(row);
      if (!collapsed.value.has(id)) walk(id, level + 1);
    }
  };
  walk(0, 0);
  return out;
});

watch(
  () => props.modelValue,
  (v) => {
    permMap.value = parse(v);
  },
);

onMounted(async () => {
  loading.value = true;
  try {
    // 区域族端点必带 /api（漏前缀会落到 SPA 兜底返回 HTML，静默为空）
    const r = await getRaw<any[]>('/api/Admin/Index/GetMenuTree');
    // GetMenuTree 返回嵌套树：递归摊平（含全部子孙），byParent/bitsById 才能索引到每个节点
    if (r?.code === 0 && Array.isArray(r.data)) {
      const all: any[] = [];
      const collect = (nodes: any[]) => { for (const n of nodes) { if (n) { all.push(n); if (Array.isArray(n.children)) collect(n.children); } } };
      collect(r.data);
      menus.value = all;
    }
    permMap.value = parse(props.modelValue);
  } catch (e: any) {
    if (e?.response?.status !== 401) ElMessage.error(e?.message || '加载菜单树失败');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-loading="loading" class="role-menu-editor">
    <!-- 工具栏：授权统计 + 联动说明 + 展开/折叠 -->
    <div class="rme-toolbar">
      <div class="rme-legend">
        <el-tag size="small" type="success" effect="light" class="rme-count">
          {{ grantedCount }} 个菜单已授权
        </el-tag>
        <span class="rme-hint">授权决定菜单是否可见；勾选后在其右侧设置可执行的操作</span>
      </div>
      <div class="rme-tools">
        <el-button size="small" plain :disabled="disabled" @click="expandAll">全展开</el-button>
        <el-button size="small" plain :disabled="disabled" @click="collapseAll">全折叠</el-button>
      </div>
    </div>

    <div class="rme-body">
      <!-- 列头：名称 / 显示名 / 授权 / 操作权限（对标 MVC 版 SetPermission） -->
      <div class="rme-head-row">
        <span class="rme-hc-name">名称</span>
        <span class="rme-hc-title">显示名</span>
        <span class="rme-hc-grant">授权</span>
        <span class="rme-hc-bits">操作权限</span>
      </div>
      <div class="rme-scroll">
        <template v-if="flatRows.length">
          <div
            v-for="row in flatRows"
            :key="row.id"
            class="rme-row"
            :class="{ 'rme-row--parent': row.hasChildren }"
          >
            <!-- 名称列：层级缩进 + 折叠箭头 -->
            <span class="rme-name" :style="{ paddingLeft: row.level * 18 + 'px' }">
              <span
                v-if="row.hasChildren"
                class="rme-caret"
                :title="collapsed.has(row.id) ? '展开子级' : '折叠子级'"
                @click="toggleCollapse(row.id)"
              >{{ collapsed.has(row.id) ? '▸' : '▾' }}</span>
              <span v-else class="rme-caret rme-caret--leaf" />
              <span class="rme-name-text" :title="row.name">{{ row.name }}</span>
            </span>

            <!-- 显示名列 -->
            <span class="rme-title" :title="row.title">{{ row.title }}</span>

            <!-- 授权列：仅父级行提供整块开关；子级由操作位隐含 -->
            <span class="rme-grant">
              <el-checkbox
                v-if="row.hasChildren"
                :model-value="isGranted(row.id)"
                :disabled="disabled"
                @change="(v: any) => toggleGrant(row.id, !!v)"
              />
            </span>

            <!-- 操作权限列 -->
            <span class="rme-bits" :class="{ 'rme-bits--off': !isGranted(row.id) }">
              <!-- 父级行：只读 / 全部 两档（勾选联动全部子菜单） -->
              <template v-if="row.hasChildren">
                <el-checkbox
                  class="rme-bit"
                  :model-value="isReadonlyChecked(row.id)"
                  :disabled="disabled"
                  @change="(v: any) => applyReadonly(row.id, !!v)"
                >只读</el-checkbox>
                <el-checkbox
                  class="rme-bit"
                  :model-value="isAllChecked(row.id)"
                  :disabled="disabled"
                  @change="(v: any) => applyAll(row.id, !!v)"
                >全部</el-checkbox>
              </template>
              <!-- 叶子行：逐位勾选（含自定义位） -->
              <template v-else>
                <el-checkbox
                  v-for="b in row.bits"
                  :key="b.bit"
                  class="rme-bit"
                  :model-value="isChecked(row.id, b.bit)"
                  :disabled="disabled"
                  @change="(v: any) => toggleBit(row.id, b.bit, !!v)"
                >{{ b.label }}</el-checkbox>
              </template>
            </span>
          </div>
        </template>
        <div v-else-if="!loading" class="rme-empty">暂无菜单数据</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-menu-editor {
  width: 100%;
}

/* ---- 工具栏 ---- */
.rme-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.rme-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rme-count {
  flex: none;
}
.rme-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rme-tools {
  flex: none;
  display: flex;
  gap: 6px;
}

/* ---- 卡片容器 ---- */
.rme-body {
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 8px;
  overflow: hidden;
}

/* ---- 列头 ---- */
.rme-head-row {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
  font-size: 12px;
  color: var(--el-text-color-placeholder, #a8abb2);
}
.rme-hc-name {
  flex: 0 0 200px;
  min-width: 0;
}
.rme-hc-title {
  flex: 1 1 auto;
  min-width: 0;
}
.rme-hc-grant {
  flex: 0 0 56px;
  text-align: center;
}
.rme-hc-bits {
  flex: 0 0 400px;
}

/* ---- 行列表 ---- */
.rme-scroll {
  max-height: 420px;
  overflow-y: auto;
}
.rme-row {
  display: flex;
  align-items: center;
  padding: 3px 12px;
  min-height: 36px;
  font-size: 13px;
  transition: background 0.15s;
}
.rme-row + .rme-row {
  border-top: 1px solid var(--el-border-color-extra-light, #f2f6fc);
}
.rme-row:hover {
  background: var(--el-fill-color-lighter, #fafafa);
}
.rme-row--parent {
  background: var(--el-fill-color-lighter, #fafafa);
}
.rme-row--parent:hover {
  background: var(--el-fill-color, #f0f2f5);
}

/* 名称列（含缩进与折叠箭头） */
.rme-name {
  flex: 0 0 200px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}
.rme-name-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-regular, #606266);
}
.rme-row--parent .rme-name-text {
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

.rme-caret {
  flex: none;
  width: 14px;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  text-align: center;
  color: var(--el-text-color-secondary, #909399);
  transition: color 0.15s;
}
.rme-caret:hover {
  color: var(--el-color-primary, #409eff);
}
.rme-caret--leaf {
  cursor: default;
  visibility: hidden;
}

/* 显示名列 */
.rme-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 8px;
}
.rme-row--parent .rme-title {
  font-weight: 600;
}

/* 授权列 */
.rme-grant {
  flex: 0 0 56px;
  display: flex;
  justify-content: center;
}

/* 操作权限列：位数随菜单不同（内置 4 位 + 自定义 16/32/64/128…），弹性换行 */
.rme-bits {
  flex: 0 0 400px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 10px;
}
/* 未授权：操作权限整体淡出提示（仍可点击，勾位会自动补授权） */
.rme-bits--off {
  opacity: 0.4;
}
.rme-bits :deep(.el-checkbox) {
  margin-right: 0;
  height: 24px;
}
.rme-bits :deep(.el-checkbox__label) {
  font-size: 12px;
}

.rme-empty {
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}
</style>
