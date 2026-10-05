<template>
  <t-dialog
    :visible="dialogVisible"
    :header="dialogTitle"
    width="760px"
    top="5vh"
    :close-on-overlay-click="false"
    :destroy-on-close="true"
    @update:visible="onVisibleChange"
  >
    <!-- 搜索栏：按 lovMeta.searchFields 渲染（input / select / lov / datepicker） -->
    <div v-if="searchFields.length > 0" class="llf-search">
      <template v-for="f in searchFields" :key="f.field">
        <t-select
          v-if="f.componentType === 'select' || f.componentType === 'lov'"
          v-model="searchParams[f.field]"
          :placeholder="f.title"
          clearable
          class="llf-search__ctl"
          :options="optionsOf(f)"
        />
        <t-date-picker
          v-else-if="f.componentType === 'datepicker'"
          v-model="searchParams[f.field]"
          :placeholder="f.title"
          clearable
          class="llf-search__ctl"
        />
        <t-input
          v-else
          v-model="searchParams[f.field]"
          :placeholder="f.title"
          clearable
          class="llf-search__ctl"
        />
      </template>
      <t-button theme="primary" size="small" @click="onSearch">搜索</t-button>
      <t-button variant="outline" size="small" @click="onReset">重置</t-button>
    </div>

    <!--
      数据表格：选择能力由 TDesign 内置 row-select 列提供
        · 多选 → type="multiple"（复选框，跨页由 reserveSelectedRowOnPaginate 保留）
        · 单选 → type="single"（radio，一眼区分交互模式）
      受控模式（:selected-row-keys + @select-change）——勾选视图完全由本组件的
      selectedKeys 派生，不存在"视图反写权威集合"的通道，故无需参考实现的
      restoringSelection 守卫（详见文件头注释第 1 条）。
    -->
    <t-table
      row-key="__key"
      :data="tableData"
      :columns="columns"
      :loading="tableLoading"
      :selected-row-keys="selectedKeys"
      :select-on-row-click="false"
      :pagination="pageable ? pagination : undefined"
      hover
      table-layout="auto"
      :row-class-name="rowClassName"
      @select-change="onSelectChange"
      @row-click="onRowClick"
      @page-change="onPageChange"
    >
      <template v-for="col in dataColumns" :key="col.colKey" #[col.colKey]="cell">
        <span>{{ textOf(cell.row, col) }}</span>
      </template>
      <template #empty>
        <span>{{ errorMsg || '暂无数据' }}</span>
      </template>
    </t-table>

    <template #footer>
      <div class="llf-footer">
        <span class="llf-count">已选 {{ selectedCountText }}</span>
        <t-space size="small">
          <t-button variant="outline" @click="close">取消</t-button>
          <t-button v-if="multiple" theme="primary" @click="onConfirm">确定</t-button>
        </t-space>
      </div>
    </template>
  </t-dialog>
</template>

<script lang="ts">
/** 自定义取数上下文（传给 `fetcher` prop） */
export interface LovFetchContext {
  lovCode: string
  params: Record<string, any>
  pageIndex: number
  pageSize: number
}
</script>

<script setup lang="ts">
/**
 * LovListField —— LIST 型值集（列表型值集）表格选择弹窗 · TDesign Vue Next 版
 * 落地路径：src/components/cube/LovListField.vue（配合 src/api/useLov.ts）
 *
 * 移植自 NewLife.Cube 官方 Element Plus 实现 `LovSelectTable.vue`（461 行），
 * 按 TDesign 惯例重写，并保留原实现的全部功能契约：
 *   搜索栏(searchFields) / 单选·多选两种选择列 / 分页 / 底部「已选 N 项」统计 /
 *   取消·确定 / 打开时按 modelValue 回显 / refLovCode 列字典翻译。
 *
 * ⚠️ 与原实现的关键差异（★ 都是刻意的，请勿"照抄"回 Element Plus 写法）：
 *
 * 1) **无需 restoringSelection 守卫**。原实现踩过的坑是：`restoreSelection` 用
 *    `toggleRowSelection()` 重放勾选时，el-table 的 `@selection-change` 只上报
 *    "本次重放的当前页行"，把权威集合 `selectedValues`（含跨页/未加载项）裁剪掉，
 *    导致「翻页后已选数不对 / 点了才更新」。TDesign 的选择列是**受控**的：
 *    勾选视图完全由 `:selected-row-keys="selectedKeys"` 派生，`@select-change`
 *    只在真实用户操作时触发，**不存在"程序化回填 → 事件回抛"的通道**，
 *    因此该 bug 类在 TDesign 版结构上不成立（`selectedKeys` 恒为唯一真相源）。
 *
 * 2) **单选用第三参 `type: 'single'`**（TDesign PrimaryTableCol 原生支持），
 *    不手写 radio 列——少一层手写状态，天然互斥。
 *
 * 3) **分页用 `t-table` 内置 `:pagination` + `@page-change`**（与技能 ListPage 一致），
 *    不另起 `t-pagination`；`listConfig.pageable` 为假时不传，分页区自动消失。
 *    `pagination` 必须是**稳定 reactive 对象**（技能 checklist：每次 render 新建字面量
 *    会让表格内部重算当前页 → 翻页回弹）。
 *
 * 4) **行点击事件是单 context 对象** `{ row, index, e }`，不是 `(e, ctx)` 双参——
 *    写成双参会 `ctx === undefined`，点行永远选不中（见 references/troubleshooting.md G9）。
 *
 * 5) **字符串搜索走 `Q` 关键词**（技能实测契约：字符串走 Q，数值/枚举/日期走字段参数），
 *    与 `fieldRender.buildSearchParams` 同源；原实现把所有搜索项都当字段参数下发。
 *
 * 6) **选中即自关闭**：单选 `pickRow`、多选 `onConfirm` 都在 emit 后 `close()`；
 *    官方实现只 emit，关闭完全交给父组件（`@update:dialogVisible`）。本组件内聚关闭
 *    以免"忘了关"，如需恢复"父组件决定关闭"契约，删掉 `pickRow` / `onConfirm` 里的 `close()` 即可。
 *
 * 7) **事件负载带展示名**：`select` 下发 `{ row, display }`、`confirm` 下发
 *    `{ values, rows, display }`（官方仅下发裸 row / values）。宿主若只关心 id，
 *    取 `payload.row` / `payload.values` 即可；如需在只读框显示「名称」而非 id，
 *    直接用 `payload.display`。`display` 由本组件依 `meta.labelField` 解析。
 *
 * 数据来源（二选一）：
 *   · 默认走 `listConfig`：`requestUrl` 以 `/` 开头 → 前端直连 getApi；
 *     否则按 `proxyRequest` 决定是否走 `POST /api/Admin/Lov/ListData` 服务端代理。
 *   · 传入 `fetcher` → 完全接管取数（单测 / 无后端演示 / 非标准数据源）。
 *
 * 展示名（id→名称）：组件按 `meta.labelField`（缺省 `name`）从行数据取标签，
 * 并随 `select` / `confirm` 一并下发（`display` 串 + `rows` 行对象），供宿主把只读
 * 输入框从「原始 id」渲染为「名称」。宿主把 `rows` 存下来即可在编辑态还原名称，
 * 组件内部的行缓存（`rowPool`）保证跨页已选项也能解析出标签。
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { camelFieldName } from '@/utils/camel'
import { lovFetchRows, type LovListMeta, type LovOption } from '@/api/useLov'

defineOptions({ name: 'LovListField' })

/** 行点击上下文（TDesign 为单对象，非 (e, ctx) 双参） */
interface RowEventCtx {
  row: Record<string, any>
  index: number
}
/** 选择变更的 options 参数（只用到 currentRowData） */
interface SelectOptionsLike {
  currentRowData?: Record<string, any>
  currentRowKey?: string | number
  type?: 'check' | 'uncheck'
}

const props = withDefaults(
  defineProps<{
    /** 弹窗可见（受控），关闭时 emit `update:dialogVisible=false` */
    dialogVisible: boolean
    /** 值集编码，如 `List.Asset.Warehouse` */
    lovCode: string
    /** `useLov().lovListConfig[lovCode]` 归一化后的元数据；为空只渲染空表 */
    lovMeta?: LovListMeta | null
    /** 搜索栏 select / lov 型字段的候选（`refLovCode` → 选项）；缺省退化为文本输入 */
    inlineEnums?: Record<string, LovOption[]>
    /** 多选：确认后 emit `confirm({values,rows,display})`；单选：行选中即 emit `select({row,display})` 并关闭 */
    multiple?: boolean
    /** 已选值：多选为 `string[]` 或逗号分隔串，单选为单值；用于打开时回显 */
    modelValue?: string | number | string[] | undefined
    /** 自定义取数（可选逃生舱）：传了就接管数据加载，不再走 listConfig */
    fetcher?: (ctx: LovFetchContext) => Promise<{ rows: any[]; total: number }>
  }>(),
  {
    lovMeta: null,
    inlineEnums: () => ({}),
    multiple: false,
    modelValue: undefined,
    fetcher: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:dialogVisible', value: boolean): void
  (e: 'select', payload: { row: Record<string, any>; display: string }): void
  (e: 'confirm', payload: { values: string[]; rows: Record<string, any>[]; display: string }): void
}>()

/* ───────────────────────── 从 meta 读取配置 ───────────────────────── */
const searchFields = computed(() => props.lovMeta?.searchFields || [])
const tableColumns = computed(() => props.lovMeta?.tableColumns || [])
const valueField = computed(() => props.lovMeta?.valueField || 'id')
/** 展示字段（id→名称）：后端 LabelField 可能 PascalCase（`Name`），readField 已做大小写宽容 */
const labelField = computed(() => props.lovMeta?.labelField || 'name')
const pageable = computed(() => !!props.lovMeta?.listConfig?.pageable)
const dialogTitle = computed(() => `选择 ${props.lovMeta?.name || props.lovCode}`)

/* ───────────────────────── 状态 ───────────────────────── */
const tableLoading = ref(false)
const errorMsg = ref('')
const searchParams = ref<Record<string, any>>({})
const tableData = ref<Record<string, any>[]>([])
/** ★ 稳定 reactive（勿改成每次 render 新建的字面量，否则翻页回弹） */
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showJumper: true,
  pageSizeOptions: [10, 20, 50, 100] as number[],
})
/**
 * ★ 已选集合 = 唯一真相源（单选也存成数组，统一喂给 TDesign 的受控 prop）。
 * 只由两条路径写入：① 打开弹窗时按 modelValue 回填；② 用户点选后 @select-change。
 * 任何路径都不允许用"当前页子集"裁剪它。
 */
const selectedKeys = ref<Array<string | number>>([])
/** 单选模式下防止「行点击」与「radio 变更」双路重复 emit（一次打开只认第一次选中） */
let picked = false

/* ───────────────────────── 字段读取（PascalCase 宽容） ───────────────────────── */
/**
 * 取行字段值：元数据里的字段名来自后端（可能 PascalCase，如 `ID` / `Name`），
 * 而行数据经消费端归一（`camelize`/`normalizeRows`，http 层已无全局 camelize）后是 camelCase（`id` / `name`）。
 * 依次尝试：原名 → 首字母小写 → 全小写比对（兜住 `ID`→`id`、`SchoolID`→`schoolID`）。
 */
function readField(row: Record<string, any> | undefined, field?: string): any {
  if (!row || !field) return undefined
  if (field in row) return row[field]
  const c = camelFieldName(field)
  if (c in row) return row[c]
  const lower = field.toLowerCase()
  for (const k of Object.keys(row)) if (k.toLowerCase() === lower) return row[k]
  return undefined
}

/** 行唯一键（统一 String，供 TDesign 受控选择与跨页保留比对） */
function keyOf(row: Record<string, any>): string {
  return String(readField(row, valueField.value) ?? '')
}

/**
 * 行缓存（key → row）：本会话每次 `loadRows` 成功都会写入。
 * 用途：`displayLabel` 解析「已选但当前页未加载」的行标签——跨页多选时
 * `selectedKeys` 含第 2 页的 id，而 `tableData` 只剩第 1 页，没有这层缓存就翻不出名称。
 * 弹窗关闭不清（同一次表单会话内复用），组件卸载随作用域回收。
 */
const rowPool = new Map<string, Record<string, any>>()

/** 单个值 → 展示标签：命中行缓存取 labelField；未命中退回原值（宿主可自译） */
function labelOne(key: string): string {
  const row = rowPool.get(key)
  if (!row) return key
  const v = readField(row, labelField.value)
  return v == null || v === '' ? key : String(v)
}

/** 已选集合 → 顿号连接的展示串（供宿主只读框直接显示名称；与 FormDialog 展示分隔符一致） */
function buildDisplay(keys: Array<string | number>): string {
  return keys.map((k) => labelOne(String(k))).join('、')
}

/** 已存储值归一为 string[]（数组 / 逗号分隔串 / 单值） */
function toValueArray(val?: string | number | string[] | null): string[] {
  if (val == null) return []
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'number') return [String(val)]
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

/* ───────────────────────── 表格列 ───────────────────────── */
const dataColumns = computed<any[]>(() =>
  tableColumns.value.map((c) => ({
    colKey: c.field,
    title: c.title,
    width: c.width || undefined,
    align: c.align || 'left',
    ellipsis: true,
    /** 保留原始列描述，供 textOf 翻译用（TDesign 忽略列对象上的额外键） */
    refLovCode: c.refLovCode,
  })),
)

const columns = computed<any[]>(() => {
  const sel = {
    colKey: 'row-select',
    width: 48,
    align: 'center',
    type: props.multiple ? 'multiple' : 'single',
    // 多选跨页保留勾选（TDesign 默认即为 true，显式声明以固化语义）
    reserveSelectedRowOnPaginate: true,
  }
  return [sel, ...dataColumns.value]
})

/** refLovCode 列字典翻译缓存（lovCode:value → 标签） */
const labelCache = new Map<string, string>()

/**
 * 单元格文本：`refLovCode` 列优先查 inlineEnums 字典，未命中回退原值。
 * （原实现还接了 lovStore/BatchLabel 批量翻译；本技能不预置该模块，
 *   ENUM 型引用值由 useLov 拉到 inlineEnums 后经本函数命中，见 SKILL.md §4.20。）
 */
function textOf(row: Record<string, any>, col: any): string {
  const raw = readField(row, col.colKey)
  if (raw == null || raw === '') return '-'
  const code = col.refLovCode
  if (!code) return String(raw)
  const ck = `${code}:${raw}`
  const hit = labelCache.get(ck)
  if (hit != null) return hit
  const opts = props.inlineEnums[code]
  if (opts) {
    const found = opts.find((o) => String(o.value) === String(raw))
    if (found) {
      labelCache.set(ck, String(found.label))
      return String(found.label)
    }
  }
  return String(raw)
}

/** select / lov 型搜索字段的候选（无字典则空数组 → 退化为可清空的空下拉） */
function optionsOf(f: { refLovCode?: string }): { label: string; value: any }[] {
  const opts = f.refLovCode ? props.inlineEnums[f.refLovCode] : undefined
  if (!opts) return []
  return opts.map((o) => ({ label: String(o.label), value: o.value }))
}

/* ───────────────────────── 已选统计 ───────────────────────── */
const selectedCountText = computed(() => `${selectedKeys.value.length} 项`)

/* ───────────────────────── 取数 ───────────────────────── */
/** 行高亮：命中权威集合的行加类（单/多选共用，视觉与内置勾选框一致） */
function rowClassName(p: { row: Record<string, any> }): string {
  return selectedKeys.value.includes(keyOf(p.row)) ? 'llf-row--selected' : ''
}

/** 组装查询参数：字符串走 Q 关键词，其余走字段参数（技能实测契约） */
function buildParams(): Record<string, any> {
  const cfg = props.lovMeta?.listConfig
  const params: Record<string, any> = { ...(cfg?.fixedParams || {}) }
  const keywords: string[] = []
  for (const f of searchFields.value) {
    const v = searchParams.value[f.field]
    if (v == null || v === '') continue
    const ctrl = String(f.componentType || 'input').toLowerCase()
    if (ctrl === 'input' || ctrl === 'textarea') keywords.push(String(v).trim())
    else params[f.field] = v
  }
  if (keywords.length) params.Q = keywords.join(' ')
  return params
}

async function loadRows() {
  tableLoading.value = true
  errorMsg.value = ''
  try {
    const cfg = props.lovMeta?.listConfig
    const params = buildParams()
    let rows: any[] = []
    let tot = 0

    if (props.fetcher) {
      const r = await props.fetcher({
        lovCode: props.lovCode,
        params,
        pageIndex: pagination.current,
        pageSize: pagination.pageSize,
      })
      rows = r?.rows || []
      tot = Number(r?.total || 0)
    } else if (cfg && props.lovMeta && (cfg.requestUrl || cfg.proxyRequest)) {
      // 取数通道（直连 / 服务端代理 + 分页参数 + 解包）与宿主标签回显共用 lovFetchRows
      const r = await lovFetchRows(props.lovMeta, params, pagination.current, pagination.pageSize)
      rows = r.rows
      tot = r.total
    }

    // 统一补 `__key`（TDesign row-key="__key"；与参考实现 getRowKey 的 String 归一语义一致）
    const keyed = rows.map((r) => ({ ...r, __key: keyOf(r) }))
    // 写入行缓存：displayLabel 需要「非当前页」的已选行标签
    for (const r of keyed) if (r.__key) rowPool.set(String(r.__key), r)
    tableData.value = keyed
    pagination.total = tot
  } catch (e: any) {
    errorMsg.value = `值集数据加载失败：${e?.message || e}`
    tableData.value = []
    pagination.total = 0
    if (MessagePlugin?.error) MessagePlugin.error(errorMsg.value)
  } finally {
    tableLoading.value = false
  }
}

/* ───────────────────────── 交互 ───────────────────────── */
function onVisibleChange(v: boolean) {
  emit('update:dialogVisible', v)
}
function close() {
  emit('update:dialogVisible', false)
}

/** 打开：清搜索、按 modelValue 回填已选、回到第 1 页并取数 */
watch(
  () => props.dialogVisible,
  (visible) => {
    if (!visible) return
    searchParams.value = {}
    pagination.current = 1
    picked = false
    const echo = toValueArray(props.modelValue)
    selectedKeys.value = props.multiple ? echo : echo.slice(0, 1)
    void loadRows()
  },
)

/** 多选：受控模式下 `keys` 即全量已选（含 reserveSelectedRowOnPaginate 保留的跨页项） */
function onSelectChange(keys: Array<string | number>, ctx: SelectOptionsLike) {
  if (props.multiple) {
    selectedKeys.value = (keys || []).map(String)
    return
  }
  const row = ctx?.currentRowData
  if (row) pickRow(row)
}

/** 单选：行点击即选中并关闭（TDesign row-click 为单 context 对象） */
function onRowClick(ctx: RowEventCtx) {
  if (props.multiple) return
  if (ctx?.row) pickRow(ctx.row)
}

function pickRow(row: Record<string, any>) {
  if (picked) return
  picked = true
  const k = keyOf(row)
  selectedKeys.value = [k]
  // 记住这一行，保证随后 buildDisplay 能解析出标签
  if (k) rowPool.set(k, row)
  // 等勾选框渲染完成再关闭，避免"关得太快看不到选中态"的观感问题
  void nextTick(() => {
    emit('select', { row, display: labelOne(k) })
    close()
  })
}

function onConfirm() {
  const values = selectedKeys.value.map(String)
  const rows = values.map((k) => rowPool.get(k)).filter(Boolean) as Record<string, any>[]
  // 与单选 pickRow 一致：确定 = 提交并关闭。官方实现把关闭交给父组件，此处内聚自关闭（差异 #6）
  emit('confirm', { values, rows, display: buildDisplay(values) })
  close()
}

function onSearch() {
  pagination.current = 1
  void loadRows()
}
function onReset() {
  searchParams.value = {}
  pagination.current = 1
  void loadRows()
}
function onPageChange(pg: { current: number; pageSize: number }) {
  if (!pg) return
  if (pg.current === pagination.current && pg.pageSize === pagination.pageSize) return
  pagination.current = pg.current
  pagination.pageSize = pg.pageSize
  void loadRows()
}
</script>

<style scoped>
.llf-search {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.llf-search__ctl {
  width: 168px;
}
.llf-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.llf-count {
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

/* 已选行高亮：用品牌浅底，与内置勾选态联动（单/多选共用） */
:deep(.llf-row--selected) > td {
  background: var(--td-brand-color-light) !important;
}
</style>
