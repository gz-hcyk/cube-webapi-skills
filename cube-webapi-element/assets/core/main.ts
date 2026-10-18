import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

// 样式顺序不可调：组件库 → 组件库暗色 → 我们的令牌 → 页面骨架
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@/styles/tokens.css';
import '@/styles/theme-dark.css';
import '@/styles/page.css';

import App from './App.vue';
import router from './router';
import { useSettingStore } from '@/stores/setting';

/**
 * 入口（落位：src/main.ts）
 *
 * 三件必须做的事（删任一都会有"功能消失但不报错"的症状）：
 *  1. 全局注册 Element Plus 图标——菜单图标是 `<component :is="名称">` 动态渲染的；
 *  2. 引 theme-dark.css —— 否则 html.dark 只切了变量的一半；
 *  3. 启动时 setting.load() —— 还原偏好并把品牌色阶注入 <html>（E7）。
 */
const app = createApp(App);

// 1) 图标全局注册：菜单/MenuItems 里用字符串名动态渲染图标
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component as any);
}

const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn });

// 3) 外观偏好必须在挂载前生效，避免首屏白闪
useSettingStore(pinia).load();

app.mount('#app');
