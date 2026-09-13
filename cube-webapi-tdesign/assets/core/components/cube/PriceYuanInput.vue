<script setup lang="ts">
/**
 * 价格输入（元 ↔ 分换算）
 *
 * 后端 Product.Price / ProductOrder.Amount 语义为「单位分」（Int32，见 Model.xml），
 * 而业务侧按「元」录入（可两位小数）。本组件对外 v-model 绑定「分」（与后端字段一致），
 * 内部以「元」编辑：change 时 ×100 取整回写，外部值变化时 ÷100 回显。
 *
 * 例：modelValue=2990 → 显示 29.9 → 用户改 39.9 → emit 3990。
 */
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue?: number | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: number | null): void
}>()

const yuan = ref<number | null>(null)

// 外部值（分）变化 → 显示（元）
watch(
  () => props.modelValue,
  (v) => {
    yuan.value = v == null || Number.isNaN(v) ? null : v / 100
  },
  { immediate: true },
)

function onChange(v?: number | null) {
  const x = v == null || Number.isNaN(v) ? null : Math.round(v * 100)
  emit('update:modelValue', x)
}
</script>

<template>
  <div class="pyi">
    <t-input-number
      v-model="yuan"
      :min="0"
      :precision="2"
      :readonly="readonly"
      theme="column"
      class="pyi-num"
      placeholder="0.00"
      @change="onChange"
    />
    <span class="pyi-unit">元</span>
  </div>
</template>

<style scoped>
.pyi {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.pyi-num {
  flex: 1;
}
.pyi-unit {
  color: var(--td-text-color-placeholder, #999);
  font-size: 13px;
  flex-shrink: 0;
}
</style>
