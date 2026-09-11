<script setup lang="ts">
/**
 * LovListField 组件验证页（DEV 专用）
 * ------------------------------------------------------------------
 * 路由 `/lov-demo`（仅开发态注册，见 router/index.ts 的 devRoutes）。
 * 覆盖两条取数通道 + 两种选择模式 + 分页跨页 + refLovCode 列翻译：
 *   ① 单选 · 前端直连（listConfig.requestUrl 以 `/` 开头 → getApi）
 *   ② 多选 · 服务端代理（listConfig.proxyRequest=true → POST /api/Admin/Lov/ListData）
 * 元数据走真实链路 `useLov().load()` → `GET /api/Admin/Lov/Meta`（mock 后端已实现）。
 * 业务工程可整页删除（连同 router 的 devRoutes 与 mock 的 LOV_DEFS）。
 */
import { computed, onMounted, ref } from 'vue'
import { useLov } from '@/api/useLov'
import LovListField from '@/components/cube/LovListField.vue'

const SINGLE_CODE = 'List.Admin.Role'
const MULTI_CODE = 'List.Admin.RoleProxy'
const ENUM_CODE = 'Enum.Admin.RoleKind'

const { lovOptions, lovListConfig, load } = useLov()

const metaError = ref('')
const singleVisible = ref(false)
const multiVisible = ref(false)
const singleValue = ref('')
const multiValues = ref<string[]>([])

const singleMeta = computed(() => lovListConfig.value[SINGLE_CODE] || null)
const multiMeta = computed(() => lovListConfig.value[MULTI_CODE] || null)
/** ENUM 型值集（InlineEnums 下发）→ 供 LovListField 翻译 refLovCode 列 */
const inlineEnums = computed(() => lovOptions.value)

onMounted(async () => {
  try {
    // useLov.load 只接收 DataField[]，这里用最小合成字段携带 lovCode 触发一次批量 Meta 拉取
    await load([
      { name: 'RoleID', lovCode: SINGLE_CODE },
      { name: 'RoleProxyID', lovCode: MULTI_CODE },
      { name: 'RoleKindID', lovCode: ENUM_CODE },
    ] as any)
    if (!lovListConfig.value[SINGLE_CODE]) {
      metaError.value = '值集元数据未拉到：请确认 mock 已实现 GET /api/Admin/Lov/Meta'
    }
  } catch (e: any) {
    metaError.value = `值集元数据加载失败：${e?.message || e}`
  }
})

/**
 * 事件负载（差异 #7）：select → { row, display }，confirm → { values, rows, display }。
 * 提交键始终取 id；display 是组件按 meta.labelField 解析出的名称，供展示。
 */
const singleDisplay = ref('')
const multiDisplay = ref('')
function onSingle(payload: { row: Record<string, any>; display: string }) {
  singleValue.value = String(payload?.row?.id ?? payload?.row?.ID ?? '')
  singleDisplay.value = payload?.display || singleValue.value
}
function onMulti(payload: { values: string[]; rows: Record<string, any>[]; display: string }) {
  multiValues.value = payload?.values || []
  multiDisplay.value = payload?.display || multiValues.value.join(', ')
}
</script>

<template>
  <div class="lov-demo">
    <h2 class="ld-title">值集选择组件（LovListField）验证页</h2>
    <p class="ld-sub">
      DEV 专用验证页（路由 <code>/lov-demo</code>）：单选直连 / 多选服务端代理 / 分页跨页已选 /
      refLovCode 列字典翻译。业务工程可整页删除。
    </p>

    <div class="ld-card">
      <div class="ld-card__hd">① 单选 · 前端直连（requestUrl 以 / 开头）</div>
      <div class="ld-row">
        <t-button theme="primary" data-testid="open-single" @click="singleVisible = true">
          选择角色
        </t-button>
        <span class="ld-val" data-testid="single-value">
          当前值：{{ singleValue || '（未选）' }}<template v-if="singleValue"> · {{ singleDisplay }}</template>
        </span>
      </div>
    </div>

    <div class="ld-card">
      <div class="ld-card__hd">② 多选 · 服务端代理（ProxyRequest=true，24 行跨页）</div>
      <div class="ld-row">
        <t-button theme="primary" data-testid="open-multi" @click="multiVisible = true">
          批量选择角色
        </t-button>
        <span class="ld-val" data-testid="multi-value">
          当前值：{{ multiValues.length ? multiValues.join(', ') : '（未选）' }}
        </span>
        <span class="ld-val" data-testid="multi-display">
          名称：{{ multiDisplay || '（未选）' }}
        </span>
      </div>
    </div>

    <p v-if="metaError" class="ld-err">{{ metaError }}</p>

    <LovListField
      v-model:dialog-visible="singleVisible"
      :lov-code="SINGLE_CODE"
      :lov-meta="singleMeta"
      :inline-enums="inlineEnums"
      :model-value="singleValue"
      @select="onSingle"
    />

    <LovListField
      v-model:dialog-visible="multiVisible"
      :lov-code="MULTI_CODE"
      :lov-meta="multiMeta"
      :inline-enums="inlineEnums"
      multiple
      :model-value="multiValues"
      @confirm="onMulti"
    />
  </div>
</template>

<style scoped>
.lov-demo {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ld-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.ld-sub {
  margin: 0;
  color: var(--td-text-color-placeholder);
  font-size: 13px;
}
.ld-sub code {
  background: var(--td-bg-color-secondarycontainer);
  padding: 1px 5px;
  border-radius: 3px;
}
.ld-card {
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  padding: 14px 16px;
}
.ld-card__hd {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.ld-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.ld-val {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  font-family: monospace;
}
.ld-err {
  margin: 0;
  color: var(--td-error-color);
  font-size: 13px;
}
</style>
