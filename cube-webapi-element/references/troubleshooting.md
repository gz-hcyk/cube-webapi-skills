# 排障：症状 → 根因 → 修法

先按症状查表，再进对应对照细节。**80% 的"页面空白"是前缀、令牌、代理三类问题。**

| # | 症状 | 最可能根因 | 修法 |
|---|---|---|---|
| G1 | 登录成功，但左侧菜单一条都没有 | 菜单端点漏 `/api`，或请求没有 `Authorization: Bearer` | 见 §G1 |
| G2 | 登录成功，菜单有，列表空白无报错 | dev proxy 缺规则 → 落到 SPA 兜底 `200 text/html` | 见 §G2 |
| G3 | 点登录报 404（生产环境） | `rawHttp` 还在用相对路径，请求打到了前端静态服务器 | 见 §G3 |
| G4 | 登录成功又弹回登录页 | 令牌键名不一致 / 守卫读到空令牌 | 见 §G4 |
| G5 | 编辑保存、删除报 **405** | `PUT /{a}/{c}/{id}`、`DELETE /{a}/{c}/{id}` 写错 | 见 §G5 |
| G6 | 列表显示原始 ID（`3`、`7`）而不是名称 | 没走 `labelOf`，或字段名大小写没归一 | 见 §G6 |
| G7 | 树形表只显示根节点 / 全平铺 | 判定只看了 `list` 组，或没 `buildTree`，或分页截断 | 见 §G7 |
| G8 | 多选下拉一打开就崩 `Symbol.iterator` | 值是 `null` 不是 `[]` | 见 §G8 |
| G9 | 暗色切换没反应 | 缺 `dark/css-vars.css` 或没切 `html.dark` 或令牌被覆盖 | 见 §G9 |
| G10 | 改了主色，hover/选中底色还是旧蓝 | 只改 `--el-color-primary`，没改色阶 | 见 §G10 |
| G11 | 菜单图标全部空白 | 图标没全局注册，或 `icon` 名对不上 | 见 §G11 |
| G12 | 点菜单不跳转 / 跳到 404 | url 没归一化（带 `/Index`），或路由没配动态段 | 见 §G12 |
| G13 | 表单该必填的不校验 / 不该必填的全红 | 把「未下发 nullable」当成可空 | 见 §G13 |
| G19 | 无权限时只看到 status code 403 | HTTP 错误没读魔方信封的 `message` | 见 §G19 |
| G14 | 上传附件 401 | 用了 `el-upload` 的 `action`，绕过了 axios 拦截器 | 见 §G14 |
| G15 | 导出下载下来是 `index.html` | 用 `window.open` 直连，没带令牌 | 见 §G15 |
| G16 | 生产子路径部署白屏 | `vite base` 与 `createWebHistory` base 不一致 | 见 §G16 |
| G17 | 树形下拉能把自己选成父级 | 没排除自身子树 | 见 §G17 |
| G18 | 页面样式"半套 Element Plus" | `assets/main.css` 还在 `main.ts` 里，覆盖了令牌 | 见 §G18 |

---

## G1 菜单全空（最高频）

三种可能，按顺序排除：

1. **前缀错**。菜单是区域族控制器，必须 `/api/Admin/Index/GetMenuTree`。
   写成 `/Admin/Index/GetMenuTree` 返回 **404**；但更多时候是落到 SPA 兜底返回 `200 + text/html`，
   axios 拿到的 `data` 是字符串 → `normalizeMenus` 得到空数组 → 菜单静默为空。
2. **请求头错**。只发 `Authorization: Bearer <jwt>`。
   发 `Authentication` → 401；只带 Cookie `.Cube.Session` → 401。
3. **令牌没落盘**。检查 `localStorage.cube_token` 是否存在；不存在说明 `setTokens` 没被调用，
   或登录响应字段名不认识（`access_token` / `accessToken` / `AccessToken` 三种都要兼容）。

自测命令（替换 token）：

```bash
curl -i -H "Authorization: Bearer <jwt>" http://127.0.0.1:5052/api/Admin/Index/GetMenuTree
# 期望 200 + application/json；若为 200 + text/html，就是前缀错
```

## G2 列表空白、无 401 无 404

`vite.config.ts` 的 `server.proxy` 必须覆盖两族：

```ts
proxy: {
  '/api':    { target: 'http://127.0.0.1:5052', changeOrigin: true },  // 区域族全包
  '/Auth':   { target: 'http://127.0.0.1:5052', changeOrigin: true },
  '/Mfa':    { target: 'http://127.0.0.1:5052', changeOrigin: true },
  '/Sso':    { target: 'http://127.0.0.1:5052', changeOrigin: true },
  '/Cube':   { target: 'http://127.0.0.1:5052', changeOrigin: true },
  '/Content':{ target: 'http://127.0.0.1:5052', changeOrigin: true },
}
```

- 写 `127.0.0.1`，不要写 `localhost`（Node 18+ 可能解析成 IPv6）。
- **不要**写 `'/Admin'`：会把前端页面路由 `/Admin/User` 也转发到后端，刷新变 404。
- 判断是否命中：打开 DevTools → Network，看该请求的 `Content-Type`。是 `text/html` 就是没代理上。

## G3 生产环境登录 404

`rawHttp` 的 `baseURL` 是 `SERVER_BASE`。同源部署留空即可；**独立域名部署必须填**
`VITE_SERVER_BASE=https://api.example.com`，否则 `/Auth/Login` 会打到静态服务器。
跨域还需要后端 `CorsOrigins` 放行（落在 Membership 库 `Parameter` 表，不是 appsettings）。

## G4 登录后又回登录页

- 两处令牌键必须一致：`api/token.ts` 的 `TOKEN_KEY` 与 `router` 守卫用的 `isAuthed()`（同一模块导出）。
- 常见错误：某个页面自己写了 `localStorage.getItem('token')`——违反 E3，删掉。
- 拦截器把 401 一律跳登录；登录接口本身返回 401（密码错）时**不能**再跳转（`isAuthEndpoint` 已排除）。

## G5 405

```
✅ PUT    /api/Lab/LabAsset            body 含 id
✅ DELETE /api/Lab/LabAsset?id=123
❌ PUT    /api/Lab/LabAsset/123
❌ DELETE /api/Lab/LabAsset/123
```

`useEntityResource.update/remove` 已按正确契约实现；自写调用时照抄。

## G6 列表显示原始 ID

1. 确认列渲染走 `labelOf(col.field, row[col.prop], lookups)`，不是 `{{ row.xxx }}`；
2. 确认行 key 已 `normalizeRow`（后端可能返回 `ParentID`，列 prop 是 `parentID`）；
3. 确认字段本身带 `map`/`dataSource`，否则需要 `lookups`（按 `lookupBaseName` 拉关联实体）。

## G7 树形塌成平铺 / 只有根节点

三个条件缺一不可：

1. **判定聚合五组字段**：`isTreeSchema([list, addForm, editForm, detail, search])`；
2. **数据是树**：`el-table :data="buildTree(rows)"` + `row-key="id"`；
3. **不分页**：树形走 `loadAll()`（`pageSize=10000`），否则跨页父子断链；
4. 想默认展开：`default-expand-all`，否则只能看到根。

## G8 多选崩溃

```
Cannot read properties of null (reading 'Symbol(Symbol.iterator)')
```

`el-select multiple` 的 `v-model` 必须是数组。`deserializeMultiValue` 永远返回数组；
新增表单初始化时 `form[prop] = []`（`FormDialog.emptyValue` 已处理）。

## G9 暗色不生效

三处接线，缺一即死代码：

1. `main.ts` 引入 `element-plus/theme-chalk/dark/css-vars.css`；
2. `setting.apply()` 里 `document.documentElement.classList.toggle('dark', dark)`；
3. `BasicLayout` 挂载 `<SettingPanel />`（没有入口，用户永远碰不到）。

另外确认 `src/assets/main.css` 已从 `main.ts` 移除——它的 `body { background: #fff }` 会盖掉暗色底。

## G10 主色改了但色阶没变

Element Plus 的 hover/选中底色用的是 `--el-color-primary-light-*` 系列。
只改 `--el-color-primary` → 按钮变了，选中行、hover 边框还是旧色。
用 `utils/color.ts` 的 `elementPrimaryPalette()` 一次性生成 7 个变量（`setting.apply()` 已如此实现）。

## G11 图标空白

- 图标必须在 `main.ts` **全局注册**（`app.component(name, comp)`），否则 `<component :is="'User'">` 解析不到；
- 后端 `icon` 可能是 `user`、`td-user`、`UserIcon` 等形态，`resolveIcon()` 会尝试 Pascal 化并校验是否真实存在，
  不存在则按名称关键词推断，最后兜底 `Menu`；
- `el-icon` 内必须包一层 `<component :is="...">`，直接写文本不显示。

## G12 菜单点击无反应

- `menuPath()` 会把 `/api/Admin/User`、`/Admin/User/Index` 统一成 `/Admin/User`；
- 路由必须有 `/:area/:controller/:rest(.*)*` 才能接住两段路径；
- 若菜单 url 是外链（`http...`），不要 `router.push`，改用 `window.open`。

## G13 必填判定

```ts
required = !key && !readonly && !boolean && (f.required === true || f.nullable !== true)
```

设备台账 `GetPage`：`Location` 带 `nullable: true`；`Name` / `Code` / `CategoryName` 省略 `nullable`，也没有 `required`。省略就是非空。等 `nullable === false` 时，分类不会出现必填星号，提交才由后端报「分类不可以为空」。

主键和审计字段先排除，所以这条规则不会给 `ID`、`CreateTime` 打星。布尔开关排除，避免 `false` 被当成没填。

## G20 搜索外键下拉是空的

表单里的分类有「计量仪器 / 办公设备」，搜索栏同一个字段打开却是「无数据」。`GetPage.search` 里的字段名是 `CategoryID`，没有内联 `dataSource`，选项只在 `lookups` 里。`ListPage` 生成搜索项时必须把 `resource.lookups` 传进 `buildFormItems`。只在 `FormDialog` 里传，搜索栏对不上。

## G21 面包屑停在父级，当前菜单不高亮

`/Ledger` 是 `/Ledger/Equipment` 的前缀。`route.path.startsWith(path + '/')` 会先命中父节点。父节点是 `el-sub-menu`，设成 `default-active` 不会点亮子项，面包屑也少最后一级。在所有命中里取 `menuPath` 最长的那个。

## G22 暗色选中态是浅色块

`theme-dark.css` 把 `--el-color-primary-light-9` 写成 `#15264a`。`setting.apply()` 若按浅色公式把 light-9 设成 `#e9effd` 并写到 `html` 的 inline style，会盖掉样式表。深色下改走 `elementPrimaryPaletteDark`。默认政务蓝与 `theme-dark.css` 同一组色值。

## G23 空日期显示 0001-01-01

没填购置日期时，后端给出 `0001-01-01 00:00:00`。这不是业务日期。`isUnsetValue` 把它和 `null` 一样收成「—」。

## G19 403 只剩状态码

`GET /api/Ledger/Equipment` 对无「查看」权限的账号返回 HTTP 403，正文仍是 `{ code, message }`。拦截器若直接抛 axios 错误，列表告警只有 `Request failed with status code 403`。要读 `response.data.message`。401 仍走刷新令牌，不要把 403 当成未登录。

`GetPage` 在这个样例里匿名可取，`enableAdd` 仍是 true。列表加载失败时不要再画「暂无数据 / 新增第一条」，否则无权限页面看起来像空表。

## G14 上传 401

`el-upload` 用 `:http-request` 走 `api/http.ts`（`FieldControl.vue` 已实现）；
用 `action="/api/..."` 是浏览器原生请求，带不上 `Authorization` 头。

## G15 导出拿到 HTML

`ExportFile` 需要令牌。用 `resource.exportFile()`（axios `responseType: 'blob'`）。
`window.open(url)` 只会发一个无头 GET，被 401 后重定向到登录页 HTML。

## G16 子路径部署白屏

两处必须一致：

```ts
// vite.config.ts
base: '/admin/'
// router
createWebHistory(import.meta.env.BASE_URL)
```

`http.ts` 的 `LOGIN_PATH` 也用 `BASE_URL` 拼，保证 401 跳转不跳出应用目录。

## G17 树形下拉自选

`toTreeSelectData(nodes, editingId)` 会剪掉自身及整棵子树。
新增时传 `undefined`；编辑时传当前行 `id`。

## G18 样式半套

`main.ts` 引入顺序固定：

```
element-plus/dist/index.css
element-plus/theme-chalk/dark/css-vars.css
@/styles/tokens.css
@/styles/theme-dark.css
@/styles/page.css
```

`tokens.css` 必须**在组件库之后**，否则它的 `:root` 变量会被组件库默认值覆盖。
`create-vue` 生成的 `import './assets/main.css'` 必须删掉。
