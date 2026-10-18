<template>
  <section class="cube-page dash">
    <header class="cube-page__head">
      <div class="cube-page__title">
        <h1>{{ greeting }}，{{ displayName }}</h1>
        <p>{{ today }} · {{ summary }}</p>
      </div>
      <div class="cube-page__actions">
        <el-button v-if="leaves.length" :icon="Grid" @click="goFirst">进入首个模块</el-button>
      </div>
    </header>

    <!-- 概览：用真实可得的数据（菜单/账号/租户），不摆假指标 -->
    <div class="dash-stats">
      <article v-for="s in stats" :key="s.label" class="dash-stat">
        <div class="dash-stat__icon" :style="{ color: s.color, background: s.bg }">
          <el-icon :size="18"><component :is="s.icon" /></el-icon>
        </div>
        <div class="dash-stat__body">
          <span class="dash-stat__label">{{ s.label }}</span>
          <strong class="dash-stat__value" :title="String(s.value)">{{ s.value }}</strong>
        </div>
      </article>
    </div>

    <!-- 快捷入口：直接来自后端菜单，不在前端硬编码业务名字 -->
    <el-card class="cube-card" shadow="never">
      <template #header>
        <div class="dash-card-head">
          <span class="dash-card-head__title">快捷入口</span>
          <span class="cube-muted">来自你当前账号可访问的菜单</span>
        </div>
      </template>

      <div v-if="leaves.length" class="dash-entries">
        <button
          v-for="node in quickEntries"
          :key="node.id"
          type="button"
          class="dash-entry"
          @click="go(node)"
        >
          <el-icon :size="18" class="dash-entry__icon"><component :is="resolveIcon(node)" /></el-icon>
          <span class="dash-entry__name">{{ node.displayName }}</span>
          <el-icon :size="12" class="dash-entry__arrow"><ArrowRight /></el-icon>
        </button>
      </div>

      <el-empty v-else description="还没有可访问的模块，请联系管理员分配权限" :image-size="88" />
    </el-card>

    <div class="dash-bottom">
      <el-card class="cube-card" shadow="never">
        <template #header>
          <div class="dash-card-head"><span class="dash-card-head__title">系统信息</span></div>
        </template>
        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="系统名称">{{ appTitle }}</el-descriptions-item>
          <el-descriptions-item label="登录账号">{{ auth.username || '—' }}</el-descriptions-item>
          <el-descriptions-item label="数据域">{{ tenantCode || '默认' }}</el-descriptions-item>
          <el-descriptions-item label="服务地址">
            <span class="cube-mono">{{ apiBase }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="cube-card" shadow="never">
        <template #header>
          <div class="dash-card-head"><span class="dash-card-head__title">外观</span></div>
        </template>
        <div class="dash-theme">
          <div>
            <p class="dash-theme__label">当前主题</p>
            <p class="cube-muted">{{ themeLabel }}</p>
          </div>
          <el-button :icon="isDark ? Sunny : Moon" @click="toggleTheme">
            {{ isDark ? '切换到浅色' : '切换到深色' }}
          </el-button>
        </div>
        <p class="dash-theme__hint">右下角齿轮可调整品牌色、密度与侧栏折叠。</p>
      </el-card>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, Grid, Menu as MenuIcon, Moon, OfficeBuilding, Sunny, User } from '@element-plus/icons-vue';
import { API_BASE } from '@/api/http';
import { getTenantCode } from '@/api/token';
import { APP_TITLE } from '@/config/app';
import { useAuthStore } from '@/stores/auth';
import { useSettingStore } from '@/stores/setting';
import { countMenus, flattenLeaves, menuPath, resolveIcon, type MenuNode } from '@/utils/menu';

/**
 * 工作台（登录后的默认落地页，铁律 E4-M3）
 * 数据全部来自已在布局层加载的菜单，不额外发请求。
 */
const router = useRouter();
const auth = useAuthStore();
const setting = useSettingStore();

const appTitle = APP_TITLE;
const apiBase = API_BASE;
const tenantCode = getTenantCode();
const isDark = computed(() => setting.isDark);

const leaves = computed(() => flattenLeaves(auth.menus));
const quickEntries = computed(() => leaves.value.slice(0, 8));

const displayName = computed(() => auth.username || '管理员');
const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const today = computed(() =>
  new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
);

const summary = computed(() => {
  if (!leaves.value.length) return '当前账号还没有可访问的业务模块';
  return `可访问 ${countMenus(auth.menus)} 个菜单、${leaves.value.length} 个业务模块`;
});

const themeLabel = computed(() => {
  const mode = setting.themeMode;
  if (mode === 'auto') return '跟随系统';
  return mode === 'dark' ? '深色' : '浅色';
});

const stats = computed(() => [
  {
    label: '可访问菜单',
    value: countMenus(auth.menus),
    icon: MenuIcon,
    color: 'var(--el-color-primary)',
    bg: 'var(--el-color-primary-light-9)',
  },
  {
    label: '业务模块',
    value: leaves.value.length,
    icon: Grid,
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.1)',
  },
  {
    label: '当前账号',
    value: auth.username || '—',
    icon: User,
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.1)',
  },
  {
    label: '数据域',
    value: tenantCode || '默认',
    icon: OfficeBuilding,
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.1)',
  },
]);

function go(node: MenuNode) {
  const path = menuPath(node);
  if (path) router.push(path);
}

function goFirst() {
  const first = leaves.value[0];
  if (first) go(first);
}

function toggleTheme() {
  setting.setTheme(isDark.value ? 'light' : 'dark');
}
</script>

<style scoped>
.dash-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--cube-gap-sm);
}

.dash-stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--cube-radius-card);
  box-shadow: var(--cube-shadow-sm);
  transition: box-shadow var(--cube-duration) var(--cube-ease), transform var(--cube-duration) var(--cube-ease);
}

.dash-stat:hover {
  transform: translateY(-1px);
  box-shadow: var(--cube-shadow-md);
}

.dash-stat__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  flex-shrink: 0;
}

.dash-stat__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dash-stat__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dash-stat__value {
  overflow: hidden;
  font-size: 20px;
  font-weight: 600;
  line-height: 26px;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
}

.dash-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.dash-card-head__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dash-entries {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.dash-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  text-align: left;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--cube-radius-control);
  cursor: pointer;
  transition: all var(--cube-duration) var(--cube-ease);
}

.dash-entry:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.dash-entry__icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.dash-entry__name {
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
}

.dash-entry__arrow {
  color: var(--el-text-color-placeholder);
}

.dash-entry:hover .dash-entry__arrow {
  color: var(--el-color-primary);
}

.dash-bottom {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--cube-gap-sm);
}

.dash-theme {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.dash-theme__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.dash-theme__hint {
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-placeholder);
}

@media (max-width: 1200px) {
  .dash-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .dash-bottom {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .dash-stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
