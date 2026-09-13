---
name: troubleshooting
description: cube-webapi-tdesign 前端排障手册 —— 契约/渲染/树形/表单/工程全量陷阱（症状→根因→修复→assets 指针）。SKILL.md 只保留最高频警示（§六），遇到其余异常先查本文件：按下方 9 组目录定位症状组，再读对应条目。
---

# Troubleshooting —— 前端全量陷阱手册（按主题分组）

> 本文件收纳原 SKILL.md「常见陷阱」节（旧 §七，现 SKILL.md §六 精选版）全部条目（**保真**）。排障路径：**先看每组标题列表（症状关键词）→ 命中再读对应条目全文**。文内 `§4.x`/`§10.x` 指 SKILL.md 章节；`见 §七` 类自引用均指**本文件内其他条目**；`assets/` 指技能 assets 目录（拷贝模板源）；`references/demo/src/` 是完整可运行工程。多数条目已注明修复落地的资产文件，表示该坑在 `assets/` 模板中已按正确做法实现，仅当自定义改动破坏约定时回查。


## G1 后端契约与权限（前端需消费的后端事实）

**目录**：
- Int64 精度
- GetPage 不含行数据
- 前端权限≠后端鉴权
- 只读控制器
- 自定义权限位
- 多租户漏带头
- 登录端点契约有两套形态并存（高频坑：端点 + 字段名完全不同，禁混用）
- 登录/注册的 `category` 必须是枚举整数，不能是字符串（高频坑，实测 `code:-2`）
- 登录返回令牌字段是 snake_case，前端读 camelCase 会拿不到 token 误判「登录失败」（高频坑）
- ⚠️ `GetPage` 五段式契约（`list`/`addForm`/`editForm`/`detail`/`search`）
- 后端字段命名是 PascalCase，不是 camelCase（高频坑，曾致树状显示失效）
- 登录契约以《Doc/Api/认证接口设计.md》为权威，SPA 用 `/Auth/Login`（非 `/Admin/User/Login`）（高频坑：端点偏差会静默登录失败）
- 后端契约不要猜：从 NuGet 包 dll 反射导出枚举值与模型字段（权威实证方法，可复用工作流）
- 前端必须完整覆盖 NewLife.Cube 框架自带系统管理模块（避免"前端只做业务页、漏掉框架自带后台"）

**条目全文**：

- **Int64 精度**：主键/大整数以**字符串**传输与回填，表单 `t-input-number` 注意类型，避免 JS 精度丢失。

- **GetPage 不含行数据**：`GetPage` 只给 schema，行数据要再调 `Index()`；别把 `GetPage.data` 当列表。

- **前端权限≠后端鉴权**：按钮隐藏只是体验，后端 `[EntityAuthorize]` 才是真正闸门；别因"按钮藏了"就省略后端权限。

- **只读控制器**：`ReadOnlyEntityController` 无写接口，`setting.isReadOnly=true`，前端应隐藏新增/编辑/删除按钮（`ListPage` 已按 `setting` 处理）。

- **自定义权限位**：后端用 `(PermissionFlags)16/32` + `[DisplayName]` 在动作级 `[EntityAuthorize]` 拦截；前端若按位隐藏业务按钮，权限位数据可由 `GET /api/Auth/Info`（AuthController.Info，返回用户+权限位）或 `GetPage`/`菜单树` 下发。

- **多租户漏带头**：切换租户后必须刷新数据，否则看到的是旧租户数据或 403。租户头来源见铁律 **L4**——登录响应头 `X-Tenant` 捕获持久化后由拦截器注入，**登录页与注册页均不提供租户选择**（放了就是设计缺陷：用户填错 Code 立即 403 或落到错误数据域；注册页更甚——新用户根本无从得知租户 Code）。

- **登录端点契约有两套形态并存（高频坑：端点 + 字段名完全不同，禁混用）**：落地前**必须用 `curl` 探真实后端**确定形态，文档与旧契约都不可盲信。
  - **形态 A（当前版本 AuthController，SPA 推荐，本项目实测）**：`POST /Auth/Login` + `GET /Auth/LoginConfig` + `GET /Auth/Challenge` + `POST /Auth/Refresh` + `/Mfa/*`（**均不带 `/api` 前缀**）；请求体 `{ username, password, category(枚举整数), remember, challengeId, captchaId, captchaCode }`；响应信封 `code/message/data`，`data` 令牌键名实测 **snake_case**（`access_token`/`refresh_token`/`expire_in`，另有 `token_type`/`scope`）——走 `normToken` 三向兜底。
  - **形态 B（老版 MVC 皮肤 / SSO 回调）**：`POST /api/Admin/User/Login`，入参 `{ userName, password }`，返回 OAuth 风格信封 `data.access_token`（含 `token_type/expire_in/refresh_token/scope`）。
  - **差异清单（切换形态时三处要同步改，缺一即静默失败）**：端点前缀（`/Auth/*` ↔ `/api/Admin/*`）、用户名字段（`username` ↔ `userName`）、是否带 `category` 枚举整数、响应令牌键名（snake/camel/Pascal 三向归一）。菜单树同样两套：`GET /api/Admin/Index/GetMenuTree` 与 `getRaw('/Admin/Index/GetMenuTree')` 都见过，curl 探测为准。Mock 后端已兼容两种前缀（/api 为主、/Admin 为别名）与 `access_token` 信封。

- **登录/注册的 `category` 必须是枚举整数，不能是字符串（高频坑，实测 `code:-2`）**：`/Auth/Login` 的 `LoginModel.Category`、`/Auth/Register` 的 `AuthRegisterModel.Category` 都是枚举 `NewLife.Cube.Enums.AuthCategory`（`Password=0 / Mobile=1 / Mail=2 / OAuth=3`）。**魔方后端未注册 `JsonStringEnumConverter`，System.Text.Json 只接受整数**：传 `''`（空串）或 `'Password'`（枚举名）均被拒，返回 `{"code":-2,"fieldErrors":[{"field":"$.category","error":"The JSON value could not be converted to NewLife.Cube.Enums.AuthCategory..."}]}`。前端必须定义 `export enum AuthCategory { Password=0, Mobile=1, Mail=2, OAuth=3 }`，登录传 `category: AuthCategory.Password`、验证码登录传 `AuthCategory.Mobile`/`AuthCategory.Mail`、注册 `category: payload.category ?? AuthCategory.Password`（**禁止裸字符串 `'mobile'`/`'mail'` 或魔法数字，统一走枚举**）。`assets/core/stores/auth.ts`（`AuthCategory` 枚举 + `loginWithPassword`/`loginWithCode`/`registerUser`）已按此修正。

- **登录返回令牌字段是 snake_case，前端读 camelCase 会拿不到 token 误判「登录失败」（高频坑）**：魔方后端字段命名不统一——错误信封与 `LoginConfig` 是 camelCase（`code`/`message`/`data`），但登录成功的 `data` 令牌对象实际是 **snake_case**：`access_token`/`refresh_token`/`expire_in`（实测真实后端 `/Auth/Login` 返回即如此）。前端若只读 `d.accessToken`，`d.accessToken` 为 `undefined` → `loginWithPassword` 走 `throw new Error(r.message || '登录失败')` → 后端明明成功却提示失败且不跳转。必须在 auth store 边界用 `normEnv`/`normToken` 三向归一化（兼容 snake/camel/Pascal 任意形态）：`accessToken = o.accessToken ?? o.AccessToken ?? o.access_token ?? ''`、`refreshToken = o.refreshToken ?? o.RefreshToken ?? o.refresh_token ?? ''`、`expireIn = o.expireIn ?? o.ExpireIn ?? o.Expire ?? o.expire_in ?? 0`；信封 `code` 兼容 `r.code ?? r.Code`、`message` 兼容 `r.message ?? r.Message`、`data` 兼容 `r.data ?? r.Data`。`assets/core/stores/auth.ts` 与 `references/demo/src/api/auth.ts` 的 `loginWithPassword`/`loginWithCode`/`verifyMfa`/`refresh` 已统一 `normEnv`+`normToken`（三向）。**注意**：不要盲信某版文档写的 `data.accessToken`(驼峰) 或 `AccessToken`(Pascal)——不同后端版本形态不一致，靠归一化兜底，不靠单一字段名。

- **⚠️ `GetPage` 五段式契约（`list`/`addForm`/`editForm`/`detail`/`search`）**：各段**已按场景裁剪**——`addForm` 不含主键/只读/审计字段、`detail` 由后端剔除主键与审计、`search` 段给出的就是**后端真实查询参数名**（如 `Student` 的 `ClassID`，而 list 只暴露虚拟列 `ClassName`），正好替代手工 `searchParamMap`；表单新增走 `addForm`、编辑走 `editForm`。`useEntityResource.loadSchema` 将五段存入 `schema`，`ListPage` 分别消费。**注意（2026-09 口径变更）**：`http` 层**已移除全局 `camelize`**，后端 PascalCase 键**原样到达**；键名归一**只在消费端发生**——行数据由 `useEntityResource.normalizeRows` 归一（见下条），前端提交时 `toPascal` 把 camel 载荷还原为后端期望的 PascalCase 字段名（映射字段还原为 `mapField` 真实列名），`Lov/Meta` 的 `data.meta`/`data.inlineEnums` 与内联枚举字典键因此**不被破坏**。

- **后端字段命名是 PascalCase，不是 camelCase（高频坑，曾致树状显示失效）**：`metadata-contract.md` 旧版称「ApiFilter 统一 CamelCase 序列化」，**与真实 NewLife.Cube WebApi 不符**——实测真实后端返回 **PascalCase**（`ID`/`ParentID`/`Name`/`CreateTime`），只有 Mock 演示是 camelCase。**（2026-09）`http` 层已移除全局 `camelize`，PascalCase 键原样到达消费端**，故键名归一**必须**在消费端完成——即下述 `normalizeRows` 是**唯一**的行数据归一入口，`buildTree` 内的 `camel(k)` 同理。朴素「仅小写首字母」会把 `ID`→`iD`、`URL`→`uRL`、`ParentID`→`parentID` 的 `ID` 部分错成 `iD`，污染 `t-table row-key="id"`、列 `colKey`、外键回显与 `buildTree` 父子链接，表现为「表没树状显示 / 外键列显示原始 ID / 主键取不到」。**正确做法**：① `camel(name)` 用正则 `/^([A-Z]+)([a-z].*)?$/` 处理纯大写缩写（`ID/URL/IP`→`id/url/ip`，无后缀直接小写；有后缀 `ParentID`→`parentID`）；② `useEntityResource.normalizeRows(rows)` 在 `loadData/loadAll/getById` 处把**行 key 统一归一为 camelCase**（仅当检测到含大写开头 key 才真正拷贝，camelCase 数据原样返回）；列定义、`row-key`、`buildTree`、`FormDialog` 回填全部据此一致。`assets/core/api/useEntityResource.ts`（`camel`/`normalizeRows`）、`assets/core/api/fieldRender.ts`（`buildTree` 内 `camel(k)` 归一）已落地。

- **登录契约以《Doc/Api/认证接口设计.md》为权威，SPA 用 `/Auth/Login`（非 `/Admin/User/Login`）（高频坑：端点偏差会静默登录失败）**：该文档明确——**当前版本 SPA 登录接口是 `POST /Auth/Login`**（不带 `/api`，由 `AuthController` 提供）；`/Admin/User/Login` 仅**保留**给 MVC 皮肤与 SSO 回调，**不是** TDesign SPA 的登录端点。请求体字段名是 **`username`**（不是 `userName`）；**响应令牌字段名不统一（snake/camel/Pascal 都可能）**：真实运行的后端 `/Auth/Login` 返回 **`data.access_token` / `data.refresh_token` / `data.expire_in`**（snake_case），而文档/旧版契约可能写 `accessToken`/`AccessToken`（驼峰/Pascal）。**不要硬编码单一字段名**，统一在 `normToken` 三向兜底（`o.accessToken ?? o.AccessToken ?? o.access_token`）。密码登录是否走 Challenge-Response 严格以 `LoginConfig.security.challengeRequired` 为准（`true`=加密/`false`=明文），不要环境假设。登录页 `onMounted` 须拉 `GET /Auth/LoginConfig` 取 `name`/`copyright`/`login`(开关)/`oauth`/`security`，按开关渲染密码/短信/邮箱 Tab、忘记密码、OAuth、注册、版权。MFA：`code=0 & 无 accessToken & message 以 mfa_required: 开头` → 进 `/Mfa/Verify` 二步验证。**正确做法**：`assets/core/stores/auth.ts` + `references/demo/src/pages/LoginView.vue`（登录页模板实际位于 demo 工程，`assets/` 下无此文件） 已按此契约落地（`normToken` 三向归一）；改登录相关代码时**勿回退**到旧 `/Admin/User/Login`+`userName` 写法（那是已被取代的旧约定）。若你的真实后端确为老式 `Admin/User/Login`+`access_token`，则**以后端为准**，但需显式标注、不要混用两套字段名。

- **后端契约不要猜：从 NuGet 包 dll 反射导出枚举值与模型字段（权威实证方法，可复用工作流）**：魔方后端契约的三处关键事实（`AuthCategory` 只收整数、`LoginModel` 精确属性集、令牌实体字段命名）都是靠此法一次性确定的，比反复试错接口快一个数量级。当后端源码不可得、只有 NuGet 包时，用 **`System.Reflection.Metadata`（`PEReader` + `MetadataReader`）直接读 dll 元数据**——**切勿**用 `Assembly.LoadFrom`（目标框架/依赖不匹配会直接抛异常）：
  ```bash
  mkdir -p /tmp/enumdump && cd /tmp/enumdump
  cat > enumdump.csproj <<'EOF'
  <Project Sdk="Microsoft.NET.Sdk">
    <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework></PropertyGroup>
  </Project>
  EOF
  # Program.cs 要点：
  #   var md = new PEReader(File.OpenRead(dll)).GetMetadataReader();
  #   枚举：遍历 TypeDefinitions，字段含 "value__" 即为枚举；跳过 value__，
  #         用 fd.GetDefaultValue() + md.GetConstant() 读常量（Int32 用 BlobReader.ReadInt32）
  #         → 得 AuthCategory: Password=0, Mobile=1, Mail=2, OAuth=3
  #   模型：打印 td.GetProperties() 的属性名
  #         → 得 LoginModel: Category/Username/Password/Remember/ChallengeId/Pkey/CaptchaId/CaptchaCode
  dotnet run
  ```
  dll 路径：`~/.nuget/packages/newlife.cube.core/<版本>/lib/<tfm>/NewLife.Cube.dll`。
  **关键推论（决定前端怎么写）**：若 dll 中**未注册 `JsonStringEnumConverter`**（魔方默认即如此），`System.Text.Json` 对枚举**只接受整数**——传 `"Password"` 或 `""` 一律 `code:-2` + `The JSON value could not be converted to ...`；前端**必须**定义 `export enum AuthCategory { Password=0, Mobile=1, Mail=2, OAuth=3 }` 并传整数。
  **注意**：dll 反射给出的是**程序内的 C# 属性名**（PascalCase），**不等于** HTTP 上的 JSON 键名——本项目实测 C# 是 `AccessToken`，实际 HTTP 却是 `access_token`。故 dll 反射用于确定**枚举值、字段有无、请求模型结构**（高可信），而**响应 JSON 键名必须抓真实 HTTP 响应确认**（见上一条 stale/normToken 陷阱）。两者互补，不可互替。

- **前端必须完整覆盖 NewLife.Cube 框架自带系统管理模块（避免"前端只做业务页、漏掉框架自带后台"）**：Cube 6.x 经 `AddCube()` 自动注册一组标准后台模块（Area=`/Admin` 与 `/Cube`），后端已就绪但前端常漏接。经实测可达的实体模块共 **9 个**（均为 `EntityController<T>`、返回完整 GetPage 五段式、可直接复用通用 `EntityPage` 零新增代码）：`/Admin/User`(用户)、`/Admin/Role`(角色)、`/Admin/Menu`(菜单)、`/Admin/Department`(部门)、`/Admin/Parameter`(参数/字典)、`/Admin/Log`(审计日志)、`/Admin/OAuthConfig`(OAuth 配置)、`/Admin/Tenant`(租户)、`/Cube/App`(应用)。Cube 6.x 已精简：**日志统一为 `Log`、字典/配置统一为 `Parameter`**，`Dic`/`Config`/`UserLog`/`VisitLog`/`TaskLog`/`RoleMenu`/`ModelNote`/`File`/`Stat`/`Index` 等返回 404（无需接入）。**接入方式**：只在 `BasicLayout` 菜单加"系统管理"组挂这 9 个链接（Area 大小写敏感：`/entity/Admin/User` 非 `/entity/admin/User`），通用 `EntityPage`（`/entity/:area/:controller`，props:true）直接消费 GetPage。**登录后首页应是系统仪表盘**（统计概览：并发 `GET /{area}/{controller}?pageSize=1` 取 `env.page.totalCount`），而非停在业务页。**Swagger 路径**：NewLife.Cube 的 Swagger UI 默认 `/Swagger`，但若后端 `Program.cs` 仅 `AddCube()` 未显式 `UseSwagger()`/`UseSwaggerUI()`，则 `/Swagger` 返回 404——需后端补 `app.UseSwagger(); app.UseSwaggerUI(c=>c.RoutePrefix="Swagger")` 并重启才可达；"通用挂载"可用接口探测等价确认，不依赖 Swagger。


## G2 请求层 / 接口路由 / dev 代理

**目录**：
- 代理 `/api` + `/cube`，切勿代理前端 SPA 路由 → GET 404
- 代理目标错配 → 登录/菜单 500
- 实体接口切勿写 `/api` 前缀 → 写了反而双前缀 404（铁律 H2，2026-09 口径反转）
- 编辑保存/删除 405 = 把主键放进了 URL path（高频坑，实测 405 Method Not Allowed）
- 加载失败要显式暴露，勿静默空白
- 详情/编辑必须「接口优先」取单条（数据一致性），列表 row 仅作即时展示/兜底
- `extractListPayload` 绝不读 `list` 键，`loadSchema` 绝不取内联数据（固定契约：GetPage 只返回元数据，数据行在其他接口）
- `rawHttp` 端点（`/Auth/*`、`/Mfa/*`）不带 `/api` 前缀，dev 代理须显式转发，否则登录 404（高频坑）

**条目全文**：

- **代理 `/api` + `/cube`，切勿代理前端 SPA 路由 → GET 404**：Vite `server.proxy` 配 **`/api`（后端接口）+ `/cube`（附件/图片资源）** 两条。真实后端所有接口（实体 + 登录 + 菜单）统一在 `/api` 下；上传接口返回的附件路径形如 `/cube/image?id=xxx.png`（`filePath`）是**后端资源前缀**，若不代理，浏览器会把 `/cube/image` 当 SPA 路由返回 index.html → 图片 404。前端菜单导航（如 `/Admin/User`、`/Sys/Config`）由 **Vue Router 在浏览器内**处理，是 SPA 路由，**不是 API 调用**——一旦为 `/Admin` 等前缀配了代理，浏览器硬刷新 `/Admin/User` 时该 GET 会被转发到后端，后端无此资源 → **404**（请求路径形如 `GET http://localhost:5173/Admin/User [404]`）。这是「登录能通、点菜单/硬刷新 404」的典型根因。正确做法：代理仅 `/api` + `/cube`；若需要 SPA 兜底在某深链硬刷新时不 404，确保 Vite `appType:'spa'`（默认）已开启，且这些路径未被任何 proxy 规则命中。默认 `secure:false` 已兼容本地自签证书。

- **代理目标错配 → 登录/菜单 500**：代理 `/api` 的目标必须指向**实际运行**的后端。Mock 演示默认 `http://localhost:3001`；对接真实后端设 `VITE_API_TARGET`。若目标写错端口（如后端未起、或 https 握手失败），前端会收到 **Vite 返回的 500**（不是 404），且耗时接近连接超时（数秒）。先确认后端在跑、端口正确，再改代理目标。

- **实体接口切勿写 `/api` 前缀 → 写了反而双前缀 404（铁律 H2，2026-09 口径反转）**：`src/api/http.ts` 导出**两个 Axios 实例**——实体 `http`（`baseURL: API_BASE`，`API_BASE = VITE_API_BASE || (SERVER_BASE ? \`${SERVER_BASE}/api\` : '/api')`，**已自带 `/api`**）与 `rawHttp`（`baseURL: SERVER_BASE`）。故**实体调用路径只写 `/{area}/{controller}`、绝不写 `/api`**：`useEntityResource` 的 `base` = `` `/${area()}/${controller()}` ``；`useLookups` 拉外键字典写 `/${a}/${ctrl}`，框架内置表（Dept/User/Role）回退 `/Admin/{控制器}`；`DbView`/`ConfigView`/`DashboardView`/`RoleMenuEditor` 同理。**误加 `/api` → 实际请求 `/api/api/{area}/{ctrl}` 实测 404**，典型表现：**列表空白、外键列只剩原始 ID、表单下拉为空**。反过来，**`getRaw`/`postRaw` 端点必须带 `/api`**（`rawHttp.baseURL === SERVER_BASE`，是后端根，不自动补前缀），如 `getRaw('/api/Admin/Index/GetMenuTree')`——**两者方向相反，勿混**。`assets/core/...` 与 `references/scaffold/src/...` 已按此修正。**落地后务必全量 `grep` `src` 中 `getApi(`/`postApi(`/`putApi(`/`deleteApi(`/`http.get(` 的调用，确认无 `/api/` 残留**。

- **编辑保存/删除 405 = 把主键放进了 URL path（高频坑，实测 405 Method Not Allowed）**：NewLife.Cube 官方契约（NewLife.CubeVue 前端 + ObjectController 源码证实）是 **修改 `PUT /{Area}/{Controller}`（主键在 body，不在 URL）**、**删除 `DELETE /{Area}/{Controller}?id=xxx`（id 在 query，不在 URL path）**——`add: post(url) / update: put(url, data) / remove: delete(url, params:{id})` 全部打**主路由**。若前端写成 `PUT /{base}/{id}`、`DELETE /{base}/{id}`（id 在 URL path），后端无此路由 → **405 Method Not Allowed**（AxiosError status 405，栈落在 `putApi`/`deleteApi`）。**正确做法**：`useEntityResource.update(id, row)` 发 `putApi(base, body)`（body 合并主键兜底：`if (body.id==null && body.Id==null) body.id = id`）；`remove(id)` 发 `deleteApi(\`${base}?id=${encodeURIComponent(String(id))}\`)`。`assets/core/api/useEntityResource.ts` 已按此修正。**注意**：这是「第三代 WebApi 主路由风格」；老版 EntityController（Insert/Update/Delete Action 命名）另当别论，落地前 curl 探后端 swagger 确认。

- **加载失败要显式暴露，勿静默空白**：`useEntityResource.loadSchema/loadData` 必须 `try/catch` 并把错误写入 `error` ref，列表页顶部用 `t-alert` 红色错误条展示「`/api/{area}/{controller}` + 失败原因」。否则「真实后端 `GetPage` 返回扁平 `fields` 而非五段数组」或「`schema.list` 为 `undefined` 致 `buildColumns` 抛错」时，页面会**静默空白**，用户只看到“右侧没数据”而无法定位。兼容策略见 §4.15 与 `assets/core/api/useEntityResource.ts` 的 `normalizeSchema`/`extractListPayload`（覆盖「五段数组」「扁平 fields + 视图标志位」「兜底空 schema」「`data` 直接数组/`{rows,page}`/`{list,page}`/`{page.rows}` 多种包裹」）。

- **详情/编辑必须「接口优先」取单条（数据一致性），列表 row 仅作即时展示/兜底**：**单条接口是 `GET /api/{area}/{ctrl}/Detail?id={id}`（id 在 query，不是 path）——curl 实测 200，返回信封 `data` 为实体对象**。此前误判「无单条接口」是因为只试了**路径形式** `/{id}`、`/Detail/{id}`、`/Get/{id}`（三者确实 404）。**为什么要接口优先**：列表行是进入页面那一刻的快照，可能已被他人修改，直接用它回填并保存会**覆盖他人改动**。**正确做法**（`getById` 候选链，首个成功即返回、404 继续下一个）：① `/Detail?id=`（主路径，对象）② `/Get?id=` ③ `?id=`（**列表接口+主键过滤**，返回数组取首行，兜底可靠）④ `/{id}`（REST 风格部署兼容）。组件侧：`DetailDrawer`/`FormDialog` 先用 `props.row` 即时渲染（不空白），随后 `await res.getById(id)` 用接口最新值**覆盖**；接口失败/返回空则保留 row 兜底。另：`onEdit/onDetail` 取主键必须用 `getRowKey(row)`（遍历行键、小写精确匹配 `id`，兼容 `id/ID/Id`），**勿写死 `row.id`**（NewLife 主键常大写 `ID`，小写取不到 → 传 undefined → 请求 `/.../undefined`）。`assets/core/components/cube/ListPage.vue`、`assets/core/components/cube/DetailDrawer.vue`、`assets/core/components/cube/FormDialog.vue`、`assets/core/api/useEntityResource.ts`（含 `getRowKey`/`getById`）已落地。

- **`extractListPayload` 绝不读 `list` 键，`loadSchema` 绝不取内联数据（固定契约：GetPage 只返回元数据，数据行在其他接口）**：契约固定——**GetPage 返回的只有字段描述符（元数据），不含数据行**；数据行一律由列表接口（裸 GET / Search / GetList / Index）返回，载体只可能是 `rows` / `page.rows` / `Page.Rows` / `data`。因此：① `extractListPayload` **只从四个数据载体取行、不读 `list` 键**，无数据载体一律返回空数组（否则当某端点只返回 `{ list:[字段] }` 时，字段描述符被当行数据，`t-table` 的 `name` 列渲染出 `row.name`=字段名如 `ClassName`/`parentID`，即“表格行显示字段 name”）；② `loadSchema` **不要尝试从 GetPage 提取内联首页数据**（`embeddedRows` 兜底是错误假设，已删除），schema 就只解析字段元数据。`assets/core/api/useEntityResource.ts`（`extractListPayload` 已删 `list` 兜底、`loadSchema` 已删内联提取）已落地。

- **`rawHttp` 端点一律无 `/api` 前缀，且 dev 代理须显式转发，否则登录/菜单 404（高频坑，2026-09-13 口径修正）**：`http.ts` 同时导出**两个独立 Axios 实例**：`rawHttp`（非实体端点：`/Auth/LoginConfig`/`Challenge`/`Login`/`Refresh`、`/Mfa/Verify`、菜单树 `/Admin/Index/GetMenuTree`、字典 `/Cube/Lookup`）与实体 `http`（`baseURL` 已含 `/api`，实体路径**只写 `/{area}/{ctrl}`**）。`rawHttp.baseURL === SERVER_BASE`（默认空串=同源根），故其路径**不带 `/api`**——`/Auth/*`、`/Mfa/*`、`/Admin/Index/*`、`/Cube/*` 全部挂后端根路径。若 `vite.config.ts` 只配 `/api` 转发，`rawHttp` 的 `/Auth/*` 请求被 Vite 当 SPA 路由 → 返回 `index.html` 或 404，表现为「登录页拉不到 `LoginConfig`、登录直接失败」；菜单树 `/Admin/Index/GetMenuTree` 同理 → **菜单静默为空**。正确做法：代理含 `/api`、**`'^/Admin/Index/'`（正则）**、`/Auth`、`/Mfa`、`/Sso`、`/Cube`、`/cube`、`/Content`（目标统一指后端/Mock）；见 §4.3 与 §4.15。


## G3 字段映射与组件选型（mapField / typeName / lookups）

**目录**：
- ⚠️ `mapField` 双语义：`[Map]` 枚举字典源在 `mapField`，不在 `field.map`（Cube 通用列表页历史坑，2026-09 复现并修复）
- ⚠️ 外键字段名与控制器名不一致 → 下拉 404（高频坑，实测 CategoryId→ProductCategory）
- ⚠️ Cube WebApi 表单常只下发「映射虚拟字段」、省略原始外键 → 映射字段被误判成普通输入框（高频坑，实测 CategoryName 变文本框）
- `mapField` 非空 ⇒ 映射字段 ⇒ 用下拉展示，该值就是原始字段名（核心契约）
- 字段选型要按真实 `typeName`/`itemType`/`mapField` 判定，勿只看字段名（高频坑）
- 外键/ParentID 字典查找大小写不敏感（兼容 PascalCase 后端）

**条目全文**：

- **⚠️ `mapField` 双语义：`[Map]` 枚举字典源在 `mapField`，不在 `field.map`（Cube 通用列表页历史坑，2026-09 复现并修复）**：6.13 的 `DataField` **没有 `map` 字段**，`FieldItem.Map` 的 `k=v` 串被原样序列化进 `mapField`。枚举字段（如 `PersonType`/`ValueMode`/`Gender`/`WeComStatus`）若代码去读 `field.map`（不存在）→ 列表渲染成**原始 Int32**（`1`/`2`/`3`）、表单变纯 `t-input`。正确做法：用 `mapFieldKind`/`mapDictOf` 解析 `mapField` 字典串——列表 `labelOf` 显名、表单 `controlOf` 出 `t-select`（`options` 来自 `parseMapSource`）。**判别法**：`mapField` 能在字段集命中同名字段 → 映射字段（`field`，提交键用 `mapField`）；否则 → 字典源（`dict`，提交键用 `f.name`）。后端 `[Map("0=未知,1=男,2=女")]` 需加在**生成实体**上（`FieldItem.Map` 只读，手写实体加 `[Map]` 特性）。详见 §4.8.1。

- **⚠️ 外键字段名与控制器名不一致 → 下拉 404（高频坑，实测 CategoryId→ProductCategory）**：`useLookups` 按「外键基名 = 同 area 同名控制器」约定式拼 URL（`CategoryId`→`/api/{area}/Category`）。但当**外键字段名与真实控制器名不同**（如 `CategoryId` 指向 `ProductCategoryController`，真实路由是 `/api/Blog/ProductCategory`）时，约定式猜测 404 → 下拉**无选项**、显示原始数字 ID。**修复**：`useLookups` 增加 `LOOKUP_ALIASES: Record<基名小写, 'Area/Controller'>`（如 `{ category: 'Blog/ProductCategory' }`），`fetchDict` 把别名 URL 放到候选**最前**优先尝试（仍失败才回退约定式 `/api/{area}/{base}` 与 `/api/Cube/{base}`）。新增外键若名实不符，只在此表补一行，不散改拉取逻辑。`assets/core/api/useLookups.ts` 已落地。

- **⚠️ Cube WebApi 表单常只下发「映射虚拟字段」、省略原始外键 → 映射字段被误判成普通输入框（高频坑，实测 CategoryName 变文本框）**：`GetPage` 表单段（addForm/editForm）里，外键常以**虚拟显示字段**出现（如 `CategoryName`，`mapField="CategoryId"`），而**原始 `CategoryId` 字段不在字段集内**（列表 list 段也只暴露虚拟列）。旧 `mapFieldKind` 用「mapField 能否在字段集命中同名字段」判别 → 找不到 `CategoryId` → 误判成字典源/普通字符串 → `controlOf` 出 `t-input`（用户投诉"分类是文本框不是下拉"）。**修复（`mapFieldKind` 双语义终极判别）**：① `mapField` 含 `=`/中文逗号 → 字典源（枚举 `[Map]` 串，如 `Kind.mapField="0=免费,1=收费"`）；② 其余（纯标识符、如 `CategoryId`）**一律判为映射字段（field）**，指向真实字段名，**不再要求目标字段存在于当前字段集**——Cube 表单只下发虚拟字段是常态。③ 控件细分：`xxxIDs/xxxIds`→`multi-select`、`ParentID`→`tree-select`、其余→`select`；提交键用 `mapField` 真实列名。`useLookups.load` 同时把**映射虚拟字段**纳入字典拉取目标（`isMappedField(f)`），否则虚拟字段的下拉也拿不到选项。`assets/core/api/fieldRender.ts`（`mapFieldKind`）、`assets/core/api/useLookups.ts`（`load` 目标含 `isMappedField`）已落地。

- **`mapField` 非空 ⇒ 映射字段 ⇒ 用下拉展示，该值就是原始字段名（核心契约）**：`DataField.mapField` 非空即表示该字段是「映射/显示名」字段（如 `TenantName`），**必须用下拉列表**渲染；`mapField` 的值即真实存储字段（如 `TenantId`）。前端据此三件事：① `isMappedField(f)` 判定，**不要额外要求 `mapField` 以 ID 结尾**（契约是「非空即映射」）；② `mappedFieldName(f)` 取原始字段名；③ `lookupBaseName(f)` 对映射字段**一律以 `mapField` 值为准**去 ID/IDs 后缀（`TenantId→Tenant`、`RoleIds→Role`），于是 `RoleName`(RoleID) 与 `RoleNames`(RoleIds) 共用同一个 `Role` 字典，不重复拉取。控件按原始字段名细分：`xxxIDs/xxxIds`→`multi-select`（`RoleNames`）、`ParentID`→`tree-select`（`ParentName`）、其余→`select`。多值判定统一走 `isMultiValue(f)`，供 `labelOf` 的「、」拼接、`t-select multiple`、详情标签组共用。详见 `references/field-renderers.md` §3.6。

- **字段选型要按真实 `typeName`/`itemType`/`mapField` 判定，勿只看字段名（高频坑）**：真实 NewLife.Cube 的 `GetPage` 字段描述符是 **camelCase + 丰富属性**，远不止 `name/displayName/type`：`typeName`（基础类型 `Int32/String/Boolean/Double/DateTime/Int64`，**也可能是枚举类型名**如 `DepartmentTypes/SexKinds/MenuTypes/DataScopes/RoleTypes`）、`itemType`（特化编辑器 `html/mail/mobile/TimeSpan`）、`mapField`（外键关联真实字段，`TenantName→TenantId`、`RoleNames→RoleIds`）、`lovCode`（关联源编码，如 `Role`）、`category`（分组，camelCase，可能为空串或 `null`）。**典型误判**：以为 `Sex` 是 Boolean（实际 `typeName=SexKinds` 枚举→应下拉）；以为 `RoleIds` 是普通 String（实际是复数外键→应多选下拉）；忽略 `itemType=html` 的 `Remark`（应富文本）。落地前务必 `curl` 真实 `GetPage` 统计一遍 `typeName` 全量取值再写规则。判定优先级见 `references/field-renderers.md` §1（itemType → Boolean → xxxIDs → 枚举 → xxxID → map → 基础类型兜底）。

- **外键/ParentID 字典查找大小写不敏感（兼容 PascalCase 后端）**：`useLookups` 写字典键、后端返回键可能 PascalCase（`Parent`/`Role`），而 `lookupBaseName` 产出 camelCase（`parent`/`role`），直接 `lookups[lookupBaseName(f)]` 会大小写失配、外键列回显不出名称。**正确做法**：`fieldRender.lookupDict(lookups, base)` 按 `base.toLowerCase()` 在 `lookups` 键里模糊匹配命中（`Parent`/`parent` 通吃），`labelOf`/`resolveOptions` 统一走它。`assets/core/api/fieldRender.ts` 已落地。


## G4 列表与表格渲染（columns / cell / 刷新抖动）

**目录**：
- ⚠️ 列表页 `table-layout:auto` + `fixed:'right'` 操作列 = 双坑（页面撑出屏幕 + 固定列失效，实测 NV8021X）
- 列表「列宽不断刷新」的根因是 `columns` 引用被反复重建，而非「没写死 width」（高频坑，实测）
- TDesign `t-table` 的 `col.cell` 回调签名是 `(h, params)`，不是 `({ row })`（高频坑，实测崩溃）
- 进入列表页后「页面多次自动刷新」（高频坑，四层根因 + 多层防御）
- `buildColumns` 内 `const` 前向引用致列表列全丢（TDZ，高频坑）
- ⚠️ TDesign 表格没有 `<t-column>` 组件——columns 配置式 API，Element Plus 风格子组件写法被静默忽略（高频坑，实测「列表页无数据」）

**条目全文**：

- **⚠️ 列表页 `table-layout:auto` + `fixed:'right'` 操作列 = 双坑（页面撑出屏幕 + 固定列失效，实测 NV8021X）**：TDesign 固定列**只在 `table-layout:fixed`（默认值）下可靠生效**——fixed 布局渲染 `<colgroup>`，`width` 来自列定义（无 width 的列 overflow 时被压成 100px，故**每列必须显式 width**）；列宽合计 > 容器时 `.t-table__content` 自身出横向滚动条，sticky 操作列钉住可视区右缘。写成 `table-layout="auto"` 后：① 内部 `<table>` 宽由内容决定（`width:100%` 在 auto 下是"下限"而非"上限"），超宽表把**整个页面撑出屏幕宽度**；② 表格外层容器被撑宽后 scrollWidth==clientWidth，TDesign 的 `isWidthOverflow` 永远 false → **操作列 `fixed:'right'` 完全不生效**（用户投诉"操作栏没钉在右侧"）。**修法**：`t-table`/`t-enhanced-table` 一律不写 `table-layout`（吃默认 fixed）；`buildColumns` 按元数据推导显式 width（bool 80/图片图标颜色 90/数值 100/日期时间 170/日期 120/文本按 length×13px 钳制 [120,260]/兜底 150，长内容走 `ellipsis` 截断）；操作列 width 含宿主 `row-actions` 插槽宽度（≥180）。外层另保留 `min-width:0`（.content/.cube-list-page）防 flex 撑爆。assets/core/components/cube/ListPage.vue 与 fieldRender.ts 已按此落地。

- **列表「列宽不断刷新」的根因是 `columns` 引用被反复重建，而非「没写死 width」（高频坑，实测）**：典型现象——打开列表页列宽不停抖动。**`fieldRender.buildColumns` 生成的列定义数组「引用」必须稳定**：TDesign 表格每次拿到新 `columns` 数组就重建列头、重算列宽。给每列写死 `width` 只是「用固定宽度掩盖反复重建」，代价是牺牲「自适应列宽」需求——**不是根因修复**。**根因**：`columns` 若依赖 `columnLookups`（外键/枚举字典），而字典在初始化期 `schema → lookups → data` 分批到达（映射列还会从「原始 ID」变成「名称」），每次字典到达就生成新 `columns` 数组 → 列宽被反复重分布 → 即「列宽不断刷新」。**正确修复（同时满足「自适应列宽」+「操作列固定右侧」两项原始需求）**：① `buildColumns(fields, getLookups?)` 只由 `fields`（schema.list）生成列定义，**不接收也不依赖字典**；字典通过 `getLookups()` 在 `cell` 渲染时**按需读取**（如 `() => columnLookups.value`，响应式），字典到达后表格自动重渲对应单元格、只更新内容不重建列；② 数据列**不写死 `width`**，列宽交由 TDesign 表格 `table-layout:auto` 下按内容自适应（窗口/容器变化列宽随之调整），长文本列配 `ellipsis` 截断；③ 操作列 `fixed:'right'` + `width:120`（fixed 列需明确 `width` 才能正确 sticky 钉右）；④ 两张 `<t-table>` 加 `table-layout="auto"`（默认 `fixed` 会把无 width 列均分容器、且固定列在均分下无横向滚动、钉右效果弱；`auto` 下内容撑宽、列多时横向滚动、操作列 sticky 钉右）。`assets/core/api/fieldRender.ts`（`buildColumns` 稳定引用 + `getLookups` 闭包）、`assets/core/components/cube/ListPage.vue`（操作列 `fixed:'right'`+`width:120` + 两表 `table-layout="auto"`）已落地，`references/demo/src/api/fieldRender.ts` 同步。**自适应屏幕宽 + 操作列钉右缘 + 不撑破页面（三项须同时满足）**：`table-layout:auto` 下**内部 `<table>` 元素宽度由内容决定**——`.t-table`（外层 div）虽 `width:100%`，但内容窄时表格不满容器、右侧留白；内容超宽时又会**把外层 flex 容器顶宽、页面超出屏幕出现浏览器横向滚动条**。三处修复缺一不可：① CSS 强制内部 table 铺满：`.cube-list-page :deep(.t-table > table), .cube-list-page :deep(.t-table .t-table__content table) { width: 100%; }`（内容超宽时 CSS 表不能窄于 min-content，仍会撑开 → `.t-table__content` 的 `scrollWidth > clientWidth` → TDesign `isWidthOverflow`（useFixed.mjs）检测到溢出并启用自身横向滚动，操作列 `fixed:'right'` sticky 钉右缘）；② **flex 子项 `.content` 必须 `min-width: 0`**（核心）——flex 子项默认 `min-width:auto` 会被超宽表格撑大，导致 TDesign 测得的容器宽 = 撑开宽、`isWidthOverflow` 永远 false、表格自身横向滚动失效、页面整体溢出；③ 页面容器 `.cube-list-page { width:100%; min-width:0 }`。`assets/core/layouts/BasicLayout.vue`（`.content{min-width:0}`）、`assets/core/components/cube/ListPage.vue`（容器约束 + 内部 table 铺满）已落地。

- **TDesign `t-table` 的 `col.cell` 回调签名是 `(h, params)`，不是 `({ row })`（高频坑，实测崩溃）**：`fieldRender.buildColumns` 生成列表列时若给列传了 `cell` 渲染函数，**必须写成 `(_h, params) => ...` 并取 `params.row`**，绝不能写成 `({ row }) => ...`。原因：TDesign 1.20.x 内部实现 `col.cell(h, params)`（`tr.mjs` 的 `renderCell`），**第 1 个参数是渲染函数 `h`，第 2 个才是 `{ row, rowIndex, col, colIndex }`**。若写成 `({ row })`，实际是在解构 `h`（一个函数），`row` 恒为 `undefined`，一旦访问 `row[xxx]` 就抛 `TypeError: can't access property "xxx", row is undefined`（报错栈 `cell fieldRender.ts` + `renderCell tr.tsx`）。**典型现象**：任何含映射/布尔列（`Sex`/`Enable` 等）的列表页整页崩溃白屏。**务必** `cell: (h, params) => labelOf(f, params?.row?.[key], lookups)` 并用 `?.` 防御 `params.row` 为 `undefined`。`assets/core/api/fieldRender.ts`（`buildColumns`）已按此修正。

- **进入列表页后「页面多次自动刷新」（高频坑，四层根因 + 多层防御）**：典型现象——点菜单进入列表页，Network 里连发多个 GET、表格反复重渲染/抖动。先排除 TDesign 分页器：读 `tdesign-vue-next/es/table/hooks/usePagination.mjs` 与 `pagination/pagination.mjs` 可知，`page-change`/`onChange` **只在用户点击翻页/改每页条数时**由 `toPage` 发出，`toPage` 有 `if (toPageCurrent === innerCurrent.value) return;` 守卫，本地分页只更新内部 `dataSource` 不回发。**故 TDesign 不会因 pagination 对象身份变化而自动回发 page-change**，真正诱因是以下四个、需逐个加防御：① **候选列表端点回退探测连发多 GET**：`loadData` 依次试 `''`/`/Search`/`/GetList`/`/Index`，裸 GET 404 时会连发 2~4 个 GET，视觉上就是「多次刷新」。正确做法：`useEntityResource` 内用模块级 `let discoveredListEndpoint` 缓存首次命中的端点，命中后把它放候选数组最前（`[discoveredListEndpoint, '', '/Search', '/GetList', '/Index']`），后续直连不再逐个回退。② **路由视图 `:key="route.fullPath"` 致组件重挂载**：query/hash 任何变化（含重复导航）都会改变 `fullPath` → `<component :key>` 变 → 整页销毁重建 → `onMounted(init)` 再跑一遍 → 再发请求。正确做法：把 key 改为 `route.path`（同实体页仅依赖 path，query/hash 抖动不重挂）。③ **`onNavigate` 重复 `router.push`**：菜单 `url` 归一化后与当前 `route.path` 相同仍执行 `push`，触发 ② 的重挂链。正确做法：`onNavigate` 归一化菜单 url 为 `/Area/Controller`（取前两段，兼容 `/Admin/User`、`/api/Admin/User`、`Admin/User/Index`），`if (clean === route.path) return;` 去重。④ **`pagination` 用「每次返回新对象的 computed」引发对象身份抖动**：`t-table` 每次重渲染都收到新 pagination 引用，可能触发分页器反复重渲染/抖动。正确做法：`pagination` 改为**稳定 `reactive` 对象**，再用 `watch(() => res.pagination.value, ...)` **原地赋值**（`pagination.current = pg.current`…），引用永远不变；`onPageChange` 加 no-op 守卫（`if (page.current === res.pagination.value.current && page.pageSize === res.pagination.value.pageSize) return;`），页码/每页条数未变则忽略，杜绝程序化重复触发。`init` 再加幂等守卫（`let initialized = false; if (initialized) return; initialized = true;`），保证同一挂载实例只加载一次。`assets/core/components/cube/ListPage.vue`、`assets/core/api/useEntityResource.ts`、`references/scaffold/src/layouts/BasicLayout.vue` 均已落地上述修复。

- **`buildColumns` 内 `const` 前向引用致列表列全丢（TDZ，高频坑）**：`fieldRender.buildColumns` 的 `.map()` 回调里，若在 `isMapped` 复合行**提前引用**某个尚未声明的 `const` 标志（如 `isLovList` 由 `lovTypeOf(f) === 'list'` 派生，却声明在 `isMapped` 之后），触发 `ReferenceError: can't access lexical declaration 'isLovList' before initialization`（暂时性死区）。错误发生在 `.map()` 内会让整个列数组构建中断——只有 `ListPage` 单独追加的**操作列残留**、其余数据列全部消失，且接口明明有返回数据。正确做法：凡由 `lovTypeOf(f)` / 函数派生的 `is*` 标志，**必须声明在 `isMapped` 复合行之前**；`lovTypeOf` 等顶层函数声明可提升、无此问题。`assets/core/api/fieldRender.ts`（与 `references/demo/src/api/fieldRender.ts`）已修正 `isLovList` 上移。

- **⚠️ TDesign 表格没有 `<t-column>` 组件——columns 配置式 API，Element Plus 风格子组件写法被静默忽略（高频坑，实测「列表页无数据」）**：**tdesign-vue-next 的 `t-table` 是 `columns` 配置式 API**（实证：`node_modules/tdesign-vue-next/es/table/` 目录下**无任何 column 子组件**，列只存在于 `columns` prop / `PrimaryTableCol` 定义里）。若照 Element Plus 习惯在模板里写 `<t-column title=".." col-key=".."><template #cell>`，Vue 会把它当**未知元素静默忽略**（运行时不报错、控制台不警告）→ 表格没有任何列 → **表体空白**；而**分页器独立于列渲染**，仍正常显示「共 N 条」——「分页器有数、表体空白」就是**列未被注册**的典型特征（接口数据其实已进入 state，只是没有列可渲染）。**正确做法**：① 列全部改为 `:columns="columns"` 配置数组（`{ title, colKey, width, cell? }`）；② 自定义单元格用 `cell` 渲染函数 `(_h, params) => h(Tag, {...}, () => ...)`（**签名 `(h, params)`**，见下方 cell 回调坑），需要的组件直接 `import { Tag, Link, Space } from 'tdesign-vue-next'` 用 `h()` 挂载；③ 排查方法：先查 `node_modules/tdesign-vue-next/es/<组件目录>/` 有无对应子组件文件，不存在即说明该组件只支持配置式/事件式用法。本项目 ArticleList/CategoryList/TagList 三个列表页均踩此坑，已改为 columns 配置修复（commit 2e48095）。


## G5 树形（基类 / 判定 / 数据构建 / 组件）

**目录**：
- 树形用错基类
- 树形列表必须基于「完整数据集」构建（loadAll），不能用当前页（高频坑：树断链塌成平铺）
- 树形判定必须聚合全部字段组 + 认 `mapField=ParentID`（高频坑：元数据有 ParentID 却不走 treeTable）
- 树形表格必须用 `t-enhanced-table`，且 `:tree` 只传对象、勿写静态布尔（高频坑：Table 系不支持树形）

**条目全文**：

- **树形用错基类**：后端若实体继承 `EntityTree<TEntity>`，必须用 `EntityTreeApiController`
  （返回 JSON），而非 `EntityTreeController`（MVC 版 `Up/Down` 返回 302 重定向）。前端只要检测到
  `ParentID` 即走 tree 模式，与后端基类正确与否无关，但后端错了列表数据会是重定向而非 JSON。

- **树形列表必须基于「完整数据集」构建（loadAll），不能用当前页（高频坑：树断链塌成平铺）**：分页只返回当前页，跨页的父子关系会让子节点找不到父节点 → 树断链、子节点丢失或整树塌平。实测部门等有层级实体尤甚。**正确做法**：新增 `useEntityResource.loadAll(params?)`（超大 `pageSize:10000` 一次性取全量，忽略前端分页 UI），`ListPage` 的 `init`/`onSearch`/`onSortChange`/`onSaved`/`onDelete` 树形一律走 `loadAll`、非树走 `loadData`；树形 `ParentID` 列经自构建 `selfLookups['Parent']`（id→name）回显父级名称（而非原始 ID）。`FormDialog` 的 `ParentID` 树形下拉同样取全量（排除自身）。`assets/core/api/useEntityResource.ts`（`loadAll`）、`assets/core/components/cube/ListPage.vue`（树形重载统一 `reloadAfterMutation`）、`assets/core/components/cube/FormDialog.vue` 已落地。

- **树形判定必须聚合全部字段组 + 认 `mapField=ParentID`（高频坑：元数据有 ParentID 却不走 treeTable）**：`isTreeSchema`/`selectListComponent` 若只查 `schema.list` 里是否有名为 `ParentID` 的字段会**漏判**——NewLife.Cube 常把 `ParentID` 从列表列隐藏、仅以 `ParentName`（`mapField=ParentID`）映射列展示（实测 `Admin/Department` 的 list 组只有 `ParentName`，`ParentID` 仅在 search 组）。漏判 → 选成 flat 平铺表，用户看到「有 ParentID 却不树状」。**正确做法**：① `isTreeSchema` 判定条件扩展为「字段名=ParentID（不区分大小写）**或** `mapField=ParentID` 的映射字段（如 ParentName）」；② 判定输入用**全部字段组聚合**（list + addForm + editForm + detail + search），`ListPage` 的 `listComponent` 与 `useEntityResource.isTree` 都传聚合数组。`assets/core/api/fieldRender.ts`（`isTreeSchema`）、`assets/core/components/cube/ListPage.vue`、`assets/core/api/useEntityResource.ts` 已落地。附验证：Department 全组聚合判定 True、真实 7 行数据 buildTree 得 2 根 + 5 子链。

- **树形表格必须用 `t-enhanced-table`，且 `:tree` 只传对象、勿写静态布尔（高频坑：Table 系不支持树形）**：**TDesign 文档明确「树形结构的表格请使用 EnhancedTable，Table/PrimaryTable/BaseTable 等不支持树形结构」**（官方示例代码注释即「!!! 树形结构 EnhancedTable 才支持，普通 Table 不支持 !!!」）。源码实证（tdesign-vue-next 1.20.7）：`table/index.mjs` 的 `Table = withInstall(cloneDeep(_PrimaryTable), "TTable")`（`t-table` 实为 PrimaryTable）；`tree` prop 只存在于 `enhanced-table-props.mjs`；`useTreeData` hooks 仅被 `enhanced-table.mjs` 引用。**用 `t-table` 渲染树形时 `tree` prop 被静默忽略 → 子节点不显示/只平铺根节点**。**正确做法**：① 树形分支用 **`<t-enhanced-table>`**（列/分页/事件与 `t-table` 一致）；② **`:tree` 只传对象**（如 `:tree="{ childrenKey: 'children', defaultExpandAll: true, treeNodeColumnIndex: 0 }"`）——EnhancedTable 以 `props.tree` 为**非空对象**判定树形（`enhanced-table.mjs`：`isTreeData = !props.tree || !Object.keys(props.tree).length`），**不要同时写静态 `tree` 布尔**（prop 合并歧义）；③ `defaultExpandAll: true` 让子节点开箱即见（否则默认收起）；`childrenKey` 与 `buildTree` 产出的 `children` 键一致（官方默认 `children`，可用 `tree.childrenKey` 定义别名如 `list`）；`treeNodeColumnIndex` 指定第几列作树形操作列（默认 0=首列，展开图标落在该列）；`tree.indent` 设置缩进。`assets/core/components/cube/ListPage.vue`（树形分支 `t-enhanced-table` + `:tree` 对象）已落地。


## G6 表单 / 校验 / 规则 / 控件

**目录**：
- ⚠️ 字段级默认值走 `FIELD_DEFAULTS` 覆盖表，勿在组件里散写（高频坑：排序未默认 0）
- 编辑表单下拉显示数字 ID 而非名称 = 值类型不匹配（高频坑）
- `required` / `nullable` / `readOnly` 语义各自独立，勿混用（高频坑）
- 业务必填/格式校验表达不了时，用「控制器.字段」显式规则覆盖表（高频坑：DB 可空字段但后端 `Valid()` 强制必填 → 空值提交被吞成「添加失败！」）
- TDesign `t-tabs` 在「activeTab 与任何 panel 都不匹配」的空/未就绪状态渲染，会在切换 tab 时崩溃（高频坑，实测 TypeError: can't access property "parentNode"
- 表单字段按 `category` 分 tab + 横向网格布局
- 多选 `t-select multiple` 的 `value` 必须为数组（高频坑：`can't access property Symbol.iterator, r is null`）
- `<script setup>` 新增响应式 API 调用务必同步 import（高频坑：`ReferenceError: watch is not defined`）
- `itemType=image` 字段三端统一用图像组件，表单支持上传（功能规范）
- `itemType=mail` 表单页必须加 email 格式校验（功能规范，遵循铁律 R2 优先用内置规则）
- `itemType=mobile` 表单页必须加手机号校验——用 TDesign 内置 `telnumber` 规则（功能规范，遵循铁律 R2）
- `FormDialog` 日期范围控件（daterange/datetimerange）落到实体单列，存「开始,结束」逗号串（与搜索栏 dtStart/dtEnd 语义不同，务必分清）
- ⚠️ TDesign `<t-form>` 的 `@submit.prevent` 会抛 `e.preventDefault is not a function`（高频坑，实测崩溃）
- ★★ 父表表单提交 DTO 白名单：服务端托管字段（单号/状态/DateTime）提交空串 `""` 炸 .NET 反序列化 → `dto is required`（父子表契约高频坑，实测）
- ★ 多 Area 拆分后跨区字典 404：基础档案下拉恒空无报错 → `useLookups` 候选区探测 + `AREA_ALIAS` 列名别名（实测）

**条目全文**：

- **⚠️ 字段级默认值走 `FIELD_DEFAULTS` 覆盖表，勿在组件里散写（高频坑：排序未默认 0）**：`controlOf` 对 `number` 的通用默认是 `null`，但业务要求特定字段有初值（如 `Sort` 排序默认 `0`、用户铁律"排序默认 0"）。若只在 `FormDialog.defaultValue` 写死，会污染所有数字字段。**修复（与 `FIELD_BIZ_RULES` 同机制）**：`fieldRender` 增加 `FIELD_DEFAULTS: Record<'控制器.字段键', any>`（键小写，如 `'product.sort': 0`）+ `applyDefaults(items, controller)`——在 `ListPage.formItems` 由 `buildFormItems` 生成后合并 `it.default`；`FormDialog.defaultValue` 优先级 **`it.default` ＞ 控件通用默认**（switch=false/number=null/''）。编辑回填时真实值经 `?? defaultValue(it)` 兜底，**不会覆盖**已有值。模式优势：泛型页零特判、默认值集中可审、只补业务增量。`assets/core/api/fieldRender.ts`（`FIELD_DEFAULTS`/`applyDefaults`）、`assets/core/components/cube/FormDialog.vue`（`defaultValue` 优先 `it.default`）已落地。

- **编辑表单下拉显示数字 ID 而非名称 = 值类型不匹配（高频坑）**：TDesign `t-select` 用**严格相等 `===`** 匹配 value。而 `useLookups` 建字典用 `dict[String(idv)] = name` → **`resolveOptions` 生成的 options.value 全是字符串**；接口/列表行返回的外键 ID 却常是**数字**（JSON number）→ 类型不同匹配失败 → 下拉显示不出 label、回退显示原始数字 ID。**修复（`FormDialog` 两处，缺一不可）**：① **回填时类型对齐**——在 `options` 中按「值相同」找命中项，用它的 value（保持原类型）写回 `formData`（多值字段逐项对齐）；② **提交时还原数字**——单选 select 字段若值是纯数字字符串则 `Number(v)`（后端 Int32/Int64 严格反序列化，字符串可能绑定失败；仅对 `it.control === 'select'` 生效，避免误转普通文本数字字段如 `Code="123"`）。多值外键走 `serializeMultiValue`（逗号串，String 字段）不受影响。`assets/core/components/cube/FormDialog.vue` 已落地。

- **`required` / `nullable` / `readOnly` 语义各自独立，勿混用（高频坑）**：字段元数据属性都是**辅助前端展示**的，但含义不同：`required`=**界面是否必填**（UI 语义）、`nullable`=**数据库是否允许为空**（NOT NULL 约束）、`readOnly`=**是否只读**（控件禁用）、`visible`=是否可见（**实测后端恒为 `false`，绝不可用于判断隐藏列**）、`primaryKey`=主键（表单/列表排除）。**典型 bug**：把 `nullable===false` 直接当必填，导致 `ID`、`CreateTime`、`CreateUserID`、`Ex1/Ex2` 等 77 个字段全被标红星要求用户填写（实测 137 个表单字段中 77 个是 NOT NULL）。正确做法：① `required===true` → 必填；② 其余情况用 `nullable===false` **兜底推断**，但排除主键/自增/`readOnly`/审计字段（`CreateTime`/`UpdateTime`/`CreateUserID`/`UpdateUserID`/`CreateIP`/`UpdateIP`）；③ 实测本后端对所有字段下发 `required:false`（0 个 true），**故 `required` 仅在为 `true` 时生效，不能把 `false` 当「明确不必填」**，否则连 `Name` 都不校验。统一走 `fieldRender.resolveFieldBehavior()`（返回 `{required, readOnly, nullable, primaryKey}`），表单校验与 `buildFormItems` 都用它，勿各处散写 `f.nullable===false`。

- **业务必填/格式校验表达不了时，用「控制器.字段」显式规则覆盖表（高频坑：DB 可空字段但后端 `Valid()` 强制必填 → 空值提交被吞成「添加失败！」）**：GetPage 只下发列元数据——`required`（后端常恒 false）、`nullable`（DB 约束）。**业务规则在控制器 `Valid()` 里**（如 SinglePageController：Slug 必填 + `^[a-z0-9][a-z0-9-]*$`），但 Slug 列在 DB **可空**（`nullable=true`）→ 前端按元数据推断**不生成必填规则** → 空值可提交 → 后端 `Valid()` 抛 `InvalidOperationException` 被框架吞成 `code=500「添加失败！」` → 用户无明确提示。**修复（显式规则覆盖，勿碰通用推断）**：`fieldRender` 增加 `FIELD_BIZ_RULES: Record<'控制器.字段键', { required?; extraRules: any[] }>`（键小写，如 `'singlepage.slug'`）+ `applyBizRules(items, controller)`——在 `ListPage.formItems` 由 `buildFormItems` 生成后合并：命中则置 `it.required=true` 并 `push` extraRules。规则一律 async-validator **内置类型**（`required`/`pattern`/`max`…），**message 与后端 `Valid()` 文案逐字一致**，使前端拦截提示与后端兜底语义完全对齐。模式优势：泛型页零特判（不写 `if controller===`）、字段规则集中一处可审、只补业务增量不覆盖元数据推断。`applyBizRules` 对新增/编辑表单都生效（`formItems` 合并点覆盖两模式）；搜索项不要合并（`buildSearchItems` 已清空 rules）。典型断言：E2E 验证空值提交**不发 POST** + 行内出现后端同款文案（可先做负向验证：临时禁用该条规则配置 → 用例报红，证明防护真实生效）。

- **TDesign `t-tabs` 在「activeTab 与任何 panel 都不匹配」的空/未就绪状态渲染，会在切换 tab 时崩溃（高频坑，实测 TypeError: can't access property "parentNode", node is null）**：`t-tabs` 的导航栏（`t-tab-nav`）把「nav 项数组」作为**片段（array 子节点）**渲染，active-bar（`t-tabs__bar`）是这个片段里的「锚点兄弟」。当 `panels` 从 **0 个 → N 个**（典型：schema 异步加载，首帧 `groups` 为空、`t-tabs` 已以 `activeTab='默认'` 渲染，随后 schema 到达 `groups` 变非空）时，Vue 在 `patchKeyedChildren` 里要把新建的 nav 项插入到 bar **之前**，而 bar 此刻 `el` 尚为 `null` → `hostInsert(child, container, anchor=null)` → `hostParentNode(null)` → 抛 `parentNode` 空引用（栈：`onTabChange2 tabs.tsx` → `useVModel` → `set value` → `componentUpdateFn` → `patchKeyedChildren`）。**修复**：① 用 `v-if="groups.length"` 包裹 `t-tabs`，**只在分组就绪（至少 1 个 tab）时才渲染**，绝不让 `t-tabs` 在空/未匹配状态存在；② `activeTab` 初值由 `watch(groups, immediate)` 设为首个分组 `category`，保证始终匹配某个 panel；③ panel 内容不要再用 `<template v-for>` 片段（改为 `v-for` 直接挂在真实 `t-form-item` 元素上），减少 tab 重渲染时的 keyed 片段 patch。`assets/core/components/cube/FormDialog.vue` 已按此修正（`t-tabs` 加 `v-if="groups.length"` + 内容改为 `v-for` on `t-form-item`）。

- **表单字段按 `category` 分 tab + 横向网格布局**：新增/编辑表单字段多时，用 `fieldRender.groupFormItemsByCategory(items)` 把字段按 `category`（后端常为 PascalCase `Category`，读取时兼容 `category ?? Category`）分组成 tab；`category` 为空/空白 → 归入「默认」组且排在最前。每个 tab 内用 **2 列 CSS 网格**（`display:grid; grid-template-columns: repeat(2,1fr); column-gap:24px`）横向组织字段，宽字段（长文本 `textarea`、树形下拉 `tree-select`、日期时间 `datetime`）加 `grid-full`（`grid-column:1/-1`）占满整行。`t-form` 设 `label-align="top"` 适配网格。TDesign `t-tabs` 默认（`lazy=false`）**保留所有 tab 面板挂载**（仅切换 `display`），跨 tab 的 `t-form-item` 仍全部注册，校验 `formRef.validate()` 覆盖隐藏 tab 的必填项，无需特殊处理。`assets/core/api/fieldRender.ts`（`buildFormItems` 已输出 `category`/`full`、`groupFormItemsByCategory`）、`assets/core/components/cube/FormDialog.vue`（tabs+grid 实现）已落地。

- **多选 `t-select multiple` 的 `value` 必须为数组（高频坑：`can't access property Symbol.iterator, r is null`）**：TDesign 内部 `getMultipleContent` 用 `for...of` 遍历 `props.value`，收到 `null`/`undefined`/空串直接抛错。触发场景：新增记录（多值字段键缺失→`undefined`）、编辑记录（库中多值外键为 `null`，如 `RoleIds=null`）。**正确做法**：`deserializeMultiValue` 保证**永远返回数组**（`null`/`undefined`/空串→`[]`、已是数组→原样、逗号串→拆分去空项、单值 `'3'`→`['3']`）；`FormDialog` 的 `editId` watch 在清空表单后、回填前，先对所有 `it.multiple` 字段置 `[]`，避免首帧绑定 null。`assets/core/api/fieldRender.ts`（`deserializeMultiValue`）、`assets/core/components/cube/FormDialog.vue`（防御初始化）已落地。

- **`<script setup>` 新增响应式 API 调用务必同步 import（高频坑：`ReferenceError: watch is not defined`）**：esbuild 打包**不校验未定义全局变量**，所以漏 import 的 `watch`/`computed`/`watchEffect`/`nextTick` 会**构建通过、运行期才崩溃**。典型现象：新增 `watch(() => res.rows.value, ...)` 后忘记在 `import { ... } from 'vue'` 补 `watch`，页面 setup 时抛 `ReferenceError: watch is not defined`。**正确做法**：每次在 `<script setup>` 里新用任一 Vue 响应式 API，立刻核对顶部 import 是否包含它。`assets/core/components/cube/ListPage.vue` 已补 `watch`。**实战推论（排查技巧）**：缺 import 的组件若被某编辑/详情页当**子组件**使用，宿主页会**整页空白**（仅浏览器 console 有 `ReferenceError`，Vite 浮层不一定出现，且重载后若会话丢失连空白都难复现）——这是「某页表单/列表完全不渲染、console 有 `is not defined`」的首要嫌疑，**优先查该页引用的具名子组件顶部 import**，而非怀疑宿主页自身。

- **`itemType=image` 字段三端统一用图像组件，表单支持上传（功能规范）**：字段元数据 `itemType === 'image'` 时：① **列表** `buildColumns` 对该列 cell 渲染 `t-image` 缩略图（`fit:cover` 48×48、圆角、cursor:pointer），点击 `window.open` 开大图，值空显示 `-`；② **详情** `DetailDrawer` 对 `isImage(f)` 用 `t-image`（`fit:contain` max 200×160、zoom-in 光标）点击开大图；③ **表单** `selectFormControl` 返回 `'image'`，`FormDialog` 渲染 `t-upload theme="image" accept="image/*" :max="1"`，**`requestMethod` 自定义上传**（`postApi` + `FormData('file', file.raw)`，绕开响应拦截器信封校验），兼容后端返回 `data` 为 URL 字符串或 `{url}` 对象，成功回写 `formData[字段]=url`（提交时随实体一起保存）；编辑时把已有 URL 回显为 `{name,url,status:'success'}` 文件列表。**上传端点（官方契约，高频坑）**：NewLife.Cube 官方前端（NewLife.CubeVue）的上传接口是 **`POST /{Area}/{Controller}/UploadFile(IFormFile file, String id, String title)`**（form-data 字段名 `file`；`id`=实体主键，编辑场景传主键关联已有实体、新增场景省略走临时实体路径；`title`=附件标题，传字段 displayName、为空后端回退 `entity.ToString()`；返回信封 `data.url` 或 `data={id,url}` 附件结构），**不是** `/api/Admin/Index/Upload` 这类全局端点。`uploadUrl` 默认值 = `/${area}/${controller}/UploadFile`（**不带 `/api` 前缀**，由 `postApi` 的 http 实例 baseURL 承载），经 `uploadUrl` prop → `VITE_UPLOAD_URL` 覆盖。**坑（实测 405）**：uploadUrl 若写成带 `/api` 前缀（如 `/api/Admin/Index/Upload`），`postApi` 会拼出 `/api/api/...` **双前缀**，后端路由错位 → 405 Method Not Allowed。**返回解析（实测真实结构）**：上传成功返回 `{code:0, message:null, data:{attId:"...", filePath:"/cube/image?id=xxx.png", contentType:"image/png"}}`——`code=0` 成功；`attId` 附件 id；**`filePath` 是附件经后端访问的相对路径（存表单字段、展示图片都用它）**；`contentType` 文件类型。兼容解析：`data` 直接是 URL 字符串 / `{url}` / `{id,url}` / `{attId,filePath,contentType}` / `{path}` 等（`url ?? Url ?? path ?? Path ?? filePath ?? FileName`）。**坑**：`filePath` 是 `/cube/...` 前缀（非 `/api`），必须给 Vite 代理加 `/cube`，否则浏览器把它当 SPA 路由返回 index.html → 图片 404（见本文件 G2「代理 /api + /cube」）。**坑**：① 不要用 `t-upload` 的 `action` 原生上传（走不到项目 axios 拦截器，且 token 头/信封解析都要手工配）——统一用 `requestMethod`；② `requestMethod` 只收 file 拿不到字段名 → 模板用闭包 `:request-method="(f) => uploadRequest(item, f)"` 传入 item，才能拼 `title` 参数；③ 表单 `imageFiles`（t-upload v-model）与 `formData[字段]`（URL 字符串）是两套值，editId watch 清空/回填时**同步初始化**，`on-success` 写回 URL、`on-remove` 清空，勿只更新其一导致提交丢值或回显失效；④ 图像字段在 2 列网格里占整行（`full:true`）。`assets/core/api/fieldRender.ts`（`'image'` 控件 + 列缩略图 cell + full）、`assets/core/components/cube/FormDialog.vue`（`t-upload` + `uploadRequest(item,file)` 拼 id/title + `onUploadSuccess`/`onUploadRemove` + 回填）、`assets/core/components/cube/DetailDrawer.vue`（`isImage`/`openImage`）、`assets/core/components/cube/ListPage.vue`（透传 `uploadUrl`）已落地。

- **`itemType=mail` 表单页必须加 email 格式校验（功能规范，遵循铁律 R2 优先用内置规则）**：`selectFormControl` 对 `itemType==='mail'` 已返回 `'email'`（渲染 `t-input type="email"`），但**仅 `type="email"` 不触发校验**——必须同时在 `FormDialog` 的 `rules` 里为该字段追加 `{ type:'email', message:'xx格式不正确' }`（async-validator 内置邮箱类型）。**要点**：① 与必填规则**叠加**（先 `required` 后 `type:'email'`，两者可并存于同一字段的规则数组）；② 对**非必填**字段的空值（`undefined`/`''`）自动跳过 `type:'email'` 校验，因此「可选邮箱留空」不会误报格式错误，无需自己判空；③ **铁律 R2**：TDesign/async-validator 内置的校验类型（`type:'email'`、`required`、`len/min/max/pattern`、TDesign 扩展 `telnumber`/`idcard` 等，见 `form-model.mjs` 的 `VALIDATE_MAP`）**必须优先使用**，不得手写正则/自定义 validator 重复实现；内置无法满足业务语义时才自定义并注明原因；④ 只对 `itemType==='mail'` 追加，普通 String 字段不做邮箱校验。`assets/core/components/cube/FormDialog.vue`（`rules` computed 按 itemType 追加 email 规则）已落地。

- **`itemType=mobile` 表单页必须加手机号校验——用 TDesign 内置 `telnumber` 规则（功能规范，遵循铁律 R2）**：`selectFormControl` 对 `itemType==='mobile'` 已返回 `'tel'`（渲染 `t-input type="tel"`），但**仅 `type="tel"` 不触发校验**——必须同时在 `FormDialog` 的 `rules` 里追加 `{ telnumber: true, message:'xx格式不正确' }`。**要点**：① **TDesign 内置了 `telnumber` 校验**（`/^1[3-9]\d{9}$/`，中国手机号），见 `tdesign-vue-next/es/form/utils/form-model.mjs` 的 `VALIDATE_MAP`——按铁律 R2 **必须用内置规则**，勿手写正则/自定义 validator；② 内置的 `telnumber`/`idcard` 等非标准 async-validator 类型在 `VALIDATE_MAP` 里，同样可用；③ 与必填规则**叠加**（`required` + `telnumber` 并存）；④ 非必填字段空值自动跳过格式校验，可选手机号留空不误报。`assets/core/components/cube/FormDialog.vue`（`rules` computed 按 itemType 追加 email/telnumber 规则）已落地。

- **`FormDialog` 日期范围控件（daterange/datetimerange）落到实体单列，存「开始,结束」逗号串（与搜索栏 dtStart/dtEnd 语义不同，务必分清）**：`selectFormControl` 对 `itemType==='daterange'`/`'datetimerange'` 返回 `'daterange'`/`'datetimerange'`，`FormDialog` 用 `<t-date-range-picker>` 渲染（datetimerange 加 `enable-time-picker`，`value-type` 分别为 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`），**控件值恒为 `[start, end]` 数组**。**关键坑（与搜索栏差异）**：① 表单页实体只有一列，不能像搜索栏那样拆成 `dtStart`/`dtEnd` 两个查询参数（后端会忽略非列参数）——提交前由 `serializeRangeValue` 把 `[start,end]` 数组转成 `"start,end"` 逗号分隔字符串存实体单列；② 回填时 `deserializeRangeValue` 把字符串/数组还原为数组（空值→`[]`、单值→`[v,v]`），`FormDialog` 首帧把 range 字段初始化为 `[]`，避免 `t-date-range-picker` 绑定 `null`/`''`/`undefined` 时内部 `value[0]`/`value[1]` 访问崩溃（与多选控件同理）；③ `buildFormItems` 对 range 控件**不写 `maxlength`**（range 值非字符串）；④ range 与 multi/lov-table 并列归入 `full`（占整行栅格）。`assets/core/api/fieldRender.ts`（`isRangeControl`/`serializeRangeValue`/`deserializeRangeValue`）、`assets/core/components/cube/FormDialog.vue`（两个 `t-date-range-picker` 分支 + 首帧 `[]` 初始化 + 回填 `deserializeRangeValue` + 提交 `serializeRangeValue`）已落地。`ListSearchBar` 的 daterange 仍按 `dtStart`/`dtEnd` 两查询参数映射（见 §4.13），两者契约**不可混用**。

- **⚠️ TDesign `<t-form>` 的 `@submit.prevent` 会抛 `e.preventDefault is not a function`（高频坑，实测崩溃）**：`<t-form>` **不是原生 `<form>` 元素**，它**不发射原生 DOM submit 事件**，而是发射 TDesign 自定义 `submit` 事件，回调参数为 `{ validateResult, firstError, e }`（`e` 才是原生 event）。Vue 模板里写 `@submit.prevent="onSubmit"` 时，`.prevent` 修饰符会让 Vue 把**整个自定义对象**当原生 event 去调 `.prevent()` → 该对象无 `preventDefault` 方法 → 抛 `TypeError: e.preventDefault is not a function`（栈：`prevent runtime-dom.esm-bundler.js` → `onSubmit form.tsx`）。**修复（二选一）**：① **最简**：改 `@submit="onSubmit"`（**去掉 `.prevent`**）——TDesign `t-form` 内部已阻止原生表单提交与页面刷新，`onSubmit` 不需要、也不应使用原生 event；② 若确需原生 `preventDefault`，回调解构出 `e`：`onSubmit({ e }: any){ e?.preventDefault() }`，不要直接对首个参数调 `.prevent()`。**注意**：`onSubmit` 自身若不使用 event（绝大多数登录/提交场景），直接 `@submit="onSubmit"` 最干净。其它用 `type="submit"` 按钮 + 自定义 `@click` 提交（不经 `@submit`）的表单不受影响。本项错误写法曾出现在个人博客 Login.vue，已修正为 `@submit="onSubmit"`。


- ★★ **父表表单提交必须走 DTO 白名单：服务端托管字段提交空串会炸 .NET 反序列化 → `"The dto field is required."`（父子表整体提交契约，2026-09 实测）**：后端 `EntityController<TEntity, TUpsertDto>` 双泛型把 `Insert/Update` 绑定到 Upsert DTO（只含业务可写列），但前端 `GetPage` 元数据下发的字段集是**实体全字段**（含单号 BillNo、状态 Status、OccurTime/ConfirmTime 等服务端托管字段）。`FormDialog` 若照全字段集渲染并提交，新增场景这些字段以**控件通用默认值**入 payload：`date` 默认 `""`、number 默认 `""` → .NET JSON 反序列化对 `DateTime` 字段收到 `""` **直接抛绑定异常 → 整个 dto=null** → 框架报 `"The dto field is required."`（误导性文案：其实是某个 DateTime 成员炸了，不是 dto 本身没传；curl 二分逐个删键才定位到 `OccurTime:""`）。**修复三层（缺一不可）**：① 父表加 **`submitFields` 白名单**——`ListPage.formFields` 只保留 DTO 真实字段（camelCase 键，如 StockBill=`['billType','warehouseID','toWarehouseID','supplierID','deptID','userID','sourceType','sourceID','remark']`），白名单**按「提交目标字段名」匹配**：`isMappedField(f) ? f.mapField : f.name`——直接按 `f.name` 匹配会把 `WarehouseName→mapField=WarehouseID` 这类**虚拟名称列一起滤掉**（列名不在白名单，但它提交时写回的是白名单里的 warehouseID），实测踩过；② `FormDialog.defaultValue` 对 `date/datetime` 控件返回 **`null` 而非 `""`**（null 能被 .NET 正常反序列化为可空/缺省）；③ 明细行 `blankLine()` 里 number/lov 列初值给 **`0` 不给 `""`**（Int32 列同理炸）。**判据**：后端 400 且 message 含 `dto field is required` → 先抓真实请求体逐键删（curl 复现），99% 是空串喂给了非 string 列。注册表范式见项目 `src/masterDetail.ts`（父子表唯一权威：childController/fk/columns/minLines/submitFields/readOnlyDetail）。

- ★ **多 Area 拆分后跨区字典 404：基础档案下拉恒空，useLookups 须按候选区探测 + 列名别名（2026-09 实测）**：Cube 按业务拆 Area（Basic/Bill/Flow/Asset）后，`useLookups` 若固定用**父表所在区**拉外键字典（如 Bill 区的 StockBill 表单拉 `Warehouse`/`Supplier`/`StorageLocation`——这些实体在 **Basic 区**），请求 `GET /api/Bill/Warehouse/Index` 直接 404 → 下拉**静默空**（无报错，最难察觉）。**修复两招**：① `ENTITY_AREAS=['Basic','Bill','Flow','Asset']`，`candidates()` 对每个外键实体生成**跨区候选端点**（排除自身区后依次探测，命中即用）；② TDesign form-item class 与后端列名的驼峰差异要补 **`AREA_ALIAS`**：`towarehouse/fromwarehouse → 'Warehouse'`（`ToWarehouseID`/`FromWarehouseID` 剥 ID 后首字母小写得 `toWarehouse`，实际实体叫 `Warehouse`）。**通用规律**：外键字典解析 = 「列名剥后缀 → 猜实体名 → 跨区探测」三步，任何一步写死单区/单名都会在新实体接入时静默失效；新增实体验收必查表单下拉**有选项**（不只是不报错）。


## G7 登录页 / 会话 / 菜单外壳

**目录**：
- 菜单 submenu value 必须稳定唯一，否则"点一个全展开"
- ⚠️ `MenuSidebar` 必须显式传 `orientation`，否则侧栏变横向菜单多出 "..." 项（高频坑）
- ⚠️ 侧栏是「品牌色皮肤」，底色与文字令牌必须成对（两个方向都踩过坑，勿拆）
- 左侧菜单须按设计系统落地，勿用裸 `t-menu`
- 登录页必须按 `LoginConfig` 全字段动态组装，静态资源走 `/Content`（高频坑）
- 登录页四条约束：左栏文案按项目生成、账号密码不预填、页面不渲染实现细节、登录页与注册页均不让用户选租户（铁律 L1~L4）
- `security.challengeRequired` 严格以 LoginConfig 返回值为准：`true` 才走 Challenge-Response，`false`/缺省明文（高频坑：多余的挑战请求）
- `security.mfaAvailable` / `passwordComplexity` 等同理严格以 LoginConfig 返回值为准（高频坑：页面/校验与后端开关脱节）
- `MenuSidebar` 菜单请求必须 `try/catch`，401 不可抛到外层（高频坑，Uncaught AxiosError）
- 401 自动刷新令牌须排除认证端点 + 单飞守卫（高频坑：刷新死循环 / 并发重复刷新）
- 登录相关页调用 `auth` store helper，勿在组件内动态 `import('@/api/api')`（高频坑：构建告警 + 循环依赖）
- `Message.success/error` 报 `is not a function`（高频坑，会导致"登录成功不跳首页"）

**条目全文**：

- **菜单 submenu value 必须稳定唯一，否则"点一个全展开"**：`t-submenu` 的 `:value` 切勿用会冲突的 `node.text||node.title`——当真实后端菜单字段名不是 `text/title`（NewLife 常用 `Name`/`Url`/`Childs`/`Icon`，且常 PascalCase）时，这些取值全部为空/`undefined` → 多个 submenu 同 value → 点击任意一个，所有同值菜单同步展开（表现为"点一个全展开"）。必须按 `优先 url → 每行 id → 层级路径(m-i/m-i-j)` 生成唯一 value；并设 `t-menu :expand-mutex="true"` **同级别互斥展开（手风琴，一次仅一个；⚠️ 别写 `accordion`——`tdesign-vue-next@1.20.7` 的 `TdMenuProps` 无此属性，源码互斥逻辑只认 `expandMutex`，见 `es/menu/utils/v-menu.mjs` 的 `VMenu.expand()`）** + 受控 `expanded` 与 `@expand` 同步。字段读取需大小写兜底（`text/Text/name/Name`、`children/Children/Childs`、`url/Url`…）。`assets/core/components/cube/MenuSidebar.vue` 已落地该健壮实现（含图标 + 设计系统激活态）。

- **⚠️ `MenuSidebar` 必须显式传 `orientation`，否则侧栏变横向菜单多出 "..." 项（高频坑）**：组件内部是 `v-if="orientation === 'vertical'"` → `t-menu`（垂直）/ `v-else` → `t-head-menu`（横向弹层）。宿主 BasicLayout 若不传 `orientation="vertical"`，侧栏里会渲染成**横向 t-head-menu**——菜单项总宽超过 232px 窄容器时 TDesign 自动把溢出项折叠进一个 **"..."（more）菜单**，表现为"菜单莫名多出一层 ..."。正确装配：侧边布局 `<MenuSidebar orientation="vertical" :theme="setting.mode" :collapsed="setting.collapsed">` 放 t-aside；顶部布局（layout='top'）另放一份 `orientation="horizontal"` 于 t-header 并隐藏 t-aside；`theme/collapsed` 从 `useSettingStore()` 读取（`stores/setting.ts`，main.ts 已 `load()`）。

- **⚠️ 侧栏是「品牌色皮肤」，底色与文字令牌必须成对（两个方向都踩过坑，勿拆）**：设计体系=「品牌深底 + 白字」。`.side` 底色用 `var(--cube-sidebar-bg)`（tokens.css 政务蓝渐变兜底，运行时 `utils/color.ts` `getBrandPalette(主色)` inline 注入 `--cube-sidebar-bg/-bg-solid/-active-bg/-active-bar/-topbar-border`，随 SettingPanel 所选主色实时联动），菜单文字/激活/悬停用 `--cube-sidebar-text/-text-strong/-text-weak/-hover-bg`（白系）。坑①：把 `.side` 写成 `var(--td-bg-color-container)`（白底）→ 切主色侧栏无感知，用户投诉"没有应用主色调"；坑②：为迁就白底把文字改成 `--td-text-color-primary` → 恢复品牌深底后深底深字不可见。**铁律：成对改**——恢复品牌皮肤时 `.side`→`--cube-sidebar-bg` 且菜单文字→`--cube-sidebar-text` 系同时落地。暗色模式由 `theme-dark.css` `.t-theme-dark .side{background:color-mix(...)!important}` 接管为品牌暗调底，白字令牌在其上仍可读。顶栏可保留白底，但 `border-bottom:1px solid var(--cube-topbar-border)` 与主色联动作呼应。

- **左侧菜单须按设计系统落地，勿用裸 `t-menu`**：设计系统（见 `design-proposal.md` 与 `prototype.html` 侧边栏规范）要求每个菜单带图标、激活态为「品牌色浅底 `#f2f7ff` + 品牌色文字 + 字重 500 + 左侧 3px 品牌色强调条」、悬停态浅灰底、菜单项圆角 40px 高（子级 13px），且一级分组名视为分组标题视觉。裸 `t-menu` 仅用默认激活色、无图标、无强调条，即“未落地设计系统”。参考 `assets/core/components/cube/MenuSidebar.vue` 的 `:deep(.t-menu__item.t-is-active)` 等样式直接复用。

- **登录页必须按 `LoginConfig` 全字段动态组装，静态资源走 `/Content`（高频坑）**：登录页左栏系统名、`loginLogo`/`logo`、登录背景 `loginBackground`、登录方式开关（`login.password/sms/mail/captcha`）、注册入口（`register.enabled`）、第三方登录（**实测真实后端键名为 `oAuth`（大写 A），文档写全小写 `oauth`**——只按文档读 `config.oauth` 会导致按钮不渲染；统一读 `config.oAuth`，`getLoginConfig` 内已双向归一）、版权（`copyright` 含 HTML 链接，用 `v-html` 渲染）、备案号（`registration`）全部由 `GET /Auth/LoginConfig` 返回驱动，**前端不得硬编码**文案/Logo（注：此处「不得硬编码」指**系统名/Logo/版权等可配置项**；左栏业务定位语等 `LoginConfig` 不提供的文案，按铁律 **L1** 由项目生成的 `PROJECT` 常量给出，二者不冲突）。**⚠️ `LoginConfig` 可带 `?tenant=` 查询参数，但登录页 / 注册页不得因此新增租户选择控件（铁律 L4）**——租户由后端在登录响应头 `X-Tenant` 下发，前端只接住。后端返回的静态资源路径（Logo/背景/OAuth 图标）一律落在 **`/Content` 目录下**（如 `/Content/images/logo/NewLife.png`），**无需登录即可公开访问**；前端 `vite.config.ts` 须把 `/Content` 也加入 dev 代理（与 `/api`/`/Auth`/`/Mfa`/`/cube` 并列）转发到后端，否则浏览器把 `/Content/...` 当 SPA 路由返回 `index.html` → 图片 404。**切忌**给这些路径加 `/api` 前缀或当 SPA 路由。`security.passwordComplexity=true` 时表单下展示密码强度规则（`security.passwordStrength` 正则）；`register.requireMailVerify`/`requireMobileVerify` 控制注册校验。`references/demo/src/pages/LoginView.vue`（登录页模板实际位于 demo 工程，`assets/` 下无此文件） 已按此动态组装落地（Logo 回退：有 `loginLogo`/`logo` 走 `<img>`，否则系统名首字母方块；OAuth logo `onerror` 降级为文字）。

- **登录页四条约束：左栏文案按项目生成 / 账号密码不预填 / 页面不渲染实现细节 / 不让用户选租户（铁律 L1~L4，2026-09 新增）**：① **L1**——登录页左栏的品牌定位语（`PROJECT.tagline`）、核心能力要点（`PROJECT.highlights`）、表单上方说明（`PROJECT.subtitle`）**必须按当前项目业务生成**，模板默认值是空串，留空即不渲染；**严禁**照抄「NewLife.Cube · TDesign Vue Next」这类技术栈话术，也不要用「Sign in to continue」之类通用英文占位。`LoginConfig` 只提供系统名 / Logo / 版权，**给不出**业务定位语，故 L1 的文案只能由生成时按项目填写。② **L2**——`username` / `password` 一律 `ref('')`，**严禁** `ref('admin')`；页面**严禁**出现「默认账号 admin / admin」「测试账号 …」之类提示（测试口令只写进 README / 交付说明）。③ **L3**——页面**严禁**渲染任何实现细节或契约说明：接口路径（`/Auth/Login`、`/Auth/Challenge`、`/api/...`）、加密方式（「密码以明文提交」「RSA 加密传输」）、配置开关名（`challengeRequired`、`mfaAvailable`、`security.*`）、环境状态（「本环境未启用…」）。这些**只写在代码注释里**。④ **L4**——**登录页与注册页均严禁**出现租户/校区/组织选择控件（形如 `<t-input v-model="pw.tenant" placeholder="租户编码（可选，多租户）">`、租户 `t-select`、租户 `t-tabs`），登录表单对象里**严禁**有 `tenant` / `tenantCode` 字段（`reactive({ username, password, tenant })` → 不合格），**注册表单同样严禁**（`reactive({ username, email, password, confirmPassword, tenant })` → 不合格），且注册页**不得** `localStorage.setItem('cube_tenant_code', …)` / `auth.setTenant(…)`（那是登录响应拦截器的活儿）。租户上下文**由后端在登录响应头 `X-Tenant` 下发**：`http.ts` 响应拦截器捕获 → `setTenantCode()` 持久化（`cube_tenant_code`）→ 请求拦截器统一注入 `X-Tenant`（主）/ `X-Tenant-Id`（legacy）。确需切换租户，只允许在**登录后的顶栏切换器**做（`auth.setTenant()` + 刷新数据）。注册用户的租户归属由**后端按邀请 / 域名映射 / 默认租户分配**，前端不提供入口。理由：租户是**账号的属性**而非登录/注册选项，手填租户 Code 反直觉且极易出错（填错 → 落到错误数据域或直接 403），多租户部署下用户通常根本不知道自己的租户 Code，注册时更是凭空要求新用户知道一个他不知道的编码。四条均为交付验收项，见 `SKILL.md`。落地文件：`assets/core/pages/LoginView.vue`、`references/scaffold/src/pages/LoginView.vue`（两份相同）、`references/demo/src/pages/LoginView.vue`、`references/demo/src/pages/RegisterView.vue`。

- **`security.challengeRequired` 严格以 LoginConfig 返回值为准：`true` 才走 Challenge-Response，`false`/缺省明文（高频坑：多余的挑战请求）**：登录是否加密由 `LoginConfig.security.challengeRequired` 决定，**不是**无条件请求。`/Auth/Challenge` 是取 RSA 公钥的公开端点；`challengeRequired===true` 时才请求 `/Auth/Challenge` 并用 RSA-OAEP/SHA-256 加密密码提交；`challengeRequired===false` 或该字段缺失时密码以明文提交（`challengeId` 留空），**不得再请求 `/Auth/Challenge`**（否则多发一次后端未启用的挑战请求、与配置自相矛盾，实测：config 返回 `challengeRequired:false` 登录仍请求 `/Auth/Challenge`）。正确做法：`loginWithPassword` 增加 `challengeRequired` 入参（**默认 `false`、`严格以 LoginConfig 为准`**），调用方传 `config.security?.challengeRequired === true`（而非 `!== false`），仅该值为 `true` 时加密；`false`/缺省**跳过**，直接明文。
  **⚠️ 该值只做「逻辑门控」，不生成任何给终端用户看的文案（2026-09 口径变更，废止旧要求）**：曾要求在登录页按 `=== true` 切换展示「加密传输 / 明文提交」说明，并写「根据 LoginConfig（challengeRequired=…）」——**已废止**，与铁律 **L3**（页面禁止渲染实现细节 / 契约说明）直接冲突。`challengeRequired` / `mfaAvailable` / `security.*` 等开关一律**只写在代码注释里**，不得进入 UI 文案；需要给用户的提示只写业务语义（如「请输入账号密码」），不写接口路径、加密方式、配置项名。`assets/core/stores/auth.ts`（`loginWithPassword` 的 `challengeRequired` 参数门控，默认 `false`）+`references/demo/src/pages/LoginView.vue`（完整版登录页模板，含 MFA/注册/找回密码；`assets/core/pages/LoginView.vue` 是精简版，仅账密 + 门禁）（调用传 `=== true`，页面不再渲染 `loginNote` 类实现细节文案）已落地。

- **`security.mfaAvailable` / `passwordComplexity` 等同理严格以 LoginConfig 返回值为准（高频坑：页面/校验与后端开关脱节）**：`LoginConfig.security` 下的每个布尔开关都必须**直接驱动**页面与登录逻辑，禁止硬编码默认开启或「缺省即开」。① `mfaAvailable===true` 才允许进入二步验证步骤（即便后端误返回 `mfa_required` 也按失败提示，不进 MFA）；`false`/缺省不渲染 MFA。② `passwordComplexity===true` 且后端给出 `passwordStrength` 正则时，注册/重置密码**才**套该正则（TDesign 内置 `pattern`，R2 优先内置），同时仅在二者皆有时才显示复杂度提示文案（避免 config 缺 `passwordStrength` 时显示不匹配的提示）；`false`/缺省不强制复杂度（仅非空）。③ 登录方式/找回密码渠道同样严格：`login.sendCode===true` 或 `login.sms/mail===true` 才显示「忘记密码」入口与对应渠道（单选 radio 按 `channels` 动态生成，无可用渠道则禁用并回登录）；`login.captcha===true` 才渲染图形验证码；`register.enabled!==true` 直接回登录、不渲染注册表单；`register.requireMailVerify/requireMobileVerify===true` 才出现邮箱/手机字段。`references/demo/src/pages/LoginView.vue`（完整版登录页，含 MFA/注册/找回密码）、`references/demo/src/pages/RegisterView.vue`、`references/demo/src/pages/ForgotPasswordView.vue`、`assets/core/pages/LoginView.vue`（脚手架精简版：仅账密登录 + 门禁）均已按上述开关驱动。

- **`MenuSidebar` 菜单请求必须 `try/catch`，401 不可抛到外层（高频坑，Uncaught AxiosError）**：侧边栏 `onMounted` 调 `getRaw('/Admin/Index/GetMenuTree')` 拉菜单，**必须包 `try/catch`**——该请求 401（未登录/令牌失效）时，Axios 拒绝若无接收方会冒泡成 `Uncaught (in promise) AxiosError: Request failed with status code 401`（控制台红错，且渲染链被打断）。`http.ts` 拦截器本就会处理 401（清 token + 跳 `/login`），故菜单加载器只需 **`catch` 中静默忽略 401、其余异常仅 `console.warn`**，绝不 `throw`。同因：任何 `onMounted`/`watch` 内的 `getRaw`/`getApi` 在未登录即可触发的请求都需 `try/catch`，否则一个未捕获 401 就崩整页。`assets/core/components/cube/MenuSidebar.vue` 已落地（`catch` 静默 401）。

- **401 自动刷新令牌须排除认证端点 + 单飞守卫（高频坑：刷新死循环 / 并发重复刷新）**：`accessToken` 过期后前端应自动用 `refreshToken` 调 `POST /Auth/Refresh` 续期并重放原请求（技能 `assets/core/api/http.ts` 当前为「401 直接清令牌跳登录」，**未内置静默刷新**；若需按文档 §6 开启令牌轮换，请在 `src/api/http.ts` 响应拦截器内自行落地，并遵守本节三处避雷）。三处必避雷：① **`/Auth/Refresh` 本身及全部认证端点（`/Auth/Login`、`/Auth/LoginConfig`、`/Auth/Challenge`、`/Mfa/*`）必须排除在刷新逻辑外**（`isAuthEndpoint` 判定）——否则刷新请求自己 401 又触发刷新，形成死循环；② **并发单飞守卫**（`refreshInFlight` 模块级 Promise）：多个受保护接口同时 401 时只真正刷新一次，其余复用同一结果，避免并发打爆 `/Auth/Refresh`；③ **刷新失败即跳登录**（`handleUnauthorized` 清令牌 + `location.href='/login'`，非 `router.push`、加 `pathname!=='/login'` 防循环），不再无限重试。登录/刷新/MFA 走 `rawHttp`（无 `/api` 前缀），这些端点自动绕开刷新分支。

- **登录相关页调用 `auth` store helper，勿在组件内动态 `import('@/api/api')`（高频坑：构建告警 + 循环依赖）**：`ForgotPasswordView`/`RegisterView`（模板见 `references/demo/src/pages/`）需 `resetPassword`/`registerUser` 时，应直接调用已注入的 `auth` store 方法，而非在组件内 `import('@/api/api')` 动态引入——后者触发 Vite 动态导入告警且易与 api 实例形成循环依赖（且 `@/api/api` 这一路径已按铁律 H1 删除，动态导入会直接构建失败）。`assets/core/stores/auth.ts` 已导出 `resetPassword`/`registerUser`/`sendCode`/`verifyMfa`，登录三页统一经 store 调用。

- **`Message.success/error` 报 `is not a function`（高频坑，会导致"登录成功不跳首页"）**：TDesign Vue Next 中 `Message` 是**组件**，`MessagePlugin` 才是**函数式调用对象**。`import { Message } from 'tdesign-vue-next'` 后调 `Message.success(...)` 会抛 `TypeError: Message.success is not a function`；若该调用处在 `try` 内、其后还有 `router.replace(...)` 等跳转逻辑，异常会中断 `onSubmit`，表现为"后端已返回登录成功、token 已写入 localStorage，但页面不跳首页、必须刷新才进"——刷新后应用重启读到 localStorage 的 token 直接进首页，极具迷惑性。**统一写法**：`import { MessagePlugin } from 'tdesign-vue-next'` 并 `MessagePlugin.success/error/warning/info(...)`。`app.use(TDesign)` 全量引入已自动注册 `MessagePlugin`，无需额外 `app.use`。本项目 `LoginView/SyncCenter/ListPage/FormDialog` 已全部修正为 `MessagePlugin`。


- **左侧菜单栏一片空白（真凶＝令牌键名不一致 + 白底白字）——2026-09 实测（FE-08）**：症状「登录成功、外壳正常、左侧菜单没有任何显示」。两个必查点：① **请求头有没有 `Authorization: Bearer`**——若组件误引了第二套 axios 实例（技能早期 `api.ts`，令牌键 `cube_token`，与 `token.ts` 的 `assets_token` 不一致），请求拦截器取不到令牌 → `GET /api/Admin/Index/GetMenuTree` 恒 **401** → `menus` 恒为空数组。修复：统一到 `@/api/http` 并删除第二套实例（铁律 H1/H2）。实测后端只认 `Authorization: Bearer <jwt>`：发 `Authentication: Bearer` 头 → 401；不带 Authorization 仅带 Cookie（`.Cube.Session`）→ 401。② **菜单底色与文字色是否同色**——`MenuSidebar` 早期无条件使用 `--cube-sidebar-text`（白色系变量，为深色侧栏设计），若宿主 `BasicLayout .side` 是白底，就构成「白底白字」：DOM 里菜单节点齐全（实测 53 个 `.t-menu__item`、`GetMenuTree` 200）却肉眼完全不可见。修复：组件按 `theme` prop 输出 `.cube-menu--light` / `.cube-menu--dark` 分支，默认 light 使用 `--td-text-color-primary`。**自查手段（CDP）**：读 `document.querySelectorAll('.t-menu__item').length` 与 `getComputedStyle(el).color` 及祖先链背景色——数量 > 0 而两者同色（对比度≈1）即为配色问题，数量 = 0 则回到 ①。

## G8 前端工程实践（Vite / 构建 / 脚手架 / 编辑器）

**目录**：
- 构建清空 dist 触发 safe-delete 报错 / dist 被进程锁定（环境 artifact + 正确处置）
- ⚠️ `@wangeditor/editor-for-vue` 禁止把钩子放进 `defaultConfig`（高频坑，粘贴即抛错）
- 📦 前端工程实践聚合（Vite / npm / 构建 / 脚手架 / 请求层，实测于 NewLife.Cube WebApi + Vue3 + TDesign 个人博客项目）
- 改 Mock 后端 `backend/server.mjs` 后必须重启 Node 进程（高频坑：命中旧契约）
- 「源码明明改对了，错误却一模一样复现」→ 先怀疑 stale（陈旧）构建产物，而非继续改源码（高频坑第一名，实测反复发生）

**条目全文**：

- **构建清空 dist 触发 safe-delete 报错 / dist 被进程锁定（环境 artifact + 正确处置）**：在 WorkBuddy 沙箱中 `vite build` 清空旧 `dist` 时，底层把 `fs.rmSync` 包装成 trash 操作，可能在 Windows 上抛 `safe-delete` 错误（**与代码无关，模块编译均通过**，不是编译失败）。此外若有 node 进程（静态服务 / vite 监视器）持有 `dist` 内文件句柄，`dist` 会**创建/改名均 `Permission denied`**。**正确处置（按序）**：① 先构建到**临时目录**验证编译与产物：`npm run build -- --outDir dist-check`，再 `grep` 该目录产物确认新逻辑存在；② **不要**对 `dist` 做 `mv`/`rm -rf` 后再 `mv` 新目录回去——沙箱 shim 会异步清掉临时目录，实测出现「`dist` 和 `dist-check` 同时消失、产物丢失」；③ 若 `dist` 被锁（服务正持有其句柄），直接 `cp -r dist-check/. dist/` **覆盖内容**（服务持有的目录句柄不变，硬刷新即生效），并核验 `index.html` 引用的 hash 与新产物一致（`grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' dist/index.html`，再确认该文件存在）；④ 治本：停掉占用 `dist` 的服务进程（Windows：`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` 找 PID → `Stop-Process -Id <pid> -Force`）后再 `npm run build`。

- **⚠️ `@wangeditor/editor-for-vue` 禁止把钩子放进 `defaultConfig`（高频坑，粘贴即抛错）**：包装层在运行时检测 `props.defaultConfig.customPaste` 等钩子，一旦存在即抛 `Error: 请使用 '@customPaste' 事件，不要放在 props 中 / Please use '@customPaste' event instead of props`（源码 `genErrorInfo()` 写死文案；**触发时机是用户粘贴时**，创建编辑器不报错，故容易漏测）。受影响钩子全集：`customPaste`/`onCreated`/`onChange`/`onDestroyed`/`onMaxLength`/`onFocus`/`onBlur`/`customAlert`。**铁律：钩子一律走模板事件**（`@on-created` / `@on-change` / `@custom-paste` / `@custom-alert`），`defaultConfig` 只放纯配置（`placeholder`/`MENU_CONF`/`readOnly` 等）。`customPaste` 事件签名 `(editor, event, callback)`：处理完自定义逻辑后 `event.preventDefault()` + `callback(false)` 阻止默认粘贴、`callback(true)` 放行（返回值 false 亦可阻止）。典型用途——粘贴 Markdown 自动转富文本：检测剪贴板 `text/plain` 像 Markdown 且无 `text/html` → `editor.dangerouslyInsertHtml(markdownIt.render(text))` + `callback(false)`。本项目 RichEditor.vue 曾把 `editorConfig.customPaste = ...` 写进 defaultConfig 导致生产站每次粘贴抛错且功能失效，已改为 `@custom-paste` 事件修复（commit 3406d4c）。

- **📦 前端工程实践聚合（Vite / npm / 构建 / 脚手架 / 请求层，实测于 NewLife.Cube WebApi + Vue3 + TDesign 个人博客项目）**：以下前端专属落地细节统一归口本 skill（与 `cube-webapi-backend` 第十四节后端契约互补，避免前后端知识错置）：
  - **Vite 代理 target 必须 `127.0.0.1` 而非 `localhost`**：Windows 沙箱下 `localhost` 间歇 502（DNS 解析问题）。代理 `/api /Auth /Mfa /cube /Content` → `http://127.0.0.1:<后端端口>`（注：本 skill 319 行搜索栏段亦提及同坑，两个方向恰好相反——代理 target 用 127.0.0.1、浏览器入口用 localhost，排查先 `netstat` 确认监听协议栈）。
  - **npm registry 卡死**：默认 registry 在沙箱/国内环境会**长时间无进展**（实测 21 分钟 0 输出）。改用 `npm install --registry=https://registry.npmmirror.com`（2 分钟装完）。`rm -rf node_modules` 触发沙箱批量删除拦截，**不要强删**，直接重试 install 增量对齐。
  - **TDesign 全量引入 chunk 过大**：`npm run build` 报 chunk >500KB。Vite `build.rollupOptions.output.manualChunks` 拆 `vue`/`tdesign`/`markdown`/`axios` 独立 vendor，消除告警并改善缓存。
  - **生产 base 路径**：部署到子路径（如 `/blog/`）时 `vite.config.ts` 设 `base: '/blog/'`，`createWebHistory('/blog/')` 同步，Nginx 按子路径反向代理（前端 `/blog` + 后端 `/blog/api`）。
  - **删除确认用 `DialogPlugin.confirm`** 而非 `window.confirm`（TDesign 规范、可定制文案、可防误删）。
  - **SQLite 并发死锁 → 首页加载转圈**：后端 SQLite 同页 3+ 并发查询会死锁（busy timeout 不够），前端表现为列表永远 loading。**前端规避**：串行发请求（先 `loadMeta()` await 完再 `loadArticles()`），勿 `Promise.all` 并发打同库多接口；治本可在后端连接串加 `Busy Timeout=15000`（见 `cube-webapi-backend` 第十二节）。
  - **富文本编辑器选 `@wangeditor/editor-for-vue@5` + Markdown 粘贴兼容**：博客/内容站需要在「富文本可视化编辑」与「Markdown 源码粘贴」之间兼容。做法：① 安装 `@wangeditor/editor@^5.1.23` 与 `@wangeditor/editor-for-vue@^5.1.12`；② 封装 `RichEditor.vue`，`v-model` 接收/输出 HTML 字符串；③ 编辑器图片上传用 `editor.getConfig().MENU_CONF['uploadImage'].customUpload`，内部调项目封装的 `postApi('/{Area}/{Controller}/UploadFile', formData)`（字段名 `file`），成功后 `insertFn(filePath)`；④ Markdown 粘贴转富文本：**用 `@custom-paste` 事件绑定**（切勿写进 `defaultConfig.customPaste`，包装层会在粘贴时抛错，见本文件 G8 对应条目）——事件回调 `(editor, event, callback)` 里检测剪贴板 `text/plain` 像 Markdown 且无 `text/html` → `editor.dangerouslyInsertHtml(markdownIt.render(text))` + `callback(false)`；⑤ 详情渲染组件做 HTML 直通：检测到内容以 `<` 开头即 `v-html`，否则走 `markdown-it` 渲染旧数据，保证历史 Markdown 文章不破。
  - **wangEditor v5 内容注入契约（无源码模式，实测）**：① v5 **没有「源码模式」**，把 HTML 写入编辑器只有两条路——真实 Ctrl+V 粘贴富文本（`text/html` 剪贴板数据），或代码 `editor.setHtml(htmlString)`；② **合成 `ClipboardEvent('paste')` 派发不生效**（wangEditor 内部粘贴处理不响应合成事件），端到端验证必须真实键盘粘贴；③ 粘贴会**过滤 `<video>`**（`<img>` 正常）——视频需在编辑器工具栏放开 `group-video` 菜单 + 配置 `MENU_CONF['uploadVideo']` 走 UploadFile 上传后插入，或 `setHtml` 注入；④ 外部文章转 wangEditor 发布时，div 卡片/网格/flex 布局会被拍平成段落，须重构为编辑器原生元素（h1-h5/p/blockquote/table/ol/ul/img + span 内联 style），CSS `<style>` 块会被丢弃须全内联（完整转换流程已沉淀在 `inline-html-for-wangeditor` 技能）。
  - **请求层三件套完整代码不再内嵌**：`http.ts` / `camel.ts` / `auth.ts`（token 存取、`camel`/`camelize` 消费端归一、双 axios 实例 + Bearer 注入 + 401 刷新重放）真身在 `references/demo/src/api/`（demo 工程）与 `assets/`（拷贝模板源），直接拷贝该处代码，避免双份漂移。分页/门户两种 `data` 形状差异仍在业务层分支处理；后端契约（`access_token` snake、响应 PascalCase、路由 `Detail?id=`）见 `cube-webapi-backend` skill §14。

- **改 Mock 后端 `backend/server.mjs` 后必须重启 Node 进程（高频坑：命中旧契约）**：Node 运行 `server.mjs` **不热更新**——改文件不杀旧进程，新请求仍由旧代码处理（典型：把 `oAuth` 改 `oauth` 后 curl 仍返旧键名，误以为前端没生效）。正确做法：改完先 `pkill -f "node backend/server.mjs"`（Windows `Stop-Process -Id <pid>`）杀旧 PID，再 `npm run mock` 重启；验证用 `curl :3001/Auth/LoginConfig` 直连确认契约已更新。同理 Vite `npm run dev` 端口（如 5173）被占时会顺延到 **5174**（以终端输出为准）——`curl` 验证须认准实际端口，否则命中旧 dev（其代理指向旧 Mock）造成「改了没生效」假象。

- **「源码明明改对了，错误却一模一样复现」→ 先怀疑 stale（陈旧）构建产物，而非继续改源码（高频坑第一名，实测反复发生）**：典型序列——修好 `src/api/auth.ts` 的 `category`、编译 0 错误，但页面报错照旧。**此时第一动作是核验「实际在被服务的那份产物」，不是继续读源码**：`grep -roE 'category:"[^"]*"|access_token|AccessToken' dist/assets/index-*.js`。实测真实案例：源码已是 `category: AuthCategory.Password`（=整数 0），`dist/assets/index-*.js` 里却仍 grep 到 `category:""`（旧 bug）——用户一直在跑修复前构建的 `dist`，于是 `$.category` 转换失败无限复现，**源码对了也白搭**。
  **验证闭环（改完登录/契约类代码必做四步，缺一即「改了没生效」）**：① `npm run build` 退出码 0；② **grep 产物**确认新逻辑关键字**存在**、旧 bug 关键字**不存在**（新包应有 `category:0`、`access_token`，且**无** `category:""`）；③ 浏览器**硬刷新**（Ctrl+Shift+R）；④ dev 模式则**重启 dev server 会话**（旧会话可能未热更）。
  **最快判定手段：用 node 直接跑归一化函数验证真实 payload**——把后端返回的真实 JSON 喂给 `normToken`，看输出 `accessToken` 是否非空，可立刻区分「前端解析 bug」「产物陈旧」「后端问题」三类根因：
  ```bash
  node -e 'const real={code:0,data:{access_token:"JWT.xxx",refresh_token:"REF.xxx",expire_in:0}};
  const normToken=d=>{const o=d??{};return{accessToken:o.accessToken??o.AccessToken??o.access_token??"",refreshToken:o.refreshToken??o.RefreshToken??o.refresh_token??"",expireIn:o.expireIn??o.ExpireIn??o.Expire??o.expire_in??0}};
  console.log(JSON.stringify(normToken(real.data)));'
  ```
  **契约铁律**：字段名以后端**真实 HTTP 响应**为唯一权威（本次实测令牌为 snake_case），靠 `normToken` 三向兜底，不硬编码单一命名——文档、dll 反射、旧契约都可能与运行中的后端不一致。


## G9 Lov 值集 / CDP 验收技巧

**目录**：
- ⚠️ TDesign `<t-select>` 渲染为 `<div class="t-select">`，不是原生 `<select>`（验收高频误判）
- ★ **`Lov/Meta` 响应 `data` 下键为小写驼峰（`meta`/`inlineEnums`，后端序列化产物，非前端 camelize）** → 读 `data.meta` / `data.inlineEnums`（大写字为首字母的键恒 `undefined`）
- ★ **（已闭环）`InlineEnums` 的"键"曾被全局 camelize 破坏**：`Enum.X` → `enum.X` 与 `RefLovCode` 值对不上 → `refLovCode` 列翻译恒失效（显示原始 0/1/2）；**2026-09 camelize 已移除，根因消除**，`useLov` 另留大小写不敏感复原兜底
- ★ 非实体端点 `GetMenuTree` 带 `/api` 前缀；Mock/代理不匹配前缀会落到实体正则 → 404 → 菜单空
- LIST 型值集模板已有：`assets/core/components/cube/LovListField.vue`（TDesign 版，勿再手搓）
- 值集弹窗选择列用 TDesign 内置 `row-select`（受控），**不需要** Element Plus 版的 `restoringSelection` 守卫
- 值集弹窗行点击事件签名是单 context 对象（不是 `(e, ctx)` 双参）
- TDesign t-input 根在无 prefix/suffix 时就是 input 元素本身，class 挂 input 上
- TDesign form item 类名是 `.t-form__item`（BEM 风格），不是 `.t-form-item`
- TDesign dialog 关闭后仍在 DOM 且**无** `t-dialog--hidden` 类 → 判定可见性必须用 `getBoundingClientRect().width>0`
- NewLife.Cube 6.13.2026.802 NuGet 运行库的 `LovListConfig` 实体没有 `ProxyRequest` 属性
- `Lov/Meta` 端点 LIST 型键是 `data.meta`（小写），ENUM 型是 `data.Meta`（大写）——并存是历史约定
- ★★ **CDP 连续点开两个 t-select 必踩 stale-popup**：`.t-popup` 关闭不卸载，「全局首个可见选项」会误点上一下拉残留 → 必须取「最后一个可见 popup」内首项（2026-09 父子表验收实测）

**条目全文**：

- **★ `/api/Admin/Lov/Meta` 响应 `data` 下键是小写驼峰（`meta` / `inlineEnums`），读 `r.data.Meta` 恒 `undefined`（2026-09 口径修正）**：该响应形如 `{ code:0, data:{ meta:[...], inlineEnums:null }, traceId }`——**`data` 下的键全部小写驼峰**，由后端 `System.Text.Json` 的 Web 序列化策略产生，**与前端无关**（`http` 层已无全局 `camelize`，见上）。历史缺陷：`useLov.load()` 曾只读 `r.data.Meta` / `r.data.InlineEnums` → 值集永远拉不到、`lovListConfig` 一直空 → LIST 型字段退化成普通下拉/text，且**不报错**（静默失效，最难查）。**正确写法**：`const metaArr = Array.isArray(r.data) ? r.data : (r.data.meta ?? r.data.Meta)`；`const inline = r.data.inlineEnums ?? r.data.InlineEnums`（大小写两侧兜底，已落地）。通用规律：**读后端信封内的键，一律用小写驼峰**；`meta` 每项为 `{ lovCode, type:"ENUM", name, options:[{ value:"0", label:"本地创建", extra:null }] }`，**`value` 是字符串**（`labelOf` 须 `String(o.value)===String(value)` 兼容数字），单码与逗号批量（`?lovCode=A,B`）均可用。**调用点写 `getApi('/Admin/Lov/Meta?lovCode=...')`（不带 `/api`）**——`useLov` 走 `http` 实例，`baseURL` 已含 `/api`（铁律 H2）。

- **★（已闭环）历史缺陷：全局 camelize 会把 `InlineEnums` 的"键"也小写，导致 `refLovCode` 列字典翻译恒失效（2026-09 实测 B5 → 同月修复）**：旧版 `http` 响应拦截器对整个信封 camelize 只把**首字母**小写，使内联枚举字典的键 `Enum.Admin.RoleKind` → `enum.Admin.RoleKind`；而字段描述符里 `RefLovCode` 的**值**（`'Enum.Admin.RoleKind'`）是普通字符串、保持原样 → `inlineEnums['Enum.Admin.RoleKind']` 恒 `undefined` → 该列**永远显示原始值**（`1`/`2`）且不报错。**现状（2026-09 口径变更）**：**全局 camelize 已从 `http` 层移除**，键保持原样、缺陷根因消除；同时 `useLov` 保留了「按本次请求规范 lovCode 大小写不敏感复原键」的兜底（`codes.find(c => c.toLowerCase() === rawKey.toLowerCase()) ?? rawKey`），双保险。**验收**：任何 `refLovCode` 列必须实测出中文（LovListField 的 `textOf` 走同一字典）。注意：LovListField **不需要**改（它按 `col.refLovCode` 原值查字典，字典键复原后即命中）。

- **★（2026-09-13 口径反转）非实体端点 `GetMenuTree` **不带** `/api` 前缀；写成带前缀 / Mock 只匹配带前缀路径 → 404 → 侧栏恒空**：前端唯一 HTTP 层调 `getRaw('/Admin/Index/GetMenuTree')`（**无 `/api`**），实测 `GET /api/Admin/Index/GetMenuTree` → **404**、`GET /Admin/Index/GetMenuTree` → **200**（9475 字节 / 3 个一级菜单）。若 Mock 写成 `if (path === '/api/Admin/Index/GetMenuTree')`，则该请求不命中 → 落入实体路由正则 `^/api/([^/]+)/([^/]+)(?:/([^/]+))?$`（解析成 `area=Admin, ctrl=Index, id=GetMenuTree`）→ `handleGetPage` 404 → `MenuSidebar` 静默忽略 → **DOM 里没有任何菜单项**（`document.querySelectorAll('.t-menu__item').length === 0`）。另有一类**更隐蔽**的失败：**vite 漏配 `'^/Admin/Index/'` 代理** → 请求落 SPA 兜底、返回 `text/html` 的 index.html → axios 解析失败但**无 401/404**，菜单同样静默为空。**修复**：前端路径去掉 `/api`；Mock/代理两种前缀都接受（便于对照）；vite 加正则代理。**排障口诀**：菜单空且控制台无红错 → ① curl 后端根路径（200 就对了）② curl 前端 5173 该路径看 `Content-Type`（`text/html` = 代理没配上；`application/json` = 代理 OK）③ 401 是令牌头问题 ④ 200 且 CT 正确但 DOM 空才是渲染/配色问题。

- **LIST 型值集模板已有：`assets/core/components/cube/LovListField.vue`（TDesign 版，勿再手搓）**：移植自 NewLife.Cube 官方 Element Plus 实现 `LovSelectTable.vue`（461 行），保留其全部功能契约（搜索栏 / 单选·多选选择列 / 分页 / 底部「已选 N 项」/ 取消·确定 / `modelValue` 回显 / `refLovCode` 列字典翻译 / **id→名称展示回显**），并按 TDesign 惯例重写。落地：拷到 `src/components/cube/`，配合 `assets/core/api/useLov.ts`，`controlOf` 出 `'lov-list'`、`FormDialog` 挂模板分支（只 import 不挂 = 死代码）。端到端验证走 scaffold 的 DEV 路由 `/lov-demo`（`npm run mock` 起 Mock 后端，已实现 `/api/Admin/Lov/Meta` 与 ListData 代理，24 行数据供跨页验证）。**选中即自关闭**（单选 `pickRow` / 多选 `onConfirm` 都在 emit 后 `close()`；官方实现交由父组件关闭——如需该契约删 `close()`）。
  - **⚠️ 资产分类（2026-09 修订）**：`useLov.ts` 与 `LovListField.vue` 已从 `assets/optional/` **移入 `assets/core/`**——因为 `core` 的 `FormDialog.vue` 对它们**静态 import**，只拷 core 会构建失败（与 `ConfigView`/`DbView` 同一判定标准）。
  - **★ 只读框显示名称、提交存 id**：`select`/`confirm` 的载荷是**对象** `{ value, display, rows }`（不再是裸 `row` / `string[]`）——`display` 是按 `meta.labelField`（缺省 `name`）拼出的名称串。宿主应把 `display` 渲染到只读输入框、`value` 存进模型。组件内部维护 `rowPool` 行缓存，使**跨页已选行**也能解析出名称。编辑态回显：宿主按 id 反查行（本地字典优先，否则整表取数匹配），**不要**把 id 直接显示给用户。

- **值集弹窗选择列用 TDesign 内置 `row-select`（受控），因此不需要 Element Plus 版的 `restoringSelection` 守卫**：官方 Element Plus 实现踩过一个坑——`restoreSelection()` 用 `toggleRowSelection()` 重放勾选时，`el-table` 的 `@selection-change` **只回传"本次重放的当前页行"**，把权威集合 `selectedValues`（含跨页/未加载项）裁掉 → 现象是「翻页后已选数不对 / 点了才更新 / 重开弹窗回显不全」。修法是加 `restoringSelection` 守卫 + 重放不回写。**TDesign 版结构上不存在该 bug 类**：选择列是受控的，勾选视图完全由 `:selected-row-keys="selectedKeys"` 派生，`@select-change` 只在真实用户操作时触发（程序化改 prop 不会回抛事件）。写 TDesign 版时**不要照抄守卫**（会变成空转死代码）；反向地，若在 Element Plus 项目里复用这套思路，也**不要**丢掉守卫。

- **LIST 型值集行点击事件签名是单 context 对象（不是 `(e, ctx)` 双参）**：TDesign Vue Next 的 `t-table` 事件 `row-click` / `row-dblclick` 回调参数是**单个** `RowEventContext` 对象 `{ row, index, e }`（类型定义实测，无 `rowIndex`），**不是** `onRowClick(_e, ctx)` 这种「事件对象 + context」双参。若组件写 `function selectRow(_e, ctx) { selected.value = ctx?.row }` —— `_e` 实际是 context 对象、`ctx` 是 `undefined`，**选中行永远不生效**。**正确写法**：`function selectRow(ctx: RowEventContext) { selected.value = ctx?.row || null }`（单参即可）。同理 `rowClassName` 的参数也是单对象 `{ row, rowIndex, rowKey?, type? }`，`onSelectChange(selectedRowKeys, options)` 才是双参。

- **TDesign t-input 根在无 prefix/suffix 时就是 input 元素本身，class 挂 input 上**：与 `<input class="..."/>` 原生 input 行为一致——`<t-input class="lov-display" :model-value="..." readonly />` 实际渲染为 `<input class="t-input t-input--readonly lov-display t-input__inner" ... />`，**根就是 input 元素**而非 div 包裹。CDP 验收取 value 用 `input.t-input__inner` 直接取 `.value`，**不要** `div.lov-display input`（找不到，因没有外层 div.lov-display）。`@click="open"` 监听原生 input 的 click 即可触发弹窗。带 prefix/suffix 模板时 TDesign 会插入 `.t-input__wrap` 容器结构，此时 class 挂在外层 div——按需调整选择器。

- **TDesign form item 类名是 `.t-form__item`（BEM 风格），不是 `.t-form-item`**：CDP 验收用 `document.querySelectorAll('.t-form__item')` 取表单项（含 label `.t-form__label`）。`fieldRender` 与 `FormDialog` 模板不直接使用类名（用 TDesign 组件），故源码无碍；CDP 验收脚本写错类名会导致「表单已渲染但选择器返回 0」误判。FormDialog 找「新增」/「编辑」弹窗靠 `.t-dialog__header` 文本严格匹配；值集弹窗靠 header 含「值集弹窗」关键字。

- **TDesign dialog 隐藏时仍留在 DOM（无 `t-dialog--hidden` 类），判定可见性必须用尺寸**：`t-dialog` 关闭后 **DOM 节点不消失**（`destroyOnClose` 只销毁内容/未开过的弹窗），**也没有 `t-dialog--hidden` 类**——实测可见弹窗与隐藏弹窗的 className 完全相同，唯一区别是 `getBoundingClientRect()`：可见 `width/height > 0`，隐藏 **`0×0`**。CDP 验收判定弹窗可见/已关闭**必须**用 `d.getBoundingClientRect().width > 0`，**不能**用 `!d.classList.contains('t-dialog--hidden')`（该判断恒真 → 会把隐藏弹窗当成打开，导致「点确定后弹窗未关闭」「找不到输入框」等误判）。**尤其当同一页面有多个标题相同的弹窗**（如两个 lov-list 字段引用同一 LovCode ⇒ 标题都是「选择 角色（前端直连）」）时，靠 header 文本无法区分，必须叠加尺寸过滤：`[...document.querySelectorAll('.t-dialog')].filter(d=>d.getBoundingClientRect().width>0).find(d=>headerText.includes(...))`。

- **NewLife.Cube 6.13.2026.802 NuGet 运行库的 `LovListConfig` 实体没有 `ProxyRequest` 属性**（cube_src master 源码有该字段）。若按 master 示例写 `new LovListConfig { ..., ProxyRequest = false }` 会报 CS0117。**正确做法**：直接**不写** `ProxyRequest`（运行库缺省 false，含义即「前端直连 requestUrl」）。`Program.cs` 未调 `AddCubeLov()` 的话，`ILovListDataProxy`/`IHttpClientFactory` 未注册 → 服务端 `/Admin/Lov/ListData` 代理必然失败——演示值集**必须**前端直连同应用实体列表（`requestUrl=/WeCom/Class`），范式对齐官方 `CubeDemo.Areas.Test.Controllers.TestFieldController`（`[LovList]` 标注 + `ProxyRequest=false` + 静态构造 `SetLov`）。不要尝试 `xcode` 重新生成实体来「修复」——运行库不会自动追加该属性。

- **`Lov/Meta` 端点 LIST 型键是 `data.meta`（小写），ENUM 型是 `data.Meta`（大写）——并存是历史约定**：`useLookups.fetchLovMeta`（ENUM 路径）取 `env.data.Meta[].Options`，`lov.ts.fetchLovListMeta`（LIST 路径）取 `env.data.meta[].type==='LIST'`。两者**不要互相抄写**——混用会找不到数据。开发时**实测一次**确认当前端点 JSON 结构（curl + token），不要凭印象。

- ★★ **CDP 同一弹窗内连续点开两个 `<t-select>` 必踩 stale-popup：选项必须从「最后一个可见 popup」里取（2026-09 父子表验收实测，13/17→17/17）**：写验收脚本时用 `[...document.querySelectorAll('.t-select-option,.t-option,.t-popup li')].find(e=>e.getBoundingClientRect().width>0)` 取「全局首个可见选项」，在**只开过一个**下拉时碰巧正确；一旦同一弹窗内**先后点开两个**下拉（如先选「仓库」再选「单据类型」），第二个下拉打开的瞬间 DOM 里会**同时存在两个可见 `.t-popup`**——第一个是上一个 select 刚关闭的残留（探针转储实证：索引0=「总务仓库」宽494 仍可见，索引1=「采购入库」才是刚打开的目标）。「全局 find 首个可见」命中残留 → **值填错且无任何报错**（单据类型被选成了仓库名）。根因：TDesign 的 `.t-select__dropdown` 关闭只做 `display:none`/`visibility:hidden`，**不卸载、不复位挂载顺序**，重开时新 popup 追加在后。**正确策略（三段式）**：① 等就绪——`[...document.querySelectorAll('.t-popup')].filter(p=>p.getBoundingClientRect().width>0)` 非空**且最后一个内有可见选项**；② 选点——在**最后一个**可见 popup 内部 `querySelectorAll('.t-select-option,.t-option,li')` 取首个可见项 `.click()`；③ 定位触发元素用 `t-form-item__<字段名>` class（如 `.t-dialog .t-form-item__warehouseID .t-select input`，FormDialog 渲染时自带），比 label 文本匹配稳（文本有全半角/空格/别名坑）。同理适用于任意「关闭不卸载」的浮层组件（tooltip 除外）。**判据**：若验收出现「A 字段的值出现在 B 字段」类串扰，先转储 `document.querySelectorAll('.t-popup')` 的宽高/可见性再下结论。
