<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { useAuthStore } from '../api/auth'

const router = useRouter()
const auth = useAuthStore()
// ★ L2：账号/密码一律不预填（禁止默认 admin/admin）
// ★ L3：页面不渲染任何契约/实现细节文案（接口路径、加密方式、challengeRequired 等）
// ★ L4：登录页不选租户——租户由后端登录响应头 X-Tenant 下发（http.ts 自动捕获持久化），
//        故此处没有 tenant 输入框；完整版模板同样遵守，勿照抄旧版「租户编码（可选，多租户）」输入
const username = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!username.value || !password.value) {
    MessagePlugin.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await auth.loginWithPassword(username.value, password.value)
    MessagePlugin.success('登录成功')
    await router.replace('/')
  } catch (e: any) {
    MessagePlugin.error(e?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <!-- ★ L1：品牌名/副标题按当前项目生成（此处示例为「企业微信通讯录管理系统」），不要照抄模板 -->
      <div class="login-brand">企业微信通讯录管理系统</div>
      <div class="login-sub">WeCom Address Book</div>
      <form class="login-form" @submit.prevent="onSubmit">
        <t-input v-model="username" placeholder="账号" size="large" autofocus />
        <t-input v-model="password" type="password" placeholder="密码" size="large" @enter="onSubmit" />
        <t-button theme="primary" size="large" block :loading="loading" @click="onSubmit">登录</t-button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cube-sidebar-bg);
}
.login-card {
  width: 360px;
  background: #fff;
  border-radius: 14px;
  padding: 32px 28px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.login-brand {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  color: #0f4c9e;
}
.login-sub {
  text-align: center;
  color: #9aa4b2;
  font-size: 12px;
  margin: 4px 0 24px;
  letter-spacing: 1px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
