<script setup lang="ts">
/**
 * AuthShell —— 认证族页面统一外壳（登录 / 注册 / 忘记密码 / 激活 共用）。
 *
 * 对标魔方 MVC 认证页的模块化版式：**左栏品牌叙事 + 右栏表单卡**，
 * 把「品牌栏 / 卡片外壳 / 版权署名」抽成公共组件，页面只负责中段表单
 * （即 MVC 里「一个认证动作一个视图」的等价物，覆盖点见 references/page-composition.md）。
 *
 * 数据来源与铁律（L1~L4，见 SKILL.md）：
 *  - 系统名 / Logo / 版权 / 备案 / 登录提示：一律取 `GET /Auth/LoginConfig`（本组件负责拉取，
 *    经 `#default` 插槽把 config 交给页面，避免每个认证页各拉一次、各写一份兜底）；
 *  - L1：左栏文案由 `brand` 传入，**必须按项目业务填写**，禁技术栈话术；
 *  - L3：页面不渲染任何接口路径 / 加密方式等实现细节（只留在代码注释）；
 *  - L4：认证页**不设租户选择**——租户由后端登录响应头 `X-Tenant` 下发，http.ts 自动捕获持久化。
 */
import { computed, onMounted, ref } from 'vue';
import { useAuthStore, type LoginConfig } from '@/stores/auth';

const props = withDefaults(
  defineProps<{
    /**
     * 左栏品牌文案（L1，按项目填写）。
     * 四项中 tagline 与 highlights 至少给出内容，否则左栏空白。
     */
    brand: {
      /** LoginConfig 未下发系统名时的兜底品牌名（填项目名，勿填框架名） */
      fallbackName: string;
      /** 品牌名下的一句定位语，建议「能力A · 能力B · 能力C」 */
      tagline?: string;
      /** 主标题，支持换行（CSS white-space: pre-line） */
      title?: string;
      /** 主标题下一段说明 */
      subtitle?: string;
      /** 2~4 条核心能力要点 */
      highlights?: string[];
    };
    /** 卡片主标题（如「创建账号」「重置密码」） */
    heading: string;
    /** 卡片副标题 */
    subheading?: string;
  }>(),
  { subheading: '' },
);

const auth = useAuthStore();
const config = ref<LoginConfig>({});
const logoBroken = ref(false);

/** 左栏 Logo：优先 loginLogo，其次 logo；加载失败回退系统名首字母方块 */
const brandLogo = computed<string>(() => {
  const u = config.value.loginLogo || config.value.logo || '';
  return !logoBroken.value && u ? u : '';
});

/** 登录页背景图（loginBackground 有值时叠加到品牌渐变之上） */
const bgStyle = computed(() =>
  config.value.loginBackground
    ? {
        backgroundImage: `url("${config.value.loginBackground}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {},
);

onMounted(async () => {
  try {
    config.value = await auth.getLoginConfig();
  } catch {
    // 配置拉取失败不阻断认证流程：退化为仅有兜底品牌名的最小外观
    config.value = {};
  }
});
</script>

<template>
  <div class="auth-wrap">
    <!-- 左栏：品牌叙事（模块化，可整块替换而不动表单） -->
    <div class="auth-left" :style="bgStyle">
      <div class="al-logo">
        <div class="lg">
          <img v-if="brandLogo" :src="brandLogo" alt="logo" class="lg-img" @error="logoBroken = true" />
          <template v-else>{{ (config.name || brand.fallbackName).charAt(0) }}</template>
        </div>
        <div>
          <b>{{ config.name || brand.fallbackName }}</b>
          <span v-if="brand.tagline">{{ brand.tagline }}</span>
        </div>
      </div>
      <h2 v-if="brand.title" class="al-title">{{ brand.title }}</h2>
      <p v-if="brand.subtitle">{{ brand.subtitle }}</p>
      <div v-if="brand.highlights && brand.highlights.length" class="al-feat">
        <div v-for="(h, i) in brand.highlights" :key="i"><t-icon name="check" /> {{ h }}</div>
      </div>
    </div>

    <!-- 右栏：表单卡外壳（页面只填中段） -->
    <div class="auth-right">
      <div class="auth-card">
        <h3>{{ heading }}</h3>
        <div v-if="subheading" class="sub">{{ subheading }}</div>
        <slot :config="config" />
        <div v-if="config.copyright" class="copyright" v-html="config.copyright" />
        <a
          v-if="config.registration"
          class="beian"
          href="https://www.beianx.cn/"
          target="_blank"
          rel="noreferrer"
        >{{ config.registration }}</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap { display: flex; min-height: 100vh; }
.auth-left {
  flex: 1; background: var(--cube-brand-gradient-iot);
  color: #fff; display: flex; flex-direction: column; justify-content: center;
  padding: 64px; position: relative; overflow: hidden;
}
.auth-left::after {
  content: ''; position: absolute; right: -120px; bottom: -120px; width: 380px; height: 380px;
  border-radius: 50%; background: radial-gradient(circle, rgba(74, 150, 235, 0.5), transparent 70%);
}
.al-logo { display: flex; align-items: center; gap: 12px; position: relative; z-index: 2; }
.al-logo .lg {
  width: 46px; height: 46px; border-radius: 12px; background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 20px; overflow: hidden;
}
.al-logo .lg-img { width: 100%; height: 100%; object-fit: contain; }
.al-logo b { font-size: 18px; display: block; }
.al-logo span { font-size: 12px; color: rgba(255, 255, 255, 0.7); }
.auth-left h2 { font-size: 30px; margin: 48px 0 14px; position: relative; z-index: 2; line-height: 1.3; }
/* L1：主标题支持换行 */
.al-title { white-space: pre-line; }
.auth-left p {
  color: rgba(255, 255, 255, 0.78); font-size: 15px; max-width: 420px;
  position: relative; z-index: 2; line-height: 1.7;
}
.al-feat {
  margin-top: 36px; position: relative; z-index: 2;
  display: flex; flex-direction: column; gap: 14px;
  color: rgba(255, 255, 255, 0.9); font-size: 14px;
}
.al-feat div { display: flex; align-items: center; gap: 10px; }
.al-feat :deep(.t-icon) { color: #7fb2ff; }
.auth-right { flex: 1; display: flex; align-items: center; justify-content: center; background: #fff; }
.auth-card { width: 400px; max-width: 90%; }
.auth-card h3 { font-size: 24px; font-weight: 600; margin-bottom: 6px; }
.auth-card .sub { color: var(--td-text-color-secondary); margin-bottom: 20px; font-size: 13.5px; }
.copyright { margin-top: 12px; font-size: 12px; color: var(--td-text-color-secondary); text-align: center; }
.beian {
  display: block; text-align: center; margin-top: 4px;
  font-size: 12px; color: var(--td-text-color-placeholder);
}
/* 窄屏：左栏收起，仅留表单（认证页可用性优先） */
@media (max-width: 860px) {
  .auth-left { display: none; }
}
</style>
