<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import type { FormItem, DataField } from '@/api/fieldRender'
import { groupByCategory, DEFAULT_CATEGORY } from '@/api/fieldRender'

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

function defaultValue(it: FormItem): any {
  if (it.control === 'switch') return false
  if (it.multiple) return []
  if (it.control === 'number') return null
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
