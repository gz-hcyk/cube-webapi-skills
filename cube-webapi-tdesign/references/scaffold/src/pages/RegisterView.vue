<script setup lang="ts">
/**
 * RegisterView —— 注册页（`POST /Auth/Register`）。
 *
 * 归属：NewLife.Cube 全局认证族（`NewLife.Cube.Controllers.AuthController.Register`），
 * **无 [Area] ⇒ 不带 /api 前缀**，走 rawHttp（见 api/http.ts 的铁律 H2 判据）。
 *
 * 开关驱动（全部来自 `GET /Auth/LoginConfig` 的 `register` 段，零硬编码）：
 *   register.enabled              是否开放注册（false → 本页只给提示，不放表单）
 *   register.password            是否支持账号密码注册
 *   register.sms / register.mail 是否暴露手机 / 邮箱字段
 *   register.requireMobileVerify / register.requireMailVerify
 *                                注册后是否必须验证码验证（**决定「待激活」提示**）
 *   register.captcha             是否要图片验证码
 *
 * 后端语义（官方文档）：开启邮箱/手机验证时，注册成功返回**待激活信息**，激活后方可登录。
 * 故本页成功态按 require*Verify 分流为「待激活」或「可直接登录」。
 *
 * 校验铁律 R2：优先用组件库内置校验类型（`{ type: 'email' }`），不手写正则重复实现。
 */
import { computed, reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin, type SubmitContext } from 'tdesign-vue-next';
import AuthShell from '@/components/cube/AuthShell.vue';
import { useAuthStore, AuthCategory } from '@/stores/auth';

/* ═════════════════ L1：左栏品牌文案（按当前项目填写，禁技术栈话术） ═════════════════ */
const BRAND = {
  fallbackName: '魔方管理后台',
  tagline: '账号 · 权限 · 数据 一站式管理',
  title: '统一后台管理平台',
  subtitle: '注册账号后即可加入团队，权限由管理员按角色分配。',
  highlights: ['一个账号通行全部业务模块', '手机 / 邮箱双重验证保障安全', '注册即纳入统一的权限体系'],
};

const auth = useAuthStore();
const router = useRouter();

const config = ref<any>({});
const loading = ref(false);
const done = ref(false);
const pendingActivate = ref(false);

const reg = computed(() => config.value.register || {});
const allowRegister = computed(() => reg.value.enabled !== false);
const needMail = computed(() => !!reg.value.mail || !!reg.value.requireMailVerify);
const needMobile = computed(() => !!reg.value.sms || !!reg.value.requireMobileVerify);
const needPassword = computed(() => reg.value.password !== false);
const needCode = computed(() => !!reg.value.requireMailVerify || !!reg.value.requireMobileVerify);
const needCaptcha = computed(() => !!reg.value.captcha);
/** 验证码通道：优先按「必须验证」的通道走，其次取已开放的通道 */
const channel = computed<'Mail' | 'Sms'>(() =>
  reg.value.requireMailVerify ? 'Mail' : reg.value.requireMobileVerify ? 'Sms' : needMail.value ? 'Mail' : 'Sms',
);

const form = reactive({
  username: '',
  email: '',
  mobile: '',
  password: '',
  confirmPassword: '',
  code: '',
  captchaCode: '',
});

const rules = computed<Record<string, any>>(() => {
  const r: Record<string, any> = {
    username: [{ required: true, message: '请输入账号', type: 'error' }],
  };
  if (needMail.value) {
    // R2：内置 email 校验类型，禁手写正则
    r.email = [
      { required: true, message: '请输入邮箱', type: 'error' },
      { type: 'email', message: '邮箱格式不正确' },
    ];
  }
  if (needMobile.value) {
    r.mobile = [
      { required: true, message: '请输入手机号', type: 'error' },
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
    ];
  }
  if (needPassword.value) {
    r.password = [
      { required: true, message: '请输入密码', type: 'error' },
      { min: 8, max: 32, message: '密码长度 8–32 位', type: 'error' },
    ];
    r.confirmPassword = [
      { required: true, message: '请再次输入密码', type: 'error' },
      {
        validator: (v: string) => v === form.password,
        message: '两次输入的密码不一致',
      },
    ];
  }
  if (needCode.value) {
    r.code = [{ required: true, message: '请输入验证码', type: 'error' }];
  }
  if (needCaptcha.value) {
    r.captchaCode = [{ required: true, message: '请输入图片验证码', type: 'error' }];
  }
  return r;
});

/* 图片验证码（register.captcha=true 时） */
const captcha = reactive({ id: '', image: '' });
const captchaSrc = computed(() =>
  captcha.image ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(captcha.image))) : '',
);
async function loadCaptcha() {
  try {
    const c = await auth.getCaptcha();
    if (c) {
      captcha.id = c.captchaId;
      captcha.image = c.image;
    }
  } catch {
    /* 验证码获取失败不阻断填写，提交时后端会再次校验 */
  }
}

/* 发送验证码倒计时 */
const countdown = ref(0);
let timer: number | undefined;
function startCountdown() {
  countdown.value = 60;
  timer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && timer) window.clearInterval(timer);
  }, 1000);
}
const codeTarget = computed(() => (channel.value === 'Mail' ? form.email : form.mobile));

async function onSendCode() {
  if (!codeTarget.value) {
    MessagePlugin.warning(channel.value === 'Mail' ? '请先填写邮箱' : '请先填写手机号');
    return;
  }
  try {
    await auth.sendCode(channel.value, codeTarget.value, 'Register');
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
    await auth.registerUser({
      username: form.username,
      email: form.email,
      mobile: form.mobile,
      password: form.password,
      confirmPassword: form.confirmPassword,
      code: form.code,
      // 枚举整数（后端无 JsonStringEnumConverter，传字符串会 400）
      category: AuthCategory.Password,
      captchaId: captcha.id,
      captchaCode: form.captchaCode,
    });
    pendingActivate.value = needCode.value;
    done.value = true;
  } catch (e: any) {
    MessagePlugin.error(e?.message || '注册失败');
    if (needCaptcha.value) loadCaptcha();
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
  if (needCaptcha.value) loadCaptcha();
});

function goLogin() {
  router.push('/login');
}
</script>

<template>
  <AuthShell :brand="BRAND" heading="创建账号" subheading="填写信息即可加入平台">
    <template #default>
      <!-- 未开放注册 -->
      <template v-if="!allowRegister">
        <t-alert theme="warning" message="当前未开放自助注册，请联系管理员开通账号。" />
        <t-button theme="primary" block size="large" class="mt" @click="goLogin">返回登录</t-button>
      </template>

      <!-- 注册成功 -->
      <template v-else-if="done">
        <div class="ok">
          <t-icon name="check-circle-filled" class="ok-icon" />
          <h4>注册已提交</h4>
          <p v-if="pendingActivate">
            我们已向你的{{ channel === 'Mail' ? '邮箱' : '手机' }}发送验证信息，
            请先完成激活，之后即可登录。
          </p>
          <p v-else>账号已创建，现在就可以登录了。</p>
        </div>
        <t-button theme="primary" block size="large" @click="goLogin">前往登录</t-button>
      </template>

      <!-- 注册表单 -->
      <t-form v-else :data="form" :rules="rules" label-width="0" @submit="onSubmit">
        <t-form-item name="username">
          <t-input v-model="form.username" placeholder="账号" size="large" clearable>
            <template #prefix-icon><t-icon name="user" /></template>
          </t-input>
        </t-form-item>

        <t-form-item v-if="needMail" name="email">
          <t-input v-model="form.email" type="text" placeholder="邮箱" size="large" clearable>
            <template #prefix-icon><t-icon name="mail" /></template>
          </t-input>
        </t-form-item>

        <t-form-item v-if="needMobile" name="mobile">
          <t-input v-model="form.mobile" type="tel" placeholder="手机号" size="large" clearable>
            <template #prefix-icon><t-icon name="mobile" /></template>
          </t-input>
        </t-form-item>

        <template v-if="needPassword">
          <t-form-item name="password">
            <t-input v-model="form.password" type="password" placeholder="密码（8–32 位）" size="large" clearable>
              <template #prefix-icon><t-icon name="lock-on" /></template>
            </t-input>
          </t-form-item>
          <t-form-item name="confirmPassword">
            <t-input v-model="form.confirmPassword" type="password" placeholder="确认密码" size="large" clearable>
              <template #prefix-icon><t-icon name="lock-on" /></template>
            </t-input>
          </t-form-item>
        </template>

        <t-form-item v-if="needCode" name="code">
          <div class="code-row">
            <t-input v-model="form.code" placeholder="验证码" size="large" clearable />
            <t-button variant="outline" size="large" :disabled="countdown > 0" @click="onSendCode">
              {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
            </t-button>
          </div>
        </t-form-item>

        <t-form-item v-if="needCaptcha" name="captchaCode">
          <div class="code-row">
            <t-input v-model="form.captchaCode" placeholder="图片验证码" size="large" clearable />
            <img v-if="captcha.image" class="captcha-img" :src="captchaSrc" alt="captcha" @click="loadCaptcha" />
          </div>
        </t-form-item>

        <t-button theme="primary" type="submit" block size="large" :loading="loading">注 册</t-button>
      </t-form>

      <t-link v-if="allowRegister && !done" theme="primary" class="foot-link" @click="goLogin">
        已有账号？返回登录
      </t-link>
    </template>
  </AuthShell>
</template>

<style scoped>
.code-row { display: flex; gap: 8px; width: 100%; }
.code-row .t-input { flex: 1; }
.captcha-img {
  height: 40px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--td-component-border);
}
.foot-link { display: block; text-align: center; margin-top: 16px; }
.mt { margin-top: 16px; }
.ok { text-align: center; padding: 8px 0 20px; }
.ok-icon { font-size: 44px; color: var(--td-success-color); }
.ok h4 { font-size: 18px; margin: 10px 0 6px; }
.ok p { color: var(--td-text-color-secondary); font-size: 13.5px; line-height: 1.7; }
</style>
