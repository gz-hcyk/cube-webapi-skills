import { createPinia } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';

// 全项目唯一的 pinia 实例（all 模板基础设施）。
// 目录归一到 `src/stores/`（all 模板原为 `src/store/`）——避免 `store` / `stores`
// 两个仅差一个字母的兄弟目录长期共存（技能资产自带 `stores/auth.ts`、`stores/setting.ts`）。
const store = createPinia();
store.use(createPersistedState());

export { store };
export default store;
