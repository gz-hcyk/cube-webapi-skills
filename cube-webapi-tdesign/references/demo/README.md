# cube-webapi-tdesign 最小可运行 Demo

零依赖验证脚手架：Mock 后端（Node 内置 http）实现 NewLife.Cube 魔方 WebApi 官方契约，
前端直接复用技能全部资产（`src/api/*` + `src/components/cube/*`）。

## 运行

```bash
npm install
npm run mock        # 终端1：Mock 后端 :3001（零额外依赖）
npm run dev         # 终端2：Vite :5173，dev proxy 转发 /api、/Auth、/Mfa、/Cube、/Content、/cube 到 mock
npm run typecheck   # vue-tsc --noEmit（⚠️ 须先 npm install，见下方说明）
npm run build       # vite build
```

> ⚠️ **本目录未随包携带依赖、从未编译**（无 `node_modules`、无 `dist`）。上方命令须**先 `npm install`** 才能执行；本 README 中出现的「0 错误」均为**预期目标**而非实测结论。实测结论一律以 `references/scaffold/` 为准，且须在其 `npm install` 之后再复现。完整口径见 `assets/README.md` §「验证结论的适用范围」。

浏览器打开 http://localhost:5173（若被占用 Vite 自动顺延）。**登录页即演示《认证接口设计.md》完整契约**：密码/短信/邮箱 Tab（由 `LoginConfig.login` 开关驱动）、OAuth 按钮、忘记密码 / 注册入口、用户名含 `mfa` 触发 MFA 二步验证；登录（任意账号 + 任意密码）后进入主界面，点左侧菜单切换实体页。

- **设备列表（IoTHub/Device）**：树形表（含 `ParentID`）、`StatusID` 显「在线/离线/故障」、`CategoryID` 经 `lookups` 显分类名、底部 `stat` 统计行；新增/编辑弹窗中 `ParentID` 为树形下拉、`StatusID`/`CategoryID` 为映射源下拉；详情抽屉回显名称。
- **设备分类（IoTHub/Category）**：完整 CRUD 演示实体，表单含 `Type` 枚举下拉、`ParentID` 自引用树形下拉、`Enable` 开关、`Sort` 数字输入。

## 三条约定的落实（与 `references/scaffold/` 同源）

| # | 约定 | demo 落点 | 验证状态（demo 自身未编译；结论引自 scaffold 实测） |
|---|---|---|---|
| C1 | 由官方脚手架生成 | Vue3 + Vite + Pinia 工程形态（`vite.config.ts` / `tsconfig.json` / `index.html`），配 `@` 别名 + `paths` | ⚠️ **本目录未编译**（无依赖、无 `dist`）——须 `npm install` 后自行跑 `vue-tsc --noEmit` / `vite build` |
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
