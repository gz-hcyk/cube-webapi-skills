<template>
  <AuthShell heading="欢迎回来" :subheading="PROJECT.subtitle">
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="login-form"
      @submit.prevent="onSubmit"
    >
      <el-form-item label="账号" prop="username">
        <el-input
          v-model="form.username"
          size="large"
          placeholder="请输入账号"
          :prefix-icon="User"
          autocomplete="username"
          clearable
        />
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          size="large"
          type="password"
          placeholder="请输入密码"
          :prefix-icon="Lock"
          autocomplete="current-password"
          show-password
          @keyup.enter="onSubmit"
        />
      </el-form-item>

      <el-alert
        v-if="errorText"
        :title="errorText"
        type="error"
        :closable="false"
        show-icon
        class="login-error"
      />

      <el-button type="primary" size="large" class="login-submit" :loading="loading" @click="onSubmit">
        {{ loading ? '登录中…' : '登录' }}
      </el-button>
    </el-form>
  </AuthShell>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Lock, User } from '@element-plus/icons-vue';
import AuthShell from '@/components/cube/AuthShell.vue';
import { DEFAULT_ROUTE, PROJECT } from '@/config/app';
import { useAuthStore } from '@/stores/auth';

/**
 * 登录页（铁律 E5）
 *  L1 左栏文案来自 PROJECT，按项目填业务语言，禁技术栈话术
 *  L2 账号/密码不预填，页面上不出现任何测试账号提示
 *  L3 不渲染接口路径、加密方式、配置开关等实现细节
 *  L4 不出现租户/组织选择控件——租户由登录响应头 X-Tenant 下发
 */
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const formRef = ref();
const loading = ref(false);
const errorText = ref('');

const form = reactive({ username: '', password: '' });

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  errorText.value = '';
  try {
    await auth.login(form.username.trim(), form.password);
    ElMessage.success('登录成功');
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : DEFAULT_ROUTE;
    await router.replace(redirect);
  } catch (e: any) {
    errorText.value = normalizeError(e);
  } finally {
    loading.value = false;
  }
}

function normalizeError(e: any): string {
  if (e?.response?.status === 401 || e?.code === 401) return '账号或密码不正确';
  if (e?.message) {
    // 后端会返回「登录错误过多，请在 N 秒后再试」这类业务提示，原样展示即可
    return String(e.message);
  }
  return '暂时无法连接服务器，请稍后再试';
}
</script>

<style scoped>
.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.login-form :deep(.el-input__wrapper) {
  padding: 1px 12px;
  border-radius: var(--cube-radius-control);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.login-error {
  margin-bottom: 16px;
}

.login-submit {
  width: 100%;
  height: 42px;
  margin-top: 4px;
  font-size: 15px;
  font-weight: 500;
  border-radius: var(--cube-radius-control);
}
</style>
