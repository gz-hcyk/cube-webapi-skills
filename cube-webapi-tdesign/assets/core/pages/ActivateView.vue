<script setup lang="ts">
/**
 * ActivateView —— 账号激活页（对齐 MVC 认证族的「一个动作一个页面」组织）。
 *
 * 端点（`NewLife.Cube.Controllers.AuthController`，**根族 ⇒ 无 /api 前缀**，走 rawHttp）：
 *   - `POST /Auth/Activate { account, code }`            验证码激活
 *   - `POST /Auth/SendActivateCode { channel, account }` 重发验证码（channel: 'Sms' | 'Mail'）
 *   - `GET  /Auth/Activate?token=&account=`              邮件链接直达激活
 *
 * ★★ 实测警示（NewLife.Cube 6.15.2026.901 / net9.0，`GET /Cube/Apis` 全量签名 + 端点探针）：
 *   **`Auth/Activate` 与 `Auth/SendActivateCode` 在该版本并不存在（均 404）**。
 *   Auth 控制器仅 11 个动作：Login / SendCode / Refresh / Captcha / LoginConfig / Info /
 *   Logout / Challenge / ResetPassword / OAuthPendingInfo / Register —— 没有激活动作。
 *   故本页的正确用法是：
 *     · 若部署自建了这两个端点 → 直接可用（本页按此契约实现）；
 *     · 若为原生 6.15 → 页面**显式提示「当前部署未开放激活接口」**，发送验证码降级到
 *       实测存在的 `POST /Auth/SendCode { channel, username, action:'Register' }`，
 *       绝不静默失败（点按钮没反应是最难查的一类缺陷）。
 *   全量页面目录（cube-page-catalog.md §4.1）已按实测结果标注该行。
 *
 * 版式：复用 `AuthShell`（左栏品牌 + 右栏表单卡），与注册/忘记密码同一套外壳，
 * 这样认证族四个页面在视觉上是一组，符合 MVC 版「共用布局 + 各自动作视图」的组织方式。
 *
 * 直达链接：邮件里的链接带 `token` 与 `account`，进页面先自动激活一次，
 * 成功后展示结果态；失败才退回「手填验证码」表单（不把用户堵在死路上）。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin, type SubmitContext } from 'tdesign-vue-next';
import AuthShell from '@/components/cube/AuthShell.vue';
import { getRaw, postRaw } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

/* ═════════════════ L1：左栏品牌文案（按当前项目填写，禁技术栈话术） ═════════════════ */
const BRAND = {
  fallbackName: '魔方管理后台',
  tagline: '账号 · 权限 · 数据 一站式管理',
  title: '激活你的账号',
  subtitle: '完成一次验证即可启用账号，随后用注册时的账号密码登录。',
  highlights: ['验证码有效期有限，请及时完成', '激活后原注册信息即可直接登录', '遇到问题可联系管理员协助'],
};

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const config = ref<any>({});
const loading = ref(false);
const done = ref(false);
const activeChannel = ref<'Sms' | 'Mail'>('Mail');
const form = reactive({ account: '', code: '' });

/** 通道开关来自 LoginConfig.register（与注册页同源，不另造开关） */
const sw = computed(() => ({
  sms: !!config.value.register?.sms,
  mail: !!config.value.register?.mail,
}));
const hasBoth = computed(() => sw.value.sms && sw.value.mail);
const accountIsMail = computed(() => activeChannel.value === 'Mail');
const accountPlaceholder = computed(() => (accountIsMail.value ? '注册邮箱' : '注册手机号'));

const rules = computed<Record<string, any>>(() => ({
  account: accountIsMail.value
    ? [
        { required: true, message: '请输入邮箱', type: 'error' },
        // R2：内置 email 校验类型，不手写正则
        { type: 'email', message: '邮箱格式不正确' },
      ]
    : [
        { required: true, message: '请输入手机号', type: 'error' },
        { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
      ],
  code: [{ required: true, message: '请输入验证码', type: 'error' }],
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

/** 是否为「端点不存在」（404）——据此区分「功能未开放」与「操作失败」 */
function isNotFound(e: any): boolean {
  return e?.response?.status === 404;
}

/** 该部署是否缺少激活动作（首次探测后置位，界面据此显式说明原因） */
const activateUnavailable = ref(false);

async function onSendCode() {
  if (!form.account) {
    MessagePlugin.warning(`请先填写${accountPlaceholder.value}`);
    return;
  }
  try {
    // 优先走上报的激活发码端点；不存在则降级到通用 SendCode（实测存在）
    try {
      const env = await postRaw<any>('/Auth/SendActivateCode', {
        channel: activeChannel.value,
        account: form.account,
      });
      if (env.code !== 0) throw new Error(env.message || '发送失败');
    } catch (e: any) {
      if (!isNotFound(e)) throw e;
      activateUnavailable.value = true;
      const env = await postRaw<any>('/Auth/SendCode', {
        channel: activeChannel.value,
        username: form.account,
        action: 'Register',
      });
      if (env.code !== 0) throw new Error(env.message || '发送失败');
    }
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
    try {
      const env = await postRaw<any>('/Auth/Activate', { account: form.account, code: form.code });
      if (env.code !== 0) throw new Error(env.message || '激活失败');
    } catch (e: any) {
      // 端点不存在 → 明确告知「该部署未开放激活」，而不是抛一句看不懂的 404
      if (isNotFound(e)) {
        activateUnavailable.value = true;
        throw new Error('当前部署未开放账号激活接口，请联系管理员开通或直接在登录页登录');
      }
      throw e;
    }
    done.value = true;
    MessagePlugin.success('账号已激活');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '激活失败');
  } finally {
    loading.value = false;
  }
}

/** 邮件链接直达：/activate?token=xxx&account=yyy */
async function tryDirectActivate() {
  const token = String(route.query.token ?? '');
  const account = String(route.query.account ?? '');
  if (!token) return;
  if (account) form.account = account;
  loading.value = true;
  try {
    const env = await getRaw<any>('/Auth/Activate', account ? { token, account } : { token });
    if (env.code !== 0) throw new Error(env.message || '链接已失效');
    done.value = true;
    MessagePlugin.success('账号已激活');
  } catch (e: any) {
    if (isNotFound(e)) activateUnavailable.value = true;
    MessagePlugin.warning(e?.message || '链接已失效，请重新获取验证码');
  } finally {
    loading.value = false;
  }
}

function goLogin() {
  router.push('/login');
}

onMounted(async () => {
  try {
    config.value = await auth.getLoginConfig();
  } catch {
    config.value = {};
  }
  // 仅开放一种通道时直接锁定
  if (!sw.value.mail && sw.value.sms) activeChannel.value = 'Sms';
  await tryDirectActivate();
});
</script>

<template>
  <AuthShell :brand="BRAND" heading="账号激活" subheading="完成验证后即可登录，激活仅需一次">
    <template #default>
      <!-- 激活成功 -->
      <template v-if="done">
        <div class="ok">
          <t-icon name="check-circle-filled" class="ok-icon" />
          <h4>账号已激活</h4>
          <p>现在可以使用注册时的账号与密码登录。</p>
        </div>
        <t-button theme="primary" block size="large" @click="goLogin">前往登录</t-button>
      </template>

      <t-form v-else :data="form" :rules="rules" label-width="0" @submit="onSubmit">
        <!-- 该部署是否开放激活接口：探测到 404 后显式说明，避免用户反复尝试 -->
        <t-alert
          v-if="activateUnavailable"
          theme="warning"
          class="unavailable-tip"
          message="当前部署未开放账号激活接口，请直接登录或联系管理员。"
        />
        <!-- 通道选择：仅当两种通道都开放时才显示 -->
        <t-radio-group v-if="hasBoth" v-model="activeChannel" variant="default-filled" class="ch">
          <t-radio-button value="Mail">邮箱验证</t-radio-button>
          <t-radio-button value="Sms">手机验证</t-radio-button>
        </t-radio-group>

        <t-form-item name="account">
          <t-input v-model="form.account" type="text" :placeholder="accountPlaceholder" size="large" clearable>
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

        <t-button theme="primary" type="submit" block size="large" :loading="loading">激活账号</t-button>
      </t-form>

      <t-link v-if="!done" theme="primary" class="foot-link" @click="goLogin">已激活？返回登录</t-link>
    </template>
  </AuthShell>
</template>

<style scoped>
.ch { width: 100%; margin-bottom: 16px; }
.ch :deep(.t-radio-button) { flex: 1; }
.code-row { display: flex; gap: 8px; width: 100%; }
.unavailable-tip { margin-bottom: 16px; }
.code-row :deep(.t-input) { flex: 1; }
.foot-link { display: block; text-align: center; margin-top: 16px; }
.ok { text-align: center; padding: 8px 0 20px; }
.ok-icon { font-size: 44px; color: var(--td-success-color); }
.ok h4 { font-size: 18px; margin: 10px 0 6px; }
.ok p { color: var(--td-text-color-secondary); font-size: 13.5px; line-height: 1.7; }
</style>
