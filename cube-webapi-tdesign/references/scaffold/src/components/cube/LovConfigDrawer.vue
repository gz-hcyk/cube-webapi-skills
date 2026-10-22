<script setup lang="ts">
/**
 * LovConfigDrawer —— 值集完整配置抽屉（Admin/Lov 行「配置」）。
 *
 * 魔方值集（LovController）的配置由 4 张子表构成，MVC 版没有对应视图（只有 WebApi），
 * 故版式按 `references/mvc-page-organization.md` 的分区规范自建：
 * 一个抽屉 + 4 个分区 tab + 底部操作栏（保存 / 取消）。
 *
 * 端点（见 references/cube-page-catalog.md §4.5，`http` 已含 /api 前缀）：
 *   - 读全量：`GET  /Admin/Lov/GetConfig?id=`
 *   - 整份存回：`POST /Admin/Lov/SaveConfig`（**首选**，避免多处半提交）
 *   - 降级分存：`POST /Admin/Lov/BatchSaveEnumItems` / `SaveListConfig`
 *               / `BatchSaveSearchFields` / `BatchSaveTableColumns`
 *
 * 契约未实测的部分（响应键名大小写、子表字段名）一律双向兜底读取，
 * 并在 DEV 下用 DataProbe 摊开原始返回——不猜、静默空白是最贵的 bug。
 */
import { computed, ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getApi, postApi } from '../../api/http';
import DataProbe from './DataProbe.vue';

const props = defineProps<{
  visible: boolean;
  lovId: string | number;
  lovName?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

/** 枚举值子表行 */
interface EnumRow {
  value: string;
  label: string;
  extra?: string;
  sort?: number;
}
/** 搜索字段子表行 */
interface SearchRow {
  field: string;
  title: string;
  componentType?: string;
  paramType?: string;
  required?: boolean;
  sort?: number;
}
/** 表格列子表行 */
interface ColumnRow {
  field: string;
  title: string;
  width?: number;
  align?: string;
  sortable?: boolean;
  sort?: number;
}

const tab = ref<'enum' | 'list' | 'search' | 'column'>('enum');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const raw = ref<any>(null);

const enumRows = ref<EnumRow[]>([]);
const searchRows = ref<SearchRow[]>([]);
const columnRows = ref<ColumnRow[]>([]);
/** 列表配置（LIST 型值集的取数代理配置） */
const listConfig = ref<Record<string, any>>({});

/** 大小写宽容取值：后端可能回 PascalCase 或 camelCase */
function pick<T = any>(obj: any, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  // 最后做一次小写键匹配（防 snake_case / 全小写）
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const real = lower.get(k.toLowerCase());
    if (real && obj[real] !== undefined && obj[real] !== null) return obj[real] as T;
  }
  return undefined;
}

/** 归一化任意子表行到前端结构（值/标签/扩展三件套为最小公分母） */
function normEnumRows(arr: any[]): EnumRow[] {
  return (arr ?? []).map((o: any) => ({
    value: String(pick(o, 'value', 'Value', 'id', 'ID') ?? ''),
    label: String(pick(o, 'label', 'Label', 'text', 'Text', 'title', 'Title') ?? ''),
    extra: String(pick(o, 'extra', 'Extra') ?? ''),
    sort: Number(pick(o, 'sort', 'Sort', 'order', 'Order') ?? 0) || 0,
  }));
}
function normSearchRows(arr: any[]): SearchRow[] {
  return (arr ?? []).map((o: any) => ({
    field: String(pick(o, 'field', 'Field') ?? ''),
    title: String(pick(o, 'title', 'Title') ?? ''),
    componentType: String(pick(o, 'componentType', 'ComponentType') ?? ''),
    paramType: String(pick(o, 'paramType', 'ParamType') ?? ''),
    required: !!pick(o, 'required', 'Required'),
    sort: Number(pick(o, 'sort', 'Sort') ?? 0) || 0,
  }));
}
function normColumnRows(arr: any[]): ColumnRow[] {
  return (arr ?? []).map((o: any) => ({
    field: String(pick(o, 'field', 'Field') ?? ''),
    title: String(pick(o, 'title', 'Title') ?? ''),
    width: Number(pick(o, 'width', 'Width') ?? 0) || undefined,
    align: String(pick(o, 'align', 'Align') ?? ''),
    sortable: !!pick(o, 'sortable', 'Sortable'),
    sort: Number(pick(o, 'sort', 'Sort') ?? 0) || 0,
  }));
}

/** 拉全量配置 */
async function load() {
  if (!props.lovId && props.lovId !== 0) return;
  loading.value = true;
  error.value = '';
  try {
    const env = await getApi<any>('/Admin/Lov/GetConfig', { id: props.lovId });
    if (env.code !== 0) throw new Error(env.message || '加载失败');
    const d = env.data ?? {};
    raw.value = d;
    enumRows.value = normEnumRows(pick<any[]>(d, 'options', 'Options', 'enumItems', 'EnumItems') ?? []);
    searchRows.value = normSearchRows(pick<any[]>(d, 'searchFields', 'SearchFields') ?? []);
    columnRows.value = normColumnRows(pick<any[]>(d, 'tableColumns', 'TableColumns') ?? []);
    listConfig.value = { ...(pick<Record<string, any>>(d, 'listConfig', 'ListConfig') ?? {}) };
  } catch (e: any) {
    error.value = e?.message || '加载值集配置失败';
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.visible, props.lovId],
  ([v]) => {
    if (v) {
      tab.value = 'enum';
      load();
    }
  },
  { immediate: true },
);

/* ----------------------------- 可编辑表格的增删 ----------------------------- */
function addEnum() {
  enumRows.value.push({ value: '', label: '', extra: '', sort: enumRows.value.length + 1 });
}
function addSearch() {
  searchRows.value.push({ field: '', title: '', componentType: 'input', paramType: '', required: false, sort: searchRows.value.length + 1 });
}
function addColumn() {
  columnRows.value.push({ field: '', title: '', width: undefined, align: 'left', sortable: false, sort: columnRows.value.length + 1 });
}
function removeAt(arr: { value?: any }[] | any[], i: number) {
  (arr as any[]).splice(i, 1);
}

/* ----------------------------- 保存 ----------------------------- */
/**
 * 保存：**只走整份 `POST Lov/SaveConfig`**（实测 6.15.2026.901 存在，形参 `JsonDocument body`）。
 *
 * ★ 实测纠正：catalog 里提到的 `BatchSaveEnumItems` / `SaveListConfig` /
 *   `BatchSaveSearchFields` / `BatchSaveTableColumns` 四个分存端点在 6.15 **并不存在**
 *   （Lov 控制器共 16 个动作，无 Batch 系列）。故不做「失败后逐子表保存」的降级——
 *   那只会把一次明确失败变成四次 404，且让用户误以为部分成功。
 */
async function save() {
  saving.value = true;
  try {
    const env = await postApi<any>('/Admin/Lov/SaveConfig', {
      // 整份回传：后端按 JsonDocument 接收，冗余带上 id 便于定位
      id: props.lovId,
      options: enumRows.value,
      listConfig: listConfig.value,
      searchFields: searchRows.value,
      tableColumns: columnRows.value,
    });
    if (env.code !== 0) throw new Error(env.message || '保存失败');
    MessagePlugin.success('值集配置已保存');
    emit('saved');
    emit('close');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

/* ----------------------------- 表格列定义 ----------------------------- */
const enumColumns = [
  { colKey: 'value', title: '值', width: 160 },
  { colKey: 'label', title: '标签', width: 160 },
  { colKey: 'extra', title: '扩展信息', width: 160 },
  { colKey: 'sort', title: '排序', width: 90 },
  { colKey: 'op', title: '操作', width: 70 },
];
const searchColumns = [
  { colKey: 'field', title: '字段', width: 150 },
  { colKey: 'title', title: '标题', width: 150 },
  { colKey: 'componentType', title: '组件类型', width: 130 },
  { colKey: 'paramType', title: '参数类型', width: 120 },
  { colKey: 'required', title: '必填', width: 70 },
  { colKey: 'sort', title: '排序', width: 80 },
  { colKey: 'op', title: '操作', width: 70 },
];
const columnColumns = [
  { colKey: 'field', title: '字段', width: 150 },
  { colKey: 'title', title: '标题', width: 150 },
  { colKey: 'width', title: '宽度', width: 90 },
  { colKey: 'align', title: '对齐', width: 90 },
  { colKey: 'sortable', title: '可排序', width: 80 },
  { colKey: 'sort', title: '排序', width: 80 },
  { colKey: 'op', title: '操作', width: 70 },
];

/** 列表配置表单字段（对齐 LovListMeta.listConfig 的六项 + 代理开关） */
const listFields = [
  { key: 'requestUrl', label: '取数地址', placeholder: '/api/Lab/LabAsset/GetPage' },
  { key: 'method', label: '请求方法', placeholder: 'GET / POST' },
  { key: 'pageNumField', label: '页码参数名', placeholder: 'pageIndex' },
  { key: 'pageSizeField', label: '页大小参数名', placeholder: 'pageSize' },
  { key: 'dataPath', label: '数据路径', placeholder: 'data' },
  { key: 'totalPath', label: '总数路径', placeholder: 'total' },
];

const drawerTitle = computed(() => (props.lovName ? `值集配置 · ${props.lovName}` : '值集配置'));
</script>

<template>
  <t-drawer
    :visible="visible"
    :header="drawerTitle"
    :size="'960px'"
    :footer="false"
    destroy-on-close
    @close="emit('close')"
  >
    <div class="lov-cfg">
      <t-alert v-if="error" theme="error" :message="error" class="cfg-err" />

      <t-tabs v-model="tab" :disabled="loading">
        <!-- ① 枚举值 -->
        <t-tab-panel value="enum" label="枚举值">
          <div class="cfg-toolbar">
            <t-button size="small" variant="outline" @click="addEnum">
              <template #icon><t-icon name="add" /></template>新增枚举项
            </t-button>
            <span class="cfg-tip">值存库、标签显示；排序决定下拉顺序。</span>
          </div>
          <t-table row-key="value" size="small" :data="enumRows" :columns="enumColumns" table-layout="auto">
            <template #value="{ row }"><t-input v-model="row.value" size="small" placeholder="如 1" /></template>
            <template #label="{ row }"><t-input v-model="row.label" size="small" placeholder="显示文案" /></template>
            <template #extra="{ row }"><t-input v-model="row.extra" size="small" placeholder="可选" /></template>
            <template #sort="{ row }"><t-input-number v-model="row.sort" size="small" theme="normal" /></template>
            <template #op="{ rowIndex }"><t-link theme="danger" @click="removeAt(enumRows, rowIndex)">删除</t-link></template>
          </t-table>
        </t-tab-panel>

        <!-- ② 列表配置 -->
        <t-tab-panel value="list" label="列表配置">
          <div class="cfg-toolbar">
            <span class="cfg-tip">LIST 型值集的取数方式：直连地址或经值集代理。</span>
          </div>
          <t-form label-align="right" label-width="130px" class="cfg-form">
            <t-form-item v-for="f in listFields" :key="f.key" :label="f.label">
              <t-input v-model="listConfig[f.key]" :placeholder="f.placeholder" />
            </t-form-item>
            <t-form-item label="启用分页">
              <t-switch v-model="listConfig.pageable" />
            </t-form-item>
            <t-form-item label="经服务端代理">
              <t-switch v-model="listConfig.proxyRequest" />
              <span class="cfg-tip cfg-tip-inline">开启后走值集代理取数，适合跨域或需鉴权的数据源。</span>
            </t-form-item>
          </t-form>
        </t-tab-panel>

        <!-- ③ 搜索字段 -->
        <t-tab-panel value="search" label="搜索字段">
          <div class="cfg-toolbar">
            <t-button size="small" variant="outline" @click="addSearch">
              <template #icon><t-icon name="add" /></template>新增搜索项
            </t-button>
          </div>
          <t-table row-key="field" size="small" :data="searchRows" :columns="searchColumns" table-layout="auto">
            <template #field="{ row }"><t-input v-model="row.field" size="small" /></template>
            <template #title="{ row }"><t-input v-model="row.title" size="small" /></template>
            <template #componentType="{ row }"><t-input v-model="row.componentType" size="small" /></template>
            <template #paramType="{ row }"><t-input v-model="row.paramType" size="small" /></template>
            <template #required="{ row }"><t-switch v-model="row.required" size="small" /></template>
            <template #sort="{ row }"><t-input-number v-model="row.sort" size="small" theme="normal" /></template>
            <template #op="{ rowIndex }"><t-link theme="danger" @click="removeAt(searchRows, rowIndex)">删除</t-link></template>
          </t-table>
        </t-tab-panel>

        <!-- ④ 表格列 -->
        <t-tab-panel value="column" label="表格列">
          <div class="cfg-toolbar">
            <t-button size="small" variant="outline" @click="addColumn">
              <template #icon><t-icon name="add" /></template>新增列
            </t-button>
          </div>
          <t-table row-key="field" size="small" :data="columnRows" :columns="columnColumns" table-layout="auto">
            <template #field="{ row }"><t-input v-model="row.field" size="small" /></template>
            <template #title="{ row }"><t-input v-model="row.title" size="small" /></template>
            <template #width="{ row }"><t-input-number v-model="row.width" size="small" theme="normal" /></template>
            <template #align="{ row }">
              <t-select v-model="row.align" size="small" :options="[{ value: 'left', label: '左' }, { value: 'center', label: '中' }, { value: 'right', label: '右' }]" />
            </template>
            <template #sortable="{ row }"><t-switch v-model="row.sortable" size="small" /></template>
            <template #sort="{ row }"><t-input-number v-model="row.sort" size="small" theme="normal" /></template>
            <template #op="{ rowIndex }"><t-link theme="danger" @click="removeAt(columnRows, rowIndex)">删除</t-link></template>
          </t-table>
        </t-tab-panel>
      </t-tabs>

      <!-- 契约探针：GetConfig 的真实结构（仅 DEV） -->
      <DataProbe :data="raw" label="GetConfig 响应结构" />
    </div>

    <!-- 操作栏：保存 / 取消（对齐 MVC .profile-actions 的居中双按钮） -->
    <div class="cfg-actions">
      <t-button theme="primary" :loading="saving" @click="save">保存</t-button>
      <t-button theme="default" :disabled="saving" @click="emit('close')">取消</t-button>
    </div>
  </t-drawer>
</template>

<style scoped>
.lov-cfg { min-height: 320px; }
.cfg-err { margin-bottom: 12px; }
.cfg-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.cfg-tip { font-size: 12px; color: var(--td-text-color-placeholder); }
.cfg-tip-inline { margin-left: 12px; }
.cfg-form { max-width: 640px; }
.cfg-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--td-component-stroke);
}
</style>
