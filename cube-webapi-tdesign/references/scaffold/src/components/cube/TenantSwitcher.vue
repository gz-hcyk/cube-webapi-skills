<script setup lang="ts">
/**
 * TenantSwitcher —— 租户切换器（顶栏 / 「租户信息」页共用）。
 *
 * 对齐 MVC 版的多租户做法：租户由**登录响应头 `X-Tenant`** 下发（`api/http.ts` 已自动捕获），
 * 前端只需携带 `X-Tenant`（Code）与 `X-Tenant-Id`（legacy）头。切换租户的正确语义是
 * 「让服务端重新签发上下文」，而不是仅改本地头 —— 否则会出现「界面切了、数据没切」的假象。
 *
 * 切换流程（按可靠性降序，逐级降级并**明确告知**用户）：
 *   1) `POST /Auth/SwitchTenant { tenant }`（根族，rawHttp）→ 成功则用返回令牌覆盖本地并整页刷新；
 *   2) 接口不可用 → 写入本地租户（`X-Tenant` / `X-Tenant-Id` 头随之变化）并整页刷新。
 *
 * ★★ 实测（NewLife.Cube 6.15.2026.901 / net9.0，`GET /Cube/Apis` 全量签名 + 端点探针）：
 *   **`Auth/SwitchTenant` 在该版本不存在（404）**。Auth 控制器没有切换租户动作，
 *   租户上下文实际由登录时的 `GET /Auth/LoginConfig(?tenant=)` 与登录响应头 `X-Tenant` 决定。
 *   故第 2 级降级才是 6.15 的**正常路径**，此时用 info 级提示（而非 warning 噪音）；
 *   只有「连本地切换都没写成功」才算异常。
 *   若后端自建了切换端点，第 1 级会自动生效，无需改本组件。
 *
 * 租户列表来源：`GET /api/Admin/Tenant/GetPage`（实测存在，但需管理员权限）。
 * 普通用户通常无权限 → 只显示当前租户，选择器自动禁用（不隐藏，避免用户以为功能坏了）。
 *
 * 版式：页内使用时与表单字段对齐（宽度自适应）；顶栏使用时固定宽度 180px（同原 BasicLayout）。
 */
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getApi, postRaw } from '../../api/http';
import { getTenant, getTenantCode, normToken, setTenant as writeTenantId, setTenantCode, setTokens } from '../../api/token';

const props = withDefaults(
  defineProps<{
    /** 是否顶栏紧凑形态（固定宽度） */
    compact?: boolean;
  }>(),
  { compact: false },
);

interface TenantOption {
  value: string;
  label: string;
}
const options = ref<TenantOption[]>([]);
const current = ref(getTenantCode() || getTenant() || '');
const loading = ref(false);
const listLoaded = ref(false);

/** 只有一项时视为不可切换（普通用户无租户列表权限） */
const switchable = computed(() => options.value.length > 1);

function normOptions(rows: any[]): TenantOption[] {
  return rows
    .map((r) => {
      const code = String(r?.code ?? r?.Code ?? r?.id ?? r?.ID ?? '');
      const name = String(r?.name ?? r?.Name ?? r?.displayName ?? r?.DisplayName ?? code);
      return { value: code, label: name };
    })
    .filter((o) => o.value);
}

async function loadTenants() {
  loading.value = true;
  try {
    const env = await getApi<any>('/Admin/Tenant/GetPage', { pageIndex: 1, pageSize: 200 });
    const rows = Array.isArray(env.data) ? env.data : [];
    options.value = normOptions(rows);
    listLoaded.value = true;
  } catch {
    // 无权限 / 端点不可达：退化为「当前租户」单项，不阻断页面
    options.value = [];
  } finally {
    // 始终保证当前租户在列表里（否则下拉显示空值）
    if (current.value && !options.value.some((o) => o.value === current.value)) {
      options.value.unshift({ value: current.value, label: current.value });
    }
    if (!options.value.length) options.value = [{ value: '', label: '默认租户' }];
    loading.value = false;
  }
}

function normalizeValue(v: unknown): string {
  return v == null ? '' : String(typeof v === 'object' ? ((v as Record<string, any>).value ?? '') : v);
}

async function onSwitch(v: unknown) {
  const code = normalizeValue(v);
  if (code === current.value) return;
  loading.value = true;
  try {
    const env = await postRaw<any>('/Auth/SwitchTenant', { tenant: code });
    if (env.code !== 0) throw new Error(env.message || '切换失败');
    // 服务端可能重签令牌：有则覆盖（否则保持原令牌，仅换租户头）
    const d = normToken(env.data ?? {});
    if (d.accessToken) setTokens(d.accessToken, d.refreshToken, d.expireIn);
    setTenantCode(code);
    writeTenantId(code);
    current.value = code;
    MessagePlugin.success('已切换租户，正在重新加载');
    window.location.reload();
  } catch (e: any) {
    // 降级（6.15 的正常路径：无 SwitchTenant 端点）：改本地租户头 + 刷新。
    // 用 info 而非 warning——这不是故障，只是该版本没有服务端切换动作。
    const notFound = e?.response?.status === 404;
    setTenantCode(code);
    writeTenantId(code);
    current.value = code;
    if (notFound) {
      MessagePlugin.info('已切换租户，正在重新加载');
    } else {
      MessagePlugin.warning(`已切换本地租户（服务端切换失败：${e?.message || '未知原因'}），正在重新加载`);
    }
    window.location.reload();
  } finally {
    loading.value = false;
  }
}

onMounted(loadTenants);
</script>

<template>
  <t-select
    :value="current"
    :options="options"
    :loading="loading"
    :disabled="!switchable"
    :class="['tenant-switcher', { 'is-compact': props.compact }]"
    :title="switchable ? '切换租户' : '当前账号无租户列表权限'"
    :auto-width="!props.compact"
    @change="onSwitch"
  />
</template>

<style scoped>
.tenant-switcher { width: 100%; }
.tenant-switcher.is-compact { width: 180px; }
</style>
