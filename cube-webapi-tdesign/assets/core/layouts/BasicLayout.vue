<template>
  <t-layout class="basic-layout">
    <t-aside :width="collapsed ? '64px' : '232px'" class="side">
      <div class="side-brand" @click="goHome">
        <div class="lg">C</div>
        <b v-show="!collapsed">魔方管理后台</b>
      </div>
      <div class="side-menu">
        <MenuSidebar
          orientation="vertical"
          theme="light"
          :collapsed="collapsed"
          @navigate="onNavigate"
        />
      </div>
      <div class="user-bar">
        <t-avatar size="28px">{{ initial }}</t-avatar>
        <span v-show="!collapsed" class="uname">{{ username }}</span>
        <t-link v-show="!collapsed" theme="danger" hover="color" @click="onLogout">退出</t-link>
      </div>
    </t-aside>

    <t-layout>
      <t-header class="topbar">
        <t-button theme="default" variant="text" shape="square" @click="collapsed = !collapsed">
          <t-icon name="menu-fold" />
        </t-button>
        <div class="crumb-nav">
          <span>{{ areaLabel }}</span>
          <t-icon name="chevron-right" />
          <b>{{ controllerLabel }}</b>
        </div>
        <div class="top-actions">
          <span class="user">{{ username }}</span>
          <t-dropdown :options="userMenu" @click="onUserMenu">
            <t-avatar size="32px" class="avatar-btn">{{ initial }}</t-avatar>
          </t-dropdown>
        </div>
      </t-header>

      <t-content class="content">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </router-view>
      </t-content>
    </t-layout>

    <!--
      个性化配置入口（悬浮齿轮按钮 + 右侧抽屉）：
      主题模式（亮/暗）切换、品牌主色选择（政务蓝置首为默认）、布局、元素尺寸。
      这是「支持暗黑模式」的 UI 唯一入口 —— 不挂载它，暗黑模式就是死代码。
    -->
    <SettingPanel />
  </t-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getUsernameFromToken } from '@/api/token'
import { titleOf, areaTitleOf } from '@/api/menuTitles'
import MenuSidebar from '@/components/cube/MenuSidebar.vue'
import SettingPanel from '@/components/cube/SettingPanel.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

// 路由形态：/entity/{area}/{controller}
const seg = computed(() => route.path.split('/').filter(Boolean))
const isEntity = computed(() => seg.value[0] === 'entity')

// 面包屑显示名优先取后端菜单 displayName（铁律 M1），查不到才回落路由参数
const areaRaw = computed(() => (route.params.area as string) || (isEntity.value ? seg.value[1] : ''))
const controllerRaw = computed(
  () => (route.params.controller as string) || (isEntity.value ? seg.value[2] : ''),
)

const areaLabel = computed(() => areaTitleOf(areaRaw.value) || areaRaw.value || '概览')
const controllerLabel = computed(
  () => titleOf(areaRaw.value, controllerRaw.value) || controllerRaw.value || '仪表盘',
)

const username = computed(() => auth.username || getUsernameFromToken() || '管理员')
const initial = computed(() => (username.value || '管').slice(0, 1).toUpperCase())

const userMenu = [
  { content: '返回仪表盘', value: 'home' },
  { content: '退出登录', value: 'logout' },
]

function goHome() {
  router.push('/dashboard')
}

function onLogout() {
  auth.logout()
  router.push('/login')
}

/**
 * 后端菜单 url → 前端路由。
 * 后端形态多样：`/Asset/AssetItem`、`Asset/AssetItem`、`~/Ai`、`/api/Admin/User`。
 * 统一剥离 `~` / 前导斜杠 / `api` 前缀后取前两段，落到 `/entity/{area}/{controller}`。
 */
function onNavigate(url: string) {
  if (!url) return
  const stripped = url.replace(/^~/, '').replace(/^\/+/, '').replace(/^api\//i, '')
  const parts = stripped.split('/').filter(Boolean).slice(0, 2)
  if (!parts.length) return
  const target = `/entity/${parts.join('/')}`
  if (target === route.path) return
  router.push(target)
}

function onUserMenu(d: { value: string }) {
  if (d.value === 'logout') onLogout()
  else if (d.value === 'home') goHome()
}
</script>

<style scoped>
.basic-layout {
  height: 100vh;
}
.side {
  background: #fff;
  border-right: 1px solid var(--td-component-stroke);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s;
  overflow: hidden;
}
.side-brand {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid var(--td-component-stroke);
  cursor: pointer;
  white-space: nowrap;
}
.side-brand .lg {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--td-brand-color);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 14px;
}
.side-brand b {
  font-size: 15px;
  font-weight: 500;
}
.side-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  min-width: 0;
}
.user-bar {
  margin-top: auto;
  padding: 12px 16px;
  border-top: 1px solid var(--td-component-stroke);
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}
.user-bar .uname {
  flex: 1;
  font-size: 13px;
  color: var(--td-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid var(--td-component-stroke);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
}
.crumb-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}
.crumb-nav b {
  color: var(--td-text-color-primary);
  font-weight: 500;
}
.top-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.top-actions .user {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}
.avatar-btn {
  cursor: pointer;
  background: var(--td-brand-color);
  color: #fff;
}
/* min-width:0 是关键：作为 t-layout 的 flex 子项，默认 min-width:auto 会被超宽表格撑大，
   导致页面出现浏览器横向滚动条，且 t-table 自身横向滚动失效。 */
.content {
  padding: 20px;
  overflow: auto;
  background: var(--td-bg-color-page);
  min-width: 0;
}
</style>
