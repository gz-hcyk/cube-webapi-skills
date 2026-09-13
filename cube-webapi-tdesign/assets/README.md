# assets/ —— 可拷贝模板库（**单层：`core/`**）

本目录是「**并入既有工程**」用的模板库：每个文件的路径都**镜像目标工程的 `src/` 目录**，
所以可以直接整目录拷贝。与之并列的 `references/scaffold/` 是**完整可运行工程**（真相源）。

```bash
# 并入既有 Vue3 + Vite 工程：一次拷全 31 件（路径已镜像 src/，无第二层可选项）
cp -r assets/core/.  <你的工程>/src/
```

## ★ 两个参考工程的职责边界（2026-09 实测）

| 工程 | 依赖/构建状态 | 定位 |
|---|---|---|
| `references/scaffold/` | **已清空为纯声明式**（**无 `node_modules`、无 `dist`**；仅留 `package.json` + `package-lock.json` 等源文件）——用前一律 `npm install`。★ 2026-09-13 **复测**：装齐依赖后 `vue-tsc --noEmit && vite build` **exit=0**（**3938 模块** / CSS 472.45 kB / JS 8,845.54 kB gzip 971.38 kB / 29.13s） | **唯一真相源**：资产改动必须先编译 0 错误再同步回 `assets/` |
| `references/demo/` | **不随包携带依赖**（`node_modules`/`dist` 已清空，同 scaffold）；★ 2026-09-13 **双侧构建实证**：装齐依赖后 `vue-tsc --noEmit && vite build` **exit=0**（3925 模块 / JS 1.54 MB），是**可独立构建通过**的精简示例工程 | **精简示例层**（层次独立，非同步目标）：体积约为 scaffold 同构版的 1/5，同名文件为 core 的 1/3~1/8；**登录页是极简版**（83 行纯账密，完整版在 scaffold）。独占资产仅注册/找回密码两页 |

> 因此：**「在 scaffold 内有副本」是资产被验证过的标志**。下表「验证状态」列据此标注。

### ★ 验证结论的适用范围（2026-09 实测口径 —— 勿误读）

本文档与 `SKILL.md` 中反复出现的「`vue-tsc --noEmit` 与 `vite build` 0 错误」，其适用范围如下：

| 维度 | 实际情况 |
|---|---|
| **何时取得** | 曾在**完整安装依赖**的工程内跑通（`vue-tsc --noEmit` + `vite build` + CDP 实测）。★ **scaffold 侧已于 2026-09-13 在本机复测确认**（exit=0 / 3938 模块）；demo 侧另有独立实测（见末行）。⚠️ 本包已将 `node_modules`/`dist` **清空为声明式**，故不再有现场物证，一切以本记录 + 下方复现命令为准 |
| **能否在技能目录内直接复现** | **不能**。依赖不随包携带（`node_modules` 已清空，仅留 `package.json`/`package-lock.json`），直接跑 `npm run typecheck` / `npm run build` 会报找不到命令 |
| **怎样复现** | `cd references/scaffold && npm install && npm run typecheck && npm run build`（**先装依赖，再谈 0 错误**） |
| **要验证待用资产怎么办** | 放进**已装全依赖的工程副本**（scaffold 执行过 `npm install`，或你自己的业务工程）里跑 `vue-tsc`；**不要**假设技能目录本身可编译 |
| **`references/demo/` 里的「0 错误」** | **成立，但基线独立** —— demo 同样不随包携带依赖（`node_modules`/`dist` 已清空，须先 `npm install`）；2026-09-13 实测 `vue-tsc --noEmit && vite build` **exit=0**（3925 模块 / JS 1.54 MB），故其「0 错误」是**实测结论**。⚠️ 该基线只对 demo 自身有效，**不可**用来推断 scaffold/core 资产已验证——demo 是精简层，同名文件与 core 的差异属**已知层次差异**（`DEMO-DIVERGENT` 白名单，见 `references/scripts/README.md`）。**scaffold 的验证状态以其自身复测为准（同日 exit=0 / 3938 模块），不依赖 demo 反推** |

## ★ 唯一真相源与同步铁律

- **真相源 = `references/scaffold/src/`**（**2026-09-13 复测** `vue-tsc --noEmit` 与 `vite build` 0 错误、exit=0，3938 模块；历史上亦曾在完整依赖环境下编译并 CDP 实测过。**复现须先 `npm install`**，见上节「验证结论的适用范围」）。
- 改任一资产：**先在 scaffold 的已装依赖工作副本内改并编译验证 0 错误**，再同步回本目录；禁止只改本目录。
- **一致性校验用脚本，不要手写 `diff`/`find`**（`find`+进程替换在 Windows Git Bash 下不可靠，且只比文件名、不比内容）：

```bash
node references/scripts/check-assets-copied.mjs references/scaffold   # 期望：缺失 0 · 漂移 0（退出码 0）
```

  逐文件 MD5 比对 + 已下线黑名单反扫，判据见 `references/scripts/README.md`。同一命令换目标路径即可查任意业务工程是否真的把 `assets/` 并入且未漂移。

`scaffold/src`（36 件）相对 `assets/core`（31 件）**只多 5 件**，且这 5 件**恒不在 `core` 内**：
「工程外壳」4 件（`main.ts` / `App.vue` / `router/index.ts` / `vite-env.d.ts`，
由 `tdesign-starter-cli` 生成）+ DEV 验证页 `pages/LovDemoView.vue`（`/lov-demo` 路由用，生产构建不注册）。
⇒ `tri-diff` 对它们必然报 `ALL-DIFF`（外壳 4 件）或 `SCAFFOLD-DRIFT`（demo 页）——**属预期，不是漂移**。

第四根 `references/demo/src/`（28 件）是**精简示例层**（技能侧样例，**非** scaffold 的同步目标），
与 `core` 的关系是**子集**（14 件 `core` 资产 demo 不收录，缺件≠漂移，脚本单独打印该计数）；
其**独占资产**仅注册 `RegisterView.vue` / 找回密码 `ForgotPasswordView.vue` 两页 → 报 `DEMO-ONLY`（属预期）。
它**有**且与 `core` 不同的文件**按白名单二分**：命中白名单的 **12 件**报 `DEMO-DIVERGENT`
（精简变体 / 上一代认证架构，**非漂移，无需同步**）；白名单外的报 `DEMO-STALE`（**须同步 demo**，当前 0 条）。
判据见 `references/scripts/README.md`《③ 为何是「层次差异」而非「陈旧」》。

## 一、core/ —— 核心（**必拷，31 件一次拷全**）

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
| `components/cube/IconPicker.vue` | **图标选择器**（`itemType=icon`；枚举 `tdesign-icons-vue-next` 全部 SVG 组件，值存 kebab 图标名） | FormDialog（`control === 'icon'` 分支） |
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
| `pages/LoginView.vue` → `src/pages/` | 登录门禁（系统名读 `/Auth/LoginConfig`；**铁律 L1~L4**：左栏 `PROJECT` 文案按项目生成、账号密码不预填、页面无实现细节文案、**无租户选择**；注册页同理见 L4） | router |
| `specialControllers.ts` → `src/` | 非实体控制器显式注册表 | EntityPage |

> `ConfigView` / `DbView` 之所以在 **core**（而非 optional）：它们被 core 的
> `specialControllers.ts` **静态 import**——只拷 core 却漏掉它们会直接构建失败。
> 二者只在后端确实存在对应控制器时才渲染，属"随包必备、按数据启用"。
> `useLov.ts` / `LovListField.vue` 同理：被 core 的 `FormDialog.vue` 静态 import
> （lov-list 表单分支），只拷 core 漏掉即构建失败；后端无 `Admin/Lov` 时
> `load()` 静默退化、弹窗不渲染，属"随包必备、按数据启用"。
> `IconPicker.vue` 同理（**2026-09 由 `optional/` 提升为 `core/`**）：被 `FormDialog.vue`
> 静态 import（`control === 'icon'` 分支），只拷 core 漏掉即 `vue-tsc` 报
> `Cannot find module './IconPicker.vue'`；后端无 `itemType=icon` 字段时该分支不渲染，
> 同属"随包必备、按数据启用"。

## 二、配方件（原 `optional/`）—— 已并入 `core`（2026-09-13）

`assets/` 已是**单层**结构。以下 3 件**随 `core/` 一并拷入即已在位**，接不接线由业务页决定：

| 文件（→ 目标路径） | 作用 | 启用条件 | 额外依赖 | 验证状态 |
|---|---|---|---|---|
| `components/cube/RoleMenuEditor.vue` | 角色权限设置（菜单树 + 权限位勾选，§4.12.1） | 需要角色授权页 | 无 | ✅ scaffold 内有副本，过 `vue-tsc` |
| `components/cube/PriceYuanInput.vue` | 金额输入（元/分换算） | 有金额字段 | 无 | ✅ 同上 |
| `components/cube/ThemeShowcase.vue` | 设计令牌板（可视化验证 `/theme`，已挂 DEV 路由） | 想看令牌全景 | 无 | ✅ 同上 |

### ★ 2026-09-13：取消可选项分层，`assets/` 收敛为单层 `core/`（31 件）

- **旧分层判据**：「是否被 core 文件静态 import」。它只对「**缺了就构建失败**」的件有解释力
  —— 如 `IconPicker.vue`（`FormDialog.vue` 对其静态 import，漏拷即 `Cannot find module`）。
- **为何取消**：`RoleMenuEditor` / `PriceYuanInput` / `ThemeShowcase` 属**零引用配方件**
  —— 不拷不报错、拷了也不报错 ⇒ 落在两可地带 ⇒「拷不拷」全靠记忆。
  这正是历史上 `IconPicker` 被漏拷的同一成因。收敛后规则回到一句：
  **一个目录、一次 `cp -r`、31 件全拷**，无需记哪件在哪个子目录。
- **已知代价**（接受）：`core/` 变重，含 3 件默认工程零引用的文件
  （实测：覆盖后再 `Grep PriceYuanInput|RoleMenuEditor|ThemeShowcase` 于工程 `src/`，无任何 import 命中，
  唯一同名命中是 `router/index.ts` 指向 `pages/ThemeShowcase.vue`——**同名不同文件**）。
  它们只贡献体积、不参与构建。
- **旧判据仍有效**，只是不再用于分层：一旦某 core 文件开始**静态 import** 某件，该件就必须在 `core/` 内。
  已知属此类：`ConfigView` / `DbView` / `LovListField` / `useLov.ts` / `IconPicker`。
