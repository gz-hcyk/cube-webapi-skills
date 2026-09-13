<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { useAuthStore } from '@/stores/auth'
import { rawHttp } from '@/api/http'

/**
 * 登录页（通用版）
 * ------------------------------------------------------------------
 * 契约：`POST /Auth/Login`，body `{ username, password }`（**不是 userName**），
 * 令牌键名实测为 snake_case，由 `auth.login()` 内部走 `normToken` 三向兜底。
 * 系统名/Logo/版权优先读后端 `GET /Auth/LoginConfig`；拉不到则静默回落默认值，不阻断登录。
 *
 * ★★ 四条硬规矩（skill 铁律 L1~L4，勿违反）：
 *  L1 左栏文案**必须按当前项目生成**（见下方 `PROJECT`）——禁止原样保留模板话术，
 *     更禁止出现「NewLife.Cube · TDesign Vue Next」这类技术栈字样；
 *  L2 账号/密码**一律不预填**（`ref('')`），禁止默认 `admin`/`admin`，禁止在页面提示测试账号；
 *  L3 页面**不得出现任何实现细节文案**——接口路径（`/Auth/Login`）、加密方式（明文 / RSA 挑战）、
 *     配置开关（`challengeRequired`/`mfaAvailable`）、契约说明等，只写在代码注释里，不渲染到 UI。
 *  L4 **登录页不得让用户选租户**——没有「租户编码」输入框，表单里也没有 tenant 字段。
 *     租户上下文由后端在登录响应头 `X-Tenant` 下发，前端 http.ts 响应拦截器捕获后持久化
 *     （cube_tenant_code）并统一注入请求头；确需切换租户只在**登录后的顶栏**做。
 */
const router = useRouter()
const auth = useAuthStore()

/**
 * ★ L1 项目文案 —— 生成新项目时按「业务定位」改写，**不要留空、不要写技术语言**。
 * 生成口径（从项目名 / 系统名 / LoginConfig.title 出发，用业务语言描述）：
 *   tagline    —— 一句定位语（12~20 字），显示在左栏系统名下方
 *   highlights —— 2~4 条核心能力要点，左栏列表；无内容给空数组（自动不渲染）
 *   subtitle   —— 右侧表单上方一行说明；留空则不渲染
 * 示例（IoTHub 物联网设备管理平台）：
 *   tagline: '设备接入 · 协议配置 · 运行监控'
 *   highlights: ['多协议驱动统一接入', '设备实例集中管理', '运行状态实时监控']
 *   subtitle: '请使用平台账号登录'
 */
const PROJECT = {
  tagline: '',
  highlights: [] as string[],
  subtitle: '',
}

const username = ref('')
const password = ref('')
const loading = ref(false)
const systemName = ref('魔方管理后台')
const logoUrl = ref('')
const copyright = ref('')

/** 无 Logo 时的回退：系统名首字 */
const logoText = computed(() => (systemName.value || 'C').trim().charAt(0))

onMounted(async () => {
  try {
    const r = await rawHttp.get('/Auth/LoginConfig')
    const d: any = (r.data as any)?.data ?? r.data ?? {}
    systemName.value = d.title || d.displayName || d.systemName || systemName.value
    // 静态资源路径落在 /Content 下（如 /Content/images/logo/NewLife.png），dev 代理须含 /Content
    logoUrl.value = d.loginLogo || d.logo || ''
    copyright.value = d.copyright || d.copyRight || ''
  } catch {
    /* 后端未提供 LoginConfig 时静默降级 */
  }
})

async function onSubmit() {
  if (!username.value || !password.value) {
    MessagePlugin.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    MessagePlugin.success('登录成功')
    await router.replace('/dashboard')
  } catch (e: any) {
    MessagePlugin.error(e?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-visual">
      <img v-if="logoUrl" class="lv-logo" :src="logoUrl" alt="" />
      <div v-else class="lv-badge">{{ logoText }}</div>
      <div class="lv-title">{{ systemName }}</div>
      <div v-if="PROJECT.tagline" class="lv-tagline">{{ PROJECT.tagline }}</div>
      <ul v-if="PROJECT.highlights.length" class="lv-list">
        <li v-for="h in PROJECT.highlights" :key="h">{{ h }}</li>
      </ul>
    </div>

    <div class="login-panel">
      <div class="login-card">
        <div class="login-brand">{{ systemName }}</div>
        <div v-if="PROJECT.subtitle" class="login-sub">{{ PROJECT.subtitle }}</div>
        <form class="login-form" @submit.prevent="onSubmit">
          <t-input v-model="username" placeholder="账号" size="large" autofocus />
          <t-input
            v-model="password"
            type="password"
            placeholder="密码"
            size="large"
            @enter="onSubmit"
          />
          <t-button theme="primary" size="large" block :loading="loading" @click="onSubmit">
            登 录
          </t-button>
        </form>
        <div v-if="copyright" class="login-tip" v-html="copyright"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  height: 100vh;
  display: flex;
}
/* 左侧品牌区：政务蓝渐变（沿用 --cube-brand-gradient 令牌，随品牌色切换） */
.login-visual {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 48px;
  color: #fff;
  background: var(--cube-brand-gradient);
}
.lv-logo {
  max-width: 220px;
  max-height: 72px;
  object-fit: contain;
}
.lv-badge {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 700;
}
.lv-title {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 1px;
}
.lv-tagline {
  font-size: 14px;
  opacity: 0.9;
  letter-spacing: 2px;
}
.lv-list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  opacity: 0.85;
}
.lv-list li::before {
  content: '';
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 8px;
  border-radius: 50%;
  background: currentColor;
  vertical-align: middle;
  opacity: 0.8;
}
/* 右侧表单区 */
.login-panel {
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-bg-color-container);
}
.login-card {
  width: 340px;
}
.login-brand {
  font-size: 20px;
  font-weight: 700;
  color: var(--td-brand-color);
}
.login-sub {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  margin-top: 4px;
  letter-spacing: 1px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 26px;
}
.login-tip {
  margin-top: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
@media (max-width: 860px) {
  .login-visual {
    display: none;
  }
  .login-panel {
    width: 100%;
  }
}
</style>
