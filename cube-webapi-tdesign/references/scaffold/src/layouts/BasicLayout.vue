<template>
  <t-layout class="basic-layout">
    <!-- 侧边布局：左侧导航栏 -->
    <t-aside
      v-if="setting.layout === 'side'"
      :width="setting.collapsed ? '64px' : '232px'"
      class="side"
      :class="{ collapsed: setting.collapsed }"
    >
      <div class="side-brand" @click="goHome">
        <div class="lg">C</div>
        <b>魔方控制台</b>
      </div>
      <!-- 菜单区：数据来自后端 GetMenuTree（铁律 M1），仅样式对齐 Starter，不写死业务菜单 -->
      <div class="side-menu">
        <MenuSidebar orientation="vertical" theme="dark" :collapsed="setting.collapsed" @navigate="onNavigate" />
      </div>
    </t-aside>

    <t-layout>
      <!-- 顶部布局：横向菜单直接作为顶栏（logo + 菜单 + 操作区） -->
      <t-header v-if="setting.layout === 'top'" class="topbar topbar-head">
        <MenuSidebar orientation="horizontal" :theme="menuTheme" @navigate="onNavigate">
          <template #logo>
            <div class="side-brand side-brand-head" @click="goHome">
              <div class="lg">C</div>
              <b>魔方控制台</b>
            </div>
          </template>
          <template #operations>
            <div class="top-actions">
              <t-input class="top-search" placeholder="搜索设备名称 / 编号 / IP" clearable>
                <template #prefix-icon><t-icon name="search" /></template>
              </t-input>
              <t-select
                :value="tenant"
                class="tenant"
                :options="tenantOptions"
                @change="onTenant"
                :auto-width="true"
              />
              <t-tooltip content="通知">
                <t-button theme="default" shape="square" variant="text">
                  <t-icon name="notification" />
                </t-button>
              </t-tooltip>
              <t-dropdown :options="userMenu" @click="onUserMenu" trigger="click">
                <div class="topbar-user">
                  <t-avatar size="28px" class="avatar-btn">{{ initial }}</t-avatar>
                  <span class="topbar-user-name">{{ username }}</span>
                  <t-icon name="chevron-down" size="16px" />
                </div>
              </t-dropdown>
            </div>
          </template>
        </MenuSidebar>
      </t-header>

      <!-- 侧边布局：常规顶栏（折叠按钮 + 面包屑 + 搜索 + 操作） -->
      <t-header v-else class="topbar">
        <t-button theme="default" variant="text" shape="square" @click="toggleCollapsed">
          <t-icon name="menu-fold" />
        </t-button>
        <div class="crumb-nav">
          <span>{{ areaLabel }}</span>
          <t-icon name="chevron-right" />
          <b>{{ controllerLabel }}</b>
        </div>
        <t-input class="top-search" placeholder="搜索设备名称 / 编号 / IP" clearable>
          <template #prefix-icon><t-icon name="search" /></template>
        </t-input>
        <div class="top-actions">
          <t-select
            :value="tenant"
            class="tenant"
            :options="tenantOptions"
            @change="onTenant"
            :auto-width="true"
          />
          <t-tooltip content="通知">
            <t-button theme="default" shape="square" variant="text">
              <t-icon name="notification" />
            </t-button>
          </t-tooltip>
          <t-dropdown :options="userMenu" @click="onUserMenu" trigger="click">
            <div class="topbar-user">
              <t-avatar size="28px" class="avatar-btn">{{ initial }}</t-avatar>
              <span class="topbar-user-name">{{ username }}</span>
              <t-icon name="chevron-down" size="16px" />
            </div>
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
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
// TDesign 事件回调类型从包根导入：t-select 的 @change 是 `(value: SelectValue<SelectOption>)`，
// t-dropdown 的 @click 是 `(dropdownItem: DropdownOption)`。二者都比本页需要的数据宽，
// 写成 `(v: string)` / `(d: { value: string })` 会因参数逆变检查失败 → TS2322。
import type { SelectValue, SelectOption, DropdownOption } from 'tdesign-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useSettingStore } from '@/stores/setting';
import { getUsernameFromToken } from '@/api/token';
import { titleOf, areaTitleOf } from '@/api/menuTitles';
import MenuSidebar from '@/components/cube/MenuSidebar.vue';
import SettingPanel from '@/components/cube/SettingPanel.vue';

const auth = useAuthStore();
const setting = useSettingStore();
const route = useRoute();
const router = useRouter();

// 面包屑取名的路由基准：SPA 形态为 `/{area}/{controller}`；
// 早期形态 `/entity/{area}/{controller}` 仍需兼容（历史链接 / 外部跳转）。
const seg = computed(() => route.path.split('/').filter(Boolean));
const isEntity = computed(() => seg.value[0] === 'entity');

const areaRaw = computed(() => {
  const p = (route.params.area as string) || '';
  if (p) return p;
  return isEntity.value ? seg.value[1] || '' : '';
});
const controllerRaw = computed(() => {
  const p = (route.params.controller as string) || '';
  if (p) return p;
  return isEntity.value ? seg.value[2] || '' : '';
});

// 铁律 M1：面包屑显示名优先取后端菜单 displayName（由 MenuSidebar 拉菜单时 registerMenuTitles 写入），
// 查不到才回落到路由参数原文。绕过它会把 `AssetItem` 这类英文控制器名暴露给用户。
const areaLabel = computed(() => areaTitleOf(areaRaw.value) || areaRaw.value || '概览');
const controllerLabel = computed(
  () => titleOf(areaRaw.value, controllerRaw.value) || controllerRaw.value || '仪表盘',
);

// auth store 为 setup 式，用户名为 `user.name`；token 解析作兜底（刷新后用 token 恢复显示）。
const username = computed(() => auth.user?.name || getUsernameFromToken() || '管理员');
const initial = computed(() => (username.value || '管').slice(0, 1).toUpperCase());

// 顶部布局下菜单主题跟随全局模式（侧边布局固定深色以匹配深蓝侧栏）
const menuTheme = computed<'light' | 'dark'>(() => (setting.mode === 'dark' ? 'dark' : 'light'));

const tenant = ref(auth.getTenant());
const tenantOptions = [
  { value: '', label: '默认租户（总控）' },
  { value: 'east', label: '华东物联网公司' },
  { value: 'south', label: '华南智造工厂' },
];

function toggleCollapsed() {
  setting.$patch({ collapsed: !setting.collapsed });
}

/**
 * 后端菜单 url → 前端路由。
 * 后端形态多样：`/Asset/AssetItem`、`Asset/AssetItem`、`~/Ai`、`/api/Admin/User`。
 * 统一剥离 `~` / 前导斜杠 / `api` 前缀后取前两段，落到 `/entity/{area}/{controller}`。
 * ⚠️ 必须补 `/entity/` 前缀：路由表注册的是 `entity/:area/:controller`，
 * 若只拼 `/{area}/{controller}` 会落到 catch-all 重定向回 /dashboard，点击菜单「没反应」
 * （2026-09-13 CubeSkillLab 真机验收发现）。
 */
function onNavigate(url: string) {
  if (!url) return;
  const stripped = url.replace(/^~/, '').replace(/^\/+/, '').replace(/^api\//i, '');
  const parts = stripped.split('/').filter(Boolean).slice(0, 2);
  if (!parts.length) return;
  const target = '/entity/' + parts.join('/');
  if (target === route.path) return;
  router.push(target);
}

function onTenant(v: SelectValue<SelectOption>) {
  // SelectValue 是宽联合（string|number|boolean|bigint|SelectOption|数组）。
  // 本页 tenantOptions 的 value 均为字符串，但类型上必须显式归一化后才能写入 string ref。
  // ⚠️ 不可断言成 SelectOption：SelectOption = SelectOption | SelectOptionGroup，其中
  //    SelectOptionGroup 没有 value 属性 → TS2339。统一按 Record<string, any> 取 value。
  const s = v == null ? '' : String(typeof v === 'object' ? ((v as Record<string, any>).value ?? '') : v);
  tenant.value = s;
  auth.setTenant(s);
  MessagePlugin.success(s ? '已切换租户，刷新数据' : '已切回总控');
  window.location.reload();
}

// 铁律 M3：默认落地页为 dashboard —— 品牌区（系统名/Logo）与用户菜单均回仪表盘
function goHome() {
  if (route.path !== '/dashboard') router.push('/dashboard');
}

const userMenu = [
  { content: '返回仪表盘', value: 'home' },
  { content: '退出登录', value: 'logout' },
];

function onUserMenu(d: DropdownOption) {
  if (d.value === 'home') {
    goHome();
    return;
  }
  if (d.value === 'logout') {
    auth.logout();
    router.push('/login');
  }
}
</script>

<style scoped>
.basic-layout { height: 100vh; }
.side { background: var(--cube-sidebar-bg, var(--cube-sidebar-bg-solid)); border-right: 1px solid var(--cube-sidebar-border); display: flex; flex-direction: column; flex-shrink: 0; transition: width 0.2s; overflow: hidden; }
.side-brand { height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid var(--cube-sidebar-border); cursor: pointer; white-space: nowrap; }
.side-brand .lg { width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; background: var(--cube-brand-gradient); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
.side-brand b { font-size: 15px; color: var(--cube-sidebar-text-strong); }
.side-menu { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px; min-width: 0; }
.topbar { height: 56px; background: #fff; border-bottom: 2px solid var(--cube-topbar-border); display: flex; align-items: center; padding: 0 20px; gap: 16px; }
.crumb-nav { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--td-text-color-secondary); }
.crumb-nav b { color: var(--td-text-color-primary); font-weight: 500; }
.top-search { flex: 1; max-width: 360px; }
.top-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.tenant { width: 180px; }
.avatar-btn { cursor: pointer; background: var(--cube-brand-gradient); color: #fff; }
/* 顶栏用户区：对齐 Starter 的 header-user-btn 形态（头像 + 用户名 + 下拉箭头） */
.topbar-user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--td-radius-default);
  transition: background-color var(--td-anim-duration-base);
}
.topbar-user:hover { background-color: var(--td-bg-color-container-hover); }
.topbar-user-name {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: var(--td-text-color-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 内容区：min-width:0 是关键——作为 t-layout 的 flex 子项，默认 min-width:auto 会被超宽表格撑大，
   导致页面出现浏览器横向滚动条，且 t-table 自身横向滚动失效。 */
.content { padding: 20px; overflow: auto; background: var(--cube-content-bg); min-width: 0; }

/* 顶部布局：横向菜单作为顶栏，贴合容器底色、去掉默认描边 */
.topbar-head { height: auto; padding: 0; background: var(--td-bg-color-container); border-bottom: 1px solid var(--td-component-stroke); }
.side-brand-head { height: 100%; border-bottom: none; }

/* 侧边栏折叠态：仅显示 logo 与头像，隐藏文字 */
.side.collapsed .side-brand { justify-content: center; padding: 0; }
.side.collapsed .side-brand b { display: none; }
</style>
