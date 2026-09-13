# cube-webapi-tdesign 最小可运行 Demo

零依赖验证脚手架：Mock 后端（Node 内置 http）实现 NewLife.Cube 魔方 WebApi 官方契约，
前端直接复用技能全部资产（`src/api/*` + `src/components/cube/*`）。

## 运行

```bash
npm install
npm run mock        # 终端1：Mock 后端 :3001（零额外依赖）
npm run dev         # 终端2：Vite :5173，dev proxy 转发 /api、/Auth、/Mfa、/Cube、/Content、/cube 到 mock
npm run typecheck   # vue-tsc --noEmit（⚠️ 须先 npm install，见下方说明）
npm run build       # vue-tsc --noEmit && vite build
```

## 已声明偏差（相对 `td-starter` 原始产物）

`node ../scripts/check-starter-align.mjs .` 当前为 **0 FAIL / 1 WARN / 6 INFO**（脚本按 `tsconfig.node.json` 存在自动判为 **`lite` 血统** —— 本目录是 `lite` 形态的**历史保留示例**，新建工程请用 `-temp all`，见 `references/scaffold/README.md`）：

- **WARN（已声明）· tsconfig 编译策略**：`moduleResolution: "Bundler"`（基线 `Node`）、`strict: false`（基线 `true`）、`sourceMap` 未设（基线 `true`）、`lib` 多 `DOM.Iterable`、额外键 `noEmit` / `types`。
  理由：本目录定位是**浏览器端最小可运行演示**（无 `*.tsx` 消费方），且刻意放开 `strict` 以贴近「拷贝即用」；`Bundler` 解析更贴合 Vite 实际行为。**结构性契约（`paths['@/*']`、`references`）与基线一致，未偏离。**
- **INFO · 已移除 CLI 演示件**：`.npmignore` / `public/tdesign-logo.svg` / `src/assets/svg/vite-logo.svg`；保留 `README.md` / `src/App.vue`（内容已替换为业务版）。
- **已补 CLI 缺口**：`public/favicon.ico`、`tsconfig.node.json`、`index.html` 的 `<link rel="icon">`、`build` 加 `vue-tsc` 类型检查、`vue-router`/`pinia`/`axios`；`scripts.prepare`（CLI 致命脚本）未携带。
- **未携带 `.gitignore`**（CLI 不生成）——演示目录不入 git，无需。

> ⚠️ **本目录不随包携带依赖**（无 `node_modules`、无 `dist`）。上方命令须**先 `npm install`** 才能执行。
> ★ **2026-09-13 双侧构建实证（口径已更新）**：装上依赖后本目录 **可独立构建通过** ——
> `vue-tsc --noEmit && vite build` **exit=0**（3925 模块 / CSS 464.86 kB / JS 1,544.92 kB / 19.69s）。
> 故本 README 中的「0 错误」是**实测结论**，不再是「预期目标」；但**本仓库不带依赖、CI 默认不编**，
> 复现仍须先 `npm install`。生产级编排层结论一律以 `references/scaffold/` 为准。

浏览器打开 http://localhost:5173（若被占用 Vite 自动顺延）。⚠️ **登录页是极简版，不是完整契约演示**（2026-09-13 实测校准）：
本目录的 `src/pages/LoginView.vue` 仅 83 行 —— **纯账密表单**（用户名 + 密码 + 提交），
**不**拉取 `LoginConfig`，**没有**密码/短信/邮箱 Tab、OAuth、图形码、忘记密码/注册入口、MFA 二步验证。
《认证接口设计.md》的**完整契约演示在 `references/scaffold/src/pages/LoginView.vue`（342 行）**，需要完整登录页时**取 scaffold/core**。
本目录的独占价值只有两页：注册 `src/pages/RegisterView.vue` + 找回密码 `src/pages/ForgotPasswordView.vue`。
登录（任意账号 + 任意密码）后进入主界面，点左侧菜单切换实体页。

- **设备列表（IoTHub/Device）**：树形表（含 `ParentID`）、`StatusID` 显「在线/离线/故障」、`CategoryID` 经 `lookups` 显分类名、底部 `stat` 统计行；新增/编辑弹窗中 `ParentID` 为树形下拉、`StatusID`/`CategoryID` 为映射源下拉；详情抽屉回显名称。
- **设备分类（IoTHub/Category）**：完整 CRUD 演示实体，表单含 `Type` 枚举下拉、`ParentID` 自引用树形下拉、`Enable` 开关、`Sort` 数字输入。

## 三条约定的落实（**铁律层面**与 `references/scaffold/` 一致；**实现层面分层不同源**）

> ★ 本目录是**精简示例层**（源码级轻量样例，JS 产物仅 1.54 MB），**不是** scaffold 的同步目标：
> 12 件同名文件为精简变体（体积 1/3 ~ 1/8），认证架构停留在上一代形态（store 内联在 `api/auth.ts`，
> scaffold 已拆为 `api/token.ts` + `api/menuTitles.ts` + `stores/auth.ts`）。
> `tri-diff.mjs` 将它们报为 `DEMO-DIVERGENT`（**非漂移，无需同步**）。
> ⇒ 改 scaffold 一处**不必**同步本目录；反之亦然。判据见 `references/scripts/README.md`。

| # | 约定 | demo 落点 | 验证状态（2026-09-13 双侧构建实证：本目录已实测编译） |
|---|---|---|---|
| C1 | 由官方脚手架生成 | Vue3 + Vite + Pinia 工程形态（`vite.config.ts` / `tsconfig.json` / `tsconfig.node.json` / `index.html` / `public/favicon.ico`），配 `@` 别名 + `paths` | `node ../scripts/check-starter-align.mjs .` **0 FAIL**（已机检）；`npm install` 后 `vue-tsc --noEmit && vite build` **exit=0**（实测，3925 模块 / JS 1.54 MB） |
| C2 | 默认品牌色 = 政务蓝 `#0f4c9e` | `src/styles/tokens.css` + `src/stores/setting.ts` 的 `DEFAULT_BRAND` + `src/theme/tokens.ts` | 登录页/主界面 `--td-brand-color` 均为 `#0f4c9e`；设置面板品牌色预设政务蓝置首 |
| C3 | 支持切换暗黑模式 | `theme-dark.css`（main.ts 引入）+ `setting.load()`（main.ts 调用）+ `<SettingPanel />`（MainView 挂载） | 右下角齿轮 → 选「暗色」→ `<html class="t-theme-dark">`、`--td-bg-color-page` 由 `#f3f3f3` → `#181818`、偏好持久化到 `localStorage['cube-personalization']` |

## 以真实魔方后端替换 Mock

本 demo 的 Mock 只是契约替身。对接真实后端时**前端资产无需改动**，唯一必改项是把 Vite dev 代理指向真实后端域名——代理 **`/api`（实体/菜单）+ `/Auth`、`/Mfa`、`/Sso`（认证）+ `/Cube`、`/cube`（框架信息/附件图片）+ `/Content`（静态资源）**；
**切勿**代理 `/Admin`、`/Asset` 等前端 SPA 路由（浏览器硬刷新会 404）。完整对接说明见 `SKILL.md` §九 / §十。

要点速记：
- **令牌头只认 `Authorization: Bearer <jwt>`**（实测；发 `Authentication` 或只带 Cookie 均 401）；令牌键 `localStorage['assets_token']`。
- 登录 `POST /Auth/Login`（snake_case 令牌键，走 `normToken` 三向兜底）；菜单 `GET /Admin/Index/GetMenuTree`（**无 `/api` 前缀**）。
- 实体页零代码：菜单每多一个 `{area}/{ctrl}`，前端只加一行 `<ListPage :area :controller />`。
- 外键 `xxxID` 自动按「同名同 area 关联控制器 Index」拉取。

## 目录约定

- **唯一 HTTP 层** = `src/api/http.ts`（铁律 H1：不存在第二套 axios / 第二套令牌键；历史遗留的 `api.ts` 已删除改名）。
- 基类组件落在 `src/components/cube/`，对 `src/api/*` 的引用统一用 `@/api/...`（已配 `@` 别名）。
- 已下线（早期 `fieldRender` 契约，拷贝即编译失败）：`ListNavbar/ListSearchBar/ListToolbar/ListFooter/DetailContent`。
