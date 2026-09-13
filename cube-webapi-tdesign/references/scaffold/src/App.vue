<template>
  <t-config-provider :global-config="{ ...getComponentsLocale, classPrefix: 't' }">
    <router-view />
  </t-config-provider>
</template>

<script setup lang="ts">
/**
 * 应用根：只承载「路由出口 + TDesign 全局配置（含多语言）」。
 *
 * 登录门禁在 `@/router`（`beforeEach` + `isAuthed()`），业务外壳（侧栏/顶栏）在
 * `@/layouts/BasicLayout.vue`；业务菜单的唯一权威是后端 `GET /Admin/Index/GetMenuTree`，
 * **不在此处硬编码**（铁律 M1/M3）。
 *
 * `getComponentsLocale` 来自 `@/locales/useLocale`：把 vue-i18n 当前语言下的
 * TDesign 组件语言包注入 `t-config-provider`，使分页/日期/空状态等内建文案随语言切换。
 */
import { useLocale } from '@/locales/useLocale';

const { getComponentsLocale } = useLocale();
</script>
