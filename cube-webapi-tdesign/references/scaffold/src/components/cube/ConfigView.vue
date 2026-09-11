<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { getApi, putApi } from '@/api/http'
import { DataField, buildFormItems, groupByCategory, DEFAULT_CATEGORY, FormItem } from '@/api/fieldRender'
import { camelize, camelFieldName } from '@/utils/camel'

/**
 * ConfigView —— ConfigController<T> 专用「系统配置」单表单页（无 GetPage，单列处理，技能 §4.17）。
 * 数据源：GetFields?kind=EditForm 元数据驱动（复用 buildFormItems → 与实体表单同源控件/校验），
 * 单对象 GET /{area}/{ctrl} 回填，PUT /{area}/{ctrl} 回存。
 * 后端接口实测：Admin/Cube(82字段/6分组)、Admin/Sys(8/单组)、Admin/Core(15) 均走此契约。
 */

const props = withDefaults(
  defineProps<{
    area: string
    controller: string
    title?: string
  }>(),
  { title: '' },
)

const url = computed(() => `/api/${props.area}/${props.controller}`)
const loading = ref(true)
const saving = ref(false)
const model = reactive<Record<string, any>>({})
const formRef = ref<any>(null)
const metaFailed = ref(false)

// GetFields 元数据 → 本项目 FormItem（含控件/分组/校验），与实体 FormDialog 同源
const metaItems = ref<FormItem[]>([])
const items = computed<FormItem[]>(() => metaItems.value)
const groups = computed(() => groupByCategory(items.value))

const rules = computed<Record<string, any[]>>(() => {
  const r: Record<string, any[]> = {}
  for (const it of items.value) if (it.rules && it.rules.length) r[it.key] = it.rules
  return r
})

const activeTab = ref('')
const useTabs = computed(() => groups.value.length > 1)

function defaultVal(it: FormItem): any {
  if (it.control === 'switch') return false
  if (it.multiple) return []
  if (it.control === 'number') return null
  return ''
}

/** 按字段集合初始化 model（保留用户已改值，仅补缺省） */
function initModel() {
  for (const it of items.value) {
    if (model[it.key] === undefined) model[it.key] = defaultVal(it)
  }
  if (!activeTab.value) activeTab.value = groups.value[0]?.category || DEFAULT_CATEGORY
}

/** 单对象回填：GET /{area}/{ctrl}（信封 data 为 Pascal 单对象）→ camelize → 按 formItem.key 取 */
function applyRow(row: any) {
  const cam = camelize(row || {})
  for (const it of items.value) {
    const v = cam[it.key]
    model[it.key] = v === undefined ? defaultVal(it) : v
  }
}

async function load() {
  loading.value = true
  try {
    // 1) 元数据优先（GetFields），失败则退化为按返回对象键动态推断
    const env: any = await getApi(`${url.value}/GetFields?kind=EditForm`)
    const raw = env?.data
    const fields: DataField[] = Array.isArray(raw) ? raw : (raw?.editForm || raw?.addForm || raw?.list || [])
    if (fields.length) {
      metaItems.value = buildFormItems(fields)
    } else {
      metaFailed.value = true
    }
    // 2) 读当前单对象
    const one: any = await getApi(url.value)
    const obj = one?.data || {}
    const cam = camelize(obj)
    if (metaItems.value.length) {
      for (const it of metaItems.value) {
        model[it.key] = cam[it.key] === undefined ? defaultVal(it) : cam[it.key]
      }
    } else {
      // 兜底：无元数据时按返回对象键 + 类型推断
      const its: FormItem[] = Object.keys(cam).map((k) => ({
        key: k,
        paramName: k,
        label: k,
        control: typeof cam[k] === 'boolean' ? 'switch' : typeof cam[k] === 'number' ? 'number' : typeof cam[k] === 'string' && String(cam[k]).length > 120 ? 'textarea' : 'input',
        category: '',
        multiple: false,
        required: false,
      }))
      metaItems.value = its
      for (const k of Object.keys(cam)) model[k] = cam[k]
    }
    activeTab.value = groups.value[0]?.category || DEFAULT_CATEGORY
    await nextTick()
    formRef.value?.clearValidate?.()
  } catch (e: any) {
    MessagePlugin.error(`加载配置失败：${e?.message || e}`)
  } finally {
    loading.value = false
  }
}

/** 保存：提交 camel 键模型 → 需还原为后端 Pascal 字段名（FormItem.paramName 即原始字段名） */
async function save() {
  const result = await formRef.value?.validate?.()
  if (result !== true) return
  saving.value = true
  try {
    const body: Record<string, any> = {}
    for (const it of items.value) {
      if (it.readOnly) continue
      body[it.paramName] = model[it.key] === null ? undefined : model[it.key]
    }
    const r: any = await putApi(url.value, body)
    if (r?.code !== undefined && r.code !== 0) throw new Error(r.message || '保存失败')
    MessagePlugin.success('配置已保存')
    await load()
  } catch (e: any) {
    MessagePlugin.error(`保存失败：${e?.message || e}`)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="cfg-page">
    <div class="cfg-head">
      <h3 class="cfg-title">{{ title || `${controller} 配置` }}</h3>
      <span v-if="metaFailed" class="cfg-warn">该配置页无 GetFields 元数据，已按当前值动态渲染（增删字段需前后端同步）</span>
    </div>
    <t-card :loading="loading" :bordered="false" class="cfg-card">
      <t-form v-if="!loading" ref="formRef" :data="model" :rules="rules" label-width="220px">
        <t-tabs v-if="useTabs" v-model="activeTab" theme="card" class="cfg-tabs">
          <t-tab-panel v-for="g in groups" :key="g.category" :value="g.category" :label="g.category">
            <div class="cfg-panel">
              <t-form-item v-for="it in g.items" :key="it.key" :label="it.label" :name="it.key">
                <t-textarea
                  v-if="it.control === 'textarea'"
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
                <t-select
                  v-else-if="it.control === 'select'"
                  v-model="model[it.key]"
                  :options="it.options"
                  :readonly="it.readOnly"
                  clearable
                  filterable
                />
                <t-input
                  v-else
                  v-model="model[it.key]"
                  :readonly="it.readOnly"
                  :type="it.control === 'tel' ? 'text' : 'text'"
                  :placeholder="`请输入${it.label}`"
                />
              </t-form-item>
            </div>
          </t-tab-panel>
        </t-tabs>

        <!-- 单分组 / 无 category：扁平表单 -->
        <template v-else>
          <div class="cfg-panel">
            <t-form-item v-for="it in items" :key="it.key" :label="it.label" :name="it.key">
              <t-textarea
                v-if="it.control === 'textarea'"
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
              <t-select
                v-else-if="it.control === 'select'"
                v-model="model[it.key]"
                :options="it.options"
                :readonly="it.readOnly"
                clearable
                filterable
              />
              <t-input v-else v-model="model[it.key]" :readonly="it.readOnly" :placeholder="`请输入${it.label}`" />
            </t-form-item>
          </div>
        </template>

        <t-form-item>
          <t-space>
            <t-button theme="primary" :loading="saving" @click="save">保存</t-button>
            <t-button theme="default" :disabled="saving" @click="load">重置</t-button>
          </t-space>
        </t-form-item>
      </t-form>
    </t-card>
  </div>
</template>

<style scoped>
.cfg-page {
  width: 100%;
  min-width: 0;
  max-width: 1080px;
}
.cfg-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}
.cfg-title {
  margin: 0;
  font-size: 18px;
}
.cfg-warn {
  font-size: 12px;
  color: var(--td-warning-color);
}
.cfg-card {
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-large);
}
.cfg-tabs {
  margin-bottom: 4px;
}
.cfg-panel {
  padding-top: 8px;
}
</style>
