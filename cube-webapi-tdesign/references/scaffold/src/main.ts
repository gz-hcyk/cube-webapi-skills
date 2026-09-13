/* eslint-disable simple-import-sort/imports */
import { createApp } from 'vue';
import TDesign from 'tdesign-vue-next';

import App from './App.vue';
import i18n from './locales';
import router from './router';
// ⚠️ 目录名必须是 stores（复数）：all 模板原带 src/store/，本项目统一归一为 src/stores/，
// 与 assets/core/stores/{auth,setting}.ts 的落位保持一致（scaffold 已同步）。
import { store } from './stores';

import { useSettingStore } from '@/stores/setting';

import 'tdesign-vue-next/es/style/index.css';
// 设计令牌：覆盖 TDesign 主题变量（默认品牌色 = 政务蓝 #0f4c9e）。
// ⚠️ 铁律 C3①：必须排在 TDesign 样式**之后**，否则变量被上游样式表覆盖。
import '@/styles/tokens.css';
// 暗色模式令牌：同样必须在 TDesign 样式之后才生效。
import '@/styles/theme-dark.css';
// 工程全局样式（reset + less 变量）：排在令牌之后、业务样式之前。
import '@/styles/index.less';

const app = createApp(App);

app.use(store);
app.use(router);
app.use(i18n);
app.use(TDesign);

// 铁律 C3②：启动即还原个性化偏好（主题模式 light/dark、品牌主色、布局、折叠）。
// 由 setting store 以 inline style 写入 <html>，优先级高于样式表 → 首屏不闪色。
useSettingStore().load();

app.mount('#app');
