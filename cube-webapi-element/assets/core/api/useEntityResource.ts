/**
 * 实体资源基类（铁律 E1：模板继承的唯一数据入口）
 * 落位：src/api/useEntityResource.ts
 *
 * 一个实体页 = 一个 useEntityResource({ area, controller }) + 三个通用组件。
 * schema / 分页 / 搜索 / 排序 / CRUD / 树形 / 统计 全部在这里，业务页零重复代码。
 */
import { computed, ref, type Ref } from 'vue';
import { deleteApi, getApi, getRaw, http, postApi, putApi } from './http';
import {
  buildTree,
  foreignLookupBases,
  isTreeSchema,
  normalizeRow,
  pickPayload,
  type DataField,
  type LookupMap,
  type PageSchema,
  type PageSetting,
} from './fieldRender';

export interface EntityResourceOptions {
  area: string | (() => string);
  controller: string | (() => string);
  pageSize?: number;
}

export interface LoadParams {
  /** 关键词（后端 Q 参数，模糊匹配） */
  Q?: string;
  /** 排序字段（camelCase） */
  sort?: string;
  desc?: boolean;
  [key: string]: unknown;
}

/** 菜单树成功结果缓存。失败不缓存，下次进入实体页再试。 */
let menuCatalogCache: Promise<any[]> | null = null;

function loadMenuCatalog(): Promise<any[]> {
  if (!menuCatalogCache) {
    menuCatalogCache = getRaw<any[]>('/api/Admin/Index/GetMenuTree')
      .then((res) => (Array.isArray(res?.data) ? res.data : []))
      .catch(() => {
        menuCatalogCache = null;
        return [];
      });
  }
  return menuCatalogCache;
}

/** 同区域菜单子节点里，名称以基名结尾的控制器。Category → EquipmentCategory */
function controllerForBase(tree: any[], areaName: string, base: string): string | undefined {
  const want = areaName.toLowerCase();
  const top = tree.find((node) => {
    const name = String(node?.name ?? '').toLowerCase();
    const head = String(node?.url ?? '').replace(/^\//, '').split('/')[0]?.toLowerCase() ?? '';
    return name === want || head === want;
  });
  const kids: any[] = Array.isArray(top?.children) ? top.children : [];
  const needle = base.toLowerCase();
  const hits = kids
    .map((node) => String(node?.name ?? ''))
    .filter((name) => name.toLowerCase().endsWith(needle));
  hits.sort((a, b) => b.length - a.length);
  return hits[0];
}

const EMPTY_SCHEMA: PageSchema = {
  setting: {},
  list: [],
  addForm: [],
  editForm: [],
  detail: [],
  search: [],
};

export function useEntityResource(options: EntityResourceOptions) {
  const area = computed(() => (typeof options.area === 'function' ? options.area() : options.area));
  const controller = computed(() =>
    typeof options.controller === 'function' ? options.controller() : options.controller,
  );

  /** 实体根路径（不含 /api，http 实例已带） */
  const base = computed(() => `/${area.value}/${controller.value}`);

  const schema: Ref<PageSchema> = ref({ ...EMPTY_SCHEMA });
  const rows: Ref<any[]> = ref([]);
  const total = ref(0);
  const pageIndex = ref(1);
  const pageSize = ref(options.pageSize ?? 20);
  const loading = ref(false);
  const schemaReady = ref(false);
  const error = ref('');
  const stat = ref<any>(null);

  /** 已生效的查询条件（点"查询"才写入，翻页沿用） */
  const activeParams = ref<LoadParams>({});
  const sortProp = ref('');
  const sortDesc = ref(false);

  const setting = computed<PageSetting>(() => schema.value.setting ?? {});
  const listFields = computed<DataField[]>(() => schema.value.list ?? []);
  const addFields = computed<DataField[]>(() => schema.value.addForm ?? []);
  const editFields = computed<DataField[]>(() => schema.value.editForm ?? []);
  const detailFields = computed<DataField[]>(() => schema.value.detail ?? []);
  const searchFields = computed<DataField[]>(() => schema.value.search ?? []);

  /** 五组字段聚合——树形判定必须用它（只看 list 会漏判） */
  const allFields = computed<DataField[]>(() => [
    ...listFields.value,
    ...addFields.value,
    ...editFields.value,
    ...detailFields.value,
    ...searchFields.value,
  ]);

  const isTree = computed(() => isTreeSchema([listFields.value, addFields.value, editFields.value, detailFields.value, searchFields.value]));

  /** 树形时把扁平行组装成树；同时导出 id→name 字典供 ParentName 回显 */
  const treeRows = computed(() => (isTree.value ? buildTree(rows.value) : rows.value));

  /** 外键字典：CategoryName(mapField=CategoryID) 这类字段没有内联 dataSource */
  const foreignLookups = ref<LookupMap>({});

  const selfLookups = computed<LookupMap>(() => {
    const result: LookupMap = {};
    if (!isTree.value) return result;
    const nameKey = ['name', 'displayName', 'title'].find((k) => rows.value.some((r) => r[k] !== undefined));
    if (!nameKey) return result;
    const dict: Record<string, string> = {};
    for (const r of rows.value) dict[String(r.id)] = String(r[nameKey] ?? r.id);
    result.Parent = dict;
    return result;
  });

  const lookups = computed<LookupMap>(() => ({ ...selfLookups.value, ...foreignLookups.value }));

  /* ------------------------------ 权限（以 GetPage.setting 为准） ------------------------------ */

  const isReadOnly = computed(() => setting.value.isReadOnly === true);
  const canAdd = computed(() => !isReadOnly.value && setting.value.enableAdd !== false);
  const canEdit = computed(() => !isReadOnly.value);
  const canDelete = computed(() => !isReadOnly.value);

  /* ------------------------------ 加载 ------------------------------ */

  async function loadSchema(force = false): Promise<PageSchema> {
    if (schemaReady.value && !force) return schema.value;
    const res = await getApi<PageSchema>(`${base.value}/GetPage`);
    const data = res?.data ?? {};
    schema.value = {
      setting: (data.setting as PageSetting) ?? {},
      list: (data.list as DataField[]) ?? [],
      addForm: (data.addForm as DataField[]) ?? [],
      editForm: (data.editForm as DataField[]) ?? [],
      detail: (data.detail as DataField[]) ?? [],
      search: (data.search as DataField[]) ?? [],
    };
    schemaReady.value = true;
    await loadForeignLookups();
    return schema.value;
  }

  /**
   * 用菜单树把外键基名解析成真实控制器。
   * CategoryID 去后缀是 Category，设备台账里的控制器却是 EquipmentCategory。
   * 同区域里按名称后缀匹配，多命中取最长的那个。
   */
  async function loadForeignLookups(): Promise<void> {
    const bases = foreignLookupBases(allFields.value);
    if (!bases.length) {
      foreignLookups.value = {};
      return;
    }
    const tree = await loadMenuCatalog();
    const next: LookupMap = {};
    await Promise.all(
      bases.map(async (base) => {
        const controller = controllerForBase(tree, area.value, base);
        if (!controller) return;
        try {
          const res = await getApi<any[]>(`/${area.value}/${controller}`, { pageIndex: 1, pageSize: 500 });
          const dict: Record<string, string> = {};
          for (const row of res.data ?? []) {
            const id = row?.id ?? row?.Id;
            if (id === undefined || id === null || id === '') continue;
            const label = row?.name ?? row?.displayName ?? row?.title ?? id;
            dict[String(id)] = String(label);
          }
          if (Object.keys(dict).length) next[base] = dict;
        } catch {
          /* 关联控制器不可达时下拉留空，列表仍可打开 */
        }
      }),
    );
    foreignLookups.value = next;
  }

  function buildQuery(extra: LoadParams, all = false): Record<string, unknown> {
    const query: Record<string, unknown> = {
      pageIndex: all ? 1 : pageIndex.value,
      pageSize: all ? 10000 : pageSize.value,
      ...activeParams.value,
      ...extra,
    };
    if (sortProp.value) {
      query.sort = sortProp.value;
      query.desc = sortDesc.value;
    }
    for (const key of Object.keys(query)) {
      const v = query[key];
      if (v === undefined || v === null || v === '') delete query[key];
    }
    return query;
  }

  /** 拉当前页 */
  async function reload(extra: LoadParams = {}): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      const res = await getApi<any[]>(base.value, buildQuery(extra));
      rows.value = (res.data ?? []).map((r) => normalizeRow(r));
      total.value = Number(res.page?.totalCount ?? rows.value.length);
      stat.value = res.stat ?? null;
    } catch (e: any) {
      error.value = e?.message || '数据加载失败';
      rows.value = [];
      total.value = 0;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** 拉全量（树形必须，否则跨页父子会断链） */
  async function loadAll(extra: LoadParams = {}): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      const res = await getApi<any[]>(base.value, buildQuery(extra, true));
      rows.value = (res.data ?? []).map((r) => normalizeRow(r));
      total.value = rows.value.length;
    } catch (e: any) {
      error.value = e?.message || '数据加载失败';
      rows.value = [];
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** 统一入口：树形走全量，平铺走分页 */
  async function refresh(extra: LoadParams = {}): Promise<void> {
    await (isTree.value ? loadAll(extra) : reload(extra));
  }

  async function init(): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      await loadSchema();
      await (isTree.value ? loadAll() : reload());
    } catch (e: any) {
      error.value = e?.message || '页面初始化失败';
    } finally {
      loading.value = false;
    }
  }

  /* ------------------------------ 查询 / 排序 / 翻页 ------------------------------ */

  async function applySearch(params: LoadParams): Promise<void> {
    activeParams.value = params;
    pageIndex.value = 1;
    await refresh();
  }

  function resetSearch(): Promise<void> {
    activeParams.value = {};
    sortProp.value = '';
    sortDesc.value = false;
    pageIndex.value = 1;
    return refresh();
  }

  async function changePage(next: number): Promise<void> {
    pageIndex.value = next;
    await reload();
  }

  async function changeSize(size: number): Promise<void> {
    pageSize.value = size;
    pageIndex.value = 1;
    await reload();
  }

  async function changeSort(prop: string, order: 'ascending' | 'descending' | null): Promise<void> {
    sortProp.value = order ? prop : '';
    sortDesc.value = order === 'descending';
    pageIndex.value = 1;
    await refresh();
  }

  /* ------------------------------ CRUD ------------------------------ */

  async function fetchOne(id: string | number): Promise<Record<string, any>> {
    // 详情是 Detail?id=。写成 /{id} 会 404，编辑弹窗每次打开都报错。
    const res = await getApi<Record<string, any>>(`${base.value}/Detail`, { id });
    return normalizeRow(res.data ?? {});
  }

  async function create(model: Record<string, any>): Promise<void> {
    await postApi(base.value, pickPayload(addFields.value, model));
  }

  async function update(model: Record<string, any>): Promise<void> {
    const payload = pickPayload(editFields.value, model);
    if (model.id !== undefined) payload.id = model.id;
    await putApi(base.value, payload);
  }

  /** 删除：id 在 query，不在 URL path（写进 path 会 405） */
  async function remove(id: string | number): Promise<void> {
    await deleteApi(base.value, { id });
  }

  async function removeMany(ids: (string | number)[]): Promise<void> {
    for (const id of ids) await remove(id);
  }

  /** 导出：走 axios（带令牌头），成功后触发浏览器下载 */
  async function exportFile(format: 'csv' | 'xlsx' = 'csv', extra: LoadParams = {}): Promise<void> {
    const params = { ...buildQuery(extra, true), format };
    const resp = await http.get(`${base.value}/ExportFile`, { params, responseType: 'blob' });
    const blob = new Blob([resp.data as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${controller.value}_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    // 状态
    area,
    controller,
    base,
    schema,
    schemaReady,
    setting,
    rows,
    treeRows,
    total,
    pageIndex,
    pageSize,
    loading,
    error,
    stat,
    lookups,
    // 字段
    listFields,
    addFields,
    editFields,
    detailFields,
    searchFields,
    allFields,
    isTree,
    // 权限
    isReadOnly,
    canAdd,
    canEdit,
    canDelete,
    // 方法
    init,
    loadSchema,
    reload,
    loadAll,
    refresh,
    applySearch,
    resetSearch,
    changePage,
    changeSize,
    changeSort,
    fetchOne,
    create,
    update,
    remove,
    removeMany,
    exportFile,
  };
}

export type EntityResource = ReturnType<typeof useEntityResource>;
