<template>
  <div class="cube-layout" :class="{ 'is-collapsed': collapsed, 'is-narrow': isNarrow, 'is-mobile-open': mobileOpen }">
    <!-- 遮罩：窄屏下点空白收起侧栏 -->
    <div v-if="isNarrow && mobileOpen" class="cube-backdrop" @click="mobileOpen = false" />

    <aside class="cube-sidebar">
      <!-- 品牌区：点击必须回工作台（铁律 E4-M3） -->
      <div class="cube-brand" role="button" tabindex="0" @click="goHome" @keyup.enter="goHome">
        <div class="cube-brand__mark">{{ brandInitial }}</div>
        <span v-show="!collapsed" class="cube-brand__name">{{ appTitle }}</span>
      </div>

      <el-scrollbar class="cube-sidebar__scroll">
        <div v-if="menuLoading" class="cube-menu-skeleton">
          <el-skeleton :rows="6" animated />
        </div>

        <div v-else-if="menuError" class="cube-menu-error">
          <p>{{ menuError }}</p>
          <el-button size="small" @click="loadMenus(true)">重试</el-button>
        </div>

        <el-menu
          v-else
          ref="menuRef"
          :default-active="activeIndex"
          :default-openeds="openeds"
          :collapse="collapsed"
          :collapse-transition="false"
          class="cube-menu"
          @select="onSelect"
          @open="onOpen"
        >
          <MenuItems :nodes="menus" />
        </el-menu>

        <el-empty v-if="!menuLoading && !menuError && !menus.length" description="当前账号暂无可访问菜单" :image-size="72" />
      </el-scrollbar>
    </aside>

    <div class="cube-main">
      <header class="cube-header">
        <div class="cube-header__left">
          <el-button text class="cube-header__icon-btn" :aria-label="collapsed ? '展开菜单' : '收起菜单'" @click="toggleSidebar">
            <el-icon :size="18"><component :is="collapsed ? Expand : Fold" /></el-icon>
          </el-button>

          <el-breadcrumb separator="/" class="cube-breadcrumb">
            <el-breadcrumb-item :to="{ path: DEFAULT_ROUTE }">工作台</el-breadcrumb-item>
            <el-breadcrumb-item v-for="node in trail" :key="node.id">{{ node.displayName }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="cube-header__right">
          <el-tag v-if="tenantCode" size="small" effect="plain" round class="cube-tenant">{{ tenantCode }}</el-tag>

          <el-tooltip :content="isDark ? '切换到浅色' : '切换到深色'" placement="bottom">
            <el-button text circle class="cube-header__icon-btn" aria-label="切换主题" @click="toggleTheme">
              <el-icon :size="17"><component :is="isDark ? Sunny : Moon" /></el-icon>
            </el-button>
          </el-tooltip>

          <el-dropdown trigger="click" @command="onCommand">
            <span class="cube-user">
              <el-avatar :size="26" class="cube-user__avatar">{{ initial }}</el-avatar>
              <span class="cube-user__name">{{ displayName }}</span>
              <el-icon :size="12"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <span class="cube-muted">已登录：{{ auth.username || '—' }}</span>
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="cube-content">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>

    <!-- 外观设置：主题 / 品牌色 / 密度（E7 第三处接线，删了等于没做暗色） -->
    <SettingPanel />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown, Expand, Fold, Moon, Sunny } from '@element-plus/icons-vue';
import MenuItems from '@/components/cube/MenuItems.vue';
import SettingPanel from '@/components/cube/SettingPanel.vue';
import { APP_TITLE, DEFAULT_ROUTE } from '@/config/app';
import { getTenantCode } from '@/api/token';
import { useAuthStore } from '@/stores/auth';
import { useSettingStore } from '@/stores/setting';
import { flattenLeaves, menuPath, type MenuNode } from '@/utils/menu';

/**
 * 主框架（侧栏 + 顶栏 + 内容区）
 *
 * 铁律 E4：
 *  M1 菜单只来自后端 GetMenuTree，前端不 push 任何业务项
 *  M2 只做 url → 路由归一化（menuPath），不产生新入口
 *  M3 品牌点击回工作台
 *  M4 一级菜单必须有图标（resolveIcon 推断兜底）
 *  M5 同层只展开一个（@open 时关闭同父兄弟，不同父互不影响）
 */
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const setting = useSettingStore();

const appTitle = APP_TITLE;
const DEFAULT_ROUTE_PATH = DEFAULT_ROUTE;
const tenantCode = ref(getTenantCode());
const menuRef = ref<any>(null);
const menuLoading = ref(false);
const menuError = ref('');
const mobileOpen = ref(false);
const isNarrow = ref(false);

const collapsed = computed(() => !isNarrow.value && setting.collapsed);
const isDark = computed(() => setting.isDark);
const menus = computed<MenuNode[]>(() => auth.menus);
const brandInitial = computed(() => appTitle.slice(0, 1).toUpperCase());
const displayName = computed(() => auth.username || '未命名用户');
const initial = computed(() => (auth.username || 'U').slice(0, 1).toUpperCase());

/** index → 节点（含所有层级） */
const indexMap = computed(() => {
  const map = new Map<string, MenuNode>();
  const visit = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      map.set(`menu-${n.id}`, n);
      if (n.children?.length) visit(n.children);
    }
  };
  visit(menus.value);
  return map;
});

/** index → 父 index（同层互斥判定用） */
const parentOf = computed(() => {
  const map = new Map<string, string | null>();
  const visit = (nodes: MenuNode[], parent: string | null) => {
    for (const n of nodes) {
      const idx = `menu-${n.id}`;
      map.set(idx, parent);
      if (n.children?.length) visit(n.children, idx);
    }
  };
  visit(menus.value, null);
  return map;
});

function matchesRoute(node: MenuNode): boolean {
  const path = menuPath(node);
  if (!path) return false;
  return route.path === path || route.path.startsWith(path + '/');
}

const activeIndex = computed(() => {
  for (const [idx, node] of indexMap.value) if (matchesRoute(node)) return idx;
  return '';
});

const trail = computed<MenuNode[]>(() => {
  const hit = [...indexMap.value.entries()].find(([, n]) => matchesRoute(n));
  if (!hit) return [];
  const chain: MenuNode[] = [];
  let cur: string | null = hit[0];
  while (cur) {
    const node = indexMap.value.get(cur);
    if (node) chain.unshift(node);
    cur = parentOf.value.get(cur) ?? null;
  }
  return chain;
});

/** 首屏展开当前路由的祖先链 */
const openeds = computed(() => {
  const chain: string[] = [];
  let cur: string | null = activeIndex.value || null;
  while (cur) {
    chain.unshift(cur);
    cur = parentOf.value.get(cur) ?? null;
  }
  return chain.slice(0, -1);
});

async function loadMenus(force = false) {
  menuLoading.value = true;
  menuError.value = '';
  try {
    await auth.loadMenus(force);
  } catch (e: any) {
    menuError.value = e?.message || '菜单加载失败';
  } finally {
    menuLoading.value = false;
  }
}

function onSelect(index: string) {
  const node = indexMap.value.get(index);
  mobileOpen.value = false;
  if (!node) return;
  const path = menuPath(node);
  if (path && path !== route.path) router.push(path);
}

/** M5：展开某分组时，关闭同父节点下的其它分组；不同父节点互不影响 */
function onOpen(index: string) {
  const parent = parentOf.value.get(index) ?? null;
  for (const [idx, p] of parentOf.value) {
    if (idx !== index && (p ?? null) === parent) menuRef.value?.close?.(idx);
  }
}

function goHome() {
  router.push(DEFAULT_ROUTE_PATH);
}

function toggleSidebar() {
  if (isNarrow.value) mobileOpen.value = !mobileOpen.value;
  else setting.toggleCollapsed();
}

function toggleTheme() {
  setting.setTheme(isDark.value ? 'light' : 'dark');
}

async function onCommand(command: string) {
  if (command !== 'logout') return;
  try {
    await ElMessageBox.confirm('退出后需要重新登录，确定退出吗？', '退出登录', {
      type: 'warning',
      confirmButtonText: '退出',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await auth.logout();
  ElMessage.success('已退出登录');
  router.replace('/login');
}

let media: MediaQueryList | null = null;
function syncNarrow() {
  isNarrow.value = !!media?.matches;
  if (!isNarrow.value) mobileOpen.value = false;
}

onMounted(() => {
  media = window.matchMedia('(max-width: 900px)');
  syncNarrow();
  media.addEventListener?.('change', syncNarrow);
  loadMenus();
});

onBeforeUnmount(() => {
  media?.removeEventListener?.('change', syncNarrow);
});

/** 路由变化：收起移动端菜单，并展开当前项的祖先链 */
watch(
  () => route.path,
  () => {
    mobileOpen.value = false;
    let cur: string | null = activeIndex.value || null;
    const chain: string[] = [];
    while (cur) {
      chain.unshift(cur);
      cur = parentOf.value.get(cur) ?? null;
    }
    chain.slice(0, -1).forEach((idx) => menuRef.value?.open?.(idx));
  },
);

/** 工作台快捷入口复用同一份菜单数据，避免第二次请求 */
const leaves = computed(() => flattenLeaves(menus.value));
defineExpose({ leaves });
</script>

<style scoped>
.cube-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--el-bg-color-page);
}

/* ============================ 侧栏 ============================ */
.cube-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--cube-sidebar-width);
  width: var(--cube-sidebar-width);
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  transition: width var(--cube-duration) var(--cube-ease), flex-basis var(--cube-duration) var(--cube-ease);
  z-index: 30;
}

.is-collapsed .cube-sidebar {
  flex-basis: var(--cube-sidebar-collapsed);
  width: var(--cube-sidebar-collapsed);
}

.cube-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--cube-header-height);
  padding: 0 16px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.cube-brand__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-dark-2));
  border-radius: 9px;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.28);
}

.cube-brand__name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
}

.cube-sidebar__scroll {
  flex: 1;
  padding: 8px 0 16px;
  overflow-x: hidden;
}

.cube-menu {
  border-right: none;
  background: transparent;
}

.cube-menu:not(.el-menu--collapse) {
  width: 100%;
}

/* 菜单项：8px 圆角 + 选中底色 + 左侧 3px 指示条 */
.cube-menu :deep(.el-menu-item),
.cube-menu :deep(.el-sub-menu__title) {
  height: 38px;
  line-height: 38px;
  margin: 2px 8px;
  padding-left: 12px !important;
  border-radius: var(--cube-radius-control);
  font-size: 13.5px;
  color: var(--el-text-color-regular);
}

.cube-menu :deep(.el-menu-item:hover),
.cube-menu :deep(.el-sub-menu__title:hover) {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.cube-menu :deep(.el-menu-item.is-active) {
  position: relative;
  font-weight: 500;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.cube-menu :deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 16px;
  background: var(--el-color-primary);
  border-radius: 0 3px 3px 0;
  transform: translateY(-50%);
}

.cube-menu :deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
  padding-left: 40px !important;
}

.cube-menu :deep(.el-icon) {
  width: 18px;
  font-size: 16px;
}

.cube-menu-skeleton {
  padding: 8px 16px;
}

.cube-menu-error {
  padding: 16px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-color-danger);
}

.cube-menu-error .el-button {
  margin-top: 8px;
}

/* ============================ 主区 ============================ */
.cube-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.cube-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--cube-header-height);
  padding: 0 20px 0 12px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.cube-header__left,
.cube-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cube-header__icon-btn {
  color: var(--el-text-color-regular);
}

.cube-breadcrumb {
  font-size: 13px;
}

.cube-breadcrumb :deep(.el-breadcrumb__inner) {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.cube-breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.cube-tenant {
  font-family: var(--cube-font-mono);
  font-size: 11px;
}

.cube-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--cube-radius-control);
  cursor: pointer;
  transition: background var(--cube-duration) var(--cube-ease);
}

.cube-user:hover {
  background: var(--el-fill-color-light);
}

.cube-user__avatar {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  font-weight: 600;
}

.cube-user__name {
  max-width: 120px;
  overflow: hidden;
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cube-content {
  flex: 1;
  padding: var(--cube-page-padding);
  overflow: auto;
}

/* ============================ 窄屏 ============================ */
.is-narrow .cube-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  transition: transform var(--cube-duration) var(--cube-ease);
  box-shadow: var(--cube-shadow-lg);
}

.is-narrow.is-mobile-open .cube-sidebar {
  transform: none;
}

.cube-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: 25;
}

.is-narrow .cube-content {
  padding: 12px;
}

@media (max-width: 640px) {
  .cube-user__name,
  .cube-tenant {
    display: none;
  }
}
</style>
