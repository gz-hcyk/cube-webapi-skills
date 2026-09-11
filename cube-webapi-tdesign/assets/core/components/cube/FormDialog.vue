<script setup lang="ts">
import { ref, computed, watch, nextTick, reactive } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import type { FormItem, DataField } from '@/api/fieldRender'
import { groupByCategory, DEFAULT_CATEGORY } from '@/api/fieldRender'
import { useLov, lovFetchRows } from '@/api/useLov'
import LovListField from './LovListField.vue'

const props = defineProps<{
  resource: any
  fields?: DataField[]
  items?: FormItem[]
  lookups?: Record<string, Record<string, string>>
  editRow?: any | null
}>()

const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ (e: 'saved'): void }>()

const formRef = ref<any>(null)
const model = ref<any>({})
const submitting = ref(false)

const isEdit = computed(() => !!props.editRow)
const formItems = computed<FormItem[]>(() => props.items || [])
const groups = computed(() => groupByCategory(formItems.value))

/* ───────────────── LIST 型值集（lov-list）：表格弹窗 ─────────────────
 * controlOf 对 lovCode 以 `List.` 开头的字段返回 'lov-list'，渲染 LovListField 弹窗。
 * 元数据（lovMeta/inlineEnums）由本组件内联 useLov 拉取（props.fields 已带 lovCode），
 * 值以「逗号串」存进 model（后端真实列多为 String）；单选 emit select({row,display})，
 * 多选 emit confirm({values,rows,display})。
 * 只读框展示的是**名称**（lovDisplay），提交的是**id**（model[it.key]）——两者分离。
 */
const { lovOptions, lovListConfig, load } = useLov()
/** 每个 lov-list 字段独立的弹窗可见态（键 = FormItem.key） */
const lovVisible = reactive<Record<string, boolean>>({})
/** 每个 lov-list 字段的展示文本（id→名称）；缺省退回原始值 */
const lovDisplay = reactive<Record<string, string>>({})

/** 后端字段描述符可能 PascalCase（`ID`/`Name`），行数据经 camelize 是 camelCase → 大小写宽容取值 */
function pickField(row: any, field?: string): any {
  if (row == null || !field) return undefined
  if (field in row) return row[field]
  const lower = field.toLowerCase()
  for (const k of Object.keys(row)) if (k.toLowerCase() === lower) return row[k]
  return undefined
}

/** 打开时若有 lov-list 字段，拉一次值集元数据（useLov 幂等，失败静默退化），并回显已有值的名称 */
function ensureLovMeta() {
  const lovItems = formItems.value.filter((it) => it.control === 'lov-list')
  if (!lovItems.length) return
  void load(props.fields || []).then(() => {
    for (const it of lovItems) seedDisplay(it)
  })
}

/** 把若干行对象的名称写进 lovDisplay（多选逗号连接） */
function setDisplay(it: FormItem, rows: any[]) {
  const meta = it.lovCode ? lovListConfig.value[it.lovCode] : undefined
  const lf = meta?.labelField || 'name'
  const names = rows
    .map((r) => pickField(r, lf))
    .filter((v) => v != null && v !== '')
    .map(String)
  lovDisplay[it.key] = names.join('、') || String(model.value[it.key] ?? '')
}

/** 从弹窗选中行取值：meta.valueField 可能 PascalCase（`ID`），行数据是 camelCase（`id`）→ 双查 */
function lovValueOf(it: FormItem, row: any): string {
  const meta = it.lovCode ? lovListConfig.value[it.lovCode] : undefined
  const vf = meta?.valueField || 'id'
  return String(pickField(row, vf) ?? row?.id ?? row?.ID ?? '')
}
function openLov(it: FormItem) {
  lovVisible[it.key] = true
}
/** 单选：行选中即回填单值 + 名称 */
function onLovSelect(it: FormItem, payload: { row: any; display: string }) {
  model.value[it.key] = lovValueOf(it, payload?.row)
  lovDisplay[it.key] = payload?.display || model.value[it.key]
}
/** 多选：确认后存逗号串（与后端真实列 String 一致），展示名另存 */
function onLovConfirm(it: FormItem, payload: { values: string[]; rows: any[]; display: string }) {
  const values = payload?.values || []
  model.value[it.key] = values.join(',')
  setDisplay(it, payload?.rows || [])
  // rows 里可能缺「本次之前已选但本会话未加载」的项 → display 兜底更准
  if (payload?.display && lovDisplay[it.key] === String(model.value[it.key])) {
    lovDisplay[it.key] = payload.display
  }
}

/** id 串 → 值集行：优先本地字典（Cube 常把映射名称一并下发），否则整表拉取后匹配 */
async function resolveLovRows(it: FormItem, ids: string[]): Promise<any[]> {
  if (!ids.length) return []
  const meta = it.lovCode ? lovListConfig.value[it.lovCode] : undefined
  if (!meta?.listConfig) return []
  // ① 映射字段：后端把名称一并下发（row.warehouseName 对应 warehouseID）
  const local = it.fallbackKey ? pickField(props.editRow, it.fallbackKey) : undefined
  if (ids.length === 1 && local != null && local !== '') {
    return [{ [meta.valueField || 'id']: ids[0], [meta.labelField || 'name']: local }]
  }
  // ② 整表取数匹配（pageable 用大 pageSize 取全量，与真实后端 >=1000 语义一致）
  try {
    const { rows } = await lovFetchRows(meta, { ...((meta.listConfig.fixedParams as any) || {}) }, 1, 1000)
    return rows.filter((r) => ids.includes(lovValueOf(it, r)))
  } catch {
    return []
  }
}

/** 编辑态回显：把已存 id 解析成名称填进 lovDisplay */
function seedDisplay(it: FormItem) {
  const raw = model.value[it.key]
  const ids = String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!ids.length) {
    lovDisplay[it.key] = ''
    return
  }
  // 先用原值兜底（保证不空），再异步替换为名称
  lovDisplay[it.key] = ids.join('、')
  void resolveLovRows(it, ids).then((rows) => {
    if (rows.length) setDisplay(it, rows)
  })
}

/** 当前激活的 category 页签：每次打开重置到第一组 */
const activeTab = ref('')

/**
 * 校验规则一律走 TDesign/async-validator 内置类型（required / email / url / number / max …），
 * 由 buildFormItems 依据字段元数据生成——不手写正则，也不自己遍历校验。
 */
const rules = computed(() => {
  const r: Record<string, any[]> = {}
  for (const it of formItems.value) {
    if (it.rules && it.rules.length) r[it.key] = it.rules
  }
  return r
})

/**
 * 未填字段的默认值。
 * ⚠️ 关键：后端字段描述符**不下发必填信息**（实测 required 恒缺、nullable 恒非 false），
 * 而业务列几乎全是 NOT NULL；此处给「数值型 0 / 布尔 false / 其余空串」，
 * 保证未填也提交出可绑定的载荷，而不是被 NOT NULL 列拒绝的 null。
 */
function defaultValue(it: FormItem): any {
  if (it.control === 'switch') return false
  // lov-list 单/多统一存逗号串（后端真实列 String），不用数组
  if (it.control === 'lov-list') return ''
  if (it.multiple) return []
  if (it.control === 'number') return 0
  // 数值型枚举/外键选择器：空串会让后端 Int32 反序列化失败，0 = 未选择
  if (it.numeric && (it.control === 'select' || it.control === 'tree-select')) return 0
  return ''
}

function buildModel() {
  const m: any = {}
  for (const it of formItems.value) {
    const row = props.editRow
    // 映射字段提交键是原始字段名（classID），但行数据里可能只有自身名（className）
    const v = row ? (row[it.key] ?? (it.fallbackKey ? row[it.fallbackKey] : undefined)) : undefined
    m[it.key] = v ?? defaultValue(it)
  }
  model.value = m
}

watch(visible, (v) => {
  if (!v) return
  buildModel()
  activeTab.value = groups.value[0]?.category ?? DEFAULT_CATEGORY
  nextTick(() => formRef.value?.clearValidate?.())
  ensureLovMeta()
})

/** 校验失败时：跳到第一个含错误的页签，避免用户在其他 tab 里找不到报错项 */
function focusErrorTab(result: any) {
  const errKeys: string[] = result && typeof result === 'object' ? Object.keys(result.fields || result.errors || {}) : []
  if (!errKeys.length) return
  const firstErr = formItems.value.find((it) => errKeys.includes(it.key))
  if (firstErr) activeTab.value = firstErr.category?.trim() || DEFAULT_CATEGORY
}

async function onSubmit() {
  // 内置校验：validate 返回 true 或校验结果对象，不抛异常
  const result = await formRef.value?.validate?.()
  if (result !== true) {
    focusErrorTab(result)
    return
  }
  submitting.value = true
  try {
    const row: any = { ...model.value }
    if (isEdit.value && props.editRow) row.id = props.editRow.id ?? props.editRow.ID
    if (isEdit.value) await props.resource.update(row)
    else await props.resource.create(row)
    MessagePlugin.success(isEdit.value ? '保存成功' : '新增成功')
    visible.value = false
    emit('saved')
  } catch (e: any) {
    MessagePlugin.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="isEdit ? '编辑' : '新增'"
    :confirm-btn="{ content: '保存', loading: submitting }"
    cancel-btn="取消"
    width="680px"
    @confirm="onSubmit"
  >
    <t-form ref="formRef" :data="model" :rules="rules" label-width="120px">
      <!-- 单 t-form 包裹 t-tabs：所有页签字段共用一份 model/rules，内置校验跨页签生效 -->
      <t-tabs v-model="activeTab" theme="card">
        <t-tab-panel v-for="g in groups" :key="g.category" :value="g.category" :label="g.category">
          <div class="fd-panel">
            <t-form-item v-for="it in g.items" :key="it.key" :label="it.label" :name="it.key">
              <t-input
                v-if="it.control === 'input' || it.control === 'email' || it.control === 'tel'"
                v-model="model[it.key]"
                :type="it.control === 'email' ? 'email' : it.control === 'tel' ? 'tel' : 'text'"
                :maxlength="it.maxlength"
                :readonly="it.readOnly"
                :placeholder="`请输入${it.label}`"
              />
              <t-textarea
                v-else-if="it.control === 'textarea'"
                v-model="model[it.key]"
                :readonly="it.readOnly"
                :placeholder="`请输入${it.label}`"
              />
              <t-input-number
                v-else-if="it.control === 'number'"
                v-model="model[it.key]"
                :readonly="it.readOnly"
                theme="column"
                style="width: 100%"
              />
              <t-switch v-else-if="it.control === 'switch'" v-model="model[it.key]" :disabled="it.readOnly" />
              <t-date-picker
                v-else-if="it.control === 'date'"
                v-model="model[it.key]"
                value-type="YYYY-MM-DD HH:mm:ss"
                format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
              <t-select
                v-else-if="it.control === 'select' || it.control === 'multi-select'"
                v-model="model[it.key]"
                :multiple="it.multiple"
                :options="it.options"
                :readonly="it.readOnly"
                :placeholder="`请选择${it.label}`"
                filterable
              />
              <t-tree-select
                v-else-if="it.control === 'tree-select'"
                v-model="model[it.key]"
                :data="it.options"
                :readonly="it.readOnly"
                clearable
                filterable
              />
              <!-- LIST 型值集：只读展示**名称** + 表格弹窗（LovListField）。只 import 不挂分支＝死代码 -->
              <div v-else-if="it.control === 'lov-list'" class="fd-lov" data-testid="lov-field">
                <t-input
                  :model-value="lovDisplay[it.key] ?? (model[it.key] == null ? '' : String(model[it.key]))"
                  readonly
                  :placeholder="`请选择${it.label}`"
                  @click="openLov(it)"
                />
                <LovListField
                  v-model:dialog-visible="lovVisible[it.key]"
                  :lov-code="it.lovCode || ''"
                  :lov-meta="it.lovCode ? lovListConfig[it.lovCode] || null : null"
                  :inline-enums="lovOptions"
                  :multiple="it.multiple"
                  :model-value="model[it.key]"
                  @select="(p) => onLovSelect(it, p)"
                  @confirm="(p) => onLovConfirm(it, p)"
                />
              </div>
              <t-input v-else v-model="model[it.key]" :readonly="it.readOnly" />
            </t-form-item>
          </div>
        </t-tab-panel>
      </t-tabs>
    </t-form>
  </t-dialog>
</template>

<style scoped>
.fd-panel {
  padding-top: 4px;
}
</style>
