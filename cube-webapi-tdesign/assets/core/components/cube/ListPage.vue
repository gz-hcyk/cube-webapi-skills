<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue'
import { MessagePlugin, DialogPlugin, Link, Space } from 'tdesign-vue-next'
import { useEntityResource } from '@/api/useEntityResource'
import { useLookups } from '@/api/useLookups'
import { buildColumns, buildFormItems, buildSearchItems, buildSearchParams, DataField } from '@/api/fieldRender'
import { titleOf } from '@/api/menuTitles'
import FormDialog from './FormDialog.vue'
import DetailDrawer from './DetailDrawer.vue'

/** 行级自定义操作（技能 §4.13.1 rowActions 扩展点，追加在 详情/编辑/删除 之后）。
 * 每行是否显示可由 visible 按行数据决定（如文章列表按 status 组织按钮）。 */
export interface RowAction {
  text: string
  theme?: 'primary' | 'danger' | 'warning' | 'success' | 'default'
  /** 按行决定是否显示该按钮；缺省恒显示 */
  visible?: (row: any) => boolean
  handler: (row: any) => void
}

const props = defineProps<{
  area: string
  controller: string
  title?: string
  readOnly?: boolean
  extra?: Record<string, any>
  /** 自定义单元格渲染：键 = camelCase 字段名（status/isTop/…），值 (h, params) => VNode */
  cellRenders?: Record<string, (h: any, params: any) => any>
  /** 行级业务操作（发布/下线/置顶…）追加在操作列末尾 */
  rowActions?: RowAction[]
  /** 新增跳独立路由（超基类表单，如富文本文章编辑）；缺省用通用 FormDialog 弹窗 */
  addTo?: () => void
  /** 编辑跳独立路由；缺省用通用 FormDialog 弹窗 */
  editTo?: (row: any) => void
  /** 是否隐藏新增入口（配合按钮权限/只读场景） */
  hideAdd?: boolean
  /** 编辑按钮按行显隐（如已发布文章禁止编辑）；缺省恒显示 */
  editVisible?: (row: any) => boolean
  /** 删除按钮按行显隐（如已发布文章禁止删除）；缺省恒显示 */
  deleteVisible?: (row: any) => boolean
}>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const res = useEntityResource(() => props.area, () => props.controller)
const { lookups, load: loadLookups } = useLookups()
const q = ref('')
/** 结构化搜索模型：键为 search 字段的 camel 名，提交时按 buildSearchParams 分流 */
const searchModel = ref<Record<string, any>>({})
const formVisible = ref(false)
const detailVisible = ref(false)
const editRow = ref<any>(null)
const detailRow = ref<any>(null)
const initialized = ref(false)
/** 表单模式决定用 addForm 还是 editForm 字段集（后端已按场景裁剪） */
const formMode = ref<'add' | 'edit'>('add')

const listFields = computed<DataField[]>(() => res.schema.value.list)
const searchFields = computed<DataField[]>(() => res.schema.value.search)

function paramsWith(p?: any): any {
  return { ...(props.extra || {}), ...(p || {}) }
}

const columns = computed(() => {
  const cols = buildColumns(listFields.value, () => lookups.value)
  // 自定义 cellRenders 覆盖（键 = camelCase 字段名，如 status → 业务状态 Tag）
  if (props.cellRenders) {
    for (const c of cols) {
      const render = props.cellRenders[c.colKey]
      if (render) c.cell = (hh: any, params: any) => render(hh, params)
    }
  }
  // 操作列：动作描述统一带 visible(row)（详情恒显；编辑/删除走 prop；rowActions 自带）
  const actionDefs: any[] = [
    { text: '详情', handler: (row: any) => openDetail(row), visible: () => true },
  ]
  if (!isReadOnly.value) {
    if (props.editTo) {
      actionDefs.push({ text: '编辑', handler: (row: any) => props.editTo!(row), visible: props.editVisible || (() => true) })
    } else {
      actionDefs.push({ text: '编辑', handler: (row: any) => openEdit(row), visible: props.editVisible || (() => true) })
    }
    actionDefs.push({ text: '删除', handler: (row: any) => onDelete(row), visible: props.deleteVisible || (() => true) })
  }
  for (const ra of props.rowActions || []) {
    actionDefs.push({ text: ra.text, theme: ra.theme, handler: ra.handler, visible: ra.visible || (() => true) })
  }
  cols.push({
    colKey: 'operate',
    title: '操作',
    width: 280, // 固定较宽：行内按钮按状态显隐，避免固定估算偏窄
    fixed: 'right',
    cell: (_h: any, params: any) => {
      const row = params?.row
      const visible = actionDefs.filter((it) => it.visible(row))
      return h(
        Space,
        { size: 10 },
        visible.map((it) =>
          h(
            Link,
            {
              theme: (it.theme as any) || 'primary',
              hover: 'color',
              onClick: () => it.handler(row),
            },
            () => it.text,
          ),
        ),
      )
    },
  })
  return cols
})

const searchItems = computed(() => buildSearchItems(searchFields.value, lookups.value))
const hasSearch = computed(() => searchItems.value.length > 0)
const formItems = computed(() =>
  formMode.value === 'edit'
    ? buildFormItems(res.schema.value.editForm, lookups.value)
    : buildFormItems(res.schema.value.addForm, lookups.value),
)
const detailFields = computed<DataField[]>(() => res.schema.value.detail)
const isReadOnly = computed(() => props.readOnly === true || res.setting.value?.isReadOnly === true)
const canAdd = computed(() => !props.hideAdd && res.setting.value?.enableAdd === true && !isReadOnly.value)
/** 页面标题：显式 title > 后端菜单 displayName（权威） > 控制器名 */
const pageTitle = computed(
  () => props.title || titleOf(props.area, props.controller) || props.controller,
)

function rowKey(row: any): any {
  return row?.id ?? row?.ID ?? row?.Id
}

async function init() {
  if (initialized.value) return
  initialized.value = true
  await res.loadSchema()
  // 外键字典的目标字段可能只出现在 list/search/addForm/editForm 之一，四组一起喂
  await loadLookups(props.area, [
    ...listFields.value,
    ...searchFields.value,
    ...res.schema.value.addForm,
    ...res.schema.value.editForm,
  ])
  await res.loadData(paramsWith())
}

/** 关键字与结构化条件合并：字符串类走 Q，其余走字段参数（见 buildSearchParams） */
function collectSearch(): Record<string, any> {
  const p = buildSearchParams(searchItems.value, searchModel.value)
  if (q.value) p.Q = p.Q ? `${p.Q} ${q.value}` : q.value
  return p
}

function onSearch() {
  res.pagination.current = 1
  res.loadData(paramsWith(collectSearch()))
}

function onReset() {
  q.value = ''
  searchModel.value = {}
  res.pagination.current = 1
  res.loadData(paramsWith())
}

function onPageChange(pg: any) {
  if (pg.current === res.pagination.current && pg.pageSize === res.pagination.pageSize) return
  res.pagination.current = pg.current
  res.pagination.pageSize = pg.pageSize
  res.loadData(paramsWith(collectSearch()))
}

function openAdd() {
  if (props.addTo) {
    props.addTo()
    return
  }
  formMode.value = 'add'
  editRow.value = null
  formVisible.value = true
}
function openEdit(row: any) {
  if (props.editTo) {
    props.editTo(row)
    return
  }
  formMode.value = 'edit'
  editRow.value = row
  formVisible.value = true
}
function openDetail(row: any) {
  detailRow.value = row
  detailVisible.value = true
}

async function onDelete(row: any) {
  const id = rowKey(row)
  const confirm = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除该记录（ID=${id}）？`,
    theme: 'danger',
    onConfirm: async () => {
      try {
        await res.remove(id)
        MessagePlugin.success('删除成功')
        confirm.hide()
        res.loadData(paramsWith(collectSearch()))
      } catch (e: any) {
        MessagePlugin.error(e?.message || '删除失败')
      }
    },
  })
}

async function onSaved() {
  formVisible.value = false
  res.pagination.current = 1
  await res.loadData(paramsWith(collectSearch()))
  emit('saved')
}

/** 宿主可用 ref 调 reload()（rowActions 自定义操作后刷新列表） */
defineExpose({ reload: () => res.loadData(paramsWith(collectSearch())) })

onMounted(init)
watch(
  () => [props.area, props.controller, props.readOnly, props.extra],
  () => {
    initialized.value = false
    res.rows.value = []
    searchModel.value = {}
    q.value = ''
    init()
  },
)
</script>

<template>
  <div class="cube-list-page">
    <div class="lp-head">
      <h3 class="lp-title">{{ pageTitle }}</h3>
      <div class="lp-tools">
        <t-input
          v-if="res.setting.value?.enableKey"
          v-model="q"
          placeholder="关键字搜索"
          clearable
          style="width: 200px"
          @enter="onSearch"
          @clear="onSearch"
        />
        <t-button v-if="res.setting.value?.enableKey" theme="default" @click="onSearch">搜索</t-button>
        <t-button v-if="hasSearch" theme="default" variant="outline" @click="onReset">重置</t-button>
        <t-button v-if="canAdd" theme="primary" @click="openAdd">{{ addTo ? '新增' : '新增' }}</t-button>
      </div>
    </div>

    <!-- 结构化搜索栏：字段集来自 GetPage.search（给出的就是后端真实查询参数名） -->
    <div v-if="hasSearch" class="lp-search">
      <t-form :data="searchModel" layout="inline" @submit="onSearch">
        <template v-for="it in searchItems" :key="it.key">
          <t-form-item :label="it.label">
            <t-select
              v-if="it.control === 'select' || it.control === 'multi-select'"
              v-model="searchModel[it.key]"
              :options="it.options"
              :multiple="it.multiple"
              clearable
              filterable
              style="width: 180px"
              :placeholder="`请选择${it.label}`"
            />
            <t-switch v-else-if="it.control === 'switch'" v-model="searchModel[it.key]" @change="onSearch" />
            <t-input-number
              v-else-if="it.control === 'number'"
              v-model="searchModel[it.key]"
              theme="column"
              style="width: 160px"
            />
            <t-date-picker
              v-else-if="it.control === 'date'"
              v-model="searchModel[it.key]"
              value-type="YYYY-MM-DD HH:mm:ss"
              style="width: 200px"
            />
            <t-input v-else v-model="searchModel[it.key]" clearable style="width: 180px" :placeholder="`请输入${it.label}`" />
          </t-form-item>
        </template>
        <t-form-item>
          <t-button theme="primary" variant="outline" type="submit">筛选</t-button>
        </t-form-item>
      </t-form>
    </div>

    <t-alert
      v-if="res.schemaError.value || res.error.value"
      theme="warning"
      :message="res.schemaError.value || res.error.value"
      style="margin-bottom: 12px"
    />

    <t-table
      row-key="id"
      :data="res.rows.value"
      :columns="columns"
      :loading="res.loading.value"
      :pagination="{
        current: res.pagination.current,
        pageSize: res.pagination.pageSize,
        total: res.pagination.total,
        showJumper: true,
        pageSizeOptions: [10, 20, 50, 100],
      }"
      table-layout="auto"
      stripe
      hover
      @page-change="onPageChange"
    >
      <template #empty>
        <span>{{ res.error.value ? '加载失败' : '暂无数据' }}</span>
      </template>
    </t-table>

    <FormDialog
      v-model:visible="formVisible"
      :resource="res"
      :fields="formMode === 'edit' ? res.schema.value.editForm : res.schema.value.addForm"
      :items="formItems"
      :lookups="lookups"
      :edit-row="editRow"
      @saved="onSaved"
    />
    <DetailDrawer
      v-model:visible="detailVisible"
      :resource="res"
      :fields="detailFields"
      :row="detailRow"
      :lookups="lookups"
    />
  </div>
</template>

<style scoped>
.cube-list-page {
  width: 100%;
  min-width: 0;
}
.lp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.lp-title {
  margin: 0;
  font-size: 18px;
}
.lp-tools {
  display: flex;
  gap: 8px;
  align-items: center;
}
.lp-search {
  margin-bottom: 12px;
  padding: 12px 12px 0;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  border-radius: 6px;
}
.cube-list-page :deep(.t-table > table),
.cube-list-page :deep(.t-table .t-table__content table) {
  width: 100%;
}
</style>
