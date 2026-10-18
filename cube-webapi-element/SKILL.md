---
name: cube-webapi-element
agent_created: true
description: "为 NewLife.Cube 魔方 WebApi 后端生成 Vue 3 + Vite + Element Plus 前端。先从官方脚手架（create-vue）初始化工程，再按设计令牌并入可复用资产；核心是「组件化 + 模板继承」：一个 ListPage/FormDialog/DetailDrawer 基类 + 字段渲染器，让每个实体的增删改查从 GetPage 元数据自动生成，新增实体不写页面。含字段映射双模式（列表显名 / 表单下拉）、ParentID 树形表格与树形下拉、X-Tenant 多租户、GetMenuTree 动态菜单与同层互斥展开、GetPage.setting 按钮权限、政务蓝设计令牌与明暗双主题、vite 代理与 /api 前缀族、生产构建与子路径部署。触发词：搭魔方 WebApi 前端、Element Plus 前端、vue3 vite element-plus、生成实体管理页面、新增实体页面、对接 GetFields/GetPage、字段映射、外键下拉、枚举下拉、树形表格、树形下拉、动态菜单、GetMenuTree、同层互斥、手风琴菜单、按钮权限、多租户前端、X-Tenant、暗色主题、品牌色换肤、设计令牌、组件化、模板继承、配置式列表页、create-vue 初始化、脚手架、vite 代理、/api 前缀、405 修改删除、多选崩溃、菜单空白、登录 404、生产部署子路径。"
---

# cube-webapi-element —— 魔方 WebApi 的 Vue 3 + Element Plus 前端

从零创建一个**能长期维护**的魔方 WebApi 管理前端：用官方脚手架起步，用设计令牌统一视觉，
用「基类组件 + 字段渲染器」把每个实体的列表 / 表单 / 详情**继承**出来。

**这个技能解决的不是"画一个页面"，而是"第 30 个页面还能 5 行写完"。**

资源导航（本文只放流程与铁律，细节按需读）：

| 需要 | 去读 |
|---|---|
| 字段 → 控件全规则、映射/多值/树形/上传的坑 | `references/field-renderers.md` |
| 响应信封、路由前缀、GetPage/DataField 契约 | `references/metadata-contract.md` |
| 颜色/字体/间距/组件规格/暗色/无障碍 | `references/design-tokens.md` |
| 三种落地方式、薄页面、父子表、扩控件 | `references/page-composition.md` |
| 症状 → 根因 → 修法（18 组） | `references/troubleshooting.md` |
| 可拷贝代码 | `assets/core/**`（映射见 `assets/README.md`） |
| 工程闸门 | `scripts/check-project.mjs` |
| 后端契约权威（控制器/权限/JWT/部署） | `cube-webapi-backend` 技能 |

---

## 铁律 E1：组件化 + 模板继承（最高优先级，违反即不合格）

魔方 MVC 的 `List.cshtml` / `_Form_*.cshtml` / `ListTree.cshtml` 是"共享骨架 + 按字段选视图"。
本技能把这套理念一比一搬到 Vue，**不是"参考一下"，是硬约束**：

| MVC | Vue 实现 | 谁维护 |
|---|---|---|
| `_Layout.cshtml` | `layouts/BasicLayout.vue` | 项目一次 |
| `List.cshtml` | `components/cube/ListPage.vue` | 全局一份 |
| `_List_Data` 按字段循环 | `buildColumns(GetPage.list)` | 全局一份 |
| `_Form_*` 按类型选分部 | `selectFormControl()` + `FieldControl.vue` | 全局一份 |
| `ListTree.cshtml` | `isTreeSchema()` + `el-table` 树形 | 全局一份 |
| `Detail.cshtml` | `DetailDrawer.vue` | 全局一份 |
| 实体页 | 路由参数 `<ListPage :area :controller />` | **每个实体 0~5 行** |

**四条硬性判定：**

1. **禁止**为单个实体复制 `ListPage.vue` 再改——复制即分叉，第 10 个实体时会出现 10 套分页逻辑。
   要定制就加 prop / slot / 扩 `fieldRender`，让改动对所有实体生效。
2. **禁止**在业务页手写表格列与表单项（`<el-table-column prop="xxx">` 硬编码、`<el-form-item>` 手抄字段）。
   字段变了前端就该跟着变，靠的是元数据，不是改代码。
3. **禁止**在业务页写 `v-if="field.name === 'xxx'"` 这类按字段名特判的渲染分支——那是把继承改成了特例。
   需要特殊控件就去 `selectFormControl` + `FieldControl` 加一条通用规则。
4. 新增实体的标准动作是：**后端出元数据 → 菜单出现 → 页面自动可用**。若还需要改前端代码才能跑通 CRUD，
   说明基类漏了能力，补基类，不要补页面。

**违反判定**：仓库里出现第 2 个列表骨架 / 业务页里出现硬编码列定义 / 为同一实体写了两份表单逻辑 → 不合格。

---

## 铁律 E2：元数据驱动 + 字段映射双模式

页面结构由 `GetPage` 决定，前端不重复定义字段：

```
GET /api/{area}/{controller}/GetPage
  → { setting, list[], addForm[], editForm[], detail[], search[] }
```

两条不可违反的映射规则：

- **E2-A 列表显名**：`xxxID` 列必须显示映射后的名称（`StatusID=1 → 启用`），**绝不显示原始 ID 数字**。
- **E2-B 表单下拉**：同一字段在表单里必须渲染为**映射源下拉**，选项来自 `map` → `dataSource` → `lookups`。

漏掉这条的典型现象：用户看到一屏 `3`、`7`、`12`，根本不知道是哪条数据。

**违反判定**：列表出现裸外键 ID / 表单里 `xxxID` 是文本框 → 不合格。

---

## 铁律 E3：唯一 HTTP 层 + 前缀族

- **E3-1** 全工程只有 `src/api/http.ts` 一套 axios（`http` 带 `/api`，`rawHttp` 不带）；
  令牌只经 `src/api/token.ts` 读写，**禁止**任何组件自己 `localStorage.getItem('...token')`。
- **E3-2** 令牌头只发 `Authorization: Bearer <jwt>`（发 `Authentication` 会 401）。
- **E3-3** 前缀按「控制器有没有 `[Area]`」分族：区域族必带 `/api`，根族不带。
  菜单是区域族：`/api/Admin/Index/GetMenuTree`（漏 `/api` → 静默空白，不报错）。
- **E3-4** vite 代理按前缀族配：`/api` 一条覆盖全部区域族；`/Auth` `/Mfa` `/Sso` `/Cube` `/Content` 列根族。
  **禁止**写 `'/Admin'`（会吃掉前端页面路由）。

**违反判定**：两个 axios 文件 / 两套令牌键名 / 菜单端点无 `/api` / 代理写了 `/Admin` → 不合格。

---

## 铁律 E4：菜单只来自后端

- **E4-M1** 业务菜单唯一权威 = `GET /api/Admin/Index/GetMenuTree`。前端**禁止** push 菜单项、禁止硬编码业务入口。
- **E4-M2** 要加页面入口 → 改后端；前端只做「url → 前端路由」归一化（`utils/menu.ts` 的 `menuPath`）。
- **E4-M3** 登录后默认落地 `/dashboard`；点击左上角品牌必须回 `/dashboard`。
- **E4-M4** 一级菜单若无 `icon`，前端必须按名称关键词补一个（`resolveIcon`），推不出兜底 `Menu`。
- **E4-M5** 同层只允许一个分组展开：展开 A 时关闭同父兄弟；**不同父节点互不影响**。
  落地 = `@open` 时 `menuRef.close(兄弟 index)`。Element Plus 的 `unique-opened` 是**全局**唯一，语义更强，
  不用它——但要保证同层互斥真的生效（不能只写 `:unique-opened` 就以为完事）。

**违反判定**：前端硬编码菜单 / 一级菜单无图标 / 同级两个分组同时展开 → 不合格。

---

## 铁律 E5：登录页四条（L1~L4）

登录页是产品门面，不是脚手架演示页。

- **L1 文案按项目生成**：`src/config/app.ts` 的 `tagline` / `highlights` / `subtitle` 必须写业务语言。
  **禁止**出现 `Vue 3 + Element Plus`、`Powered by …`、`Sign in to continue` 之类残留。
- **L2 不预填账号密码**：`username` / `password` 一律初始化为 `''`；页面不得出现「默认账号 admin」提示。
- **L3 不暴露实现细节**：接口路径、加密方式、配置开关、令牌字段名只能写在注释里，不进 UI 文案。
- **L4 认证页不选租户**：不得出现「租户编码」输入框/下拉，表单对象里不得有 `tenant` 字段。
  租户由登录响应头 `X-Tenant` 下发，前端只管接住；要切换只在登录后的顶栏做。

**违反判定**：左栏技术栈话术 / 预填 admin / 页面写 `/Auth/Login` / 出现租户选择 → 不合格。

---

## 铁律 E6：父子表只展现父表

一对多（`Parent` + `ParentLine`，`ParentID` 关联）：

1. 菜单只暴露父表；子表即使被后端下发也不进导航。
2. 父表列表不铺子表行。
3. 父表详情内嵌只读子表 `el-table`。
4. 子表数据在父表表单里录入（tab 或分区），随父表一次提交。
5. 子表**无独立权限位**，按钮显隐跟随父表。
6. 子表不注册独立路由。

**与 E7 树形的区别**：E6 是**两个实体**的一对多；单实体 `ParentID` 自引用（部门/菜单）走树形表格。
二者不可混淆。

---

## 铁律 E7：设计基线（令牌唯一来源）

- **E7-1 默认品牌色 = 政务蓝 `#2563eb`**，三处同源：`styles/tokens.css`、`stores/setting.ts` 的 `DEFAULT_BRAND`、
  `SettingPanel` 预设首位。改色时三处一起改，色阶由 `utils/color.ts` 运行时推导（7 个变量一次生成）。
- **E7-2 暗色必须"点得到"**，三处接线缺一即死代码：
  ① `main.ts` 引 `element-plus/theme-chalk/dark/css-vars.css` → `tokens.css` → `theme-dark.css`（顺序不可调）；
  ② `setting.apply()` 切 `html.dark`；
  ③ `BasicLayout` 挂 `<SettingPanel />`（右下角齿轮）。
- **E7-3 8px 栅格**：间距只用 `4/8/12/16/24/32`，卡片 12px 圆角、控件 8px 圆角、表格行 48px。
  业务样式里**禁止**出现零散像素值（`13px` 边距、`#f7f8fa` 硬编码），一律走 CSS 变量。
- **E7-4 状态齐全**：加载 / 空 / 错 / 无权限 / 禁用，五种状态都要有专门呈现（见 `design-tokens.md` §7）。

**违反判定**：主色三处不同源 / `theme-dark.css` 未引入 / `setting.load()` 未调用 / `SettingPanel` 未挂载 → 不合格。

---

## 三条主线（唯一工作流）

| 步 | 动作 | 命令 / 入口 | 铁律 | 出口校验 |
|---|---|---|---|---|
| **① 初始化** | 官方脚手架 create-vue 生成骨架 | `npm create vue@latest <名> -- --ts --router --pinia --eslint --prettier` | E1 前提 | `package.json` / `vite.config.ts` / `src/main.ts` / `src/router/index.ts` 齐全 |
| **② 并入资产** | 设计令牌 + 可复用组件拷入 | `cp -r assets/core/. <工程>/src/`；`cp assets/env.example <工程>/.env.local` | E3 / E7 | `src/api/http.ts`、`src/styles/tokens.css` 已就位。**不要**在这一步跑闸门 |
| **③ 代理与个性化** | 先写 `/api` `/Auth` `/Cube` 代理，再跑闸门，然后改文案 | 见 §五开头 | E2 / E3-4 / E4 / E5 / E6 | `node scripts/check-project.mjs <工程>` → **退出码 0**，且 `npm run build` 0 错误 |

**为什么必须先脚手架**：`create-vue` 会给出一套**经过验证**的 tsconfig / vite / 目录约定。
手搭 `package.json` 看着快，后面每个工具链问题都要自己踩一遍。技能只允许在脚手架产物上做**白名单补丁**。

### ③ 的边界：必改 vs 可选

**最短可用路径 = 下面 3 项必改**，工程即可登录、出菜单、跑通 CRUD。

| 类别 | 项 | 落点 |
|---|---|---|
| **必改** | 系统名与登录页文案（`VITE_APP_TITLE` + `config/app.ts` 的 `PROJECT`） | E5-L1 |
| **必改** | dev proxy `target` 指向真实后端（写 `127.0.0.1`，勿 `localhost`） | `vite.config.ts` |
| **必改** | 路由默认页与菜单数据对齐（默认 `/dashboard`，勿留 create-vue 的 `/about`） | `router/index.ts` |
| 可选 | 品牌色 / 暗色 / 密度 | `tokens.css` + `setting.ts` |
| 可选 | 树形实体 | 元数据命中 `ParentID` 自动生效，无需改代码 |
| 可选 | 特殊控制器（Config / 报表 / DB） | 见 `page-composition.md` §2.3 |
| 可选 | 父子表内嵌明细 | 见 `page-composition.md` §6 |

---

## 一、目录结构（②完成后）

```
src/
├── api/
│   ├── http.ts               # 唯一 axios 层（http + rawHttp）
│   ├── token.ts              # 令牌 / 租户 / UI 偏好
│   ├── fieldRender.ts        # DataField → 控件 / 列 / 选项 / 规则
│   └── useEntityResource.ts  # 实体数据基类（schema/分页/搜索/CRUD）
├── components/cube/
│   ├── ListPage.vue          # 列表骨架（唯一）
│   ├── FormDialog.vue        # 新增/编辑弹窗
│   ├── DetailDrawer.vue      # 详情抽屉
│   ├── FieldControl.vue      # 单控件渲染器（搜索栏与表单共用）
│   ├── MenuItems.vue         # 递归菜单
│   ├── AuthShell.vue         # 认证页外壳
│   └── SettingPanel.vue      # 外观设置入口
├── layouts/BasicLayout.vue   # 侧栏 + 顶栏 + 内容区
├── views/
│   ├── LoginView.vue
│   ├── DashboardView.vue
│   └── EntityView.vue        # 泛型实体页（路由参数驱动）
├── router/index.ts
├── stores/{auth,setting}.ts
├── styles/{tokens,theme-dark,page}.css
├── utils/{color,menu}.ts
├── config/app.ts
└── types/env.d.ts
```

## 二、前置条件

- Node `^22.18.0 || >=24.12.0`（与当前 `create-vue` 的 `engines.node` 一致）。低于 22.18 时 CLI 会报 `EBADENGINE`。后端已用 `cube-webapi-backend` 暴露标准实体 API。
- 后端默认端口示例 `5052`，与 `vite.config.ts` 的 `API_TARGET` 对齐。
- 浏览器支持 CSS 变量与 `:focus-visible`（现代浏览器均满足）。

## 三、第①步：脚手架

```bash
npm create vue@latest cube-admin -- --ts --router --pinia --eslint --prettier
cd cube-admin
npm install
npm i element-plus @element-plus/icons-vue axios
```

- 若 CLI 仍进入交互，按此选：**TypeScript 是 / JSX 否 / Router 是 / Pinia 是 / Vitest 否 / E2E 否 / ESLint 是 / Prettier 是**。
- 不要选 Vitest/E2E——技能不产测试，选了只会留一堆空 spec。
- 生成后**立刻删掉示例文件**，否则会与资产同路径冲突：

| 删除 | 原因 |
|---|---|
| `src/components/HelloWorld.vue` | 示例组件 |
| `src/components/TheWelcome.vue`、`src/components/WelcomeItem.vue`、`src/components/icons/` | 欢迎页及其图标，删掉 `HelloWorld` 后仍会留在 `src/` 里被 `vue-tsc` 扫到 |
| `src/views/HomeView.vue`、`src/views/AboutView.vue` | 示例页面 + 示例路由 |
| `src/assets/main.css`、`src/assets/base.css`、`src/assets/logo.svg` | `main.css` / `base.css` 会覆盖设计令牌（尤其 `body { background:#fff }`）；`logo.svg` 只被示例页引用 |
| `src/stores/counter.ts` | 示例 store |
| `src/router/index.ts` 里的 `/about` 路由 | 前端自造页面入口，违反 E4-M2。下一步会整文件覆盖路由，这里先删掉，避免拷贝前残留 |

保留：`vite.config.ts`、`tsconfig*.json`、`index.html`、仓库根的 `env.d.ts`（create-vue 3.24 起不再生成 `src/vite-env.d.ts`）、`eslint.config.*`、`.prettierrc*`、`.gitignore`。

### 白名单补丁（只允许这几类偏离）

1. `vite.config.ts`：`server.proxy`（E3-4）+ `base`（子路径部署）；
2. `tsconfig` 的 `paths` 已有 `@/*`，不要动；
3. `index.html`：`lang="zh-CN"` + `<title>`；
4. `src/main.ts` / `src/App.vue` / `src/router/index.ts`：整体替换为技能版本；
5. `package.json`：`private: true`（可选）。

白名单外的改动（换构建工具、改目录结构、加第二套状态管理）一律视为未按本技能执行。

## 四、第②步：并入资产

```bash
cp -r <skill>/assets/core/. ./src/
cp <skill>/assets/env.example ./.env.local
```

`.env.local` 三项：`VITE_APP_TITLE`（系统名）、`VITE_SERVER_BASE`（独立域名部署才填）、`VITE_API_BASE`（一般留空）。

这一步**不要**跑 `check-project.mjs`。create-vue 生成的 `vite.config.ts` 还没有 `/api` `/Auth` `/Cube` 代理，闸门会在这里失败。代理写完再跑，见下一节。

## 五、第③步：先写代理，再跑闸门，然后个性化

### 5.0 代理与闸门（必做，先于文案）

在脚手架的 `vite.config.ts` 里保留原有 `plugins` 与 `@` 别名，加上 `API_TARGET` 和 `server.proxy`。三条前缀缺一，闸门就是 FAIL；不要写 `'/Admin'`。

```ts
const API_TARGET = 'http://127.0.0.1:5052';

// defineConfig({ ...现有 plugins / resolve 不动...
server: {
  proxy: {
    '/api': { target: API_TARGET, changeOrigin: true },
    '/Auth': { target: API_TARGET, changeOrigin: true },
    '/Mfa': { target: API_TARGET, changeOrigin: true },
    '/Sso': { target: API_TARGET, changeOrigin: true },
    '/Cube': { target: API_TARGET, changeOrigin: true },
    '/Content': { target: API_TARGET, changeOrigin: true },
  },
},
```

端口与后端对齐。写 `127.0.0.1`，不要写 `localhost`。然后：

```bash
node <skill>/scripts/check-project.mjs .
```

闸门脚本会校验六类硬约束：脚手架骨架、唯一 HTTP 层、令牌键、`/api` 前缀与代理、设计令牌与暗色接线、动态菜单与登录页。
**退出码 1 不要往下做**——那些 FAIL 都会以"页面空白但不报错"的形式在运行时爆炸。退出码 0 之后再改系统名和登录文案。

### 5.1 请求层（`api/http.ts`）

两个实例的分工是**唯一容易搞错**的地方：

```ts
http     baseURL = /api        // 区域族：/{area}/{controller}、/api/Admin/Index/GetMenuTree
rawHttp  baseURL = 后端根       // 根族：/Auth/*、/Mfa/*、/Cube/*
```

调用方规则：`getApi('/Admin/User')`（**不要**写 `/api/Admin/User`）；`getRaw('/Auth/Login')`；
菜单必须 `getRaw('/api/Admin/Index/GetMenuTree')`（写全）。

### 5.2 登录与鉴权（`stores/auth.ts`）

```ts
await auth.login(username, password)   // POST /Auth/Login，令牌三向兼容落盘
await auth.loadMenus()                 // GET /api/Admin/Index/GetMenuTree
await auth.logout()                    // 清令牌 + 清租户 + 清菜单缓存
```

权限不来自独立接口，只认 `GetPage.setting`：`enableAdd` / `isReadOnly` / `enableSelect`。

### 5.3 元数据 → 页面（三步，全部在基类里）

```
① GetPage 取 schema        useEntityResource.loadSchema()
② 列表  buildColumns(list) → el-table + labelOf 回显
   表单  buildFormItems(addForm|editForm) → FieldControl + buildFormRules
   详情  groupByCategory(detail) → el-descriptions
③ 新增实体 = 后端菜单出现 → /:area/:controller 直接命中 → 完成
```

业务页只需要：

```vue
<ListPage area="Admin" controller="User" title="用户管理" />
```

### 5.4 字段渲染

完整规则见 `references/field-renderers.md`。三条最常踩的：

- `mapField` 非空 ⇒ **必须下拉**，哪怕它是"名称"字段（`RoleName`）。
- 多选控件 `v-model` **必须是数组**，`null` 会让 Element Plus 直接抛 `Symbol.iterator` 错误。
- 日期字段必须给 `value-format`，否则提交的是 `Date` 对象，后端解析失败。

### 5.5 树形

判定要**五组字段聚合**（`list + addForm + editForm + detail + search`）——Cube 常把 `ParentID` 从列表隐藏，
只留 `ParentName`。数据必须 `buildTree()` 且**不分页**（跨页父子会断链）。

`el-table` 原生支持：`row-key="id"` + `:tree-props="{children:'children'}"` + `default-expand-all`。

### 5.6 菜单

```ts
const menus = await auth.loadMenus();        // 已 normalizeMenus 归一化
menuPath(node);                              // /Admin/User/Index → /Admin/User
resolveIcon(node);                           // 无 icon 时按名称推断
```

同层互斥的实现（E4-M5）：

```ts
function onOpen(index: string) {
  const parent = parentOf.value.get(index) ?? null;
  for (const [idx, p] of parentOf.value) {
    if (idx !== index && (p ?? null) === parent) menuRef.value?.close?.(idx);
  }
}
```

### 5.7 权限

| 能力 | 判据 |
|---|---|
| 显示「新增」 | `setting.enableAdd !== false && !setting.isReadOnly` |
| 显示「编辑/删除」 | `!setting.isReadOnly` |
| 打开详情 | `setting.enableSelect !== false` |
| 行双击进详情 | `setting.enableTableDoubleClick !== false` |

前端只做 UI 隐显，真实鉴权永远在后端。

### 5.8 多租户

登录响应头 `X-Tenant` → 拦截器捕获 → `token.ts` 落盘 → 后续请求注入 `X-Tenant` / `X-Tenant-Id`。
**认证页不得出现租户控件**（E5-L4）。

### 5.9 外观

- 换主色：改三处（tokens.css / `DEFAULT_BRAND` / 预设首位），色阶自动推导；
- 暗色：`html.dark` + `theme-dark.css`，卡片去阴影改边框分层；
- 密度：`html.compact` 收紧行高（`SettingPanel` 开关）。

### 5.10 构建与体积

默认**全量引入** Element Plus：简单、稳定，不会出现「某个组件没注册」的运行时空白。
主包会触发 Vite 的 500KB 告警，这是预期，不要为了消警告去改引入方式。

Vite 8（rolldown）**不接受对象形式**的 `manualChunks`。下面这种写法会让 `vite build` 直接失败（`manualChunks is not a function`），不要粘贴：

```ts
// 错误：对象表。rolldown 只接受函数。
manualChunks: {
  vue: ['vue', 'vue-router', 'pinia'],
  element: ['element-plus', '@element-plus/icons-vue'],
}
```

需要分包、又不改成按需引入时，用函数按模块路径归类：

```ts
// vite.config.ts —— 只做分包，不改变引入方式
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('element-plus') || id.includes('@element-plus')) return 'element';
        if (id.includes('vue-router') || id.includes('pinia')) return 'vue';
        if (id.includes('node_modules/vue/') || id.includes('node_modules\\vue\\')) return 'vue';
      },
    },
  },
},
```

需要进一步瘦身时再上按需引入（`unplugin-vue-components` + `ElementPlusResolver`），
但必须注意两点：**`ElMessage`/`ElMessageBox` 的样式要单独引**；**图标仍要全局注册**（菜单是动态渲染的）。
没到 500KB 告警影响体验之前，不建议上按需引入。


## 六、新增实体的验收清单

- [ ] 后端菜单里出现该实体，前端**没有**新增任何页面文件；
- [ ] 列表列由元数据生成，外键列显示**名称**不是 ID；
- [ ] 搜索栏出现的条件字段合理（字符串走 `Q`，其余走字段参数）；
- [ ] 新增/编辑表单按 `category` 分组，必填项与后端一致（不是全红也不是全绿）；
- [ ] 树形实体的子节点默认展开、分页器隐藏；
- [ ] 无权限账号登录后，新增/编辑/删除按钮消失；
- [ ] 空数据、加载失败、无权限三种状态都有可行动提示。

## 七、交付清单

- [ ] `node scripts/check-project.mjs .` 退出码 0；
- [ ] `npm run build`（create-vue 的脚本是 `vue-tsc --build` 与 `vite build`）0 错误；
- [ ] 登录 → 菜单 → 列表 → 新增 → 编辑 → 删除 全链路手工走通一遍；
- [ ] 窄屏（900 / 560）无横向溢出；
- [ ] 暗色切换后表格、表单、弹窗、登录页都正常（不是只变了顶栏）；
- [ ] `README` 里写清：后端地址、默认端口、启动命令、测试账号（**不写进登录页**）。

## 八、与 `cube-webapi-backend` 的分工

| 事项 | 归属 |
|---|---|
| 路由、响应信封、字段描述符、权限位语义 | backend 技能（权威） |
| 前端如何消费这些契约 | 本技能 |
| 父子表后端事务与权限校验 | backend 技能 |
| 父子表前端只展现父表 | 本技能 E6 |
| 菜单节点如何产生 | backend 技能 |
| url → 前端路由归一化、图标兜底 | 本技能 E4 |

## 九、最常见的一次性错误（先看这里）

1. 菜单空 → 端点漏 `/api`，或没发 `Authorization: Bearer`；
2. 列表空且无报错 → dev proxy 漏规则，请求落到 SPA 兜底返回 HTML；
3. 编辑/删除 405 → `PUT`/`DELETE` 把 id 写进了 path；
4. 列表显示原始 ID → 没走 `labelOf`；
5. 树形塌平铺 → 只查了 `list` 组 / 没 `buildTree` / 分页截断；
6. 多选崩溃 → 值是 `null` 不是 `[]`；
7. 分类/名称没有必填星号 → `GetPage` 对非空字段省略 `nullable`，不要等 `nullable: false`；
8. 「更新者」显示 `0` 或 `1` → 列表、详情、表单同时渲染了 `UpdateUser` 和 `UpdateUserID`，ID 列要让给名称列；
9. 无权限只看到 `status code 403` → HTTP 错误要读信封 `message`；
10. 搜索里的分类下拉是「无数据」、表单里却有选项 → 搜索栏 `buildFormItems` 没传 `lookups`；
11. 面包屑停在父菜单、当前项不高亮 → `/Ledger` 前缀命中了 `/Ledger/Equipment`，要取最长路径；
12. 暗色下选中菜单是一块近白 → `setting.apply()` 把浅色 light-9 写进了 inline，盖掉 `theme-dark.css`；
13. 没填的日期显示 `0001-01-01` → 这是未赋值，按空值显示「—」。

逐条修法见 `references/troubleshooting.md`。
