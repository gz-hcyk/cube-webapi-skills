import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';
import './styles/tokens.css'; // 设计令牌落地（覆盖 TDesign 主题变量，登录页渐变等依赖它）
import './styles/theme-dark.css'; // 暗色模式令牌：必须排在 TDesign 样式之后才能生效
import App from './App.vue';
import router from './router';
import { useSettingStore } from './stores/setting';

const app = createApp(App);
app.use(createPinia());
app.use(TDesign);
app.use(router);

// 铁律 C3：启动还原个性化偏好（主题模式/品牌主色/布局），保证首屏不闪色且暗黑可切
useSettingStore().load();

app.mount('#app');
