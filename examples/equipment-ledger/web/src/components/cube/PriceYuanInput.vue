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
// t-input-number 的值类型是 InputNumberValue = number | string（用户清空时可能是 ''），
// 直接声明成 `number | null` 会因参数逆变检查失败 → TS2322。
import type { InputNumberValue } from 'tdesign-vue-next'

const props = defineProps<{
  modelValue?: number | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: number | null): void
}>()

// 内部编辑态：必须用 InputNumberValue（而非 number | null），否则 v-model 回写类型不匹配。
// undefined 表示「空」（TDesign 用 undefined 表达受控空值，null 不在其类型联合内）。
const yuan = ref<InputNumberValue>()

// 外部值（分）变化 → 显示（元）
watch(
  () => props.modelValue,
  (v) => {
    yuan.value = v == null || Number.isNaN(v) ? undefined : v / 100
  },
  { immediate: true },
)

function onChange(v: InputNumberValue) {
  // 清空 '' / undefined / null → 视为空值；其余转数字后 ×100 取整回写为「分」
  const n = v == null || v === '' ? null : Number(v)
  emit('update:modelValue', n == null || Number.isNaN(n) ? null : Math.round(n * 100))
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
