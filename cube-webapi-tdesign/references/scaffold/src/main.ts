import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';
import '@/styles/tokens.css'; // 设计令牌：覆盖 TDesign 主题变量（默认品牌色 = 政务蓝 #0f4c9e）
import '@/styles/theme-dark.css'; // 暗色模式令牌：必须排在 TDesign 样式之后才能生效
import App from './App.vue';
import router from './router';
import { useSettingStore } from '@/stores/setting';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(TDesign);

// 启动即还原个性化偏好（主题模式 light/dark、品牌主色、布局、折叠），
// 由 setting store 以 inline style 写入 <html>，优先级高于样式表 → 首屏不闪色。
useSettingStore().load();

app.mount('#app');
