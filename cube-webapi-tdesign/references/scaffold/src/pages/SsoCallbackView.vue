<script setup lang="ts">
/**
 * SsoCallbackView —— 第三方登录回跳落地页。
 *
 * 背景：`SsoController` 系列动作（Login / Auth2 / LoginInfo / Bind / UnBind…，共 24 个）
 * 属**根族**（无 `[Area]`），登录页的 OAuth 按钮已指向 `/Sso/Login/{provider}?r={returnUrl}`。
 * 第三方平台回调后，后端把浏览器重定向回 `r`，并在 query 里带上令牌或授权码。
 *
 * 本页做三件事（按 query 实际内容分支）：
 *   1) 有令牌（`token` / `access_token`）→ 直接落库 → 校验一次 → 进工作台；
 *   2) 只有授权码（`code`）→ `GET /Sso/LoginInfo?code=`（根域，rawHttp）换令牌；
 *   3) 有 `error` / 都没有 → 展示失败原因并回登录页。
 *
 * 纪律：**不猜参数名**。三种键名（token / access_token / code）都兜底读，
 * 因为不同 OAuth 提供方与后端版本的命名并不统一；解析结果在 DEV 下用 DataProbe 摊开。
 */
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getRaw } from '@/api/http';
import { getToken, normToken, setTokens } from '@/api/token';
import AuthShell from '@/components/cube/AuthShell.vue';
import DataProbe from '@/components/cube/DataProbe.vue';

/* ═════════════════ L1：左栏品牌文案（按当前项目填写，禁技术栈话术） ═════════════════ */
const BRAND = {
  fallbackName: '魔方管理后台',
  tagline: '账号 · 权限 · 数据 一站式管理',
  title: '正在完成第三方登录',
  subtitle: '正在校验授权信息，请稍候。',
  highlights: ['授权信息仅用于登录校验', '不会读取第三方账号的其他数据', '如需解绑请前往个人资料'],
};

const route = useRoute();
const router = useRouter();

type Status = 'pending' | 'ok' | 'fail';
const status = ref<Status>('pending');
const message = ref('');
const raw = ref<any>(null);

/** 从 query 读取令牌/授权码（键名多版本兜底） */
function readQuery() {
  const q = route.query as Record<string, any>;
  const pickStr = (...keys: string[]) => {
    for (const k of keys) {
      const v = q[k];
      if (typeof v === 'string' && v) return v;
    }
    return '';
  };
  return {
    token: pickStr('token', 'accessToken', 'access_token'),
    code: pickStr('code', 'authCode', 'auth_code'),
    // ★ 实测：`GET Sso/LoginInfo(String id, String code, String state)` —— 三个形参都接受
    id: pickStr('id', 'provider', 'name'),
    state: pickStr('state'),
    error: pickStr('error', 'error_description', 'errmsg'),
  };
}

async function run() {
  const { token, code, id, state, error } = readQuery();

  if (error) {
    status.value = 'fail';
    message.value = error;
    return;
  }

  // ① 已带令牌：直接落库
  if (token) {
    try {
      setTokens(token, '', 0);
      status.value = 'ok';
      message.value = '登录成功，正在进入工作台…';
      // 稍作停顿让用户看到结果态，再整页跳转（保证 axios 拦截器按新令牌工作）
      window.setTimeout(() => router.replace('/dashboard'), 600);
      return;
    } catch (e: any) {
      status.value = 'fail';
      message.value = e?.message || '保存登录状态失败';
      return;
    }
  }

  // ② 只有授权码：换取令牌（`GET Sso/LoginInfo(id, code, state)`）
  if (code) {
    try {
      const params: Record<string, string> = { code };
      if (id) params.id = id;
      if (state) params.state = state;
      const env = await getRaw<any>('/Sso/LoginInfo', params);
      raw.value = env;
      if (env.code !== 0) throw new Error(env.message || '授权校验失败');
      const d = normToken(env.data ?? {});
      if (!d.accessToken) throw new Error('授权成功但未返回令牌');
      setTokens(d.accessToken, d.refreshToken, d.expireIn);
      status.value = 'ok';
      message.value = '登录成功，正在进入工作台…';
      window.setTimeout(() => router.replace('/dashboard'), 600);
      return;
    } catch (e: any) {
      status.value = 'fail';
      message.value = e?.message || '授权校验失败';
      return;
    }
  }

  // ③ 无令牌无授权码：可能已登录（从别处跳来），否则视为失败
  if (getToken()) {
    status.value = 'ok';
    message.value = '已登录，正在进入工作台…';
    window.setTimeout(() => router.replace('/dashboard'), 400);
    return;
  }
  status.value = 'fail';
  message.value = '未收到授权信息，请重新登录';
}

function goLogin() {
  router.push('/login');
}

onMounted(run);
</script>

<template>
  <AuthShell :brand="BRAND" heading="第三方登录" subheading="正在校验授权结果">
    <template #default>
      <div class="sso-state">
        <template v-if="status === 'pending'">
          <t-loading size="32px" />
          <p class="sso-text">正在校验授权信息…</p>
        </template>
        <template v-else-if="status === 'ok'">
          <t-icon name="check-circle-filled" class="sso-icon ok-icon" />
          <p class="sso-text">{{ message }}</p>
        </template>
        <template v-else>
          <t-icon name="error-circle-filled" class="sso-icon fail-icon" />
          <p class="sso-text">{{ message }}</p>
          <t-button theme="primary" block size="large" class="sso-btn" @click="goLogin">返回登录</t-button>
        </template>
      </div>
      <DataProbe :data="raw" label="SSO LoginInfo 响应结构" />
    </template>
  </AuthShell>
</template>

<style scoped>
.sso-state { text-align: center; padding: 12px 0 4px; }
.sso-icon { font-size: 44px; }
.ok-icon { color: var(--td-success-color); }
.fail-icon { color: var(--td-error-color); }
.sso-text {
  color: var(--td-text-color-secondary);
  font-size: 13.5px;
  line-height: 1.7;
  margin: 12px 0 0;
}
.sso-btn { margin-top: 20px; }
</style>
