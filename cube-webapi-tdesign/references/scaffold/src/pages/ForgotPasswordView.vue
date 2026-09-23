<script setup lang="ts">
/**
 * ForgotPasswordView —— 忘记密码 / 重置密码页（`POST /Auth/SendCode` + `POST /Auth/ResetPassword`）。
 *
 * 归属：NewLife.Cube 全局认证族（`NewLife.Cube.Controllers.AuthController.ResetPassword`），
 * **无 [Area] ⇒ 不带 /api 前缀**，走 rawHttp（见 api/http.ts 铁律 H2 判据）。
 *
 * 流程（官方接口约定）：
 *   1) 选通道（手机 / 邮箱）→ `POST /Auth/SendCode { channel:'Sms'|'Mail', username, action:'ResetPassword' }`
 *   2) 提交 `POST /Auth/ResetPassword { username, code, newPassword, confirmPassword, challengeId }`
 *
 * 通道开关来源：`GET /Auth/LoginConfig` 的 `login.sms` / `login.mail`（与登录页同源，不另造开关）。
 * 校验铁律 R2：邮箱用内置 `{ type:'email' }`；手机为 TDesign 无内置项 → 保留 pattern。
 */
import { computed, reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin, type SubmitContext } from 'tdesign-vue-next';
import AuthShell from '@/components/cube/AuthShell.vue';
import { useAuthStore } from '@/stores/auth';

/* ═════════════════ L1：左栏品牌文案（按当前项目填写，禁技术栈话术） ═════════════════ */
const BRAND = {
  fallbackName: '魔方管理后台',
  tagline: '账号 · 权限 · 数据 一站式管理',
  title: '找回你的账号访问',
  subtitle: '通过手机或邮箱验证码验证身份，即可重设密码。',
  highlights: ['验证码验证身份，全程不暴露原密码', '重设后旧密码立即失效', '遇到问题可联系管理员协助'],
};

const auth = useAuthStore();
const router = useRouter();

const config = ref<any>({});
const loading = ref(false);
const done = ref(false);
const activeChannel = ref<'Sms' | 'Mail'>('Sms');

const sw = computed(() => ({
  sms: !!config.value.login?.sms || !!config.value.login?.sendCode,
  mail: !!config.value.login?.mail || !!config.value.login?.sendCode,
}));
const hasBoth = computed(() => sw.value.sms && sw.value.mail);

const form = reactive({
  username: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
});

/** 账号输入框的占位与是否按邮箱校验，随通道变化 */
const accountIsMail = computed(() => activeChannel.value === 'Mail');
const accountPlaceholder = computed(() => (accountIsMail.value ? '注册邮箱' : '注册手机号'));

const rules = computed<Record<string, any>>(() => ({
  username: accountIsMail.value
    ? [
        { required: true, message: '请输入邮箱', type: 'error' },
        // R2：内置 email 校验类型
        { type: 'email', message: '邮箱格式不正确' },
      ]
    : [
        { required: true, message: '请输入手机号', type: 'error' },
        { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
      ],
  code: [{ required: true, message: '请输入验证码', type: 'error' }],
  newPassword: [
    { required: true, message: '请输入新密码', type: 'error' },
    { min: 8, max: 32, message: '密码长度 8–32 位', type: 'error' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', type: 'error' },
    {
      validator: (v: string) => v === form.newPassword,
      message: '两次输入的密码不一致',
    },
  ],
}));

const countdown = ref(0);
let timer: number | undefined;
function startCountdown() {
  countdown.value = 60;
  timer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && timer) window.clearInterval(timer);
  }, 1000);
}

async function onSendCode() {
  if (!form.username) {
    MessagePlugin.warning(`请先填写${accountPlaceholder.value}`);
    return;
  }
  try {
    // action 一律走字面量枚举值（后端按 string 匹配）
    await auth.sendCode(activeChannel.value, form.username, 'ResetPassword');
    startCountdown();
    MessagePlugin.success('验证码已发送');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '发送验证码失败');
  }
}

async function onSubmit(ctx: SubmitContext) {
  if (ctx.validateResult !== true) return;
  loading.value = true;
  try {
    await auth.resetPassword(form.username, form.code, form.newPassword, form.confirmPassword);
    done.value = true;
    MessagePlugin.success('密码已重置');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '重置失败');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    config.value = await auth.getLoginConfig();
  } catch {
    config.value = {};
  }
  // 仅开放一种通道时直接锁定，减少一次无谓选择
  if (!sw.value.sms && sw.value.mail) activeChannel.value = 'Mail';
});

function goLogin() {
  router.push('/login');
}
</script>

<template>
  <AuthShell
    :brand="BRAND"
    heading="重置密码"
    subheading="验证身份后设置新密码，重设后请用新密码登录"
  >
    <template #default>
      <!-- 重置成功 -->
      <template v-if="done">
        <div class="ok">
          <t-icon name="check-circle-filled" class="ok-icon" />
          <h4>密码已重置</h4>
          <p>请使用新密码登录；如非本人操作，请立即联系管理员。</p>
        </div>
        <t-button theme="primary" block size="large" @click="goLogin">前往登录</t-button>
      </template>

      <t-form v-else :data="form" :rules="rules" label-width="0" @submit="onSubmit">
        <!-- 通道选择：仅当两种通道都开放时才显示 -->
        <t-radio-group v-if="hasBoth" v-model="activeChannel" variant="default-filled" class="ch">
          <t-radio-button value="Sms">手机验证</t-radio-button>
          <t-radio-button value="Mail">邮箱验证</t-radio-button>
        </t-radio-group>

        <t-form-item name="username">
          <t-input v-model="form.username" type="text" :placeholder="accountPlaceholder" size="large" clearable>
            <template #prefix-icon>
              <t-icon :name="accountIsMail ? 'mail' : 'mobile'" />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item name="code">
          <div class="code-row">
            <t-input v-model="form.code" placeholder="验证码" size="large" clearable />
            <t-button variant="outline" size="large" :disabled="countdown > 0" @click="onSendCode">
              {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
            </t-button>
          </div>
        </t-form-item>

        <t-form-item name="newPassword">
          <t-input v-model="form.newPassword" type="password" placeholder="新密码（8–32 位）" size="large" clearable>
            <template #prefix-icon><t-icon name="lock-on" /></template>
          </t-input>
        </t-form-item>

        <t-form-item name="confirmPassword">
          <t-input v-model="form.confirmPassword" type="password" placeholder="确认新密码" size="large" clearable>
            <template #prefix-icon><t-icon name="lock-on" /></template>
          </t-input>
        </t-form-item>

        <t-button theme="primary" type="submit" block size="large" :loading="loading">重置密码</t-button>
      </t-form>

      <t-link v-if="!done" theme="primary" class="foot-link" @click="goLogin">想起密码了？返回登录</t-link>
    </template>
  </AuthShell>
</template>

<style scoped>
.ch { width: 100%; margin-bottom: 16px; }
.ch :deep(.t-radio-button) { flex: 1; }
.code-row { display: flex; gap: 8px; width: 100%; }
.code-row .t-input { flex: 1; }
.foot-link { display: block; text-align: center; margin-top: 16px; }
.ok { text-align: center; padding: 8px 0 20px; }
.ok-icon { font-size: 44px; color: var(--td-success-color); }
.ok h4 { font-size: 18px; margin: 10px 0 6px; }
.ok p { color: var(--td-text-color-secondary); font-size: 13.5px; line-height: 1.7; }
</style>
