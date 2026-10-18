<template>
  <!-- 认证页外壳：左品牌 / 右表单。登录、注册、找回密码共用，换页面不换骨架 -->
  <div class="auth">
    <aside class="auth__side">
      <div class="auth__glow auth__glow--1" aria-hidden="true" />
      <div class="auth__glow auth__glow--2" aria-hidden="true" />
      <div class="auth__grid" aria-hidden="true" />

      <div class="auth__brand">
        <span class="auth__mark">{{ initial }}</span>
        <span class="auth__name">{{ PROJECT.name }}</span>
      </div>

      <div class="auth__pitch">
        <h1 class="auth__tagline">{{ PROJECT.tagline }}</h1>
        <ul class="auth__highlights">
          <li v-for="item in PROJECT.highlights" :key="item">
            <el-icon class="auth__check"><Select /></el-icon>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>

      <footer class="auth__copyright">© {{ year }} {{ PROJECT.name }}</footer>
    </aside>

    <main class="auth__main">
      <div class="auth__mobile-brand">
        <span class="auth__mark">{{ initial }}</span>
        <span class="auth__name">{{ PROJECT.name }}</span>
      </div>

      <div class="auth__card">
        <header class="auth__head">
          <h2>{{ heading }}</h2>
          <p v-if="subheading">{{ subheading }}</p>
        </header>
        <slot />
      </div>

      <p class="auth__legal">继续使用即表示你已阅读并同意平台的使用条款与隐私政策</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Select } from '@element-plus/icons-vue';
import { PROJECT } from '@/config/app';

/**
 * 认证页外壳（铁律 E5-L1：左栏文案来自 PROJECT，必须是业务语言）
 * 结构：左侧品牌叙事（深蓝渐变 + 3 条能力）+ 右侧表单白卡。
 * 980px 以下隐藏左栏，保留顶部小品牌，避免手机上出现"半屏空白"。
 */
withDefaults(defineProps<{ heading?: string; subheading?: string }>(), {
  heading: '登录',
  subheading: '',
});
const year = new Date().getFullYear();
const initial = computed(() => PROJECT.name.slice(0, 1).toUpperCase());
</script>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: minmax(360px, 44%) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--el-bg-color);
}

/* ============================ 左栏 ============================ */
.auth__side {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 48px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(155deg, #0a1a33 0%, #123a76 52%, #1d4ed8 100%);
}

.auth__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
}

.auth__glow--1 {
  top: -120px;
  right: -80px;
  width: 380px;
  height: 380px;
  background: rgba(96, 165, 250, 0.45);
}

.auth__glow--2 {
  bottom: -160px;
  left: -100px;
  width: 420px;
  height: 420px;
  background: rgba(37, 99, 235, 0.5);
}

/* 细网格：给纯渐变一点"工程感"，非常低对比，不抢文字 */
.auth__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 30% 20%, #000 20%, transparent 75%);
  pointer-events: none;
}

.auth__brand,
.auth__pitch,
.auth__copyright {
  position: relative;
  z-index: 1;
}

.auth__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 16px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 10px;
  backdrop-filter: blur(6px);
}

.auth__name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.auth__pitch {
  max-width: 420px;
}

.auth__tagline {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.auth__highlights {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  margin: 28px 0 0;
  list-style: none;
}

.auth__highlights li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.82);
}

.auth__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 11px;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 50%;
}

.auth__copyright {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* ============================ 右栏 ============================ */
.auth__main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.auth__mobile-brand {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
  color: var(--el-text-color-primary);
}

.auth__mobile-brand .auth__mark {
  color: #fff;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-dark-2));
  border: none;
}

.auth__card {
  width: 100%;
  max-width: 380px;
}

.auth__head {
  margin-bottom: 28px;
}

.auth__head h2 {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.auth__head p {
  margin-top: 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
}

.auth__legal {
  max-width: 380px;
  margin-top: 32px;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  color: var(--el-text-color-placeholder);
}

/* ============================ 响应式 ============================ */
@media (max-width: 980px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }

  .auth__side {
    display: none;
  }

  .auth__mobile-brand {
    display: flex;
  }

  .auth__main {
    justify-content: flex-start;
    padding-top: 12vh;
  }
}
</style>
