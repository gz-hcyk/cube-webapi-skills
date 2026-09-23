<template>
  <div class="cube-list-page">
    <!-- 加载失败显式提示（避免静默空白，便于定位真实后端返回结构问题） -->
    <t-alert v-if="error" theme="error" :title="`/api${res.base} 加载失败`" :message="error" class="err-bar" close />

    <!-- 导航栏（内联，对应魔方 MVC 的 _List_Navbar.cshtml）：标题 + 实体路径，setting.enableNavbar 控制 -->
    <div v-if="setting.enableNavbar !== false" class="cube-list-navbar">
      <div class="nb-left">
        <span class="nb-title">{{ title }}</span>
        <t-tag v-if="area" theme="primary" variant="light" size="small">{{ area }} / {{ controller }}</t-tag>
      </div>
      <!-- ▼ 覆盖点 L2（对标 MVC 分部视图覆盖，见 references/page-composition.md）：导航栏右侧扩展 -->
      <slot name="navbar-extra" />
    </div>

    <!-- 搜索栏（内联，对应魔方 MVC 的 _List_Search.cshtml）：GetPage.search 驱动 + 默认自带的关键词（Q）框。
         注意：@submit 勿加 .prevent！TDesign t-form 内部已 e.preventDefault()（form.mjs _onSubmit），
         onSubmit 回调参数是 { validateResult, firstError, e } 对象（无 preventDefault 方法），
         .prevent 会让 Vue withModifiers 先调 e.preventDefault() 导致 TypeError。 -->
    <t-form
      ref="searchFormRef"
      v-if="showSearch"
      layout="inline"
      :data="searchModel"
      :rules="searchRules"
      class="cube-search-bar"
      @submit="onSearchSubmit"
    >
      <!-- 关键词（Q）：NewLife.Cube 全局模糊搜索，**默认自带**（setting.enableKey 控制）。
           实测 ?Q=行政部 生效；字符串字段精确参数不生效，统一走 Q 关键词。
           ⚠️ t-input 的 @enter 回调签名是 (value: InputValue, context: { e: KeyboardEvent })，与
           t-form 的 @submit (ctx: SubmitContext) 完全不同，**不可共用同一个 handler**（会 TS2322）。
           故单独走 onSearchEnter：先调 t-form 内置 validate()，通过再查询（等价于点了「查询」）。 -->
      <t-form-item v-if="setting.enableKey !== false" label="关键词" name="Q">
        <t-input v-model="searchKeyword" clearable placeholder="关键词" style="width: 180px" @enter="onSearchEnter" />
      </t-form-item>
      <template v-for="item in searchItems" :key="item.name">
        <t-form-item :label="item.label" :name="item.name">
          <t-select v-if="item.control === 'select'" v-model="searchModel[item.name]" :options="item.options" clearable style="width: 180px" />
          <!-- 多值外键（xxxIDs / 映射自 RoleIds）：多选下拉 -->
          <t-select v-else-if="item.control === 'multi-select'" v-model="searchModel[item.name]" :options="item.options" multiple clearable style="width: 220px" />
          <!-- 布尔（typeName=Boolean）：开关。v-model 初始 undefined（useVModel 原样透传），
               未操作不发参数；开=true / 关=false 才筛选；「重置」清空恢复不筛选 -->
          <t-switch v-else-if="item.control === 'switch'" v-model="searchModel[item.name]" style="margin-top: 6px" />
          <t-tree-select v-else-if="item.control === 'tree-select'" v-model="searchModel[item.name]" :data="item.treeOptions" clearable style="width: 180px" />
          <t-date-picker v-else-if="item.control === 'datetime' || item.control === 'date'" v-model="searchModel[item.name]" clearable style="width: 180px" />
          <!-- 日期范围（itemType=daterange / 搜索栏 DateTime 字段）：提交 dtStart/dtEnd（后端 Search 按 MasterTime 过滤） -->
          <t-date-range-picker v-else-if="item.control === 'daterange'" v-model="searchModel[item.name]" clearable style="width: 280px" />
          <t-date-range-picker v-else-if="item.control === 'datetimerange'" v-model="searchModel[item.name]" enable-time-picker clearable style="width: 320px" />
          <t-input-number v-else-if="item.control === 'number'" v-model="searchModel[item.name]" clearable style="width: 160px" />
          <!-- 邮箱（itemType=mail）：TDesign 无 type="email"（TdInputProps.type 联合里没有 email），
               格式校验由内置 `{ type:'email' }` 规则承担（铁律 R2），故此处用 type="text" -->
          <t-input v-else-if="item.control === 'email'" v-model="searchModel[item.name]" type="text" clearable placeholder="邮箱" style="width: 180px" />
          <!-- 手机号（itemType=mobile）：tel 输入 + 格式校验 -->
          <t-input v-else-if="item.control === 'tel'" v-model="searchModel[item.name]" type="tel" clearable placeholder="手机号" style="width: 180px" />
          <!-- 其余（html/textarea/image/input）搜索场景统一文本输入 -->
          <t-input v-else v-model="searchModel[item.name]" clearable style="width: 180px" />
        </t-form-item>
      </template>
      <!-- ▼ 覆盖点 L2：搜索栏扩展项（对标 MVC 分部视图覆盖，GetPage.search 表达不了的自定义搜索项） -->
      <slot name="search-extra" :model="searchModel" />
      <t-form-item>
        <t-space>
          <t-button theme="primary" type="submit">查询</t-button>
          <t-button theme="default" @click="onSearchReset">重置</t-button>
        </t-space>
      </t-form-item>
    </t-form>

    <!-- 工具栏（内联，对应魔方 MVC 的 _List_Toolbar.cshtml）：新增 / 批量删除，setting.enableToolbar 控制 -->
    <t-space v-if="toolbarVisible" class="cube-list-toolbar">
      <t-button v-if="canAdd" theme="primary" @click="onAdd">
        <template #icon><t-icon name="add" /></template>新增
      </t-button>
      <t-button v-if="canDelete && selectedKeys.length" theme="danger" @click="onBatchDelete">
        批量删除（{{ selectedKeys.length }}）
      </t-button>
      <!-- ▼ 覆盖点 L2：工具栏扩展按钮（对标 MVC 分部视图覆盖，用 res.loadData() 刷新） -->
      <slot name="toolbar-extra" :selected="selectedKeys" :reload="res.loadData" />
    </t-space>

    <!-- 普通表格（setting.enableSelect=true 显示选择列；enableTableDoubleClick=true 双击行打开详情） -->
    <t-table
      v-if="!isTree"
      row-key="id"
      table-layout="auto"
      :data="rows"
      :columns="columns"
      :loading="loading"
      :pagination="pagination"
      :selected-keys="showSelect ? selectedKeys : undefined"
      @select-change="onSelectChange"
      @page-change="onPageChange"
      @sort-change="onSortChange"
      @row-dblclick="enableTableDoubleClick ? (ctx: any) => onDetail(ctx?.row) : undefined"
    >
      <template #operation="{ row }">
        <t-space>
          <t-link v-if="canDetail" theme="default" @click="onDetail(row)">详情</t-link>
          <t-link v-if="canEdit" theme="primary" @click="onEdit(row)">编辑</t-link>
          <t-link v-if="canDelete" theme="danger" @click="onDelete(row)">删除</t-link>
          <slot name="row-actions" :row="row" />
        </t-space>
      </template>
    </t-table>

    <!-- 树形表格（list 含 ParentID 时自动切换）：
         TDesign 文档明确「树形结构的表格请使用 EnhancedTable，Table/PrimaryTable/BaseTable 不支持树形结构」。
         注意：EnhancedTable 以 `props.tree` 为**非空对象**判定树形（enhanced-table.mjs: isTreeData = !props.tree || !Object.keys(props.tree).length），
         故**只传 `:tree` 对象、不要同时写静态 `tree` 布尔**（避免 prop 合并歧义）。 -->
    <t-enhanced-table
      v-else
      row-key="id"
      table-layout="auto"
      :data="treeData"
      :columns="columns"
      :loading="loading"
      :tree="{ childrenKey: 'children', defaultExpandAll: true, treeNodeColumnIndex: 0 }"
      :selected-keys="showSelect ? selectedKeys : undefined"
      @select-change="onSelectChange"
      @sort-change="onSortChange"
      @row-dblclick="enableTableDoubleClick ? (ctx: any) => onDetail(ctx?.row) : undefined"
    >
      <template #operation="{ row }">
        <t-space>
          <t-link v-if="canDetail" theme="default" @click="onDetail(row)">详情</t-link>
          <t-link v-if="canEdit" theme="primary" @click="onEdit(row)">编辑</t-link>
          <t-link v-if="canDelete" theme="danger" @click="onDelete(row)">删除</t-link>
          <slot name="row-actions" :row="row" />
        </t-space>
      </template>
    </t-enhanced-table>

    <!-- 底部（内联，对应魔方 MVC 的 _List_Footer.cshtml）：统计行 + 记录数，setting.enableFooter 控制 -->
    <div v-if="footerVisible" class="cube-list-footer">
      <span v-if="pagination.total != null">共 {{ pagination.total }} 条</span>
      <span v-if="statText">{{ statText }}</span>
      <!-- ▼ 覆盖点 L2：底部扩展（对标 MVC 分部视图覆盖，统计补充说明 / 合计行） -->
      <slot name="footer-extra" />
    </div>

    <!-- 新增/编辑弹窗 -->
    <FormDialog
      v-if="dialogVisible"
      :area="area"
      :controller="controller"
      :schema="schema"
      :edit-id="editId"
      :row="editingRow"
      :lookups="effectiveLookups"
      :upload-url="uploadUrl"
      :lov-options="lovOptions"
      :lov-list-config="lovListConfig"
      @saved="onSaved"
      @close="dialogVisible = false"
    />

    <!-- 详情抽屉 -->
    <DetailDrawer
      v-if="detailVisible"
      :area="area"
      :controller="controller"
      :schema="schema"
      :id="detailId"
      :row="detailRow"
      :visible="detailVisible"
      :lookups="effectiveLookups"
      :lov-options="lovOptions"
      @close="detailVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  buildColumns,
  buildFormItems,
  buildFormRules,
  buildTree,
  formItemName,
  RESERVED_PARAMS,
  selectFormControl,
  selectListComponent,
} from '../../api/fieldRender';
import { camel, getRowKey, useEntityResource } from '../../api/useEntityResource';
import { MessagePlugin } from 'tdesign-vue-next';
// TDesign 官方类型从包根导入（铁律 R5）：t-form 的 @submit 回调是 SubmitContext，
// 不是自定义的 `{ validateResult?, firstError? }`。
import type { SubmitContext } from 'tdesign-vue-next';
import { useLookups, type LookupOverrides } from '../../api/useLookups';
import { useLov } from '../../api/useLov';
import FormDialog from './FormDialog.vue';
import DetailDrawer from './DetailDrawer.vue';
// 列表页四段结构（对标魔方 MVC 的 List.cshtml 分部视图）：
// Navbar（标题/路径）、SearchBar（查询条件）、Toolbar（新增/批量删除）、Footer（统计/记录数）
// —— 四段已按「公共组件层只保留被多处复用的组件」原则内联进本文件（见对应 script 分区）。

const props = defineProps<{
  area: string;
  controller: string;
  title?: string;
  /**
   * 外键关联源字典（宿主应用可直接注入，优先级最高）：{ Category: { "1": "类别A" } }。
   * 若未提供，ListPage 会按约定式 useLookups 自动拉取（见 useLookups.ts）。
   */
  lookups?: Record<string, Record<string, string>>;
  /** 关联源覆盖配置：自定义某基名对应的 area/controller/idField/nameField */
  lookupOverrides?: LookupOverrides;
  /**
   * 图像字段（itemType=image）上传端点；默认取 VITE_UPLOAD_URL，兜底 `/{area}/{controller}/UploadFile`
   * （NewLife.Cube 官方契约：POST form-data，字段名 file，返回信封 data.url；/api 前缀由 http 实例 baseURL 承载，勿重复）。
   */
  uploadUrl?: string;
  /**
   * 搜索参数名映射：{ 搜索项键 : 后端真实参数名 }（键由 `formItemName` 生成——映射字段用原始字段名，
   * 如 RoleName → roleID）。由本页 `buildSearchParams` 在拼装查询参数时应用。 */
  searchParamMap?: Record<string, string>;
  /**
   * 列表是否显示主键列（编号）。默认 true。
   * 注意：`GetPage.setting.enableKey` 的魔方语义是**关键字（Q）搜索框**，不是主键列，两者勿混用。
   */
  showIdColumn?: boolean;
}>();

const res = useEntityResource(props.area, props.controller);
const schema = computed(() => res.schema.value);

// 外键关联源字典：优先用宿主注入的 props.lookups，否则按约定式自动拉取（useLookups）
// ★ 第 3 参传当前控制器名：供 useLookups 解析**自引用外键**（树形 ParentID → 本实体自身）
const { lookups: autoLookups, load: loadLookups } = useLookups(
  props.area,
  props.lookupOverrides,
  props.controller,
);
// LovController 值集（枚举/列表型）：schema 字段的 lovCode 命中的权威值集，退化为约定式兜底
const { lovOptions, lovListConfig, load: loadLov } = useLov();
const effectiveLookups = computed(() => ({ ...autoLookups.value, ...(props.lookups ?? {}) }));
// 树形实体自构建的父子名称字典（id→name），键为 "Parent"（大小写不敏感，labelOf 内部兜底），
// 用于树表 ParentID 列回显父级名称（而非原始 ID 数值）
const selfLookups = ref<Record<string, Record<string, string>>>({});
// 列回显实际使用的字典：宿主注入 + 自动拉取 + 树形自构建
const columnLookups = computed(() => ({ ...effectiveLookups.value, ...selfLookups.value }));

// 顶层计算属性（避免模板里访问嵌套 ref）
const rows = computed(() => res.rows.value);
const error = computed(() => res.error.value);
const loading = computed(() => res.loading.value);
const stat = computed(() => res.stat.value);
const columns = computed(() => {
  // 关键：列定义只依赖 schema（字段集合），与字典分批到达解耦 → 数组引用稳定，列宽只算一次不抖；
  // 字典通过 getLookups() 在单元格渲染时按需读取（响应式），映射名称随后到达只更新单元格、不重建列。
  // 主键列（编号）显隐由独立 prop `showIdColumn` 控制（默认显示），
  // 注意：setting.enableKey 的魔方语义是「关键字搜索框」，与主键列无关，勿混用。
  const cols = buildColumns(
    res.schema.value?.list ?? [],
    () => columnLookups.value,
    props.showIdColumn !== false,
    () => lovOptions.value,
  );
  // 列表末尾追加操作列（若未由后端字段提供）：固定宽度并钉在右侧（fixed 列需明确 width 才能正确固定）
  if (!cols.some((c) => c.colKey === 'operation')) {
    cols.push({ colKey: 'operation', title: '操作', fixed: 'right', width: 120 });
  }
  return cols;
});
const treeData = computed(() => buildTree(res.rows.value));
const dialogVisible = ref(false);
const editId = ref<string | number | null>(null);
const detailVisible = ref(false);
const detailId = ref<string | number | null>(null);
// 当前操作的整行数据：详情/编辑优先复用，避免再请求不存在的单条详情接口
const editingRow = ref<any>(null);
const detailRow = ref<any>(null);
// init 幂等标志（同一挂载实例只加载一次）
let initialized = false;
// 详情为只读查看，非只读控制器下始终可看
const canDetail = computed(() => !readOnly.value);

// 列表组件选型（元数据驱动）：聚合全部字段组（list+addForm+editForm+detail+search）判定树形——
// ParentID 常不在 list 组（列表用 ParentName 映射列显示父级），只查 list 会漏判成平铺表。
const listComponent = computed(() =>
  selectListComponent([
    ...(res.schema.value?.list ?? []),
    ...(res.schema.value?.addForm ?? []),
    ...(res.schema.value?.editForm ?? []),
    ...(res.schema.value?.detail ?? []),
    ...(res.schema.value?.search ?? []),
  ]),
);
const isTree = computed(() => listComponent.value === 'tree');

// 树形实体：rows 变化（初始化 / 搜索 / 增删后）时重建 Parent(id→name) 字典，
// 供树表 ParentID 列回显父级名称（而非原始 ID）。非树形实体跳过，保持 selfLookups 为空。
// 变更守卫：仅当 Parent 字典内容真正变化才赋值，避免相同数据集重取时反复触发
// columnLookups → columns 重建（进而导致 TDesign 表格重渲染、列宽抖动）。
watch(
  () => res.rows.value,
  (rs) => {
    if (!isTree.value) return;
    const self: Record<string, string> = {};
    for (const r of rs) {
      const id = getRowKey(r);
      const nm = r.name ?? r.Name;
      if (id != null && nm != null) self[String(id)] = nm;
    }
    const prev = selfLookups.value.Parent ?? {};
    const changed =
      Object.keys(self).length !== Object.keys(prev).length ||
      Object.keys(self).some((k) => self[k] !== prev[k]);
    if (changed) selfLookups.value = { Parent: self };
  },
  { immediate: true },
);

// 权限/能力：以 GetPage.setting 为准（真实后端暴露的开关），前端只做 UX 显隐
const setting = computed(() => (res.schema.value?.setting as Record<string, any>) ?? {});
const readOnly = computed(() => setting.value.isReadOnly === true);
const canAdd = computed(() => !readOnly.value && setting.value.enableAdd !== false);
const canEdit = computed(() => !readOnly.value);
const canDelete = computed(() => !readOnly.value);
// setting 派生开关（GetPage.setting 各属性应用）：
//  - enableSelect：显示选择列（复选框）+ 批量删除
//  - enableTableDoubleClick：双击行打开详情
//  - enableFooter：显示表格底部统计行（分页由分页器自身控制）
//  - orderByKey：默认按主键排序（init 首次加载带 sort=ID）
const showSelect = computed(() => setting.value.enableSelect !== false);
const enableTableDoubleClick = computed(() => setting.value.enableTableDoubleClick !== false);
const enableFooter = computed(() => setting.value.enableFooter !== false);
const orderByKey = computed(() => setting.value.orderByKey === true);
// 勾选行主键集合（选择列）
const selectedKeys = ref<(string | number)[]>([]);
function onSelectChange(value: Array<string | number>) {
  selectedKeys.value = value ?? [];
}

// 分页（对齐 TDesign pagination 结构）。
// 关键：必须是稳定引用（reactive 对象原地变更），不能每次返回新对象的 computed ——
// 否则 TDesign t-table 每次重渲染都收到“新的 pagination 值”，会引发分页器反复重渲染/抖动，
// 在部分场景下表现为“进入列表页后页面多次自动刷新”。
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  pageSizeOptions: [10, 20, 50, 100],
  showJumper: true,
});
// 后端分页信息 → 稳定分页对象（原地赋值，引用不变）
watch(
  () => res.pagination.value,
  (pg) => {
    pagination.current = pg.current;
    pagination.pageSize = pg.pageSize;
    pagination.total = pg.total;
  },
  { immediate: true, deep: true },
);

// ============================================================================
// 工具栏（内联，对应魔方 MVC 的 _List_Toolbar.cshtml 分部视图）
// 按钮显隐由 GetPage.setting 驱动：enableToolbar / enableAdd / isReadOnly / enableSelect。
// ============================================================================
const toolbarVisible = computed(
  () =>
    setting.value.enableToolbar !== false &&
    (canAdd.value || (showSelect.value && canDelete.value && selectedKeys.value.length > 0)),
);

// ============================================================================
// 底部（内联，对应魔方 MVC 的 _List_Footer.cshtml 分部视图）
// 统计/合计行（Index 响应的 stat）+ 记录数摘要，由 setting.enableFooter 控制显隐。
// ============================================================================
const statText = computed(() => {
  const s = stat.value;
  if (!s) return '';
  if (typeof s === 'string') return `统计：${s}`;
  try {
    return `统计：${JSON.stringify(s)}`;
  } catch {
    return '统计：-';
  }
});
// 有统计行或有总记录数才显示（enableFooter=false 时整体隐藏）
const footerVisible = computed(() => enableFooter.value && (!!statText.value || pagination.total != null));

// ============================================================================
// 搜索栏（内联，对应魔方 MVC 的 _List_Search.cshtml 分部视图）
// GetPage.search 字段驱动；控件选型复用 buildFormItems（与表单页同源）；
// 查询参数拼装内聚 NewLife.Cube Search 契约（见 buildSearchParams）。
// ============================================================================
const searchFields = computed(() => res.schema.value?.search ?? []);
// 关键词框默认自带（setting.enableKey），故即使 search 组为空也应显示搜索栏；
// 仅当「无 search 字段」且「后端关闭关键字搜索」时才隐藏。
const showSearch = computed(() => searchFields.value.length > 0 || setting.value.enableKey !== false);
/** 搜索条件模型（键 = formItemName(f)，映射字段用原始字段名如 RoleName → roleID） */
const searchModel = reactive<Record<string, any>>({});
/** 搜索表单实例：供关键词框回车时手动触发内置校验（validate()） */
const searchFormRef = ref();
/** 关键词（全局模糊搜索 Q）：独立于 search 字段组，默认自带 */
const searchKeyword = ref('');
// 搜索项控件（复用表单控件选型，searchMode=true；字典/值集分批到达后自动重建）
const searchItems = computed(() => buildFormItems(searchFields.value, effectiveLookups.value, lovOptions.value, true));
/**
 * 搜索栏校验规则（元数据驱动，单源）：复用 buildFormRules，**不含必填规则**——搜索项均为可选；
 * 但 itemType=mail→`{type:'email'}`、itemType=mobile→`{telnumber:true}` 格式规则仍追加，
 * 输入非法格式时拦截查询（TDesign t-form 提交时自动校验，通过 @submit 的 firstError 判断是否放行）。
 */
const searchRules = computed(() => buildFormRules(searchFields.value, { required: false }));

/**
 * Search 参数契约（curl 实测）：
 *  - 数值/枚举/布尔/日期字段：字段参数直接过滤（parentID / enable / type，大小写不敏感）；
 *  - 字符串字段精确参数不生效（code=011、name=行政部 返回全量）→ 并入 Q 关键词模糊搜索；
 *  - 数组（多值外键）原样发；虚拟映射字段（User.RoleID）经 searchParamMap 映射。
 */
function buildSearchParams(): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  // 关键词优先（放在 Q 串最前），与字符串字段条件合并为一个 Q（空格分隔）
  const q: string[] = [];
  const kw = searchKeyword.value != null ? String(searchKeyword.value).trim() : '';
  if (kw) q.push(kw);
  for (const f of searchFields.value) {
    if (f.primaryKey || f.isIdentity) continue;
    let k = formItemName(f);
    const v = searchModel[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    // 日期范围 → dtStart/dtEnd（后端 ReadOnlyEntityController2.Search 统一按 MasterTime 过滤）。
    // 日期范围取值为 [start, end] 数组：日期型补 00:00:00 / 23:59:59 成当天闭区间；
    // 日期时间型（enable-time-picker）值已含时分秒，原样下发。
    const ctrl = selectFormControl(f);
    if (ctrl === 'daterange' || ctrl === 'datetimerange') {
      if (Array.isArray(v) && v.length === 2) {
        const s = v[0];
        const e = v[1];
        if (s) params['dtStart'] = ctrl === 'datetimerange' ? String(s) : `${s} 00:00:00`;
        if (e) params['dtEnd'] = ctrl === 'datetimerange' ? String(e) : `${e} 23:59:59`;
      }
      continue;
    }
    k = props.searchParamMap?.[k] ?? k;
    // ★ 保留字过滤：与 Q/分页/排序同名的业务字段（如 sort）若原样下发，后端会按
    //   排序参数解释 → 列表返回 0 行（实测）。宁可漏过滤，也不能把结果集打成空。
    if (RESERVED_PARAMS.has(String(k).toLowerCase())) continue;
    const tn = ((f.typeName ?? f.type ?? '') as string).toLowerCase();
    if (Array.isArray(v)) {
      params[k] = v;
    } else if (tn === 'string' || tn === 'text' || tn.includes('char')) {
      q.push(String(v));
    } else {
      params[k] = v;
    }
  }
  if (q.length) params.Q = q.join(' ');
  return params;
}

/**
 * 查询提交：TDesign t-form 提交时会自动按 :rules 校验，并把结果通过
 * `SubmitContext`（{ validateResult, firstError, e }）传给 @submit。
 * ⚠️ 铁律 R5：参数类型必须是官方 `SubmitContext`，写成自定义窄形状
 *    （如 `{ validateResult?: Record<string, any> }`）会因参数逆变检查失败 → TS2322。
 * FormValidateResult<T> = boolean | ValidateResultObj<T>，只有严格 === true 才算校验全过。
 */
function onSearchSubmit(ctx?: SubmitContext) {
  if (ctx?.validateResult !== true) return; // 校验未过（如邮箱/手机号格式非法），不发起查询
  onSearch(buildSearchParams());
}
/**
 * 关键词框回车：与「查询」按钮等价。因 t-input 的 @enter 与 t-form 的 @submit 签名不同，
 * 单独走此 handler：先调用 t-form 内置 validate()（复用 R2 的内置校验规则），通过后再查询。
 */
async function onSearchEnter() {
  const r = await searchFormRef.value?.validate?.();
  if (r !== true) return;
  onSearch(buildSearchParams());
}
/** 重置：清空全部条件（含关键词）后按无过滤条件重新加载 */
function onSearchReset() {
  for (const k of Object.keys(searchModel)) delete searchModel[k];
  searchKeyword.value = '';
  onSearch({});
}

function onSearch(params: Record<string, unknown> = {}) {
  // 树形列表：搜索同样基于完整数据集（loadAll）再重建树；非树形走常规分页
  if (isTree.value) res.loadAll(params);
  else {
    res.pagination.value = { ...res.pagination.value, current: 1 };
    res.loadData(params);
  }
}

// 翻页：页码/每页条数未变化则忽略，避免程序化重复触发导致的反复加载
function onPageChange(page: { current: number; pageSize: number }) {
  if (page.current === res.pagination.value.current && page.pageSize === res.pagination.value.pageSize) return;
  res.pagination.value = { ...res.pagination.value, current: page.current, pageSize: page.pageSize };
  res.loadData();
}

async function init() {
  // 幂等保护：避免同一挂载实例内因任何意外（重复 onMounted / 响应式副作用）重复加载
  if (initialized) return;
  initialized = true;
  try {
    await res.loadSchema();
    if (res.schema.value) {
      // 拉取所有字段组（list/form/detail/search）里出现的 xxxID 外键字典，不限于 list
      const sc = res.schema.value;
      const allFields = [
        ...(sc.list ?? []),
        ...(sc.addForm ?? []),
        ...(sc.editForm ?? []),
        ...(sc.detail ?? []),
        ...(sc.search ?? []),
      ];
      await loadLookups(allFields);
      // 枚举/列表型值集：lovCode 命中的字段经 LovController.Meta 拉取权威选项/配置，
      // LovController 不可达时静默跳过，退化为约定式 useLookups。
      await loadLov(allFields);
    }
    // 树形列表必须基于完整数据集构建（分页只取当前页会断链），故走 loadAll；否则常规分页
    if (isTree.value) await res.loadAll();
    // setting.orderByKey=true：默认按主键排序（升序），后端无自定义排序时生效
    else await res.loadData(orderByKey.value ? { sort: 'ID', desc: false } : undefined);
    // 列定义由 computed 随 schema / 字典（effectiveLookups / selfLookups）自动重建，无需手动赋值
  } catch (e: any) {
    res.error.value = '页面初始化失败：' + (e?.message ?? String(e));
  }
}

// 官方排序参数：?sort=字段&desc=true（或 ?orderBy=字段 desc 复合排序）
function onSortChange(sort: { sortBy: string; descending: boolean } | any) {
  // 树形列表：层级由父子关系决定，排序无意义；重载完整数据集保持树结构
  if (isTree.value) {
    res.loadAll();
    return;
  }
  const params: Record<string, unknown> = {};
  if (sort?.sortBy) {
    params.sort = sort.sortBy;
    params.desc = !!sort.descending;
  }
  res.loadData(params);
}
function onAdd() {
  editId.value = null;
  dialogVisible.value = true;
}
function onEdit(row: any) {
  const id = getRowKey(row);
  if (id == null) return;
  editId.value = id;
  editingRow.value = row;
  dialogVisible.value = true;
}
function onDetail(row: any) {
  const id = getRowKey(row);
  if (id == null) return;
  detailId.value = id;
  detailRow.value = row;
  detailVisible.value = true;
}
async function onDelete(row: any) {
  const id = getRowKey(row);
  if (id == null) return;
  const ok = await (window as any).confirm?.(`确认删除 ${row.name ?? row.Name ?? id} ?`) ?? true;
  if (!ok) return;
  const r = await res.remove(id);
  if (r.code === 0) {
    MessagePlugin.success('已删除');
    selectedKeys.value = selectedKeys.value.filter((k) => String(k) !== String(id));
    reloadAfterMutation();
  }
}

/**
 * 批量删除（setting.enableSelect=true 时可用）：逐个调用删除接口。
 * doubleDelete 语义由后端 setting.doubleDelete 表达，前端已用 confirm 二次确认。
 */
async function onBatchDelete() {
  if (!selectedKeys.value.length) return;
  const ok = await (window as any).confirm?.(`确认删除选中的 ${selectedKeys.value.length} 条记录 ?`) ?? true;
  if (!ok) return;
  let fail = 0;
  for (const id of selectedKeys.value) {
    const r = await res.remove(id);
    if (r.code !== 0) fail++;
  }
  selectedKeys.value = [];
  if (fail === 0) MessagePlugin.success('批量删除成功');
  else MessagePlugin.warning(`批量删除完成，${fail} 条失败`);
  reloadAfterMutation();
}
/**
 * 新增/编辑/删除后的重载：树形列表必须基于完整数据集重建（loadAll），
 * 否则分页只取当前页会让树断链（子节点找不到父节点 → 树塌成平铺）。
 */
function reloadAfterMutation() {
  if (isTree.value) res.loadAll();
  else res.loadData();
}
function onSaved() {
  dialogVisible.value = false;
  reloadAfterMutation();
}

onMounted(init);
defineExpose({ res, columns, isTree, listComponent });
</script>

<style scoped>
/* 页面容器：宽度自适应屏幕 + 允许收缩（min-width:0），
   避免被内部超宽表格顶宽把页面撑出屏幕（配合外层 .content 的 min-width:0）。 */
.cube-list-page { width: 100%; min-width: 0; }
.err-bar { margin-bottom: 12px; }

/* ---- 导航栏（内联，原 ListNavbar）---- */
.cube-list-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.nb-left { display: flex; align-items: center; gap: 10px; }
.nb-title { font-size: 16px; font-weight: 600; color: var(--td-text-color-primary); }

/* ---- 搜索栏 / 工具栏（内联，原 ListSearchBar / ListToolbar）---- */
.cube-search-bar { margin-bottom: 12px; }
.cube-list-toolbar { margin-bottom: 12px; }

/* ---- 底部（内联，原 ListFooter）---- */
.cube-list-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  color: var(--td-text-color-secondary);
  font-size: 13px;
}

/* 页面宽度自适应屏幕：TDesign `.t-table`（外层 div）默认 width:100%，
   但 table-layout:auto 下内部 <table> 宽度由内容决定——内容窄时表格不满容器、右侧留白。
   强制内部 table 铺满容器宽：内容需求 > 容器时被撑开（CSS 表不能窄于 min-content），
   `.t-table__content` 的 scrollWidth > clientWidth → TDesign 检测到溢出并启用自身横向滚动，
   配合操作列 fixed:'right' 的 sticky 定位，操作列始终钉在表格右缘。 */
.cube-list-page :deep(.t-table > table),
.cube-list-page :deep(.t-table .t-table__content table) {
  width: 100%;
}
</style>
