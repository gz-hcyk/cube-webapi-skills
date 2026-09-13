# cube-webapi-tdesign · 生产级编排层脚手架（references/scaffold/）

对接 **NewLife.Cube 魔方 WebApi** 的 TDesign Vue Next 前端**完整可运行工程骨架**。

- **基线来源**：官方 `tdesign-starter-cli@0.5.3` 以 **`-type vue3 -temp all`（完整脚手架）** 生成，
  在其产物（**193 件**）之上「保留全部基础设施 + 删除上游演示业务代码 + 注入技能 `assets/core/`」。
- **为什么是 `all` 而不是 `lite`**：`all` 自带 `vue-router` / `pinia` / `axios` / `vue-i18n` / `@vueuse/core`、
  `src/types/{env,globals,interface,router,axios}.d.ts`、`eslint.config.js` + `stylelint.config.js` + `commitlint.config.js`
  + `.husky/`、`.env*` 多环境文件、`vite-plugin-mock` + `vite-svg-loader` 等完整工具链；
  `lite` 只有 13 件、三件套依赖都得手补。**本项目只支持 `all` 形态**（2026-09-13 起）。
- **可校验**：`node ../scripts/check-starter-align.mjs .`（退出码 0 = 仍是 CLI 产物形态，无 FAIL）。
  脚本按 `tsconfig.node.json` 是否存在**自动判定血统**（`all` / `lite`），再按对应基线校验。
  本目录当前为 **0 FAIL / 0 WARN** —— 已声明的偏差见下节。
- **能力范围**：登录门禁 → 动态菜单（后端 `GetMenuTree`）→ 泛型实体页（`GetPage` 元数据驱动）
  → 表单/详情 → 配置类单表单页 → 通用动作页；含**默认政务蓝**品牌主色与**暗黑模式**切换。

## 已声明偏差（相对 `td-starter -temp all` 原始产物）

| 项 | 处理 | 理由 |
|---|---|---|
| `scripts.prepare` | **已删（必须）** | 实测致命：该脚本调 `is-ci`（还有 `husky install`），`is-ci` 不在任何依赖中 → `npm run prepare` exit=1。`all` 下 `npm install` 恰好不阻断，但仍属必删项。改名为 `scripts.husky:init`（`husky`）保留手动启用能力。 |
| `package.json#name` | `demo-all` → `cube-webapi-tdesign-scaffold` | CLI 用工程名作为包名；`package-lock.json` 同步改（2 处） |
| `package.json#private` | **新增 `true`** | `all` 模板无此键，业务工程补上以防误 `npm publish` |
| `package.json#scripts.mock` | **新增** `node backend/server.mjs` | `all` 模板无自带 Mock 启动脚本；本目录内置零依赖 Mock 后端要用 |
| `README.md` / `README-zh_CN.md` / `CHANGELOG.md` / `LICENSE` / `PUBLISH.md` / `docs/` / `.github/` / `.cnb` / `.cnb.yml` / `.gitattributes` | **已删** | 上游仓库文档与 CI 配置，对业务工程无意义 |
| `src/permission.ts`、`mock/` | **已删** | 上游演示鉴权守卫与 mock 目录（本目录用 `backend/server.mjs` + `vite.config.ts` 的 `viteMockServe(mockPath:'mock', enable:false)`） |
| 上游演示业务代码（`src/pages/`50 件、`src/layouts/`18 件、`src/api/`6 件、`src/router/modules/`、`src/store/modules/`、`src/utils/`8 件、`src/style/`5 件、`src/components/`7 件） | **已删** | 与本技能 `assets/core/` **同路径不同内容**，留着必打架 |
| `src/assets/`（19 件，1.9 MB 上游演示图） | **已删** | 全量零引用（`grep` 无命中）；`vite-svg-loader` 与本技能代码无 svg 导入 |
| `src/store/` → `src/stores/`、`src/style/` → `src/styles/` | **目录归一** | 与 `assets/core/stores/`、`assets/core/styles/` 落位一致；`main.ts` 的 `import ... from './stores'` 已同步 |
| `index.html` | 改 `lang="zh-CN"`、`<title>魔方管理后台</title>`、**删腾讯 Aegis 上报脚本** | 上游内嵌 `tdesign.tencent.com` 站点的埋点，业务工程必须移除；`window.global = window` 垫片保留（个别依赖假设 CJS `global` 存在） |
| `src/types/env.d.ts` | **追加** `VITE_SERVER_BASE` / `VITE_API_BASE` / `VITE_API_TARGET` / `VITE_UPLOAD_URL` | 本技能 `api/http.ts` 与上传端点的环境变量类型 |

**白名单补丁**（唯一允许的偏离）：`@` 别名（`vite.config.ts` alias + `tsconfig.paths` 成对）、dev `server.proxy` 八条规则、
`build.rolldownOptions`、`index.html` 的 `lang`/`<title>`、补 `backend/` 与上述 `package.json` 六项。
**tsconfig 编译策略与 `all` 基线逐字一致**（故无 WARN）；`package.json` 的依赖与其余脚本**原样保留 `all` 模板全部内容**。

## 保留但零引用的上游基础设施（可裁）

以下来自 `all` 模板，业务代码**零引用**，保留是为了维持「完整脚手架」形态；确认不需要可整目录删除：

| 目录 | 件数 | 说明 |
|---|---|---|
| `src/config/` | 3 | `global.ts`（`prefix`）、`color.ts`（图表色板）、`style.ts`（布局默认值，已被 `stores/setting.ts` 取代） |
| `src/constants/` | 1 | 上游「合同状态」演示枚举，**与本技能规范冲突**（枚举应走后端 `dataSource` 字典），仅作占位 |
| `src/hooks/` | 1 | `useChart`（`echarts/core` 依赖源；删它可连带删 `echarts` 依赖） |
| `src/locales/` | 4 | **建议保留**：`src/types/{router,interface}.d.ts` 依赖其 `LocalizedTitle` 类型，`App.vue` 依赖 `useLocale()` |
| `src/types/` | 5 | **建议保留**：`env.d.ts`（环境类型根）、`globals.d.ts`（`*.vue`/`*.svg` 模块声明）、`router.d.ts`（`RouteMeta` 增强）、`interface.d.ts`、`axios.d.ts` |

## 三条强制约定（本脚手架的验收基线）

| # | 约定 | 落点 | 验收方式 |
|---|---|---|---|
| 1 | **由 td-starter 生成** | 工程配置文件保持 CLI 产物形态（`package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` / `public/favicon.ico` / `src/types/env.d.ts`）；本 README 上方注明 CLI 版本 | `node ../scripts/check-starter-align.mjs .` **退出码 = 0**（骨架存在性 / 无 `prepare` / 依赖 / `@` 别名 / favicon / rolldown 分包 API 全部机检）；另 `npm install && npm run build` 通过（**2026-09-13 本目录自测：INSTALL exit=0（880 包）/ `vue-tsc --noEmit` exit=0（**0 错误**）/ `vite build` exit=0，3953 模块，CSS 472.45 kB，JS 7,206.42 kB，24.15s，dist 7.4 MB**） |
| 2 | **默认品牌色 = 政务蓝 `#0f4c9e`** | `src/styles/tokens.css`（`--td-brand-color` 及全色阶）；`src/stores/setting.ts` 的 `DEFAULT_BRAND`；`src/theme/tokens.ts` | 首屏无自定义时即为政务蓝；设置面板「政务蓝」置首 |
| 3 | **支持切换暗黑模式** | `src/styles/theme-dark.css` + `src/stores/setting.ts`（`mode: light/dark`，切 `<html>.t-theme-dark`）+ `src/main.ts` 首屏 `load()` + **`BasicLayout.vue` 挂载 `SettingPanel.vue`**（悬浮齿轮按钮，UI 唯一入口） | 点右下角齿轮 → 主题模式切「暗色」，页面即时变暗 |

> ⚠️ 三个条件**缺一不可**：`theme-dark.css` 不 import、或 `setting.load()` 未在启动调用、
> 或 `SettingPanel` 未挂载，都会让「暗黑模式」沦为死代码（能力在、但用户点不到）。

## 从零生成一个 all 形态工程的完整命令序列

`-temp all` 的「选择包含模块」提示可以直接回车（默认即「全部」），**无需 TTY**：

```bash
# 1) 生成（printf '\n' = 回车选中「全部模块」，避免交互式箭头选择）
printf '\n' | npx --yes tdesign-starter-cli@0.5.3 init <工程名> -type vue3 -temp all

# 2) 删除上游演示业务代码与仓库文档（必删清单）
cd <工程名>
rm -rf .git .github .cnb .cnb.yml .gitattributes \
       README.md README-zh_CN.md CHANGELOG.md LICENSE PUBLISH.md docs \
       mock src/permission.ts src/assets \
       src/api/* src/components/* src/layouts/* src/pages/* \
       src/router/modules src/store src/style src/utils/*

# 3) 目录归一（all 用单数 store/style，本项目统一为复数）
mkdir -p src/stores src/styles

# 4) 注入技能资产（31 件，含全部配方件）
cp -r <skill>/assets/core/. src/

# 5) 删 prepare、修 index.html（lang/title/埋点）
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.scripts.prepare;p.private=true;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"

# 6) 装依赖 + 三连验证（缺一不可）
npm install && npx vue-tsc --noEmit && npx vite build
node <skill>/references/scripts/check-starter-align.mjs .
```

> ⚠️ **第 6 步的 `vue-tsc --noEmit` 不是可选项**：`all` 用 `vite@8` + `vue-tsc@3` + `typescript@6` + `tdesign-vue-next@1.20.2`，
> TDesign 的**事件/属性类型远比 `lite` 严格**（`lite` 是 `vite@5`/`vue-tsc@2`/`ts@5.9`）。
> 技能资产在 `lite` 下从不报错的写法（如 `@change="(v: SomeNarrow) => ..."`）在 `all` 下会直接 TS2322。
> 详见 SKILL.md §4.1 与 §十一 的铁律 R4/R5。

## 目录

```
references/scaffold/
  index.html  vite.config.ts  tsconfig.json  package.json                    # td-starter(all) 基线
  .env  .env.development  .env.site  .env.test  .npmrc  .prettierrc.js       # all 工具链件
  eslint.config.js  stylelint.config.js  commitlint.config.js  .husky/       # all 工具链件
  backend/server.mjs            零依赖 Mock 后端（:3001）：/Auth/Login·LoginConfig、GetMenuTree、
                                实体 GetPage+CRUD、/api/Admin/Lov/{Meta,ListData}（值集）
  src/
    main.ts                     TDesign + tokens.css + theme-dark.css + pinia + router + i18n + setting.load()
    App.vue                     t-config-provider（注入 TDesign 组件语言包）+ router-view
    router/index.ts             登录门禁（beforeEach 未登录跳 /login）+ /dashboard + /entity/:area/:controller 泛型兜底
                                + DEV-only 验证路由 /theme、/lov-demo（生产构建不注册）
    layouts/BasicLayout.vue     侧栏（MenuSidebar）+ 顶栏（面包屑/用户菜单/租户切换）+ 内容区 + 【SettingPanel 挂载】
                                + onNavigate()：后端菜单 url → /entity/{area}/{controller}
    pages/
      LoginView.vue             登录门禁（左品牌渐变区 + 右表单区，系统名读 /Auth/LoginConfig）
                                ★ L1~L4：左栏 PROJECT 文案按项目生成 / 账号密码不预填 / 页面无实现细节文案 / 登录页与注册页均无租户选择
      EntityPage.vue            泛型实体页：按 SPECIAL_CONTROLLERS 分发专用页 / 标准 ListPage
      DashboardView.vue         仪表盘首页（菜单树驱动，按 permissions 位 2/4/8 过滤实体）
      LovDemoView.vue           【DEV 验证页】LovListField 值集弹窗（单选直连 / 多选代理 / 跨页）
    api/                        http.ts(唯一 HTTP 实例) token.ts fieldRender.ts useEntityResource.ts
                                useLookups.ts useLov.ts menuTitles.ts
    components/cube/            ListPage / FormDialog / DetailDrawer / MenuSidebar / SettingPanel
                                + ConfigView / DbView（非实体控制器专用页）
                                + RoleMenuEditor / PriceYuanInput / ThemeShowcase（零引用配方件，随 core 全拷）
                                + LovListField（LIST 型值集表格弹窗） / IconPicker（图标选择器）
    stores/                     auth.ts（登录态/令牌）  setting.ts（主题模式/品牌色/布局）  index.ts（pinia 实例）
    types/                      env.d.ts（环境类型根） globals.d.ts interface.d.ts router.d.ts axios.d.ts
    locales/                    index.ts（vue-i18n 实例） useLocale.ts lang/{zh_CN,en_US}.json
    config/ constants/ hooks/   上游保留的零引用基础设施（见上「可裁」表）
    theme/tokens.ts             与 tokens.css 同源的 TS 令牌（图表配色用）
    utils/                      color.ts（品牌色阶推导） camel.ts
    styles/                     tokens.css（政务蓝）  theme-dark.css（暗色令牌）  + all 的 *.less
    specialControllers.ts       非实体控制器显式注册表（ConfigController<T> / ControllerBaseX）
```

> **本目录 vs `assets/core/`**：脚手架 = `assets/core/`（**31 件，必拷**）+ 工程外壳
> （`main.ts`/`App.vue`/`router/index.ts`，`td-starter(all)` 生成并改造）+ DEV 验证页 1 件
> （`pages/LovDemoView.vue`）+ `all` 保留的基础设施（`types/`、`locales/`、`config/`、`constants/`、`hooks/`、`*.less`）。
> **后三者恒不在 `core` 内**，`tri-diff` 对它们必然报 `ALL-DIFF`（外壳）或 `SCAFFOLD-DRIFT`（demo 页）
> —— **属预期，不是漂移**。第四类（上游基础设施）同样不在 `core` 内，报 `ALL-DIFF` 亦属预期。
> `tri-diff` 的第四根（**可选**）原为 `references/demo/src/`（精简示例层，lite 血统，非同步目标）——
> 该 demo 已于 2026-09-13 **归档移出技能**（→ 技能仓库 `.archive/cube-webapi-tdesign--demo-lite/`），
> `tri-diff` **默认只跑三根**，需 `--demo <归档>/src` 显式启用第四根。启用后：
> 仅 demo 有的报 `DEMO-ONLY`（预期，独占资产仅注册/找回密码两页）；与 `scaffold`/`core` 内容不同的
> **按白名单二分** —— 命中白名单的报 `DEMO-DIVERGENT`（层次差异，**非漂移**），
> 白名单外的报 `DEMO-STALE`（**须同步**）。判据见 `references/scripts/README.md`。
> `assets/` 只是"并入既有工程"用的、按目标路径镜像的拷贝源；同步铁律见 `assets/README.md`。

> **`IconPicker.vue` 已随包附带**（2026-09 由 `assets/optional/` 提升为 `assets/core/`）：
> `FormDialog.vue` 对本文件是**静态 import**（`control === 'icon'` 分支），
> 脚手架不带它即不可编译（`Cannot find module './IconPicker.vue'`）。
> 归类判据见 `assets/README.md`「归类的唯一判据：是否被 core 文件静态 import」。

> **已下线**：`ListNavbar/ListSearchBar/ListToolbar/ListFooter`、`DetailContent.vue`——早期 `fieldRender` 契约产物，拷贝即编译失败，能力已并入自包含的 `ListPage.vue` / `FormDialog.vue`。
>
> **已删除**：`CodeEditor.vue`（`itemType=json/markdown` 富编辑）——零引用 + 从未编译验证（缺 `@codemirror/*`）。
> 当前 json/markdown 字段按多行文本渲染，设计要点留在 `references/field-renderers.md` §9.2 供复活参考。

## 使用方式

```bash
npm install

# 方式 A（自跑，含登录）：先起内置 Mock 后端，再把代理指过去 → 端到端可跑通登录/菜单/实体页/值集弹窗
npm run mock                                          # 终端1：Mock 后端 :3001
VITE_API_TARGET=http://127.0.0.1:3001 npm run dev     # 终端2：Vite :3002

# 方式 B（对接真实魔方后端）
VITE_API_TARGET=http://127.0.0.1:5052 npm run dev

# all 完整脚手架自带的工具链
npm run build            # = vue-tsc --noEmit && vite build --mode release
npm run build:type       # 仅类型检查（等价于 npx vue-tsc --noEmit）
npm run lint             # eslint --max-warnings 0
npm run stylelint        # stylelint
node ../scripts/check-starter-align.mjs .               # CLI 基线体检（退出码 0 = 通过）
```

> ⚠️ **前置条件（实测口径）**：本目录**不随技能携带依赖与构建产物**（`node_modules`、`dist` 均已清空为声明式，
> 仅留 `package.json`/`package-lock.json` 等源文件），故 `npm run build:type` / `npm run build`
> **必须先 `npm install` 补齐依赖**才能执行。本目录声称的「编译 0 错误」**已于 2026-09-13 在本机完整依赖环境下复测确认**
> （`npm install` exit=0，880 包；`vue-tsc --noEmit` exit=0，**0 条错误**；`vite build` exit=0，3953 模块，24.15s，dist 7.4 MB），
> 但该结论**不是**当前目录内可直接复现的状态——**须先装依赖**。
> 资产同步铁律的完整口径见 `assets/README.md` §「验证结论的适用范围」。

- **唯一必改项**：`vite.config.ts` 的 `VITE_API_TARGET`（默认 `http://127.0.0.1:5052`）。
- **代理范围**：`/api` `^/Admin/Index/` `/Auth` `/Mfa` `/Sso` `/Cube` `/cube` `/Content`；
  **切勿代理 `/Admin`**（会把前端页面路由 `/Admin/User` 一并转发，硬刷新变 GET 404）。
- **端口**：dev server `3002`（`all` 模板原生端口，非 `lite` 的 `5173`）；Mock 后端 `3001`。
- **`all` 自带的多环境**：`npm run dev` = `--mode development` → 读 `.env.development`；
  `build` = `--mode release`（回落 `.env`）；`build:site` = `--mode site` → 读 `.env.site`。
  本技能只用到 `VITE_BASE_URL`；`.env*` 里的 `VITE_API_URL` / `VITE_API_URL_PREFIX` 是上游演示地址，
  **业务代码零引用**，可替换或删除。
- **DEV 验证页**：`/theme`（设计令牌板）、`/lov-demo`（LIST 型值集弹窗，需 Mock 或真实后端提供
  `/api/Admin/Lov/Meta`）。生产构建不注册这两个路由。
- **表单集成（lov-list）已落地**：Mock 的 `Admin/User` 实体带两个 LIST 型字段——`roleLovID`（单选）、
  `roleIds`（多选，名以 `IDs` 结尾）——用于端到端验证「列表 → 新增表单 → 值集弹窗 → 回填」。
  到 `/entity/Admin/User` 点「新增」即可复现；组件行为 / FR / 验证清单见 `references/lov-list-field.md`。
- **并入既有工程**：用 `cp -r assets/core/. <工程>/src/` 拷贝核心（31 件，含全部配方件，一次到位）；
  或对照把 `BasicLayout` / `EntityPage` / `LoginView` / `router` / `main.ts` 的编排逻辑迁移过去，不重复造轮子。

## 契约要点（实测，详见 SKILL.md §4.8 / §六）

- 登录 `POST /Auth/Login`，body `{ username, password }`（**不是 `userName`**），令牌键名 snake_case，
  统一走 `token.ts` 的 `normToken` 三向兜底。
- 请求头只认 **`Authorization: Bearer <jwt>`**（发 `Authentication` 或只带 Cookie 均 401）。
- 实体接口 `/api/{area}/{controller}/{action}`；**菜单 `/api/Admin/Index/GetMenuTree`（区域族必带 `/api`；漏前缀 → SPA 兜底、菜单静默为空）**；
  字典 `/Cube/Lookup`、签名清单 `/Cube/Apis` 同样无前缀。
- 枚举字典由后端下发在字段描述符 **`dataSource`**（不是 `mapField`）；外键走 `mapField` 映射列。
- ★ **布尔键恒下发**：`nullable` / `required` / `readOnly` / `visible` / `primaryKey` 在 GetPage 响应里
  **一个都不省**（实测 129/129 字段全带 `"nullable":false,"required":false,"primaryKey":false,"readOnly":false`）
  → 一律写 `f.xxx === true` 判定，**不要依赖「键缺失」**。
  > 曾据一次抓包误判为「Cube 省略取值为 `false` 的布尔键」并据此写 `!== false`——**该断言已证伪**，
  > 依据：`NewLife.CubeNC/ViewModels/DataField.cs` 中这些属性都是**非空 `Boolean` 值类型**，
  > `System.Text.Json` 默认不忽略 `false`。详见 SKILL.md §4.8 ③。
- 推必填：优先后端 `required === true`；否则 `inferRequired()`（`f.nullable === true` ⇒ 可空 ⇒ 不必填）。

> 资产文件对 `src/api/*` 的引用使用 `../../api/...`（基类组件落在 `src/components/cube/`），复制时注意目录层次。

## 开源协议

TDesign 遵循 [MIT 协议](https://github.com/Tencent/tdesign-starter-cli/blob/develop/LICENSE)。
