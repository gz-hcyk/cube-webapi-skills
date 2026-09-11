<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { labelOf, DataField, mapDictOf, isMappedField, groupByCategory, DEFAULT_CATEGORY } from '@/api/fieldRender'
import { camelFieldName } from '@/utils/camel'

const props = defineProps<{
  /** 通常传 GetPage.detail 字段集（后端已按详情场景裁剪） */
  fields?: DataField[]
  row?: any
  lookups?: Record<string, Record<string, string>>
}>()
const visible = defineModel<boolean>('visible', { default: false })

const items = computed(() => {
  const fs = props.fields || []
  return fs
    .filter((f) => !f.primaryKey)
    .map((f) => {
      const key = camelFieldName(f.name)
      const raw = props.row ? props.row[key] : undefined
      const text = labelOf(f, raw, props.lookups, fs)
      return {
        label: f.header || f.displayName || f.name,
        value: text === '' || text == null ? '-' : String(text),
        tag: isMappedField(f, fs) || !!mapDictOf(f, fs),
        category: f.category || '',
      }
    })
})

/** 按 category 分页签（默认组靠前），单分类时退化为单 tab 不影响阅读 */
const groups = computed(() => groupByCategory(items.value))
const activeTab = ref('')

watch(visible, (v) => {
  if (v) {
    activeTab.value = groups.value[0]?.category ?? DEFAULT_CATEGORY
  }
})
</script>

<template>
  <t-drawer v-model:visible="visible" header="详情" size="460px" :footer="false">
    <t-tabs v-model="activeTab" theme="card">
      <t-tab-panel v-for="g in groups" :key="g.category" :value="g.category" :label="g.category">
        <t-descriptions :column="1" bordered class="detail-desc">
          <t-descriptions-item v-for="it in g.items" :key="it.label" :label="it.label">
            <t-tag v-if="it.tag && it.value !== '-'" theme="primary" variant="light">{{ it.value }}</t-tag>
            <span v-else>{{ it.value }}</span>
          </t-descriptions-item>
        </t-descriptions>
      </t-tab-panel>
    </t-tabs>
  </t-drawer>
</template>

<style scoped>
.detail-desc {
  margin-top: 4px;
}
</style>
