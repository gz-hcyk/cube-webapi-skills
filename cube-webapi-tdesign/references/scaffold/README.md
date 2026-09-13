# cube-webapi-tdesign · 生产级编排层脚手架（references/scaffold/）

对接 **NewLife.Cube 魔方 WebApi** 的 TDesign Vue Next 前端**完整可运行工程骨架**。

- **基线来源**：官方 `tdesign-starter-cli`（`-type vue3 -bt vite -temp lite`，v0.5.3）生成，
  在其产物（`index.html` / `vite.config.ts` / `tsconfig.json` / `src/main.ts` / `src/App.vue`）之上
  注入技能 `assets/` 模板，并补齐 `vue-router` / `pinia` / `axios` 三项脚手架默认未含的依赖。
- **能力范围**：登录门禁 → 动态菜单（后端 `GetMenuTree`）→ 泛型实体页（`GetPage` 元数据驱动）
  → 表单/详情 → 配置类单表单页 → 通用动作页；含**默认政务蓝**品牌主色与**暗黑模式**切换。

## 三条强制约定（本脚手架的验收基线）

| # | 约定 | 落点 | 验收方式 |
|---|---|---|---|
| 1 | **由 td-starter 生成** | 工程配置文件保持 CLI 产物形态（`package.json` / `vite.config.ts` / `tsconfig.json` / `index.html`）；本 README 上方注明 CLI 版本 | `npm install && npm run build` 通过（历史实测；依赖不随包携带、已清空为声明式，复现见「使用方式」上方前置条件） |
| 2 | **默认品牌色 = 政务蓝 `#0f4c9e`** | `src/styles/tokens.css`（`--td-brand-color` 及全色阶）；`src/stores/setting.ts` 的 `DEFAULT_BRAND`；`src/theme/tokens.ts` | 首屏无自定义时即为政务蓝；设置面板「政务蓝」置首 |
| 3 | **支持切换暗黑模式** | `src/styles/theme-dark.css` + `src/stores/setting.ts`（`mode: light/dark`，切 `<html>.t-theme-dark`）+ `src/main.ts` 首屏 `load()` + **`BasicLayout.vue` 挂载 `SettingPanel.vue`**（悬浮齿轮按钮，UI 唯一入口） | 点右下角齿轮 → 主题模式切「暗色」，页面即时变暗 |

> ⚠️ 三个条件**缺一不可**：`theme-dark.css` 不 import、或 `setting.load()` 未在启动调用、
> 或 `SettingPanel` 未挂载，都会让「暗黑模式」沦为死代码（能力在、但用户点不到）。

## 目录

```
references/scaffold/
  index.html  vite.config.ts  tsconfig.json  tsconfig.node.json  package.json   # td-starter 基线
  backend/server.mjs          内置 Mock 后端（:3001）：/Auth/Login·LoginConfig、GetMenuTree、
                              实体 GetPage+CRUD、/api/Admin/Lov/{Meta,ListData}（值集）
  src/
    main.ts                    TDesign + tokens.css + theme-dark.css + pinia + router + setting.load()
    App.vue                    t-config-provider + router-view
    router/index.ts            登录门禁（beforeEach 未登录跳 /login）+ /dashboard + /entity/:area/:controller 泛型兜底
                               + DEV-only 验证路由 /theme、/lov-demo（生产构建不注册）
    layouts/BasicLayout.vue    侧栏（MenuSidebar）+ 顶栏（面包屑/用户菜单）+ 内容区 + 【SettingPanel 挂载】
                               + onNavigate()：后端菜单 url → /entity/{area}/{controller}
    pages/
      LoginView.vue            登录门禁（左品牌渐变区 + 右表单区，系统名读 /Auth/LoginConfig）
                               ★ L1~L4：左栏 PROJECT 文案按项目生成 / 账号密码不预填 / 页面无实现细节文案 / 登录页与注册页均无租户选择
      EntityPage.vue           泛型实体页：按 SPECIAL_CONTROLLERS 分发专用页 / 标准 ListPage
      DashboardView.vue        仪表盘首页（菜单树驱动，按 permissions 位 2/4/8 过滤实体）
      LovDemoView.vue          【DEV 验证页】LovListField 值集弹窗（单选直连 / 多选代理 / 跨页）
    api/                       http.ts(唯一 HTTP 实例) token.ts fieldRender.ts useEntityResource.ts
                               useLookups.ts useLov.ts menuTitles.ts
    components/cube/           ListPage / FormDialog / DetailDrawer / MenuSidebar / SettingPanel
                               + ConfigView / DbView（非实体控制器专用页）
                               + RoleMenuEditor / PriceYuanInput / ThemeShowcase（可选增强件）
                               + LovListField（LIST 型值集表格弹窗）
    stores/                    auth.ts（登录态/令牌）  setting.ts（主题模式/品牌色/布局）
    theme/tokens.ts            与 tokens.css 同源的 TS 令牌（图表配色用）
    utils/                     color.ts（品牌色阶推导） camel.ts
    styles/                    tokens.css（政务蓝）  theme-dark.css（暗色令牌）
    specialControllers.ts      非实体控制器显式注册表（ConfigController<T> / ControllerBaseX）
```

> 本目录 = 技能 `assets/core/` + `assets/optional/` 的**全部文件**（另加 `td-starter` 生成的工程外壳
> `main.ts`/`App.vue`/`router/`/`vite-env.d.ts`，以及 DEV 验证页 `LovDemoView.vue`）。
> `assets/` 只是"并入既有工程"用的、按目标路径镜像的拷贝源；分类依据与同步铁律见 `assets/README.md`。
>
> 早前放在本目录的 `api/menuTree.ts`、`utils/permissions.ts` 已**删除**（主链路零引用的历史残留，
> 职责与 `MenuSidebar`+`BasicLayout` 的内联归一化、`DashboardView` 的内联权限位判定重叠）。

> **未随脚手架附带的**（按需从 `assets/optional/` 取）：
>
> | 组件 | 额外依赖 |
> |---|---|
> | `IconPicker.vue`（`itemType=icon`） | 无（用 `tdesign-icons-vue-next`，已在依赖内）；⚠️ 本目录无副本、未过 `vue-tsc`，取用前先放进 `src/` 验证 |
>
> **已下线**：`ListNavbar/ListSearchBar/ListToolbar/ListFooter`、`DetailContent.vue`——早期 `fieldRender` 契约产物，拷贝即编译失败，能力已并入自包含的 `ListPage.vue` / `FormDialog.vue`。
>
> **已删除**：`CodeEditor.vue`（`itemType=json/markdown` 富编辑）——零引用 + 从未编译验证（缺 `@codemirror/*`），
> 且 `fieldRender`/`FormDialog` 从未接该分支。当前 json/markdown 字段按多行文本渲染，
> 设计要点留在 `references/field-renderers.md` §9.2 供复活参考。

## 使用方式

```bash
npm install

# 方式 A（自跑，含登录）：先起内置 Mock 后端，再把代理指过去 → 端到端可跑通登录/菜单/实体页/值集弹窗
npm run mock                                          # 终端1：Mock 后端 :3001
VITE_API_TARGET=http://127.0.0.1:3001 npm run dev     # 终端2：Vite :5173

# 方式 B（对接真实魔方后端）
VITE_API_TARGET=http://127.0.0.1:5052 npm run dev

npm run build                                         # vue-tsc --noEmit && vite build
npm run typecheck                                     # 仅类型检查
```

> ⚠️ **前置条件（实测口径）**：本目录**不随技能携带依赖与构建产物**（`node_modules`、`dist` 均已清空为声明式，仅留 `package.json`/`package-lock.json` 等源文件），故 `npm run typecheck` / `npm run build` **必须先 `npm install` 补齐依赖**才能执行。本目录声称的「编译 0 错误」是**在完整依赖环境下取得的历史结论**，**不是**当前目录内可直接复现的状态。资产同步铁律的完整口径见 `assets/README.md` §「验证结论的适用范围」。

- **唯一必改项**：`vite.config.ts` 的 `VITE_API_TARGET`（默认 `http://127.0.0.1:5052`）。
- **代理范围**：`/api` `/Auth` `/Mfa` `/Sso` `/Cube` `/cube` `/Content`；
  **切勿代理** `/Admin`、`/Asset` 等业务区路由（由 Vue Router 处理，转发后端会 404）。
- **DEV 验证页**：`/theme`（设计令牌板）、`/lov-demo`（LIST 型值集弹窗，需 Mock 或真实后端提供
  `/api/Admin/Lov/Meta`）。生产构建不注册这两个路由。
- **表单集成（lov-list）已落地**：Mock 的 `Admin/User` 实体带两个 LIST 型字段——`roleLovID`（单选）、
  `roleIds`（多选，名以 `IDs` 结尾）——用于端到端验证「列表 → 新增表单 → 值集弹窗 → 回填」。
  到 `/entity/Admin/User` 点「新增」即可复现；组件行为 / FR / 验证清单见 `references/lov-list-field.md`。
- **并入既有工程**：用 `cp -r assets/core/. <工程>/src/` 拷贝核心，按需再补 `assets/optional/`；
  或对照把 `BasicLayout` / `EntityPage` / `LoginView` / `router` / `main.ts` 的编排逻辑迁移过去，不重复造轮子。

## 契约要点（实测，详见 SKILL.md §4.8 / §六）

- 登录 `POST /Auth/Login`，body `{ username, password }`（**不是 `userName`**），令牌键名 snake_case，
  统一走 `token.ts` 的 `normToken` 三向兜底。
- 请求头只认 **`Authorization: Bearer <jwt>`**（发 `Authentication` 或只带 Cookie 均 401）。
- 实体接口 `/api/{area}/{controller}/{action}`；**菜单 `/Admin/Index/GetMenuTree`（无 `/api` 前缀，带前缀 → 404）**；字典 `/Cube/Lookup`、签名清单 `/Cube/Apis` 同样无前缀。
- 枚举字典由后端下发在字段描述符 **`dataSource`**（不是 `mapField`）；外键走 `mapField` 映射列。
- ★ Cube 序列化 `DataField` 时**省略取值为 false 的布尔键** → 推必填只能 `f.nullable !== true`
  （写 `=== false` 会全体失效）。

> 资产文件对 `src/api/*` 的引用使用 `../../api/...`（基类组件落在 `src/components/cube/`），复制时注意目录层次。

## 开源协议

TDesign 遵循 [MIT 协议](https://github.com/Tencent/tdesign-starter-cli/blob/develop/LICENSE)。
