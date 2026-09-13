# assets/ —— 可拷贝模板库（核心 / 可选 / 已归档）

本目录是「**并入既有工程**」用的模板库：每个文件的路径都**镜像目标工程的 `src/` 目录**，
所以可以直接整目录拷贝。与之并列的 `references/scaffold/` 是**完整可运行工程**（真相源）。

```bash
# 并入既有 Vue3 + Vite 工程（core 为必拷项，路径已镜像 src/）
cp -r assets/core/.  <你的工程>/src/
# 按需追加可选件（示例：角色授权页 / 金额输入 / 代码编辑器）
cp -r assets/optional/components/cube/RoleMenuEditor.vue  <你的工程>/src/components/cube/
```

## ★ 两个参考工程的职责边界（2026-09 实测）

| 工程 | 依赖/构建状态 | 定位 |
|---|---|---|
| `references/scaffold/` | **已清空为纯声明式**（**无 `node_modules`、无 `dist`**；仅留 `package.json` + `package-lock.json` 等源文件）——用前一律 `npm install` | **唯一真相源**：资产改动必须先编译 0 错误再同步回 `assets/` |
| `references/demo/` | **无 `node_modules`、无 `dist`**（从未编译，源码级演示） | 零依赖演示工程：展示登录/MFA/令牌板等**完整形态**页面，**不保证可直接编译**，拷贝前须自行过 `vue-tsc` |

> 因此：**「在 scaffold 内有副本」是资产被验证过的标志**。下表「验证状态」列据此标注。

### ★ 验证结论的适用范围（2026-09 实测口径 —— 勿误读）

本文档与 `SKILL.md` 中反复出现的「`vue-tsc --noEmit` 与 `vite build` 0 错误」，其适用范围如下：

| 维度 | 实际情况 |
|---|---|
| **何时取得** | 曾在**完整安装依赖**的工程内跑通（`vue-tsc --noEmit` + `vite build` + CDP 实测）。⚠️ 本包已将 `node_modules`/`dist` **清空为声明式**，故不再有现场物证，一切以本记录 + 下方复现命令为准 |
| **能否在技能目录内直接复现** | **不能**。依赖不随包携带（`node_modules` 已清空，仅留 `package.json`/`package-lock.json`），直接跑 `npm run typecheck` / `npm run build` 会报找不到命令 |
| **怎样复现** | `cd references/scaffold && npm install && npm run typecheck && npm run build`（**先装依赖，再谈 0 错误**） |
| **要验证待用资产怎么办** | 放进**已装全依赖的工程副本**（scaffold 执行过 `npm install`，或你自己的业务工程）里跑 `vue-tsc`；**不要**假设技能目录本身可编译 |
| **`references/demo/` 里的「0 错误」** | **不适用** —— demo 无 `node_modules`、无 `dist`、从未编译；其文档中的「0 错误」是**预期目标**，非实测结论 |

## ★ 唯一真相源与同步铁律

- **真相源 = `references/scaffold/src/`**（历史在完整依赖环境下 `vue-tsc --noEmit` 与 `vite build` 0 错误、CDP 实测过；**复现须先 `npm install`**，见上节「验证结论的适用范围」）。
- 改任一资产：**先在 scaffold 的已装依赖工作副本内改并编译验证 0 错误**，再同步回本目录；禁止只改本目录。
- 一致性可用一行校验（应仅剩工程外壳 + 可选件差异）：

```bash
diff <(cd assets/core && find . -type f | sort) \
     <(cd references/scaffold/src && find . -type f | sort | grep -vE '^\./(main\.ts|App\.vue|router/|vite-env\.d\.ts|pages/LovDemoView\.vue|components/cube/(PriceYuanInput|RoleMenuEditor|ThemeShowcase)\.vue)')
```

`scaffold/src` 相对 `assets/core` 只多出「工程外壳」4 个文件
（`main.ts` / `App.vue` / `router/index.ts` / `vite-env.d.ts`，
由 `tdesign-starter-cli` 生成，随 scaffold 提供）、DEV 验证页 `pages/LovDemoView.vue`
与三个**零依赖可选件**（`PriceYuanInput` / `RoleMenuEditor` / `ThemeShowcase`，
scaffold 为演示而附带，业务工程按需拷）。

## 一、core/ —— 核心（必拷，被主链路真实引用）

| 文件（→ 目标路径） | 作用 | 被谁引用 |
|---|---|---|
| `api/http.ts` → `src/api/` | **唯一 HTTP 层**，导出双实例 `http`（baseURL 已含 `/api`）/`rawHttp`（同源根）；`Authorization: Bearer` + `assets_token` + 信封处理 + 401 刷新重放；**无全局 camelize** | 全局 |
| `api/token.ts` → `src/api/` | 令牌/租户持久化（`assets_token`/`assets_refresh_token`）+ `normToken` 三向兜底 + JWT 显示名 | http、router、auth |
| `api/fieldRender.ts` → `src/api/` | 字段元数据 → 控件/列/表单/rules 选型（单真相源） | ListPage/FormDialog/DetailDrawer |
| `api/useEntityResource.ts` → `src/api/` | `GetPage`/`Index`/CRUD 封装 | ListPage/FormDialog |
| `api/useLookups.ts` → `src/api/` | 约定式外键字典（`xxxID` → 同名控制器 Index） | ListPage |
| `api/menuTitles.ts` → `src/api/` | 后端 `displayName` 登记为页面标题权威源 | MenuSidebar、ListPage |
| `utils/camel.ts` → `src/utils/` | PascalCase → camelCase（**消费端归一，http 层已无全局 camelize**） | 多处 |
| `utils/color.ts` → `src/utils/` | 品牌色阶推导（`getBrandPalette`） | setting |
| `stores/auth.ts` → `src/stores/` | 登录态 / `POST /Auth/Login` | LoginView、router |
| `stores/setting.ts` → `src/stores/` | 个性化偏好（主题模式 / 品牌色 / 布局）+ `load()` | main、BasicLayout、SettingPanel |
| `theme/tokens.ts` → `src/theme/` | 与 `tokens.css` **同源**的 TS 令牌（图表配色） | ThemeShowcase；铁律 C2 三处同源之一 |
| `styles/tokens.css` → `src/styles/` | 设计令牌（默认政务蓝 `#0f4c9e` 兜底） | main |
| `styles/theme-dark.css` → `src/styles/` | 暗色令牌（**必须在 TDesign 样式后 import**，铁律 C3） | main |
| `api/useLov.ts` → `src/api/` | LovController 值集加载器（ENUM 选项 / LIST 表格配置 / `lovFetchRows` 取数） | fieldRender、FormDialog、LovListField |
| `components/cube/LovListField.vue` | **LIST 型值集表格选择弹窗**（单选/多选 + 搜索 + 分页 + 已选统计 + id→名称回显） | FormDialog（lov-list 分支） |
| `components/cube/ListPage.vue` | 自包含列表页组合根（搜索/工具条/统计/表格/弹窗） | EntityPage |
| `components/cube/FormDialog.vue` | 新增/编辑弹窗（映射下拉 / rules / 按 category 分 tab / **lov-list 表格选择**） | ListPage |
| `components/cube/DetailDrawer.vue` | 详情抽屉（`xxxID` 经 `labelOf` 回显名称） | ListPage |
| `components/cube/MenuSidebar.vue` | 侧栏/顶栏菜单（数据源 `GetMenuTree`，含 `--light/--dark` 配色分支） | BasicLayout |
| `components/cube/SettingPanel.vue` | 个性化配置抽屉 = **暗黑模式 UI 唯一入口**（铁律 C3） | BasicLayout |
| `components/cube/ConfigView.vue` | `ConfigController<T>` 单对象配置页（无 GetPage） | `specialControllers.ts` |
| `components/cube/DbView.vue` | `ControllerBaseX` 自定义端点页（如 Db 备份/下载） | `specialControllers.ts` |
| `layouts/BasicLayout.vue` → `src/layouts/` | 侧栏 + 顶栏 + 内容区 + SettingPanel 挂载位 | router |
| `pages/EntityPage.vue` → `src/pages/` | 泛型实体页（按 `specialControllers` 分发，否则 ListPage） | router |
| `pages/DashboardView.vue` → `src/pages/` | 仪表盘（菜单树驱动，按 permissions 位 2/4/8 判实体） | router |
| `pages/LoginView.vue` → `src/pages/` | 登录门禁（系统名读 `/Auth/LoginConfig`） | router |
| `specialControllers.ts` → `src/` | 非实体控制器显式注册表 | EntityPage |

> `ConfigView` / `DbView` 之所以在 **core**（而非 optional）：它们被 core 的
> `specialControllers.ts` **静态 import**——只拷 core 却漏掉它们会直接构建失败。
> 二者只在后端确实存在对应控制器时才渲染，属"随包必备、按数据启用"。
> `useLov.ts` / `LovListField.vue` 同理：被 core 的 `FormDialog.vue` 静态 import
> （lov-list 表单分支），只拷 core 漏掉即构建失败；后端无 `Admin/Lov` 时
> `load()` 静默退化、弹窗不渲染，属"随包必备、按数据启用"。

## 二、optional/ —— 可选增强（按需拷，零额外依赖者优先）

| 文件（→ 目标路径） | 作用 | 启用条件 | 额外依赖 | 验证状态 |
|---|---|---|---|---|
| `components/cube/RoleMenuEditor.vue` | 角色权限设置（菜单树 + 权限位勾选，§4.12.1） | 需要角色授权页 | 无 | ✅ scaffold 内有副本，过 `vue-tsc` |
| `components/cube/PriceYuanInput.vue` | 金额输入（元/分换算） | 有金额字段 | 无 | ✅ 同上 |
| `components/cube/ThemeShowcase.vue` | 设计令牌板（可视化验证 `/theme`，已挂 DEV 路由） | 想看令牌全景 | 无 | ✅ 同上 |
| `components/cube/IconPicker.vue` | 图标选择器（`itemType=icon`） | 表单需选图标 | 无（`tdesign-icons-vue-next` 已在依赖内） | ⚠️ **scaffold 内无副本**，仅 `references/demo/` 有源码级实现（demo 未编译）→ 拷贝前须自行过 `vue-tsc` |

## 三、archive/ —— 已归档（**勿拷贝**，仅留痕）

| 文件 | 归档原因 |
|---|---|
| `api/menuTree.ts` | 在 scaffold 主链路中**零引用**（孤立文件）。其 `normalizeUrl`/`CUSTOM_PATHS`/`EXCLUDED` 归一化逻辑已被 `MenuSidebar.vue`（取数）+ `BasicLayout.onNavigate()`（url → `/entity/{area}/{controller}`）内联实现取代，**职责重叠**且两套规则并存会互相打架。 |
| `api/permissions.ts` | 在 scaffold 主链路中**零引用**。`PermissionFlags`/`hasFlag`/`PermissionLabels` 与 `DashboardView.vue` 内联的权限位判定（`kindOf()`：含 2/4/8 判实体）**职责重叠**。 |

详见 `archive/README.md`（含依赖分析证据与"若要复活"的接法）。
