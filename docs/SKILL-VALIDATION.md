# 技能验证报告：设备台账示例

## 复测结论：干净通过

最后一轮完整验证没有再发现新的技能缺陷。对照的是技能修正分支 `cursor/skill-fix-from-ledger-validation-7836` 的 `ed47602a7d2c7f27af3203bbe1fd82d45ee94326`，不是最初的 `main` `756c85af1467af8432b8bce6dd16e2115add3be4`。下面第 1–4 节保留第一次对着 `main` 的记录，没有删。

最后一轮（技能提交 `ed47602` 之后，2026-10-04）：

| 检查 | 结果 |
|---|---|
| `dotnet build --no-incremental` | 成功。0 错误，6 警告：`LedgerArea` 的 `TrimEnd` CS0618，实体 CS8601，未使用的 `MaxCacheCount`。模板不在本仓库，示例未改生成代码 |
| `npm run build`（Node v22.22.2，满足技能 `engines.node` `>=22.22.1`） | 退出码 0。`vue-tsc` 无错误。vite 8.1.5。`tdesign` 分包 6,821.55 kB，大于 500 kB 的警告仍在，与技能「属预期」一致 |
| `node check-all.mjs <web>`（含 `tri-diff`，不再加 `--no-tridiff`） | 7 个闸门全部 PASS |
| `POST /Auth/Login`，`username` 与 `userName` 各一次 | 都是 HTTP 200，`code: 0`，`expire_in: 0`，令牌键 snake_case |
| `GET /api/Admin/Index/GetMenuTree` | HTTP 200，含 `Ledger` |
| `GET /Admin/Index/GetMenuTree`（不带 `/api`） | Kestrel HTTP 404。经 Vite（3002）则是 SPA 的 `index.html`（200 + `text/html`），请求没有进后端 |
| 无令牌 `GET /api/Ledger/Equipment` | HTTP 401，`code: 401` |
| 列表 / 新增 / `GET Detail` / `PUT` / 再 `GET Detail` / `DELETE` | 行键 camelCase（`id`/`categoryID`/`purchasedDate`）。`PUT` 之后的 `GET Detail` 仍保留原来的 `createTime`。`GetFields.name` 仍是 PascalCase（`Id`/`CategoryName`） |
| `GET /Auth/LoginConfig` | `name` 为「设备台账」。`copyright`、`loginTip` 为 null。`registration` 为「沪ICP备10000000号」。供应商键名是 `oAuth` |
| 经 `http://127.0.0.1:3002` 代理登录 | HTTP 200，`code: 0` |

### 中间轮次：技能分支上修了什么

这些提交只在技能 PR，没有把示例工程放进去。

1. `71402cc`、`e307e47`：`deployment.md` 仍要求删掉 `Provider=sqlite` 且 `Busy Timeout=15000`；后端菜单铁律仍写不带 `/api` 的 `GetMenuTree`；§14.5 仍是 15000；前端工具链仍把 `.husky` 写成现行 CLI 必有；排障仍教无 `/api` 菜单、代理正则 `^/Admin/Index/`、缺 husky 算 FAIL、文件数 31/55。
2. `e29258d`：排障里的 `Busy Timeout=15000` 和少了 `/Sso`、`/Cube` 的代理清单；`cube-page-catalog.md` 把实测会 302 的 `/Cube/MenuTree` 写成菜单权威；把 6.15 的行 JSON 写成当前就是 PascalCase；CLI 现行文件数仍写 193；`scripts/README.md` 仍把缺 `.husky/` 写成 WARN；登录体 `username` / `userName` 两条都能 200，`LoginConfig` 的键是 `oAuth`。
3. `ed47602`：多处「一次拷 31 件」改成 38 个文件；`scaffold/README.md` 仍写登录体「不是 `userName`」。

第 3 轮提交之后又做了一轮完整构建、HTTP 和 `check-all`。没有再出现同一类「步骤和实测相反」的新缺陷，所以停在干净通过，没有开第 4 轮。

### 中间轮次：示例分支上修了什么

只在 `cursor/equipment-ledger-sample-7836`：

- `src/api/token.ts`、`src/stores/auth.ts` 与更新后的 `assets/core` 对齐（注释：`expire_in` 为 0 不是登录失败）。`LoginView.vue` 的 `PROJECT` 定制保留。
- `web/package.json` 的 `engines.node` 改为 `>=22.22.1`。
- README 改掉「缺 husky 仍是 2 条 WARN」「engines 仍是 22.12」「`Cube.config` 里的 JwtSecret 就是运行时密钥」这几句。本机首次启动写入 Membership `Parameter` 的是随机 `JwtSecret`，不是文件里的演示串。

### 仍然故意没做

报告第 4 节的 P2 没有纳入技能 PR，本轮也没有把它们当成新缺陷重开：`example-iothub` 短分类示例、5 个零引用声明文件改成非零退出、排障旁补 Linux `pkill`。`scan-assets-dead` 对那 5 个文件仍只打印、退出码 0。外部技能 `project-architecture`、`xcode-data-modeling`、`cube-mvc-backend` 和 xcodetool 模板仍不在本仓库。

---

验证对象是本仓库 `main` 上的两份技能，提交 `756c85af1467af8432b8bce6dd16e2115add3be4`：

- `cube-webapi-backend/SKILL.md` 及其 `references/`
- `cube-webapi-tdesign/SKILL.md` 及其 `references/`、`assets/`

示例代码在 `examples/equipment-ledger/`。本报告不修改技能文件。环境：Ubuntu 24.04，.NET SDK 8.0.425，Node 22.22.2（系统默认 `node` 曾是 22.14.0），npm 10.9.7。

## 1. 做了什么，验证了什么

两层单项目后端 `EquipmentLedger.Web`（net8.0），外加官方 CLI 生成的前端 `web/`。业务区名 `Ledger`，避免和实体名 `Equipment` 前缀撞车，也避开技能点名的框架前缀 `Auth` / `Cube` / `Sso` / `Mfa`。

| 产物 | 做法 |
|---|---|
| 数据模型 | `Entities/Model.xml`：`EquipmentCategory`、`Equipment`（名称、编码、分类外键、位置、状态枚举、购置日期、审计字段） |
| 代码生成 | `dotnet tool install -g xcodetool --version 11.25.2026.901`，在模型目录执行 `xcode Model.xml` |
| 业务补充 | 分类与设备的 `InitData` 种子；设备控制器静态构造 `SetLov`；两个控制器 `EnableFieldValidation => true` |
| 启动 | `AddControllers` + `AddCube` + `AddCubeLov` + `UseCube` + `UseCubeLov`；`ITracer` / `ILog` 注册在 `AddCube` 之后；开发环境 Swagger 挂 `/Swagger` |
| 前端 | `printf '\n' \| npx --yes tdesign-starter-cli@0.5.3 init web -type vue3 -temp all`，再按 §4.1 删除上游演示代码、去掉 `prepare`、拷入 `assets/core` 与 `references/scaffold` |
| 登录文案 | 只改 `LoginView.vue` 的 `PROJECT` 常量与 `index.html` 标题。账号密码不预填 |

依赖版本（技能正文没有 `PackageReference` 版本号，取技能里写过「实测」的稳定包）：

- `NewLife.Cube` 6.15.2026.901（技能 §7.2 写 6.15.2026.0901）
- 传递依赖 `NewLife.XCode` 12.2.2026.901
- `Swashbuckle.AspNetCore` 6.9.0（技能只写包名）
- `xcodetool` 11.25.2026.901（与上述 XCode 同日稳定版）

### 命令与结果

| 命令 | 结果 |
|---|---|
| `dotnet build examples/equipment-ledger/EquipmentLedger.Web/EquipmentLedger.Web.csproj` | 成功，0 错误，6 警告（生成代码：`TrimEnd` 过时、CS8601、未使用字段） |
| `printf '\n' \| npx --yes tdesign-starter-cli@0.5.3 init web -type vue3 -temp all` | 退出码 0。`find -type f` 为 **173**。技能写「193 件」 |
| `npm install --no-audit --no-fund`（Node 22.14.0） | 失败：`lint-staged@17.0.8` 要求 Node `>=22.22.1`，`EBADENGINE` |
| 同上，Node 22.22.2 | 成功，`added 882 packages`。技能写 880 |
| `node cube-webapi-tdesign/references/scripts/check-starter-align.mjs examples/equipment-ledger/web` | 退出码 0。0 FAIL，2 WARN：缺 `.husky/`、`.vscode/` |
| `node .../check-assets-copied.mjs examples/equipment-ledger/web` | 退出码 0。37 通过，0 缺失。`LoginView.vue` 的 `PROJECT` 被识别为预期定制 |
| `npm run build`（`vue-tsc --noEmit && vite build --mode release`） | 退出码 0。`vue-tsc` 无错误。vite 8.1.5，约 4.3s。`tdesign` 分包 6,821.55 kB，并有 >500 kB 警告（技能称属预期） |
| `node .../check-all.mjs <web> --no-tridiff` | 退出码 1。唯一 FAIL 是 `scan-assets-dead`（见第 3 节）。其余列出的闸门 PASS |
| `ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://127.0.0.1:5052` | 进程起来，`Hosting environment: Development` |
| `POST /Auth/Login` `{"username":"admin","password":"admin"}` | HTTP 200，`code: 0`，`data.access_token` / `refresh_token` / `expire_in`。`expire_in` 实测为 **0**，JWT 的 `exp-iat` 为 7200 秒 |
| `GET /api/Ledger/Equipment` 无令牌 | HTTP **401**，`{"code":401,"message":"没有登录或登录超时！"}` |
| 带 Bearer 的设备列表 | HTTP 200，`totalCount: 2`，两行种子，`categoryName` 有值 |
| `GET /api/Ledger/Equipment/GetPage` | `lovCode=Enum.EquipmentLedger.Web.Entities.EquipmentStatus`；`CategoryName.mapField=CategoryID` |
| `GET /api/Ledger/Equipment/GetFields?kind=1` 匿名 | HTTP 200，`code: 0`，11 个字段 |
| `POST` / `PUT` / `DELETE /api/Ledger/Equipment` | 均为 HTTP 200，`code: 0`（添加成功 / 保存成功 / 删除成功） |
| `GET /api/Admin/Index/GetMenuTree` | HTTP 200。一级节点 `Ledger`（设备、设备分类）、`Admin`、`Cube`。未在前端写业务菜单 |
| `GET /Auth/LoginConfig` | `name` 为「设备台账」（`Config/Sys.config` 的 `DisplayName` 生效）。`copyright`、`loginTip` 为 null。`registration` 为「沪ICP备10000000号」。`oAuth` 含「新生命用户中心」 |
| `npm run dev:linux` 后经 `http://127.0.0.1:3002` 代理登录与菜单 | 登录 `code: 0`；菜单 `content-type: application/json`，区域 `Ledger` / `Admin` / `Cube` |

数据库文件落在 `EquipmentLedger.Web/bin/Debug/net8.0/Data/`，不在工程目录。这些 `*.db` 已加入仓库 `.gitignore`。

没有在浏览器里点登录页和表格。本环境没有现成的浏览器验收工具。界面结构沿用技能的 `LoginView`、`BasicLayout`、`ListPage`、`EntityPage`，只改了登录左栏文案和页面标题。列表、表单、搜索、分类下拉是否在屏幕上可用，没有逐控件点过。

## 2. 技能写清楚、并且这次够用的部分

后端：

- 纯 WebApi 的启动顺序（`AddControllers`、`AddCube`、其后注册 `ITracer`/`ILog`、`UseCube`、不要手写 `InitAll`、不要引用 AdminLTE）按原文编译通过并能启动。
- 控制器选型表够用：设备与分类都是 `EntityController<T>`。区域类、`[Menu]`、`[DisplayName]`、静态构造里改字段，生成器已经给出骨架，补 `SetLov` 后 `GetPage` 真的带上 `lovCode`。
- `xcode Model.xml` 会生成实体、Biz、数据字典、区域类和两个控制器。`Map="EquipmentCategory@Id@Name@CategoryName"` 生成了 `CategoryName`，列表 JSON 里能看到分类名称。
- 连接串必须写成 `Data Source=`（带空格）。按 §14.8 写了 WAL 与 `Busy Timeout=30000` 后，四张库都建出来了。
- `Config/Sys.config` + csproj `CopyToOutputDirectory` 这条是对的：登录配置里的系统名是「设备台账」，不是程序集名。
- `JwtSecret` 用 `HS256:` 两段写在 `Config/Cube.config` 后，登录令牌可以被后续接口接受。
- 路由契约够用：`GET/POST/PUT /api/Ledger/Equipment`，删除 `DELETE ...?id=`，详情元数据与数据行不是同一个 URL。
- 枚举要显式 `SetLov`、外键字段名 `xxxID`、不要把 `Map` 指到 `Department` 这种 `EntityTree`。这三条按着做，编译和 `GetPage` 都过了。
- 匿名 `GetFields` 与需登录的列表，边界和技能一致。

前端：

- 「先 CLI `-temp all`，再删上游演示，再删 `prepare`，再三步拷贝」这条链路能得到可编译工程。`printf '\n' |` 非交互选择「全部」在本机退出码 0，技能对旧结论的更正是对的。
- `check-starter-align.mjs` 与 `check-assets-copied.mjs` 能在 Linux 上直接跑，登录页 `PROJECT` 定制被豁免逻辑认出来了。
- 代理按脚手架 `vite.config.ts`：`/api`、`/Auth`、`/Mfa`、`/Sso`、`/Cube`、`/cube`、`/Content`，目标 `127.0.0.1:5052`。经开发服务器转发的登录和菜单是 JSON，不是 `index.html`。
- 菜单不在前端硬编码。泛型路由 `entity/:area/:controller` 足够覆盖设备和分类，没有另写业务页。
- `npm run build` 使用 `rolldownOptions.output.codeSplitting`，`vue-tsc` 0 错误。技能关于 vite 8 不能写对象式 `manualChunks` 的说明，和这份 `package.json` 一致。
- 登录铁律 L2/L3/L4 在模板里已经做到：空账号、不展示接口路径、表单没有租户字段。L1 只要改 `PROJECT`。

分层：技能要求先读 `project-architecture`。该技能对「两张表的小项目用单项目两层、控制器直接调实体」的判断，和这个示例匹配。没有抽 Service。

## 3. 具体失败、矛盾和做不到的步骤

下面每条都是这次按原文做时撞上的，不是推测。

### 3.1 仓库里没有元流程点名的技能

`cube-webapi-backend` 元流程 ①② 要求 `project-architecture` 和 `xcode-data-modeling`，字段定制还指向 `cube-mvc-backend`。这三份都不在本仓库。技能写的补齐方式是从 `https://github.com/NewLifeX/NewLife.Skills` 的 `.github/skills/` 拷到本机技能目录，并给出 Windows 的 WorkBuddy / Copilot 路径。只克隆本仓库的代理不能从仓库内读到它们。本次是在运行环境的用户技能目录里读到的，不是本仓库提供的。

### 3.2 生成器会改模型，并在结束时自行升级到预发布版

`xcode-data-modeling` 给出的 `Model.xml` 示例没有 `ModelVersion`。对同样没有版本号的文件执行 `xcode Model.xml` 时日志是：

`检测到旧版本模型文件(无版本号)，自动启用中文文件名`

随后工具改写了 `Model.xml`：补上 `ModelVersion`，把 `<ChineseFileName>False</ChineseFileName>` 改成 `True`，并删掉部分 `Length`。实体文件名变成 `设备.cs`、`设备分类.cs`。技能示例把 `ChineseFileName` 设为 `True` 只是示例，没有说明「无版本号会被强制改成中文文件名」。

同一次运行在生成**之后**执行了 `dotnet tool update xcodetool -g --prerelease`，把刚装的 11.25.2026.901 升到 `11.25.2026.912-beta0916`。技能没有写这条副作用。代理若再次生成，用的将是预发布工具，而不是刚才验证过的稳定版。

生成代码还有技能未写的编译警告：`LedgerArea` 里 `TrimEnd("Area")` 标记过时（CS0618）；实体里 CS8601。构建能过，但「编译错误清零」没有覆盖这些警告。

### 3.3 包版本、目标框架、Node 版本没有钉死

- 后端技能的 `Program.cs` 片段没有包版本，也没有说 `net8.0` 还是 `net10.0`。NuGet 上 `NewLife.Cube` 6.15.2026.901 同时包含 net6 到 net10。另有更新的 beta `6.15.2026.1002-beta1649`。技能多处版本号写法也不统一（`6.13.2026.802`、`6.15.2026.0901`、XCode `12.1.2026.801` 与 `12.2.2026.901`）。
- `Swashbuckle.AspNetCore` 只写了 `dotnet add package`，没有版本。本次用 6.9.0，在 net8 上能编译。
- 前端技能写 Node ≥ 18。脚手架 `package.json` 的 `engines` 是 `>=22.12.0`。实际 `lint-staged@17.0.8` 要求 `>=22.22.1`。Node 22.14 安装直接失败。三条口径互相不一致。
- §4.1 命令先写 `pnpm install`。§4.1.1 又写作者 Windows 上 pnpm 链接阶段挂死，可行路径是 `npm install --no-audit --no-fund --prefer-offline`。本次按后一条做，npm 成功。没有再试 pnpm。

### 3.4 连接串、路径、端口，三处各写各的

| 位置 | 写法 | 本次实测 |
|---|---|---|
| 后端 §1.2 示例 | `DataSource=..\\Data\\Membership.db`（无空格、反斜杠） | 未采用。§14.8 说这种写法不建表 |
| 后端 §1.2 说明 | 相对路径相对**进程工作目录** | 不成立 |
| 后端 §14.8 | `Data Source=`（有空格） | 采用后能建表 |
| 前端排障 G11 | 相对路径相对 `AppContext.BaseDirectory`（bin 输出目录） | **成立**。库在 `bin/Debug/net8.0/Data/` |

端口：后端技能冒烟示例是 `127.0.0.1:5077`。前端脚手架默认代理是 `127.0.0.1:5052`，注释还写这是后端脚手架的默认端口。后端技能里没有 5052。本次把后端听在 5052，这样前端可以不改代理。

`dotnet run` 不带环境变量时技能说默认 Production，从而没有 Swagger。`dotnet new web` 生成的 `launchSettings.json` 已经带 `ASPNETCORE_ENVIRONMENT=Development`，但端口是模板随机的 `localhost:5200`。技能没有说要改这个文件。本次改成 `http://127.0.0.1:5052` 且不自动打开浏览器。

### 3.5 登录与 JSON 契约，文档和 6.15.2026.901 的 HTTP 响应不一致

实测 `POST /Auth/Login` 成功体是 snake_case：`access_token`、`refresh_token`、`expire_in`。这一点和后端 §14.1、前端 `auth.ts` 注释一致。但 `expire_in` 的值是 0，而令牌内部有效期是 7200 秒。技能没有说 `expire_in` 可以为 0，前端若把 0 当成「已过期」会把刚登录的用户弹回登录页。本次没有在浏览器里验证这条。

列表 JSON 键名是 camelCase（`id`、`categoryID`、`purchasedDate`）。后端 §14.2 写「响应体 PascalCase，旧文档误述 FastJson CamelCase」。对 6.15.2026.901 这条是反的：旧文档的 CamelCase 才符合这次响应。前端资产靠 `normalizeRows` 再转一次，camelCase 输入下多半仍能工作，但技能把 PascalCase 写成唯一事实，会让人去改一个已经是 camelCase 的接口。

未登录访问 `GET /api/Ledger/Equipment` 得到 HTTP 401 和 `code: 401`。技能 §3.2 写未认证由基类返回 `code: 403` 且 **HTTP 仍是 200**。§6.5 又写未登录是 `code: 401`。本次实体列表符合 401 这一支，不符合「HTTP 200」这一支。

`GET /Auth/LoginConfig`：

- `name` 来自 `Sys.config` 的 `DisplayName`，符合 §1.3。
- `Config/Cube.config` 里写了 `Copyright` 和 `LoginTip`，响应里仍是 null。技能把这两项列为 `Cube.config` 的最小骨架，但没有说登录配置接口不读它们。
- `registration` 固定出现「沪ICP备10000000号」。这是框架内置占位，技能没写，示例也无法从 `Cube.config` 里把它清掉（至少这次清不掉）。
- 未配置任何第三方登录，响应仍带 `oAuth: [{ name: NewLife, nickName: 新生命用户中心 }]`。完整版登录页会把它画出来。

技能 §7 写「首个进入系统的用户自动成为管理员，原 admin 被禁用」。本次用种子 `admin` / `admin` 可以登录，没有观察到原管理员被禁用。

### 3.6 整实体 PUT 的警告，响应和库不一致

按技能警告，PUT 未带的字段会被重置。对新建行做了一次只带业务字段的 PUT：响应里 `createUser` 为 null、`createTime` 为 `0001-01-01`。紧接着 DELETE 同一 `id`，返回体里的 `createUser` 仍是「管理员」、`createTime` 仍是插入时间。技能没有说明该相信响应体还是落库结果。本次不能据此断定审计字段已被写坏，也不能断定警告已过时。

### 3.7 前端技能里的件数、文件清单和脚本路径是作者机器上的

- 技能写 CLI `all` 为 193 件。本次 `find -type f` 是 173，且没有 `.husky/`、`.vscode/`。校验脚本把这两项目标为 WARN。技能说缺一即 WARN，并要求在 README 声明。已在示例 README 声明：不是有意裁剪，是 CLI 没生成。
- 技能写 `assets/core` 31 件、`scaffold/src` 55 件（31+24）。仓库里实际是 core **38** 个文件、`references/scaffold/src` **62** 个文件。拷贝后 `web/src` 也是 62，与脚手架目录一致，与正文数字不一致。
- 技能写注册页和找回密码页只在已归档的 lite demo 里，`core` 与 scaffold 都不提供。当前 `references/scaffold/src/pages/` 里有 `RegisterView.vue`、`ForgotPasswordView.vue`，路由也引用它们。正文过时，代码是自洽的。
- 铁律表仍写代理要包含 `'^/Admin/Index/'`。同文件 H3 正文说这条已删除。脚手架 `vite.config.ts` 没有这条。按脚手架做是对的，按铁律表做会把人带回去。
- `references/scripts/scan-assets-dead.mjs` 第 9 行：

  `const ROOT = process.env.SKILL_DIR || 'C:/Users/admin/.workbuddy/skills/cube-webapi-tdesign'`

  `check-all.mjs` 不设置 `SKILL_DIR`。在本机直接跑会 `ENOENT` 扫 `C:/Users/admin/.workbuddy/...`，`check-all` 因此 FAIL。设置 `SKILL_DIR=/workspace/cube-webapi-tdesign` 后该脚本退出码 0，但仍打印 5 个零引用文件（`global.ts`、`axios.d.ts`、`globals.d.ts`、`interface.d.ts`、`router.d.ts`）。脚本本身不因此返回非零，所以「死文件」不会让闸门变红。
- `check-all.mjs` 注释要求工程目录用 Windows 路径（`C:/proj/frontend`），并写 Git-Bash 会把 `/c/proj` 拼错。Linux 上传绝对路径 `/workspace/examples/equipment-ledger/web`，除上述死文件脚本外，其它闸门能跑。注释没有 Linux 路径。
- 技能多处排障命令是 `taskkill`、`Stop-Process`、PowerShell。Linux 上对应的是结束占用 dll 的 `dotnet` 进程。这不是功能错误，但是代理不能照抄。

### 3.8 种子数据的审计身份

`InitData` 在 `UseCube` 预热时执行，当时没有登录用户。两行演示设备的 `createUser` 是操作系统用户 `ubuntu`，`createUserID` 是 0。技能的 Biz 模板把 `InitData` 注释掉，没有说明无用户时审计字段会落成进程身份。演示数据本身在库里，列表能查到。

## 4. 建议改技能的地方（本 PR 不改技能）

按「不改就还会让下一个代理走错」的程度排序。只写该改哪个文件、改什么。

### P0

1. `cube-webapi-tdesign/references/scripts/scan-assets-dead.mjs`  
   删掉默认的 `C:/Users/admin/.workbuddy/skills/cube-webapi-tdesign`。默认根目录改为脚本所在位置上溯到技能根（`references/scripts` 的上两级）。`SKILL_DIR` 只作为可选覆盖。  
   `check-all.mjs` 调用它时不必再依赖作者本机路径。

2. `cube-webapi-tdesign/references/scripts/check-all.mjs` 文件头  
   删掉「工程目录必须是 Windows 风格」作为唯一口径。写明 Linux 绝对路径可用；Git-Bash 的 `/c/...` 问题单独作为 Windows 注记。

3. `cube-webapi-backend/SKILL.md` 第一节启动配置  
   补一段可复制的 `PackageReference`：`NewLife.Cube` 固定到一次实测的稳定版本（建议就用正文已写过的 6.15.2026.901），`Swashbuckle.AspNetCore` 写出版本，`TargetFramework` 写 `net8.0`。版本升级时改这一处，并删掉正文里并存的 6.13 / 12.1 旧实测号，或标成历史。

4. `cube-webapi-tdesign/references/scaffold/package.json` 与 `SKILL.md`「前置条件」  
   把 Node 要求收成一个数。现在正文是 ≥18，`engines` 是 ≥22.12.0，`lint-staged@17` 是 ≥22.22.1。要么把 `engines` 和正文都改成 `>=22.22.1`，要么把 `lint-staged` 降到与 `engines` 兼容的版本。

5. `cube-webapi-backend/SKILL.md` 元流程，以及 `xcode-data-modeling` 的「xcode 命令」一节（该技能不在本仓库，但本仓库技能引用了它）  
   写明：`xcode` 结束时会执行 `dotnet tool update xcodetool -g --prerelease`。给出关闭方式，或改成不自动升级。否则「指定稳定版安装」会被同一次命令抹掉。  
   同时写明：无 `ModelVersion` 的模型会被改写成中文文件名，并覆盖 `ChineseFileName`。示例 XML 要么带上当前 `ModelVersion`，要么说明这是预期重写。

6. `cube-webapi-backend/SKILL.md`「依赖的新生命团队技能」  
   写清本仓库并不包含 `project-architecture`、`xcode-data-modeling`、`cube-mvc-backend`。若希望本仓库自洽，把这三份放进仓库；若继续外置，给一个不依赖 Windows 家目录的获取方式，并在元流程里写「缺失时停止，不要手写实体冒充生成结果」。

### P1

7. `cube-webapi-backend/SKILL.md` §1.2 与 §14.8  
   删掉 `DataSource=`（无空格）和反斜杠示例。只保留实测可用的 `Data Source=Data/Membership.db;Provider=sqlite`（正斜杠）。路径基准改成与 XCode 12.2 一致的输出目录 `AppContext.BaseDirectory`，删掉「相对 CWD」或标成旧行为。把 5052 与 5077 收成一个默认端口，并和 `cube-webapi-tdesign/references/scaffold/vite.config.ts` 的 `API_TARGET` 使用同一个数。

8. `cube-webapi-backend/SKILL.md` §14.1、§14.2、§3.2  
   用 6.15.2026.901 的 HTTP 响应改写：列表与登录以外的实体 JSON 为 camelCase；未登录实体列表是 HTTP 401 + `code: 401`。若旧版本确为 PascalCase 或 HTTP 200，写成版本条件，不要两段同时当事实。  
   补一句：`expire_in` 可能为 0，前端不要用它判断令牌已过期，以 JWT `exp` 或重新请求为准。前端 `assets/core/stores/auth.ts` 若把 `expireIn === 0` 当失败，一并改掉。

9. `cube-webapi-backend/SKILL.md` §1.3 与 §7  
   `Cube.config` 的最小骨架旁注明：`GET /Auth/LoginConfig` 的 `copyright` / `loginTip` 在 6.15.2026.901 上不读这份文件（本次为 null）。写明 `registration` 的真实来源，以及如何去掉内置「沪ICP备10000000号」。写明未配置时仍会返回 NewLife OAuth 项，以及怎样不让它出现在登录页。  
   「原 admin 被禁用」若不再发生，删掉或改成当前种子账号行为：`admin` / `admin` 可用。

10. `cube-webapi-tdesign/SKILL.md`  
    - 把 193 / 31 / 55 改成与当前 `assets/core`、`references/scaffold/src` 一致的文件数，并说明计数是文件而不是「项」。  
    - 删掉「注册页 / 找回密码只在归档 demo」的说法，或把 scaffold 里的这两页移回归档。二者只能留一处。  
    - 铁律对照表里的 H3 代理清单与后文统一：不要再写 `'^/Admin/Index/'`。  
    - §4.1 的安装命令直接写 npm 实测路径；pnpm 放到「作者环境曾挂死，可试但不要当默认」。  
    - 写明 `tdesign-starter-cli@0.5.3` 若不再生成 `.husky/`、`.vscode/`，校验脚本的 WARN 清单要跟着改，避免每个新工程都在 README 里解释同一条。

11. `cube-webapi-backend/SKILL.md` §十二第 4 条（PUT 重置字段）  
    补一个 6.15 的判定方法：看随后的 `GET Detail`，不要只看 PUT 响应体。本次 PUT 响应把审计字段显示成默认值，DELETE 回读仍是原值。

### P2

12. `cube-webapi-backend/references/example-iothub.md` 或技能「新增实体」网关  
    增加一个短示例：自建分类表 + `Map` + `SetLov`，并再次写明不要 `Map` 到 `XCode.Membership.Department`。本次设备台账就是这条路径，生成器能编过。

13. 生成器模板（xcodetool，不在本仓库）  
    `LedgerArea` 的 `nameof(LedgerArea).TrimEnd("Area")` 已触发 CS0618。模板改成不会命中过时 API 的写法。Biz 里的 `InitData` 示例说明：启动期没有 `ManageProvider.User` 时，`createUser` 会变成操作系统账户。

14. `cube-webapi-tdesign/references/scripts/scan-assets-dead.mjs`  
    在默认路径修好之后，决定那 5 个 `references/scaffold/src` 下的零引用声明文件算不算失败。若算，脚本应返回非零；若不算，放进白名单。现在退出码 0，闸门看不出它们。

15. `cube-webapi-backend/SKILL.md` 排障命令  
    在 `taskkill` / `Stop-Process` 旁加 Linux：`pkill -f EquipmentLedger.Web` 或按端口结束进程。文件锁症状（MSB3027）两边都会出现。
