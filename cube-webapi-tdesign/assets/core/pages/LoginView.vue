<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { useAuthStore } from '@/stores/auth'
import { rawHttp } from '@/api/http'

/**
 * 登录页（通用版）
 * ------------------------------------------------------------------
 * 契约：`POST /Auth/Login`，body `{ username, password }`（**不是 userName**），
 * 令牌键名实测为 snake_case，由 `auth.login()` 内部走 `normToken` 三向兜底。
 * 系统名/版权优先读后端 `GET /Auth/LoginConfig`；拉不到则静默回落默认值，不阻断登录。
 */
const router = useRouter()
const auth = useAuthStore()

const username = ref('admin')
const password = ref('admin')
const loading = ref(false)
const systemName = ref('魔方管理后台')
const copyright = ref('')

onMounted(async () => {
  try {
    const r = await rawHttp.get('/Auth/LoginConfig')
    const d: any = (r.data as any)?.data ?? r.data ?? {}
    systemName.value = d.title || d.displayName || d.systemName || systemName.value
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
      <div class="lv-badge">C</div>
      <div class="lv-title">{{ systemName }}</div>
      <div class="lv-sub">NewLife.Cube · TDesign Vue Next</div>
    </div>

    <div class="login-panel">
      <div class="login-card">
        <div class="login-brand">{{ systemName }}</div>
        <div class="login-sub">Sign in to continue</div>
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
        <div v-if="copyright" class="login-tip">{{ copyright }}</div>
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
  color: #fff;
  background: var(--cube-brand-gradient);
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
.lv-sub {
  font-size: 13px;
  opacity: 0.85;
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
  margin: 4px 0 26px;
  letter-spacing: 1px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
