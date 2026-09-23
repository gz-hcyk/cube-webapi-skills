---
name: cube-webapi-backend
description: 使用 NewLife.Cube（魔方）第三代 WebApi 快速开放框架开发前后端分离的后台 REST API 时使用。适用场景：基于 EntityController/ReadOnlyEntityController/EntityTreeApiController/ControllerBaseX 暴露 /api 标准 CRUD 接口；用 GetFields/GetPage 字段元数据驱动动态列表/表单；配置 AddCube/UseCube 启动、数据层预热（EntityFactory.InitAll/InitConnection）、登录与 JWT（Auth/Login、Bearer/X-Token）；设计自定义权限体系（PermissionFlags 权限位、Menu 菜单、EntityAuthorize 鉴权、401/403）；实现数据范围权限（Role.DataScopes、IDataScope/DataScopeInterceptor、DataPermission 表达式、IFieldScope 脱敏）；多租户隔离、自定义业务权限（审批/下发指令等）、导出。触发词：魔方 WebApi、NewLife.Cube、Cube API、EntityController、GetFields、元数据驱动接口、权限位、数据权限、前后端分离后台、数据库预热、InitConnection。挂链开号场景触发词：给业务人员开登录账号、魔方建 User、初始密码、首登强制改密、批量补开账号。不适用于 MVC 服务器渲染后台（用 cube-mvc-backend）与前端页面生成（用 cube-webapi-tdesign）。触发词：生成部署包、生产部署包、发布部署包、上线部署、Linux+Nginx+systemd 反向代理、SQLite 部署、dotnet publish 跨平台、appsettings.Production、Nginx 反向代理模板、冒烟验证、新增实体验收、枚举 LOV 值集（SetLov）、外键映射字段、实体验收核查、魔方定时作业（CronJob/CubeJobBase，周期任务替代启动钩子）。
agent_created: true
argument-hint: 说明要做什么：新建 Area 并生成实体 CRUD API、控制器基类选型（CRUD/只读/树形/自定义）、定制字段元数据（GetFields/GetPage）、添加鉴权 Action 与自定义权限位、接入登录与 JWT、配置多租户与数据范围权限，还是排查 401/403/FieldErrors/路由 404 问题。
---

# Cube WebApi 快速开放框架（前后端分离 API）

> 字段定制（ListFields / AddFormFields / EditFormFields / SearchFields / DetailFields）的**完整方法速查**
> 与 ListField 扩展属性，与 MVC 版本完全一致，参见 `cube-mvc-backend` skill。本 skill 专注 WebApi 差异点：
> 路由约定、标准响应模型、字段元数据接口、鉴权与 JWT、只读/配置控制器、多租户数据权限。

第三代魔方（NewLife.Cube）的后台/实体控制器统一以 `/api` 为前缀暴露标准 REST 接口，
前端通过 **字段元数据接口（GetFields / GetPage）** 驱动动态界面，无需硬编码表单与表格。

**资源导航（本文件只载入流程与契约；细节按需读取）**：

| 需要 | 去读 |
|---|---|
| 后端全量排障（编译/路由/权限/序列化/`[Map]` 陷阱） | `references/troubleshooting.md` |
| 生产部署 Playbook（publish/Production/Nginx/systemd/README/坑） | `references/deployment.md` |
| 端到端示例（IoTHub：选型+数据范围+权限位+多租户） | `references/example-iothub.md` |
| 挂链开号（业务实体→魔方 User 登录账号、初始密码+首登强制改密、批量补开） | `references/open-account.md` |
| curl 冒烟探针脚本（登录→token→401 五步） | `references/curl-smoke.md` |
| 前端如何消费（camelize/normToken/登录页/代理） | `cube-webapi-tdesign`（前端消费契约归其职责） |

## 依赖的新生命团队技能（缺失请到仓库补齐）

本技能与以下**新生命团队技能**协同工作，若本地技能目录缺失其中任一项，请按下方方式补齐：

| 技能 | 用途 | 本技能何处引用 |
|---|---|---|
| `cube-webapi-tdesign` | 前端 TDesign 消费端（GetFields/GetPage 元数据驱动） | 元流程 ⑦、第九节、第十四节 |
| `cube-mvc-backend` | 魔方 MVC 版后台（字段定制 ListField 扩展属性速查） | 文件头字段定制说明 |
| `project-architecture` | 分层架构选型（两层起步、按需渐进三层） | 元流程 ① |
| `xcode-data-modeling` | Model.xml 数据建模（表/字段/索引/外键 Map/ShowIn） | 元流程 ② |

**仓库地址**：`https://github.com/NewLifeX/NewLife.Skills`

- 技能在仓库中的路径：`.github/skills/<技能名>/`（每个子目录含 `SKILL.md`）。
- **WorkBuddy 用户**：把缺的 `<技能名>/` 目录整目录复制到 `~/.workbuddy/skills/<技能名>/` 即可，无需重启对话（下次触发自动加载）。
- **VS Code Copilot 用户**：克隆仓库后执行 `.\scripts\install-copilot-assets.ps1`，会自动同步全部技能到 `%USERPROFILE%\.copilot\skills\`（详见仓库 README）。
- 也可直接将整个仓库克隆到本地，按需把 `.github/skills/` 下所需子目录拷入上述技能目录。

## 铁律：前端菜单必须后端动态下发（不可违反）

- **菜单唯一权威 = 后端 `GetMenuTree`**（只返回当前用户有权限节点）：前端页面菜单**必须**消费 `GET /Admin/Index/GetMenuTree` 动态生成，**不允许**在前端手工新增/硬编码业务菜单项（如前端常量表手动 push、写死菜单数组）。
- 新增某个页面的菜单入口时，**只能在后端产出菜单节点**：实体控制器/自定义 API 控制器被自动扫描后自然会带出（`~/Ctrl` 形态），或显式挂菜单；前端只做「url → 前端路由」的**映射表**（如把 `~/Reconcile` 改写为前端专用路由 `/reconcile`），**映射不算新增菜单**。
- 例外（允许内置，不视为业务菜单）：登录后默认落地页 **dashboard** 及顶部品牌跳转，作为前端默认首页常驻。
- **违反判定**：前端代码中出现手工向菜单树 push 业务菜单项/写死业务菜单配置并展示 = 违反；后端已有对应节点却仍需前端手工补 = 后端节点缺失，应补后端而非改前端。

---

## 铁律：父子表（主从表）后端权限与提交契约（不可违反）

凡一对多父子关系（父 `Parent` + 子 `ParentLine`/`ParentItem`，外键 `ParentID`），后端须遵守：

1. **子表无独立权限**：子表查看/新增/修改/删除权限**一律继承父表**，后端**不得**为子表单独开权限位或菜单权限项；增删改查子表前**必须先校验父表权限**。
2. **写接口随父表权限位校验**：子表 `Insert`/`Update`/`Delete` **必须校验父表权限位**（而非子表自身接口放行）——父表无某操作位（如无「修改」）子表该操作同样拒绝（防越权直调子表 API）。
3. **数据范围随父表**：父表带行级/范围权限（按仓库、部门、校区隔离，`IDataScope`/`DataScopeInterceptor`）→ 子表数据**必须落在父表数据范围内**；读取子表以父记录为已授权上下文，不得越出父表范围取数（如 `GET /api/{area}/{parentLine}?parentId=xxx` 须校验该 `parentId` 属当前用户可见父表集合）。
4. **parentId 入参强制校验（防 IDOR）**：所有子表写接口入参必含 `parentId`，服务层须校验 `parentId` 对应父记录对当前用户**可见且具备对应操作权限**，否则拒绝（不可仅校验子表行属主）。
5. **整体事务提交**：父表与子表**一个事务整体提交**——`Insert`/`Update` 入参含 `lines` 集合，服务层统一落库；子表行 `ParentID` 由服务端根据父记录回填，前端不可伪造。
6. **子表不注册独立菜单节点**（与前端一致）：`GetMenuTree` 仅下发父表节点，子表节点作父表详情内嵌区，避免前端误生成子表独立入口。

> 前端展示与录入职责（不进菜单、列表只父表、详情内嵌、表单内 tab/区域录入、按钮可见性＝父表权限位）见 `cube-webapi-tdesign`「铁律：父子表前端只展现父表」。本铁律只管后端权限校验与提交契约。

---

## 〇、标准开发路线（元流程，先于一切编码）

基于魔方 WebApi 的完整项目按以下路线推进，每一步有明确产出与检查点，**编译错误必须清零后才能进入下一步**：

```
① 搭建项目框架          → 使用 project-architecture 技能（分层选型、目录结构、.sln/.csproj 落地）
② 生成 XML 数据模型     → 使用 xcode-data-modeling 技能，根据需求文档/设计文档编写 Model.xml（表、字段、索引、外键 Map）
③ 代码生成              → 使用 xcodetool（xcode 命令 / Build.tt）从 Model.xml 生成实体类 + WebApi 控制器
④ 编译检查              → dotnet build，错误清零
⑤ 补充业务代码          → 在实体类（业务方法/Search/枚举访问）与控制器（字段定制/自定义 Action/权限位）中补充，生成代码不手改
⑥ 编译检查              → dotnet build，错误清零
⑦ 创建前端项目          → 使用 cube-webapi-tdesign 技能（TDesign Vue Next，GetFields/GetPage 元数据驱动）
⑧ 前端编译、测试        → npm run build + npm run dev 自测（列表/表单/详情/空状态/错误状态）
⑨ 前后端联调测试        → 登录鉴权、CRUD、字段元数据映射（PascalCase→camelCase）、权限显隐、导出、分页排序筛选
```

要点：
- **模型先行**：所有实体/控制器由 Model.xml 驱动生成，需求变更先改 XML 再重新生成，禁止手改生成器产物（会被覆盖）；字段/表结构调整一律走「改 Model.xml → xcodetool 重新生成 → 编译检查」。
- **两次编译检查是硬闸门**：③ 生成后、⑤ 业务补充后各一次，任何修复后编译错误数必须为 0。
- **技能衔接**：① 依赖 `project-architecture` 技能确定分层（两层起步、按需渐进）；② 依赖 `xcode-data-modeling` 技能（Model.xml 完整属性体系、主键设计、Map 外键、ShowIn、分表字段）；⑦ 依赖 `cube-webapi-tdesign` 技能，其零代码列表/表单正是本 skill 第五节元数据接口的消费端。
- **联调常见坑**：前端字段名映射（后端 FastJson CamelCase 输出、Int64 字符串化）、`GetFields` 匿名可取但数据接口需登录、区域路由 `[XxxArea]` 缺失导致 404。
- **新增实体后验收网关（枚举 / 外键字段与前端组件约定，硬约束）**：
  - **枚举字段 → 首选 LOV 值集（权威通道）**：在控制器 `static XxxController()` 中显式下发值集编码，前端 `useLov` 据此拉 `/api/Admin/Lov/Meta` 显示 `[Description]` 中文标签，**无需前端改动**：
    ```
    var lovCode = $"Enum.{typeof(YourEnum).FullName}";   // 与 LovAutoRegisterService 注册码一致
    SetLov(ListFields,     Entity._.Kind, lovCode);
    SetLov(AddFormFields,  Entity._.Kind, lovCode);
    SetLov(EditFormFields, Entity._.Kind, lovCode);
    SetLov(DetailFields,   Entity._.Kind, lovCode);
    SetLov(SearchFields,   Entity._.Kind, lovCode);
    // 辅助：static void SetLov(FieldCollection f, Field field, String code)
    //       { var df = f.GetField(field); if (df != null) df.LovCode = code; }
    ```
    权威源：`CubeDemo/Areas/Test/Controllers/TestFieldController.cs`。
    **前提**：`AddCubeLov(o => o.ScanNamespace("你的实体命名空间"))` + `UseCubeLov()`，且枚举项带 `[Description]`。
    实测（Cube 6.13.2026.802）：`list/addForm/editForm/detail/search` 五组字段集合均下发 `lovCode=Enum.{FullName}`。
  - **`[Map("0=文本1,1=文本2")]` 为兼容降级通道，非首选**：仅在标量枚举无 LOV 注册时使用；它**不**驱动前端 LOV 下拉 / 中文标签链路，且 `mapField` 对枚举恒为 `null`。
  - **外键字段**：命名 `xxxID`，虚拟显示字段的 `mapField` 指向真实列。
  - 前端渲染核查见 `cube-webapi-tdesign` §4.20/§4.21。

---

## 一、启动配置（Program.cs）

```csharp
var builder = WebApplication.CreateBuilder(args);

// ★ 必须：UseCube 内部 MapControllerRoute 依赖 MVC 控制器服务，缺失启动即抛异常。
//   注意：AddControllers 只注册 REST Controller 基础设施（[ApiController]/[Route]/[HttpPost]），
//   不等于 Razor 服务器渲染 MVC，纯 WebApi 也必须调用。
builder.Services.AddControllers();

// 注册权限、菜单、实体控制器扫描、JWT 等
builder.Services.AddCube();

// ★ 必须在 AddCube 之后：AddCube 内部注册了返回 DefaultTracer.Instance(未初始化=null) 的
//   ITracer 工厂，MS DI 取“最后”一个描述符，之前注册会被覆盖；UseCube→UseStardust 依赖 ITracer/ILog。
DefaultTracer.Instance ??= new DefaultTracer();
builder.Services.AddSingleton<ITracer>(_ => DefaultTracer.Instance!);
builder.Services.AddSingleton<ILog>(XTrace.Log);

var app = builder.Build();

// ⚠️ 纯 WebApi（前后端分离）只需 AddControllers + AddCube + UseCube，【不要】调用任何主题/前端包：
//   - NewLife.Cube.AdminLTE（及其 Tabler / Metronic / TDesign / NaiveUI 主题包）是【魔方 MVC 版】的
//     服务器渲染前端，提供 Razor 视图，依赖 MVC 控制器（return View()、Up/Down 返回 RedirectToAction）。
//     与 WebApi 后端（控制器返回 JsonResult、Up/Down 返回 JSON）完全不兼容：引用后页面空白/500、路由冲突、徒增体积。
//   - WebApi 的“前端”是独立 SPA（如 cube-webapi-tdesign / TDesign Vue），通过 /api 消费 JSON，不在此托管。
//   两套技术栈二选一：要 REST API 选 NewLife.Cube + 独立前端；要服务器渲染后台选 AdminLTE + MVC 控制器。
app.UseCube(app.Environment);      // 注册路由表、静态资源与中间件（含 /api 路由）

app.Run();
```

> 需要 `using NewLife.Cube;`（AddCube/UseCube 扩展）、`using NewLife.Log;`（ITracer/ILog/DefaultTracer/XTrace）。
> 若启用 Swagger 还需 `using Microsoft.Extensions.Hosting;`（`IsDevelopment()` 扩展方法所在，缺失报 CS1061）。

### 1.1 Swagger（仅开发环境启用，实测结论）

Swagger UI 默认挂 `/Swagger`（NewLife.Cube 生态约定路径），用于**核对框架自带接口与数据格式**（实体 CRUD、Auth、GetFields/GetPage 等）。**只在开发环境启用**——生产环境不注册服务也不挂中间件，避免接口清单/模型结构对外暴露：

```csharp
// —— 服务注册（builder.Build() 之前）——
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
}

// —— 中间件（app.UseCube 之后）——
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.RoutePrefix = "Swagger";   // UI 挂 /Swagger（Cube 生态约定路径，非默认 /swagger）
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "NewLife.Cube API v1");
    });
}
```

要点（全部实测踩过）：
- **需安装包**：`dotnet add package Swashbuckle.AspNetCore`，否则 CS1061 三连（`AddSwaggerGen`/`UseSwagger`/`UseSwaggerUI` 均不存在）。
- **服务与中间件两处都要包 `IsDevelopment()`**：只包中间件不包服务，生产仍注册了 Swagger 服务（徒增暴露面）；只包服务不包中间件则开发期 UI 不可达。
- **环境判定**：`dotnet run` 无 `launchSettings.json` 或其未指定时默认 **Production**（实测启动日志 `Hosting environment: Production`）；开发期显式 `ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://127.0.0.1:5077`。
- **实测行为**：Production 下 `/Swagger` → 404 且业务接口（如 `POST /Auth/Login`）正常 200；Development 下 `/Swagger` → 301 → `/Swagger/index.html` 200，`/swagger/v1/swagger.json` 200（含全部实体 CRUD 路径）。
- **构建期文件锁**：旧进程未杀时 `dotnet build` 报 MSB3027/3021「文件被 WeComAddressBook.WebApi 锁定」——先 `taskkill /F /IM dotnet.exe` 再构建（代码本身 0 错误，勿误判为代码问题）。

### 1.2 数据层预热（EntityFactory.InitAll / InitConnection）——UseCube 已内置，勿重复调用

> 反编译核实版本：XCode 12.1.2026.801 + NewLife.Cube 6.13.2026.802（2026-08 构建）。

**XCode 侧 API（`EntityFactory`，`using XCode;`）：**

| 方法 | 签名 | 语义 |
|------|------|------|
| `InitAll()` | 同步 | 遍历全部实体类型 → 按 ConnName 分组 → 逐连接：建厂 + 反向工程建表（`Migration > Off` 时）+ 各实体 `InitData()` 数据初始化；异常**直接抛出** |
| `InitAllAsync()` | 异步 | InitAll 的并行版（每连接一个 LongRunning 任务，总耗时 = max 而非求和）；异常吞掉仅记日志 |
| `InitConnection(connName)` | 同步 | 只初始化**单个连接**；异常直接抛出 |

三者共同内部流程（私有 `Init(connName, types, throwOnError)`）：
① 按连接名加载实体工厂（自动跳过分表实体）；② `DAL.Create(connName)` → `Migration > Off` 时 `CheckAndAdd` 反向工程建表 + `SetTables`；③ 逐实体 `Session.InitData()` 初始数据。

**⚠️ 魔方 Web 项目：不要在 Program.cs 里手写预热，`UseCube()` 已经做了**（反编译 `CubeService.cs` 实证）：

```csharp
// app.UseCube(env) 内部第一步：
CubeSetting set = Config<CubeSetting>.Current;
if (set.IsNew)  EntityFactory.InitAll();        // 首次启动（尚无 Cube 配置）：同步全库初始化，确保系统表就绪
else            EntityFactory.InitAllAsync();   // 非首次：异步并行初始化
app.UseManagerProvider();
```

- 全库预热（含 `Membership`/`Cube`/`Log` 等系统库）框架自动完成，再手写 `EntityFactory.InitConnection("Membership")` 属于**重复预热**。
- **时序风险（实测事故）**：在 UseCube 之前手动做实体级初始化（提前建厂 / `InitConnection`）会**破坏 UseCube 内部 InitAll 的自动建表**——实测导致 `UserOnline` 等系统表缺失、每个请求 500。预热代码要么删掉，要么放在 `UseCube` 之后且只针对框架建不到的动态库。
- `InitConnection` 参数是**连接名**（`ConnectionStrings` 的键名，如 `Membership`/`MyBlog`），**不是连接串本身**；连接名必须已注册，传原始连接串会抛「非法连接名」（同 §8.1 `DAL.Create` 陷阱）。

**`InitConnection` 的正确适用场景**（XCode 官方 remarks）：
- 纯 XCode（非魔方）控制台/批处理：启动调 `InitAll()`（Web/Service 用 `InitAllAsync()`）；
- **多租户运行时新增租户库**：主库由启动预热，新租户库在开通时调 `InitConnection(tenantConnName)`；
- 插件/模块热加载：初始化插件自有数据表。

判定口诀：**魔方项目预热交给 UseCube；InitConnection 只用于运行时动态加库**。

`appsettings.json` 必需连接字符串（`Membership` 存储用户/角色/菜单/权限）。**纯 WebApi 不配 `Cube:Theme`**——`Theme`（Tabler/Metronic/AdminLTE）是 MVC 服务器渲染前端的开关，WebApi 后端用不到；配了也不会生效，反而误导成"MVC 项目"：

```json
{
  "ConnectionStrings": {
    "Membership": "DataSource=..\\Data\\Membership.db;Provider=sqlite",
    "Cube": "DataSource=..\\Data\\Cube.db;Provider=sqlite",
    "Log": "DataSource=..\\Data\\Log.db;Provider=sqlite"
  },
  "Cube": {
    "JwtSecret": "请替换为强密钥",
    "TokenExpire": 86400,
    "CorsOrigins": "https://app.example.com"
  }
}
```

> ⚠️ 连接串里的 `..\Data\` 相对路径基于**进程当前工作目录（CWD）**，不是 ContentRoot。`dotnet run`（CWD=工程目录）与直接运行 `bin/Debug/net8.0/*.dll`（CWD=输出目录）会解析到不同 Data 目录，导致"建了表却查不到""冒烟打到旧库"。调试时固定一种启动方式。
> 生产环境**必须**配置强 `JwtSecret`，否则令牌可伪造。

### 1.3 配置分属两套体系：`Config/*.config` 必须落到**运行目录**

魔方的配置**不是单一来源**，写错地方会**静默无效**（2026-09-13 从零新建 `CubeAdmin.WebApi` 实测）：

| 配置项 | 归属体系 | 实际读取位置 | 写在 `appsettings.json` 里有效吗 |
|---|---|---|---|
| 连接串 / `Logging` / `AllowedHosts` | ASP.NET Core | `appsettings*.json` | ✅ 有效 |
| `SysConfig`（系统名 `DisplayName` / 公司 / 版本） | NewLife `Config<T>` | 运行目录 **`Config/Sys.config`** | ❌ **无效**（缺失时回落到**程序集名**） |
| `CubeSetting`（版权 / 登录页提示 / 跨域 / `JwtSecret` / 主题） | NewLife `Config<T>` | 运行目录 **`Config/Cube.config`** | ❌ **无效** |

**「运行目录」= `bin/Debug/net8.0/`（或 publish 输出目录），不是你的工程目录**。因此把
`Config/Sys.config`、`Config/Cube.config` 放在工程根下**不会生效**——表现为：系统名变成程序集名、
`JwtSecret` 每次启动都随机、跨域设置不生效。

两种落地方式：

1. **推荐（可复现、`dotnet run` 与 `dotnet publish` 都自动带上）**：在 csproj 加拷贝项
   ```xml
   <ItemGroup>
     <None Update="Config\**" CopyToOutputDirectory="PreserveNewest" />
   </ItemGroup>
   ```
2. 手工把 config 拷进 `bin/**/Config/` —— 清 `bin`/换机器即丢失，**不要**作为常规做法。

> ⚠️ **`JwtSecret` 必须是 `HS256:xxx` 两段格式**（冒号分两段）。`CubeSetting.OnLoaded` 对不合规值会
> **静默**替换为 `HS256:` + 16 位随机串 ⇒ 每次重启令牌全部失效，表现为「昨天还好好的，今天全员 401」。
> 裸密钥串写在 `appsettings.json` 里同样无效。正确落点：`Config/Cube.config` 的 `<JwtSecret>`。
> 一个可用的最小骨架：`Sys.config`（Name/DisplayName/Company/Develop）+ `Cube.config`
> （CorsOrigins / Copyright / LoginTip / JwtSecret）。

---

## 二、路由约定（必须理解）

基类 `ControllerBaseX` 默认路由：`[Route("api/[area]/[controller]/[action]")]`。
实体控制器通过显式路由覆盖为 **REST 风格**（不带 `/[action]`）：

| 操作 | Http 方法 + 路由 | 说明 |
|------|------------------|------|
| 列表 | `GET  /api/{area}/{controller}` | 分页/排序/条件动态参数 |
| 详情 | `GET  /api/{area}/{controller}/Detail?id={id}` | 单行数据 |
| 新增 | `POST /api/{area}/{controller}` | body 为 TModel |
| 修改 | `PUT  /api/{area}/{controller}` | body 为 TModel |
| 删除 | `DELETE /api/{area}/{controller}?id={id}` | 单条删除 |
| 字段 | `GET  /api/{area}/{controller}/GetFields?kind=1` | 字段元数据（见下） |
| 页面 | `GET  /api/{area}/{controller}/GetPage` | 页面+全部字段元数据 |
| 图表 | `GET  /api/{area}/{controller}/GetChartData` | 图表数据 |
| 导出 | `GET  /api/{area}/{controller}/ExportFile?format=excel` | excel/csv/json/xml |

> 认证类服务控制器（`Auth`/`Cube`/`Sso`）自带 `[Route]` **不带 `/api` 前缀**（如 `/Auth/Login`）。
> 自定义 Action 不要手动再加 `/api`，基类已统一处理。

### 2.1 前后端同域部署：根命名空间撞名（实测，2026-09）

Cube 在**根命名空间**额外注册泛型区域路由 `{area}/{controller=Index}/{action=Index}/{id?}`（Order=1，内部自带，勿手写）。它与前端 SPA 菜单页路径**同名**（菜单 Url = `/Iam/NasClient`、`/Admin/User` 这种 `/{Area}/{Controller}` 形态）。

**一起部署**（Kestrel 自托管 `wwwroot` / nginx 整站反代）时，浏览器硬刷新菜单页被后端路由截获 → 无令牌 401 JSON、有令牌实体 JSON，**永不回退 `index.html`**。dev 正常是因为 `vite.config.ts` 的 `spaAwareBypass` 已按 `Accept: text/html` 放过导航，**必须把同一语义搬到 Kestrel**。

- **前缀级拆分无解**：`/Auth` 同时承载框架认证端点（`/Auth/Login` 真接口）与业务菜单页（`/Auth/NasClient` 前端路由）。
- **`Cube:ApiPrefixes` 也修不了**：它是**剥前缀转发**（`/api/Xxx` 去掉 `/api` 转发到真实路由，非重定向、不改注册路由）；只收口「API 唯一入口 = `/api`」，而 `/api` 的转发目标恰是那条根路由，删掉它 `/api` 全挂。
- **正解 = 请求语义分流中间件**（注册在 `UseCube` **之前**）：导航（`Sec-Fetch-Mode: navigate` 或 `Accept` 含 `text/html`）→ 回退 `wwwroot/index.html`；程序调用 → 走 API。豁免前缀 `/api`、`/Auth`、`/Mfa`、`/Swagger`、`/Content`、`/Uploads`；**不可**豁免 `/Admin`、`/Cube`、`/Iam`、`/Device`、`/Security`、`/Ops`、`/Sys`、`/FreeRadius`（既后端路由又前端菜单前缀）。`MapFallback` 统一 404，**勿按前缀维护白名单**。
- **根治**：业务区域避开框架前缀（`Auth`/`Cube`/`Sso`/`Mfa`）。改名升级脚本**只改 `Menu.Name/Url/FullName/DisplayName`，绝不改 `Menu.ID`**（`Role.Permission` 以 `"<菜单ID>#<权限位>"` 存储，改 ID 会让管理员丢失全部菜单权限）。
- **单区扛太多控制器 → 按业务继续拆分（一区拆多区）**：保住一个原区（沿用其 `Menu.ID`）+ 新增 N 区；扫描器**从不改写已有菜单的 `ParentID`**、且预插根节点会导致**不触发自动授权重建**；**先跑 SQL 改完 `Menu` 表再部署重启**（顺序反了会新增孤儿菜单、权限串失效）。完整工作流见 `references/spa-hosting.md` **§3.4**。

> 完整根因分析、中间件参考实现、区域改名 SQL 模式与验收探针脚本 → **`references/spa-hosting.md`**。

---

## 三、公共控制器选型与用法（避免用错基类）

魔方控制器是一条**继承链**，能力从上往下递增。选错基类是最高频的误用：例如树形实体用了 `EntityController`/`EntityTreeController` 而非 `EntityTreeApiController`，或需要写操作却用了 `ReadOnlyEntityController`，或想拿字段级错误却没开 `EnableFieldValidation`。

### 3.1 继承关系

```
ControllerBaseX                                    根基类：路由前缀 / 令牌解析 / 租户校验 / JSON 序列化 / 审计日志
   └─ ReadOnlyEntityController<TEntity>            只读：列表/详情/元数据/图表/导出（无写接口，IsReadOnly=true）
        └─ EntityController<TEntity,TModel>        标准 CRUD：在只读之上增加 Insert/Update/Delete（IsReadOnly=false）
             └─ EntityTreeController<TEntity,TModel>         树形实体（MVC 版，Up/Down 返回 RedirectToAction）
                  └─ EntityTreeApiController<TEntity,TModel> 树形实体（WebApi 版，Up/Down 返回 JSON）★ WebApi 用它
```

便捷类：`EntityController<TEntity>` = `EntityController<TEntity, TEntity>`（无独立视图模型时，令 `TModel=TEntity`）；`ReadOnlyEntityController<TEntity>` 同理。

### 3.2 ControllerBaseX（根基类，自定义非实体 API）

- 不直接暴露实体 CRUD，提供所有控制器共有的基础设施：`[ApiController]` + `[Route("api/[area]/[controller]/[action]")]`、`CurrentUser` / `CurrentTenant` / `Menu` / `Token` 属性、请求前 `LoadToken()`（Bearer / X-Token / Cookie / Query 四种令牌）、`OnActionExecuting` 中多租户 `ValidateTenant` **fail-closed** 校验、统一 JSON 序列化（FastJson：CamelCase、Int64 作为字符串）、`Json(code,message,data)` 助手、`WriteLog` 审计。
- **适用场景**：纯自定义接口（看板聚合、RPC 风格动作、第三方回调等），不绑定单一实体、不需要 `GetFields` / 字段校验。
- **注意**：它不带 `SearchData` / `FindData` / `GetFields` / `Valid` 等实体辅助方法；若接口要复用魔方实体查询与数据权限，应继承 `ReadOnlyEntityController` 或更上层，而非 `ControllerBaseX`。权限仍需在 Action / Controller 上显式 `[EntityAuthorize]`。

### 3.3 ReadOnlyEntityController<TEntity>（只读 / 字典 / 统计）

- 仅暴露**读**与**导出**接口；构造时 `PageSetting.IsReadOnly = true`，**不生成 Insert / Update / Delete**。
- 内置 Action：`Index()`（GET，Detail 权限）、`Detail(id)`（GET，Detail）、`GetPage()`（匿名）、`GetFields(kind)`（匿名）、`GetChartData()`（Detail）、`ExportFile(format)`（Detail）。
- 继承的实体辅助方法：`Search(Pager)` / `SearchData(Pager)` / `FindData(key)` / `ExportData(max)` / `Valid(entity,type,post)` / `OnGetFields(kind,...)`。
- **适用场景**：
  - 字典表 / 配置类只读数据（如行政区划、枚举映射）；
  - 统计 / 报表视图（配合 `GetChartData` + `OnGetChartData` 返回 ECharts 配置）；
  - 任何“绝不允许通过 API 被增删改”的参考数据。
- **陷阱**：若业务某天需要写入，不要偷偷在子类手写 `Insert` Action 绕过只读——应直接改用 `EntityController`，让权限位（Insert / Update / Delete）与菜单权限项自动对齐。

### 3.4 EntityController<TEntity, TModel>（标准 CRUD）

- 在只读之上新增写操作，构造时 `PageSetting.IsReadOnly = false`。
- 内置写 Action（均带标准权限位与 `[DisplayName]`）：
  - `Insert(TModel)` — `POST /api/area/ctrl`，`Insert` 权限；
  - `Update(TModel)` — `PUT /api/area/ctrl`，`Update` 权限；
  - `Delete(id)` — `DELETE /api/area/ctrl`，`Delete` 权限；支持**假删除**（字段 `Deleted` / `IsDelete` / `IsDeleted` 为真删除标记）与二次删除 / 恢复。
- `EnableFieldValidation` 属性默认 `false`（源码实现 `=> false`；源码注释虽写“默认 true”但实际未开启），需在子类 `override` 返回 `true` 才会按 Model.xml 做必填 / 长度字段级校验并返回 `FieldErrors`。
- **适用场景**：绝大多数业务主数据（订单、学生、设备等）的标准增删改查 API。

```csharp
[SchoolArea]                                                   // 区域特性（等价于 [Area("School")]）
[DisplayName("学生")]
[Menu(0, true, Mode = MenuModes.Admin | MenuModes.Tenant)]    // 自动建菜单+权限项
public class StudentController : EntityController<Student, StudentModel>
{
    // 字段定制与 MVC 完全一致，必须在静态构造器中（全局一次性）

> **⚠️ 区域名与实体名前缀撞名的编译坑（MyBlog 拆分 Product 区实测 2026-09）**：当业务区名与实体名**前缀相同**（如区 `Product` + 实体 `Product/ProductOrder/ProductFile/…`，均放 `MyBlog.Areas.Product.Controllers`），file-scoped namespace + 文件顶部 `using Product = MyBlog.Entities.Product;` **仍会 CS0118/CS0234**（“Product 是命名空间/命名空间 X 中不存在 Y”，namespace 段遮蔽 using，`using static` 也无效）。**唯一解法：把控制器文件改为块式 namespace，并在块内首行放 scoped alias**：
> ```csharp
> namespace MyBlog.Areas.Product.Controllers
> {
>     using Product = MyBlog.Entities.Product;      // 块内 scoped alias 才压得过同名 namespace 段
>     using ProductOrder = MyBlog.Entities.ProductOrder;   // 区里用到的每个 Product* 实体都要列
>     public class ProductController : EntityController<Product> { ... }
> }
> ```
> 通用公共 DTO（如分页 `PagedResult<T>`）勿放在单区命名空间（`Areas/Blog/Controllers/PortalModels.cs`）下，跨区会 CS0246——上移到 `MyBlog.Common`。    static StudentController()
    {
        // ⚠️ RemoveField 须「逐字段多参」写法；本版本不解析逗号串（RemoveField("A,B,C") 会当单个
        // 字段名查找 → no-op，GetPage 仍返回全字段）。曾有版本支持逗号串，勿混用。
        ListFields.RemoveField("CreateUserID", "UpdateUserID");
    }

    // 可选重写：自定义查询
    protected override IEnumerable<Student> Search(Pager p) => base.Search(p);

    // 可选重写：自定义主键查找
    protected override Student Find(Object key) => base.Find(key);
}
```

- **TEntity**：XCode 实体类（由 Model.xml + Build.tt 生成）。
- **TModel**：视图模型（通常同名 `XxxModel`，由 Build.tt 生成；没有时可令 `TEntity` 即 `TModel`）。
- 不写任何 Action 即自动拥有上面“路由约定”表里的全部标准接口。

```csharp
// 只读示例：字典 / 统计报表，绝不允许写
[SchoolArea]
public class StudentStatController : ReadOnlyEntityController<Student> { }
```

### 3.5 EntityTreeController 与 EntityTreeApiController（树形实体）

- 要求 `TEntity : EntityTree<TEntity>`（实体具备 `Parent` / `Name` / `TreeNodeName` 等树字段与树缓存）。
- 静态构造器自动调整 `ListFields`：前置显示 `Key` 与 `TreeNodeName`，移除 `Name` / `Parent` 等。
- 重写 `Search(Pager)`：从**缓存**返回整棵树（`Root.AllChilds` 或按 `Parent` 过滤的 `FindAllChildsByParent`），`PageSize` 强制 10000（树形一次性拉全）。
- 提供 `Up(id)` / `Down(id)` 节点上移 / 下移。
- ⚠️ **两个变体，WebApi 必须用 `EntityTreeApiController`**：
  - `EntityTreeController<TEntity,TModel>`：`Up/Down` 是 **MVC 风格**，返回 `RedirectToAction("Index")`（HTTP 302 + 页面跳转），前端拿不到 JSON；**不在 WebApi 场景使用**。
  - `EntityTreeApiController<TEntity,TModel>`：继承前者并 `new` 覆写 `Up/Down` 为 `[HttpPost]` + `Json(0,"上移成功",menu)`，返回标准 JSON。**WebApi 树形接口请用此基类。**

```csharp
[SchoolArea]
[DisplayName("菜单")]
[Menu(0, true, Mode = MenuModes.Admin | MenuModes.Tenant)]
// WebApi 树形实体：用 EntityTreeApiController（不要直接用 EntityTreeController）
public class MenuController : EntityTreeApiController<Menu, MenuModel> { }
```

### 3.6 选型决策表

| 需求 | 选哪个基类 | 关键原因 |
|------|-----------|---------|
| 标准增删改查（订单 / 学生 / 设备） | `EntityController<TEntity,TModel>` | 自带 Insert/Update/Delete + 4 权限位 |
| 只读字典 / 统计报表 / 不可写参考数据 | `ReadOnlyEntityController<TEntity>` | IsReadOnly=true，无写接口，防止误写 |
| 树形结构（菜单 / 分类 / 组织机构） | `EntityTreeApiController<TEntity,TModel>` | 缓存整树 + Up/Down 返回 JSON |
| 纯自定义聚合 / RPC 接口（不绑实体） | `ControllerBaseX` | 仅基础设施，不引入实体查询 |
| 无独立视图模型 | 用单泛型 `EntityController<TEntity>` / `ReadOnlyEntityController<TEntity>`（`TModel=TEntity`） | 简化泛型参数 |

### 3.7 高频用错点

- **树形实体用错基类**：WebApi 写树形接口却继承 `EntityTreeController`，`Up/Down` 返回 302 跳转而非 JSON —— 一律用 `EntityTreeApiController`。
- **树形实体未继承 `EntityTree<TEntity>`**：`EntityTreeController` 要求 `TEntity : EntityTree<TEntity>`，普通实体既编不过也没有树缓存 / 上下移语义。
- **需要写操作却用 `ReadOnlyEntityController`**：它天生无 Insert/Update/Delete，别在子类手写写接口绕过——直接升级为 `EntityController`。
- **`EnableFieldValidation` 默认关闭**：想在 Insert/Update 拿到 `FieldErrors` 字段级错误，必须子类 `override EnableFieldValidation => true`（源码注释“默认 true”不实，实际 `=> false`）。
- **`ControllerBaseX` 缺实体辅助方法**：自定义接口若需 `SearchData` / `FindData` / `GetFields` / `Valid` 与数据权限，应继承 `ReadOnlyEntityController` 而非 `ControllerBaseX`。
- **`EntityController<T>` 创建/删除 Action 名字写错（override 静默失效）**：MVC 习惯的 `Add`/`Delete` 在 WebApi 第三代是 **`Insert(TModel)`**（非 `Add`）、**`Delete(String id)`**（基类 `[HttpDelete]` verb，6.13 无 `DeleteSelect`/`DeleteAll`）。若用 `Add`/`DeleteSelect` 拼写 override，编译不报错但**运行时不被路由命中（收口等于没做）**；若与基类 virtual 签名不符还会触发 **CS0111 重复定义**。必须重写 `public virtual Insert(TModel)` / `Delete(String id)`。
- **数据由同步引擎维护的实体收口手动增删**：学生/成员等“数据来自同步、不应手改”的实体，将控制器升为 `EntityController` 后**重写 `Insert`/`Delete` 固定返回 403**（`Response.StatusCode=403` + `ApiResponse{Code=403}`），`Update` 保留供必要字段（如手机号）编辑；注意 `Insert` 返回 `Task<ApiResponse<T>>`、`Delete` 返回 `ApiResponse<T>`（签名须对齐基类 virtual）。

---

## 四、标准响应模型（ApiResponse / ApiListResponse）

所有返回经 `ApiFilter` / `ControllerBaseX` 统一序列化为 `{ code, message, data, ... }`
（FastJson：**CamelCase**、**Int64 作为字符串**）。

```csharp
// 单对象/操作响应
public class ApiResponse<T>
{
    public Int32      Code        { get; set; }  // 0 = 成功，其它为错误码
    public String     Message     { get; set; }  // 成功/失败提示
    public T          Data        { get; set; }
    public String     TraceId     { get; set; }
    public List<FieldError> FieldErrors { get; set; } // 字段级校验错误
}

// 列表响应（Index 返回）
public class ApiListResponse<T> : ApiResponse<IList<T>>
{
    public PageModel Page { get; set; }  // 分页：PageIndex/PageSize/TotalCount/Sort
    public T         Stat { get; set; }  // 统计行（p.State）
}
```

### 便捷扩展方法（推荐用于自定义 Action）

```csharp
return data.ToOkApiResponse("操作成功");        // code=0
return data.ToFailApiResponse("参数错误");       // code≠0
return 0L.ToRemotingErrorApiResponse("发送失败"); // 远程/错误码
// 或直接返回 ActionResult：
return Json(0, "ok", data);                      // ControllerBaseX.Json 助手
```

> **自定义 Action 入参绑定（高坑）**：前端/脚本以 `{"id":N}` 的 JSON body POST 时，**简单类型参数（如 `Int32 id`）不会从 body 反序列化**（ASP.NET Core 简单类型默认绑 query/route），导致恒为 0。
> 必须包一个 `[FromBody]` 包装类接收：
> ```csharp
> public class IdInput { public Int32 id { get; set; } }
> [HttpPost][EntityAuthorize((PermissionFlags)16)]
> public IActionResult TestConnection([FromBody] IdInput input) { var id = input?.id ?? 0; /* ... */ }
> ```
> **特性归属陷阱**：在同一文件新增 DTO/辅助类时，**绝不能插在 `[Area("X")]` / `[DisplayName("…")]` 等控制器级特性与 `class XxxController` 之间**——否则这些特性会被 DTO 类抢走，控制器丢掉 `[Area]`，其全部 Action 路由崩溃（`area` token 找不到）。DTO 类不挂这些特性，控制器类紧挨特性。

> **字段级校验**：`EntityController` 的 `EnableFieldValidation` 默认 `false`（源码 `=> false`；源码注释“默认 true”不实），
> 必须在子类 `override` 返回 `true` 才启用。开启后 Insert/Update 依据 Model.xml 元数据做必填、长度校验，
> 失败时返回 `FieldErrors`（含 `Field`/`Message`），前端据此高亮对应表单字段。

---

## 五、字段元数据接口（前端动态界面核心）

前端无需硬编码表格/表单，调用以下接口按 `kind` 取字段定义：

| kind | 含义 |
|------|------|
| 1 | List（列表列） |
| 2 | Detail（详情） |
| 3 | AddForm（新增表单） |
| 4 | EditForm（编辑表单） |
| 5 | Search（搜索条件） |

```http
GET /api/School/Student/GetFields?kind=1
GET /api/School/Student/GetPage        // 一次性返回 setting+list+addForm+editForm+detail+search
```

- `GetFields` / `GetPage` 默认标注 `[AllowAnonymous]`，前端可在登录前拉取 schema；
  **真实数据接口（Index/Detail/Insert/...）仍需登录与对应权限**。
- 返回 `List<DataField>`，含 `Name`/`DisplayName`/`Type`/`Nullable`/`Length`/`DataSource` 等，
  前端配合 `@cube/field-mapping` 之类包映射为控件。

---

## 六、权限与鉴权（自定义权限体系）

> 魔方的权限是**“以菜单为资源 + 以权限位为操作”**的模型：每个控制器对应一个菜单节点，菜单节点挂一组
> 按 `PermissionFlags` 位拆分的权限项；权限项由框架**扫描 Action 上的 `[EntityAuthorize]` 自动生成**，
> 不需要手写注册。自定义权限 = 在标准 4 位之外使用更高权限位 + 用 `[DisplayName]` 命名。

### 6.1 权限位模型（PermissionFlags，XCode.Membership，UInt32 [Flags]）

| 值 | 枚举 | 描述（菜单权限项显示名） |
|----|------|--------------------------|
| 0 | `None` | 无权限（仅用于“已登录”语义） |
| 1 | `Detail` | 查看 |
| 2 | `Insert` | 添加 |
| 4 | `Update` | 修改 |
| 8 | `Delete` | 删除 |
| 0xFFFFFFFF | `All` | 所有 |

- 可 `|` 组合：`Insert | Update`、`Detail | Delete`。
- 每个 `IMenu` 持有 `Dictionary<Int32, String> Permissions`，**键 = 权限位整数值**，值 = 权限项显示名；角色管理界面按菜单列出这些项分配给角色。

### 6.2 权限项自动发现（核心机制）

框架在首次访问或扫描时（`MenuHelper.ScanActionMenu` / `EntityAuthorizeAttribute.CreateMenu`）遍历控制器 Action：

- 仅处理 `public`、非 `static`、未标 `[AllowAnonymous]` 的 Action；
- 若 Action 标了 `[EntityAuthorize(p)]` 且 `p > None`：
  - `p ≤ Delete` → 权限项名取 `[Description]`（查看/添加/修改/删除）；
  - `p > Delete` → 权限项名取 Action 的 `[DisplayName]`（缺省用方法名）；
  - 写入 `controller.Permissions[(Int32)p] = 权限名`；
- 若 Action 另标了 `[Menu]` → 生成**独立子菜单**并带对应权限项。
- 新增/变更后 `Role.CheckRole()` 自动对账角色与权限项。

> 结论：**不要手写权限记录**，只要在 Action 上标 `[EntityAuthorize(...)]` + 必要时 `[DisplayName]`，
> 权限项就会自动出现在角色管理里。修改了权限位/名称后，重启或触发扫描即可生效。

### 6.3 `[Menu]` 注册与可见性模式

```csharp
[SchoolArea]                                                  // 区域特性
[DisplayName("学生")]
[Menu(0, true, Mode = MenuModes.Admin | MenuModes.Tenant, Icon = "fa-graduation-cap")]
public class StudentController : EntityController<Student, StudentModel> { }
```

- `[Menu(order, visible, Mode, Icon, LastUpdate)]`：`order` 越大越靠前；`LastUpdate` 用于代码改了菜单参数后**强制覆盖**已有菜单设置。
- `MenuModes`（[Flags]）：`Admin = 1`（管理后台可见）、`Tenant = 2`（租户可见），可 `|` 组合。
- `MenuHelper.CheckVisible(type, isTenant)` 规则（用于租户隔离）：
  - 租户模式（`TenantId > 0`）：仅 `Mode.Has(Tenant)` 的控制器可见；
  - 管理后台：含 `Admin` **或** 未声明任何模式（默认仅后台）可见；
  - 反例：纯 `Admin` 菜单租户不可访问，纯 `Tenant` 菜单后台不可访问。

#### 6.3.1 隐藏菜单的三个坑（实测确认，改菜单可见性前必读）

想让某个控制器**不进后台菜单**（但保留路由与权限项），有三个容易连环踩的坑：

**坑 1：不写 `[Menu]` ≠ 不进菜单——反而会按默认 `visible=true` 被收录。**
Cube 扫描器对**未标 `[Menu]`** 的控制器按默认可见收录。因此「不要菜单就不写 `[Menu]`」是**错的**。
✅ 正确做法：显式写 `[Menu(0, false)]`。

```csharp
[DisplayName("产品版本文件")]
[Menu(0, false, Icon = "fa-file-archive")]   // 必须显式 false；不写反而会显示
[ProductArea]
public class ProductFileController : EntityController<ProductFile> { }
```

**坑 2：已有 `Menu` 记录的 `Visible`/`Sort`/`Icon` 不会因控制器特性改动而更新。**
扫描器只在**首次插入**时写入这些字段；库中已存在的记录会被跳过（判据：该记录 `UpdateTime` 长期不变）。
所以改完控制器特性后重启，菜单**看起来毫无变化**——不是没生效，是根本没被覆盖。
✅ 正确做法：在**区域类**上抬高 `LastUpdate`，强制用代码定义覆盖库中设置（官方 XML：
`最后更新时间。小于该更新时间的菜单设置将被覆盖。` / `一般应用于区域类`）。

```csharp
[DisplayName("产品管理")]
[Menu(0, true, LastUpdate = "2026-09-14")]   // 每次改本区菜单结构都要抬高此日期
public class ProductArea : AreaBase
{
    public ProductArea() : base(nameof(ProductArea).TrimEnd("Area")) { }
}
```

> ⚠️ **区域自身的 `Visible` 必须为 `true`**。写成 `[Menu(0, false, LastUpdate = ...)]`
> 会让**整个区域分组**（连同其下所有正常菜单）从侧边栏消失。`LastUpdate` 只用于触发重建，
> 不要顺手把区域可见性也关掉。

**坑 3：`GetMenuTree` 返回全量节点（含 `visible=false`），不做服务端过滤——前端必须自己消费 `visible`。**
这是最隐蔽的一环：后端标了 `[Menu(0,false)]`、库记录 `Visible=0`，接口返回的 JSON 里那条记录
**依然在 `children` 数组里**，只是带了个 `"visible": false` 字段。若前端菜单消费层不读这个字段，
就会被渲染成菜单项——**后端声明完全空转**。

✅ 前端须在映射菜单树时显式过滤（参考实现）：

```ts
interface RawMenuNode { id: number; name: string; url?: string; visible?: boolean; children?: RawMenuNode[] }

function mapChildren(nodes: RawMenuNode[]): MenuNode[] {
  const out: MenuNode[] = []
  for (const n of nodes || []) {
    if (n.visible === false) continue        // 用 !== false 而非 === true：对老接口/缺字段保持宽容
    // ... url 归一化等
  }
  return out
}
// 区域根节点同样要判断：if (root.visible === false) continue
```

**结论：隐藏菜单是「后端声明 + 前端消费」两环，缺一不可。**
只改后端 = 菜单照旧显示（坑 3）；只改前端 = 服务器换了库记录又冒出来（坑 2）。
排查口诀：**先看接口 JSON 里 `visible` 是什么，再看前端有没有读它。**

> 实战收益参考：某存量项目补上前端 `visible` 消费后，菜单从 **40 条降到 23 条**，
> 一次清掉 14 个框架内部页（字典参数/访问规则/OAuth 配置/短信配置/应用日志等）
> 长期挂在侧边栏的污染——它们此前一直存在，因前端不读 `visible` 而无人察觉。

### 6.4 自定义权限位（CRUD 之外的业务权限）

`PermissionFlags` 是 UInt32 `[Flags]`，除标准 4 位外，可用更高位 `(PermissionFlags)16`、`(PermissionFlags)32` 等作为**自定义业务权限位**：

```csharp
[EntityAuthorize((PermissionFlags)16)]
[DisplayName("审批")]
public ApiResponse<String> Approve(Int32 id) => ...;          // 角色界面出现“审批”权限项

[EntityAuthorize((PermissionFlags)16 | PermissionFlags.Update)]
[DisplayName("撤回")]
public ApiResponse<String> Recall(Int32 id) => ...;
```

- 权限项名取 Action 的 `[DisplayName]`；角色管理里该菜单下会出现“审批 / 撤回”等自定义项；
- 也可用 `[Menu]` 把自定义权限做成独立子菜单项（同时带菜单与权限）。
- ⚠️ **同一控制器内，每个权限位只能被一个 Action 使用（最致命的隐性坑）**：
  `MenuHelper.ScanActionMenu` 用 `dic.Add(method, (Int32)attAuth.Permission)` 收集权限项，
  键为**权限位整数值**。同一控制器里两个 Action 写同一个位（如两个 `(PermissionFlags)16`）会抛
  `ArgumentException`，**导致该控制器整个权限扫描中断、权限项一个都不落库**。
  症状具有欺骗性：**编译通过、接口代码正常，只在运行时报**
  `设计错误！验证权限时无法找到[XxxController/Yyy]的菜单` 或
  `管理员访问资源 [Xxx/Yyy] 需要  权限`（权限名位置为空串，因为 `Permissions` 字典里没这项）。
  更坑的是**开发期可能正常**（内存里已有旧权限缓存），**重启后才暴露**——
  所以「重启后某接口突然 403、且提示权限名为空」优先怀疑本坑。
  ✅ 自查：`grep -n 'PermissionFlags)' XxxController.cs` 列出所有位，确认**无重复**。
  发现重复时，给后出现的 Action 换一个未占用的高位（16 → 32 → 64 → 128 …）。
  注意 `PermissionFlags.Update | (PermissionFlags)16` 这类**组合位**同样参与去重——
  两个 Action 若含相同的高位成分，即使组合值不同也可能撞车，最稳妥是每个 Action 独占一个高位。
  修复后**必须重启**（或触发扫描）让菜单权限串重建，然后到 `Membership.db` 的 `Menu.Permission` 字段核对，
  应能看到形如 `1#查看,2#添加,16#批量导入,32#导入Excel/CSV` 的完整串。
- ⚠️ `EntityAuthorizeAttribute` 的带参构造在 `permission ≤ None` 时抛 `ArgumentNullException`，
  **必须显式传入权限位**。魔方区域内的“仅要求登录”由全局过滤器兜底（见 6.5），
  不要在 Action 上空写 `[EntityAuthorize()]` 来只校验登录——写上具体权限位才是本意。

### 6.5 鉴权流程（EntityAuthorizeAttribute，IAuthorizationFilter）

> ⚠️ **实际存在两层鉴权，先过第 0 层框架过滤器，再过本节 EntityAuthorize**：
>
> **第 0 层（`BaseController`/`ControllerBaseX` 内置，对全部魔方控制器生效）**：
> `OnActionExecuting` 检查
> `!ActionDescriptor.MethodInfo.IsDefined(typeof(AllowAnonymousAttribute)) && (token 为空 || OnAuthorize(token) 失败)`
> → 抛 `ApiException(403, "认证失败")`。
> **它只认 Action 方法上的 `[AllowAnonymous]`，控制器类上的 `[AllowAnonymous]` 完全无效**（`MethodInfo.IsDefined` 不会回溯类型特性）。
> 纯自定义匿名控制器（第三方回调、门户登录、开放 API 等继承 `ControllerBaseX` 的根控制器）
> **必须在每个 Action 方法上逐个标 `[AllowAnonymous]`**，只在类上标会被 403 拦截。
> 三层 403/401 响应体的区分：
> - `{"code":403,"message":"认证失败","data":"认证失败"}`（无 traceId/fieldErrors）→ 第 0 层框架过滤器，检查方法级 AllowAnonymous；
> - `{"code":401,"message":"没有登录或登录超时！"}` → EntityAuthorize 已注册但无有效令牌；
> - `{"code":403,"message":"{user}访问资源 [Ctrl/Action] 需要 {权限} 权限"}` → EntityAuthorize 已登录无权限。

1. Action/Controller 标 `[AllowAnonymous]` → **直接放行**（注意：第 0 层只认 Action 级）；
2. 控制器**非**魔方区域且未标 `[EntityAuthorize]` → 跳过全局校验；
3. 按 `FullName` 或 `Url` 定位菜单（WebApi 路由去 `/api` 前缀：`WebHelper.TrimApiPrefix`），
   必要时为带特性的非魔方控制器**自动建菜单**；
4. `DataScopeContext.Current?.SetMenu(menu)` 设置数据权限上下文（供 6.7 使用）；
5. `ManageProvider.Provider.Current`（内部 `ManagerProviderHelper.TryLogin`，支持 Bearer / X-Token / Cookie / Query 四种令牌）取当前用户；
6. `user.Has(menu, Permission)` 判定：
   - **未登录 → 401**：`{"code":401, "message":"没有登录或登录超时！"}`；
   - **已登录无权限 → 403**：`{"code":403, "message":"{user}访问资源 [Controller/Action] 需要 {权限描述} 权限"}`，并记“访问-拒绝”日志。

```csharp
// Action 或 Controller 级标注（Controller 级对本控制器全部 Action 生效）
[EntityAuthorize(PermissionFlags.Detail)]
[EntityAuthorize(PermissionFlags.Insert | PermissionFlags.Update)]
public ApiResponse<Student> Xxx() { ... }
```

### 6.6 代码内自定义权限判定

```csharp
var user  = ManageProvider.Provider.Current;        // IManageUser / IUser
var menu  = ManageProvider.Menu.FindByFullName(typeof(StudentController).FullName);
if (user.Has(menu, PermissionFlags.Detail)) { ... }   // 或关系可传多个位
// MVC 视图中：page.Has(menu, flags) / page.Has(flags)（纯 WebApi 前端改用 GET /Auth/Info 判断权限）
```

- `IUser.Has(IMenu, PermissionFlags)`：当前用户对该菜单是否拥有指定权限位（“或”关系，传多位是任意一个即可；要“与”关系请合并成单个多位的 `PermissionFlags` 值再传入）；
- `MembershipExtensions.Has(IRazorPage, ...)`：视图层便捷判定。

### 6.7 与数据权限协同

- `EntityAuthorize` 执行时已 `DataScopeContext.Current?.SetMenu(menu)`，同时供**两套**数据权限拿到菜单上下文：
  - 角色数据范围：`DataScopeContext` 据此解析 `menu.DataScope`（菜单级覆盖角色默认）；
  - 控制器表达式：`[DataPermission]` 的行级过滤（见第十节）。
- `[DataPermission("系统管理员,超级管理员", "CreateUserID={$user.Id} or linkId in {#SiteIds}")]`（详见第十节）；
- `DataPermissionAttribute.Valid(roles)`：当前用户属于 `SystemRoles` 时**跳过**表达式过滤（系统角色不受限）。

---

## 七、登录与 JWT（Auth/Login）

```http
POST /Auth/Login
Content-Type: application/json
{ "username": "admin", "password": "admin" }
```
返回：
```json
{ "code": 0, "data": { "accessToken": "xxx", "refreshToken": "yyy" }, "message": "登录成功" }
```

**令牌传递方式（任选其一）**：
- Header：`Authorization: Bearer <token>`
- Header：`X-Token: <token>`
- Cookie：`Token=<token>`
- Query：`?token=<token>`

其它认证接口：
- `GET  /Auth/Info` —— 当前用户（含角色与权限）
- `GET  /Auth/LoginConfig` —— OAuth 提供商、验证码配置（可匿名）
- `POST /Auth/Refresh` —— 用 RefreshToken 换新的 AccessToken
- `POST /Auth/Logout` —— 登出

> 首个进入系统的用户自动成为管理员，原 `admin` 被禁用。

### 7.1 第三方登录：扩展 `NewLife.Web.OAuthClient`（实测，2026-09）

Cube 自带 OAuth 客户端工厂，接入新第三方登录源（企微/钉钉/飞书等）**不要自写 HTTP 轮子**，继承 `OAuthClient` 即自动注册：

- **工厂发现机制**：`OAuthClient.Create(tenantId, name)` → `Reflect.GetAllSubclasses(typeof(OAuthClient))` → 每个子类取 `Name.TrimSuffix("Client")` 作字典键（`StringComparer.OrdinalIgnoreCase`）→ 查 `OAuthConfig` 表按 `Name` 匹配 → `Apply` 配置。
  - ⚠️ **类名即契约**：`WecomClient` → 键 `Wecom`（匹配 provider `"wecom"`）。写成 `WeComClient` 键变 `WeCom`——OrdinalIgnoreCase 下仍能匹配，但命名与既有 `QyWeiXinClient` 等框架风格不一致，统一用 `WecomClient`。
- **重写点**（全部 virtual）：`Support(string userAgent)`、`Authorize(redirect, state, Uri baseUri)`、`GetAccessToken(code)`、`GetOpenID()`、`GetUserInfo()`、`protected OnGetInfo(IDictionary<string,string>)`。
- **类型坑（CS0266 三连）**：
  1. `OAuthClient.Items` 是 `IDictionary<string,object>`（不是 `<string,string>`）；`OnGetInfo` 参数才是 `IDictionary<string,string>` —— `GetUserInfo()` 里两路分开构造，object 字典给 Items，`ToDictionary(k, v => Convert.ToString(v.Value) ?? "")` 给 OnGetInfo。
  2. `OAuthConfig` **没有** `Items`/`ResponseType` 属性；扩展字段（如企微 agentid）走索引器 `cfg["agentid"]?.ToString()`（返回 object，勿直接赋 string）。
  3. 父类默认 `AuthUrl` 含 `{response_type}` 模板占位——自定义 `Authorize()` 须兜底：`AuthUrl.IsNullOrEmpty() || AuthUrl.Contains('{') ? 内置常量 : AuthUrl`，否则未替换的模板原样渲染进前端二维码链接。
- **一源多形态**：同一登录源有多个授权入口（企微：A PC 扫码 `qrConnect`+agentid / B 客户端内静默 `oauth2/authorize`+`snsapi_base`），在子类加 `AuthForm` 枚举属性，`Authorize()` 按 `Form` 分流——不要在业务服务层拼 URL。
- **企微特例**：`GetAccessToken(code)` 语义不同——先 `gettoken(corpid,secret)` 拿 access_token，再 `user/auth/getuserinfo(code)` 换 **UserId 直接当 OpenID**（无需 openid 字段）。
- **验证配方**：临时 console 工程（`dotnet new console` + `AssemblyResolve` 指向发布目录）反射 `GetAllSubclasses` 确认新子类已进工厂索引；端到端测 `/portal/{Ctrl}/Config` 比对两种形态 URL 是否正确区分；用无效 code 打 Login 端点验证异常链路（应返回业务错误码而非 500）。

---

### 7.2 内置 OAuth SSO 服务端（IdP，SsoController）

`AddCube()`/`UseCube()` 自动注册 `SsoController`，提供**开箱即用的 OAuth 2.0 / OIDC 授权服务端**（本系统即 IdP）。无需手写控制器，但**纯 WebApi 下有一处必须补：登录页桥接**（见下）。

**关键端点（路径前缀 `/Sso`，无 `/api`）**：

| 端点 | 方法 | 用途 |
|---|---|---|
| `/Sso/Authorize` | GET | 授权码申请（未登录 → 内置登录入口跳转） |
| `/Sso/Auth2` | GET | 签发授权码并回跳 `redirect_uri`（已认证时直接发码，无 Consent 页） |
| `/Sso/Token` | POST | **统一令牌端点**（覆盖 authorization_code/password/client_credentials/refresh_token，以 `grant_type` 区分） |
| `/Sso/UserInfo` | GET | 用户信息（`Bearer`/`X-Token`） |
| `/Sso/Verify` | GET/POST | 令牌校验 |
| `/Sso/Logout` | GET | 登出（`end_session_endpoint`） |
| `/Sso/Login/{name}` | GET | 第三方登录入口（企业微信/钉钉/GitHub/微软，走 `OAuthConfig`） |
| `/Sso/LoginInfo/{id}` | GET | 第三方回调 |
| `/Sso/GetKey` | GET | JWKS（id_token RS256 公钥） |
| `/.well-known/openid-configuration` | GET | OIDC 发现文档（实测 200） |

**⚠️ 三处实测校正（2026-09-23，NewLife.Cube 6.15.2026.0901，以 HTTP 探活为权威）**：
1. **令牌端点不是 `/Sso/Access_Token`，是 `/Sso/Token`**（以 `/.well-known/openid-configuration` 的 `token_endpoint` 为准）。四种 grant 全走 `/Sso/Token`：`grant_types_supported=[authorization_code,password,client_credentials,refresh_token]`。`/Sso/Access_Token` 仅为历史别名，对外契约统一用 `/Sso/Token`。
2. **未登录 `GET /Sso/Authorize` → `302` 到 `/Admin/User/Login?ssoAppId=<id>&r=%2fSso%2fAuth2%3fid%3d<id>`**（内置登录入口；回跳 `r=/Sso/Auth2?id` 由该端点签发授权码）。未知/禁用 `client_id` → `{"code":500,"message":"应用[xxx]不可用"}`。
3. **纯 WebApi 构建下 `GET /Admin/User/Login` 返回 404**（无 Razor 视图）→ 必须由本系统提供**登录桥接**，否则未登录 SSO 流程断裂。

**登录桥接（Login Bridge，纯 WebApi 必需）**：
- 新增控制器接管 `GET /Admin/User/Login`，透传 `ssoAppId` 与 `r` 参数，302 到同域前端登录页 `https://sso.example.com/login?ssoAppId=<id>&r=<r>`；
- 前端登录页提交账号密码 → `POST /Auth/Login`（放行，见 §7）→ 设置同域 `.Cube.Session` Cookie；
- 前端携带 Cookie 回跳 `r`(`/Sso/Auth2?id=…`) → SSO 识别已认证会话 → 直接回跳 `redirect_uri?code&state` → RP 用 `code` 调 `/Sso/Token(grant_type=authorization_code)` 换 JWT。

**客户端登记（`OAuthApp` 表，落 Cube 库）**：`Name`=client_id（唯一）、`Secret`、`Urls`=回调白名单（逗号分隔多值）、`Scopes`、`TokenExpire`、`Enable`、`Category`、`RoleIds`；框架客户端校验走 `IOAuthAppService`。**已播种测试客户端** `webclient`(Secret=sec_123456, Enable=1, Urls=http://localhost:5173/callback,https://app.example.com/callback, Scopes=user, TokenExpire=86400)，可直接联调。

**第三方源（`OAuthConfig` 表）**：Provider∈{企业微信,钉钉,GitHub,微软}（均为内置客户端，无需自写），填 `AppId`/`Secret`/`AuthUrl`/`AccessUrl`/`UserUrl`/`AutoRegister`/`Enable`；入口 `/Sso/Login/{provider}`，回调 `/Sso/LoginInfo/{provider}`。

**密钥**：access_token 用 `JwtSecret`(HS256，落 `Config/Cube.config`，见 §1.3)；id_token 用 RS256（公钥经 `/Sso/GetKey` 暴露）。`scopes_supported=[openid,profile,email]`；`response_types_supported=[code]`。

### 7.3 内置管理控制器清单与区域归属（实测，2026-09-23 —— 防「误判 API 缺失」）

**核心结论**：魔方 WebApi 版**已内置大量实体管理控制器**，`/api/{区域}/{控制器}/GetPage|GetFields|Insert|Update|Delete` 直接可用，**无需自写 `EntityController<T>`**。但**控制器名 ≠ 表名，区域也不体现在名字里**——凭猜测拼前缀会误判成「该 API 缺失」（本会话实际踩过，浪费数轮）。

| 能力 | 控制器 | 区域 | 权威路径 | 实测 |
|---|---|---|---|---|
| 账号管理 | `UserController` | `Admin` | `/api/Admin/User/GetPage` | 200 |
| 第三方登录源 | `OAuthConfigController` | `Admin` | `/api/Admin/OAuthConfig/GetPage` | 200 |
| **OAuth 客户端应用（表 `OAuthApp`）** | **`AppController`** | **`Cube`** | **`/api/Cube/App/GetPage`** | **200** |
| OAuth 授权日志（表 `AppLog`） | `AppLogController` | `Cube` | `/api/Cube/AppLog/GetPage` | 200 |
| 角色 / 菜单 / 参数 / 短信 / 邮件 / 部门 / 租户 / 在线用户 … | `Role`/`Menu`/`Parameter`/`SmsConfig`/`MailConfig`/`Department`/`Tenant`/`UserOnline`Controller | `Admin` | `/api/Admin/{X}/GetPage` | — |
| 数据库管理（`ControllerBaseX`，非实体） | `DbController` | `Admin` | `/api/Admin/Db`（`data` 直接是数组） | — |

**两条判定规则（防误判）**：

1. **`GET /Cube/Apis` 返回的是「控制器/动作名」扁平字符串列表（实测 477 条），不含区域字段** → **不可据此推断路由前缀**。区域只能从 `NewLife.Cube.dll` 的 XML 文档全限定类型名读出（`T:NewLife.Cube.Areas.<区域>.Controllers.<X>Controller`）。
2. **实体类名 ≠ 表名**：`AppController` 管理的实体类叫 `App`，**表名是 `OAuthApp`**；判据 = `GET /api/Cube/App/GetFields?kind=2` 返回的 25 个字段与 `OAuthApp` 表 25 列**逐列一致**（`Id/Name/DisplayName/Secret/Category/Enable/HomePage/Logo/White/Black/TokenExpire/Urls/RoleIds/Scopes/OAuths/Expired/Auths/LastAuth/CreateUserID/CreateTime/CreateIP/UpdateUserID/UpdateTime/UpdateIP/Remark`）。

**权威排查配方（比逐个猜前缀快一个数量级）**：读 NuGet 包内 XML 文档（`~/.nuget/packages/newlife.cube/<ver>/lib/<tfm>/NewLife.Cube.xml`）取 `T:...Areas.<区域>.Controllers.<X>Controller` → 拆出「区域 + 控制器」→ 拼 `/api/<区域>/<控制器>/GetPage` 实测 200。
> 反例（本会话）：只试了 `/api/Admin/App`、`/api/Sso/App`、`/api/App`、`/App` 全 404 便下结论「OAuthApp 管理 API 缺失」——真实路径是 `/api/Cube/App`，一直没试。

**`kind` 参数实测复核**（与 §五表一致，无需改）：`1`=List 列表列、`2`=Detail 详情、`3`=AddForm 新增表单、`4`=EditForm 编辑表单、`5`=Search 搜索条件；`0` 无效（`code=-2`）。列表列**不含** `Secret`/`Urls` 等敏感大字段（`App` 的 `kind=1` 仅 14 列），**取全字段必须用 `kind=2`/`4`**。

### 7.4 `AppLog` 实体契约与「用户维度」统计的正解（实测，2026-09-23）

**结论先说**：`AppLog`（OAuth 应用授权日志，表 `AppLog`）**不能用于「某用户的最近/常用应用系统」统计** —— 它没有用户ID列，且框架写入方法不接收用户参数。此类需求须**自建流水表**。

**实体契约（`NewLife.Cube.Entity.AppLog`，取自包内 XML 文档全量属性）**：

| 分组 | 字段 |
|---|---|
| 业务 | `Id`(Int64) `AppId`(Int32) `Action` `Success` `ClientId` `RedirectUri` `ResponseType` `Scope` `State` `AccessToken` `RefreshToken` `TraceId` |
| 审计 | `CreateUser`(nvarchar(50)) `CreateIP` `CreateTime` `UpdateIP` `UpdateTime` |
| 其他 | `Remark`；导航属性 `App` / `AppName` |

**三条硬约束（决定"能不能拿它做用户统计"）**：

1. **没有 `CreateUserId`**。审计组只有字符串 `CreateUser` —— 与本框架其他实体（`OAuthApp`/`OAuthConfig`/`AppModule`…均带 `CreateUserID`）**不一致**，别想当然。
2. **写入方法不接收用户参数**：`AppLog.Create(Int32 appid, String action, Boolean success, String remark)`。`CreateUser` 由 XCode 基类在 `Save()` 时从 `ManageProvider.User` 自动填充（XML 注释原文：「创建者。可以是设备编码等唯一使用者标识」）⇒ **外部无法干预其取值**。
3. **实测同一用户写入值不一致**（取决于调用链上的身份对象形态）：

| `Action` | 实测 `CreateUser` |
|---|---|
| `Authorize` / `Password` | `admin`（用户名） |
| `GetResult` | `管理员`（显示名） |

⇒ 按单一值精确匹配会**把同一用户拆成两条**（实测聚合结果即出现 `admin` 与 `管理员` 两行）。

**两个顺带查明的事实**：
- **`AppLog.Id` 就是 SSO 授权码载体**（XML：「授权码，即 `AppLog.Id` 的字符串形式，5 分钟内有效」）——解释了实测未登录授权时跳转地址里的 `/Sso/Auth2?id=7508381324838551552`。`Action` 实测取值：`Authorize` / `GetResult` / `Password`。
- **`OAuthLog`（第三方登录源日志）有 `UserId` 数字列**（`Provider`/`ConnectId`/`UserId`/`Action`…）。框架在「登录源」日志用数字ID、在「应用授权」日志用字符串，**自身不一致** —— 不可据此推断 `AppLog` 也有用户ID。

**正解：自建流水表承载用户维度**（用于门户/工作台的「最近使用」「常用应用」）

```
PortalVisit: Id(Int64) / UserId(Int32, 索引) / AppId(Int32) / AppName(String 50)
             / Action(String 20) / IP(String 50) / VisitTime(DateTime)
             联合索引 (UserId, VisitTime)
```

- **写入点**（与"进入应用一律走 SSO 授权"天然契合）：门户的进入入口走**自建端点** `GET /api/Portal/Enter?appId=N` → 取登录态 `UserId` → 写流水 → `302` 到 `/Sso/Authorize?client_id={App.Name}&redirect_uri={App.Urls首项}&response_type=code`。一次请求同时完成**留痕 + SSO 授权跳转**。
- **查询**：最近 = `GROUP BY AppId ORDER BY MAX(VisitTime) DESC`；常用 = `GROUP BY AppId ORDER BY COUNT(*) DESC`。
- **取舍**：只统计「经门户进入」的行为 —— 门户本就是 SSO 入口，口径反而更准；且彻底摆脱框架审计字段的脏数据与升级风险。XCode 自动建表，无需人工 DDL（铁律 R3）。

> 若强行复用 `AppLog`，唯一可行路径是按 `IN (用户 Name, 用户 DisplayName)` 双值匹配 —— 仍有同名风险，且依赖框架内部行为不变。**不推荐。**

> **⛔ 平台侧提醒**：Cube WebApi 版**没有**任何「我的应用 / 门户聚合」类内置 API（实测 477 个内置接口中不存在）。门户首页的聚合接口（可访问应用集、最近、常用）**必须自研控制器**。

### 7.5 框架内置表的只读边界与索引补建（实测，2026-09-23）

**结论先说**：`AppLog` / `Log` / `UserStat` 等**框架内置实体**的表名、分表策略、索引清单均由**编译进 `NewLife.Cube.dll` 的 Model** 固定 —— 项目侧自己的 `Model.xml` **改不动它们**。对这些表只能做「补索引」与「按时间清理」，**不能分表、不能分区**。

**误判预防（先看这三条，再决定优化路线）**：

| 事实 | 证据（2026-09-23 实测） |
|---|---|
| `AppLog` 主键**已是雪花 ID** | 表内 7 行 `Id` 全部 19 位（如 `7508377927259353088`）；框架方法签名 `FindById(System.Int64)`。建表语句为 `Id integer Primary Key`（**无 `AUTOINCREMENT`**；对照 `OAuthApp` 带 `AUTOINCREMENT`）⇒ **别再说"要改成雪花 ID"，它本来就是** |
| `AppLog` **未分表** | 物理表名即 `AppLog`，无月份后缀 |
| `AppLog` **只有 `IX_AppLog_AppId`** | `CreateTime` **无索引**。对照：`Log` 有 3 个复合索引、`OAuthLog` 有 `Provider`/`ConnectId`/`UserId` 三索引 —— 框架对 `AppLog` 的时间维度确实没建索引 |

**为什么分表 / 分区都走不通**：

- 启用分表须改实体 Model（`DataScale="timeShard:yyyyMM"`）⇒ 须改框架源码，不可行；
- MySQL **原生分区**同样不行：分区键必须包含在**每个唯一索引**中，而 `AppLog` 主键是 `Id`、`CreateTime` 不在其中 ⇒ `PARTITION BY RANGE(CreateTime)` 直接报错。要绕开就得把主键改成 `(Id, CreateTime)` 复合 —— 又回到改框架。

**框架自己给的答案**：`AppLog.DeleteBefore(DateTime)`（XML 注释「删除指定日期之前的数据」）—— **框架的设计意图是「定期清理」，不是分表**。

**于是框架层只剩两件事可做**：

1. **补索引（幂等 DDL）**，建议复合 `(CreateTime, AppId)`，直接覆盖「时间窗范围扫描 + 按 `AppId` 分组」这一主查询形态：

| 库 | 写法 |
|---|---|
| SQLite | `CREATE INDEX IF NOT EXISTS IX_AppLog_CreateTime_AppId ON AppLog(CreateTime, AppId)` |
| MySQL | ★ **不支持** `CREATE INDEX IF NOT EXISTS` ⇒ 须先查 `information_schema.statistics` 判断存在性再建（按 `Database.Type` 分支） |

2. **按时间清理**（可选，默认关闭）：定时调用 `DeleteBefore(DateTime.Now.AddMonths(-N))`；定时器可直接复用框架自带的 `CronJob` 表，不必另引调度组件。

**★ 一条容易踩空的坑**：`XCode:Migration` 若设为 **`Full`**，框架会**删除模型外的索引** ⇒ 手工补的索引会被清掉。生产环境必须保持 **`On`**（仅新建表/列）。

**雪花 ID 做时间裁剪？不可靠**：雪花内嵌时间戳、单机单调递增，理论上可用 `Id >= snowflake(startTime)` 免建索引做区间下推。但**多实例部署时不同 `workerId` 的雪花不保证全局有序**（时钟回拨、机器时差），边界会错漏。仅作了解，不作为方案。

---

## 八、自定义 API Action

```csharp
// 在 3.4 的 StudentController 基础上追加自定义 Action（partial 拆分）
[SchoolArea]
public partial class StudentController : EntityController<Student, StudentModel>
{
    [EntityAuthorize(PermissionFlags.Detail)]
    [HttpGet]                                   // 路由：GET /api/School/Student/Call
    public ApiResponse<String> Call(String teacher)
    {
        var p = new Pager(WebHelper.Params);    // 复用动态查询参数
        var list = SearchData(p);               // 走与 Index 一致的查询逻辑
        return new ApiResponse<String> { Code = 0, Data = $"已呼叫 {list.Count()} 名学生" };
    }
}
```

- 列表型自定义接口用 `SearchData(Pager)` / `ExportData()`（基类提供）。
- 需要直接返回 JSON 时用 `Json(code, message, data)` 助手（返回 `ActionResult`）。

### 8.1 实战自定义 Action 模板（连接测试 / 手动拉取 / 聚合统计）

三类高频业务 Action 的可复用骨架（均落在 `EntityController<T>` 子类，复用基类 `SearchData`/权限/`Json` 助手）：

**(1) 数据源连接测试**——真正建连校验 + 映射可读性。⚠️ **勿 `DAL.Create(ds.ConnStr)`**：XCode v12.1 的 `DAL.Create(String)` 只把参数当「已注册连接名」，原始连接串会被当名字去查配置而抛「非法连接名」。必须先 `DAL.AddConnStr(name, connStr, null, null)`（type/provider 传 null 自动按连接串探测 provider；同名重复注册不抛、换串自动覆盖）再 `DAL.Create(name)`：

```csharp
public static DAL CreateDataSourceDAL(DataSourceConfig ds)
{
    if (ds == null || ds.ConnStr.IsNullOrEmpty()) return null;
    if (DAL.ConnStrs.ContainsKey(ds.ConnStr)) return DAL.Create(ds.ConnStr);   // 已是注册名
    var name = "DataSource_" + ds.ID;
    DAL.AddConnStr(name, ds.ConnStr, null, null);                              // 原始连接串 → 动态注册（幂等可覆盖）
    return DAL.Create(name);
}
// XCode DatabaseType(SqlServer=2/MySql=4/SQLite=6/PostgreSQL=8/Oracle=3) 与业务自有 DbType 映射往往不一致，指定 provider 须显式映射勿强转
```

```csharp
[EntityAuthorize(PermissionFlags.Detail)]          // 或自定义位（如 16=超级管理员）
[HttpPost]
public ActionResult TestConnection([FromBody] IdInput input)   // 简单类型 id 不读 JSON body，须包 [FromBody] DTO
{
    var id = input?.id ?? 0;
    var ds = DataSourceConfig.FindById(id);
    if (ds == null) return Json(500, "数据源不存在", null, null);
    if (ds.ConnStr.IsNullOrEmpty()) return Json(400, "连接串为空", null, null);
    try
    {
        using var dal = CreateDataSourceDAL(ds);
        var probe = dal.DbType == DatabaseType.Oracle ? "SELECT 1 FROM DUAL" : "SELECT 1";  // Oracle 必须 FROM DUAL
        dal.Select<String>(probe).ToList();
        var maps = EntityMapping.FindAllByDataSource(ds.Id);      // 映射可读性：源表/源列真实存在
        var issues = new List<String>();
        foreach (var m in maps)
            foreach (var f in FieldMapping.FindAllByEntity(m.Id))
                try { dal.Select<object>($"SELECT * FROM {m.SrcTable} WHERE 1=0").ToList(); }
                catch (Exception ex) { issues.Add($"{m.SrcTable}.{f.SrcColumn}: {ex.Message}"); }
        return issues.Count == 0
            ? Json(0, "连接成功，全部映射可读", new { connected = true, tables = maps.Count, issues = Array.Empty<String>() }, null)
            : Json(0, $"连接成功，但 {issues.Count} 项映射不可读", new { connected = true, tables = maps.Count, issues }, null);
    }
    catch (Exception ex) { return Json(500, $"连接失败：{ex.Message}", new { connected = false }, null); }
}
```

> ⚠️ **动态写实体字段必须走属性 setter，勿用 `entity["Field"]=x` 索引器**：XCode 生成实体的 `this[name]` 索引器 setter 直接赋私有字段，**绕过 `OnPropertyChanged` 脏标记**；Save 的插入/更新 SQL 只含「必填列 + 脏字段」——可空且非脏字段被静默省略 → 落库为列默认值（症状：必填列正常、可空列恒 null、「影响 0 行」）。正确：按属性反射 `SetValue` + 目标类型转换、失败再退回索引器——helper 完整实现见 `references/troubleshooting.md` 附录（§8.1 迁移）。

**(2) 按指定数据源单独拉取**（区别于全量/增量同步，仅刷新该数据源）：
```csharp
[EntityAuthorize((PermissionFlags)16)]            // 16 = 超级管理员自定义位
[HttpPost]
public async Task<ApiResponse<Int32>> Pull(Int32 id)
{
    var ds = DataSourceConfig.FindById(id);
    if (ds == null) return ApiResponse.Error<Int32>("数据源不存在");
    if (ds.ConnStr.IsNullOrEmpty()) return ApiResponse.Error<Int32>("连接串为空");
    var n = await new DataSourceSyncService().SyncDataSource(ds);   // 增量 upsert，仅该数据源
    return new ApiResponse<Int32> { Code = 0, Message = $"已拉取 {n} 条", Data = n };
}
```

**(3) 作用域内聚合统计**（复用 `SearchData` 已带的本班/本人作用域过滤）：
```csharp
[EntityAuthorize(PermissionFlags.Detail)]
[HttpGet]
public ApiResponse<Object> StatusStats()
{
    var q = SearchData(new Pager { PageSize = Int32.MaxValue });   // 已带作用域过滤
    var total = q.Count();
    var activated   = q.Count(e => !e.WeComUserId.IsNullOrEmpty() && e.WeComStatus == 1);
    var unarchived  = q.Count(e => e.WeComUserId.IsNullOrEmpty());
    return new ApiResponse<Object> { Code = 0, Data = new { total, activated, inactivated = total - activated - unarchived, unarchived } };
}
```

- `Json(code, msg, data)` 返回 `ActionResult`，适合「探测/校验」类无强类型信封接口；有强类型聚合结果优先 `ApiResponse<T>`（前端统一响应解析一致）。
- **自定义业务权限位用 `PermissionFlags` 的 `[Flags]` 高位**（`1<<4=16`、`(PermissionFlags)32/64`），避免与内置 CRUD 4 位（1/2/4/8）冲突；`[EntityAuthorize((PermissionFlags)16)]` 即可。

## 九、配置控制器（ConfigController<T>）

与 MVC 一致，为 `Config<T>` 配置类暴露 Web 查看/编辑接口：

```csharp
[SchoolArea]
[DisplayName("订单设置")]
[Menu(0, false, Icon = "fa-cog")]
public class OrderSettingController : ConfigController<OrderSetting> { }
```

自动提供 Get（读取 `Config<T>.Current`）与 Update（线程安全 `Copy + Save`）。

### 9.1 定时作业（CronJob + CubeJobBase）——周期任务的标准落地方式

凡「周期性 / 需后台手动补跑 / 需执行记录」的后台逻辑，**建魔方定时作业，不要写成启动钩子**（`IHostedService` / `PreheatHostedService` 启动调用）。启动钩子的问题：只在启动跑一次、多进程重复执行同一写逻辑、无法手动补跑、无执行留痕。

```csharp
using System.ComponentModel;
using NewLife.Cube.Jobs;

/// <summary>作业参数（后台以 JSON 配置，表单按属性 + [DisplayName] 生成）</summary>
public class PlaceCodeMigrateArgument
{
    [DisplayName("产品编码")] public String ProductCode { get; set; }
    [DisplayName("仅预览")]   public Boolean DryRun { get; set; }
}

[DisplayName("场地编码对齐")]
[Description("按门锁编码确保场地树节点存在并绑定设备位置，幂等可重复执行")]
[CronJob("PlaceCodeMigrateJob", "0 0 * * * ? *", Enable = false)]
public class PlaceCodeMigrateJob : CubeJobBase<PlaceCodeMigrateArgument>
{
    protected override Task<String> OnExecute(PlaceCodeMigrateArgument argument)
    {
        var result = PlaceCodeMigrateService.Run(argument?.ProductCode, argument?.DryRun ?? false);
        return Task.FromResult(result.ToString());   // 返回值即后台「执行结果」，写清计数与原因
    }
}
```

- **命名空间** `NewLife.Cube.Jobs`（`CubeJobBase` / `[CronJob]`）；类随程序集**自动扫描注册**（`CronJob.Meta.Count` 可核），无需手工登记。
- **cron 为 Quartz 风格 7 段**（秒 分 时 日 月 周 年），如每小时 = `0 0 * * * ? *`、每天 8:30 = `0 30 8 * * ? *`。
- **`Enable = false` 是项目惯例**：默认不启用，上线由运维在后台「定时作业」页启用/停用/改 cron/手动「立即执行」/配参数，避免部署即自动跑写操作。
- `OnExecute` **必须自吞异常**（内部 try-catch 后返回摘要串），单作业失败不得影响其它作业；返回值会被记录为执行结果，**写清关键计数与跳过原因**（如「扫描1294 修正3 跳过1291」）。
- **服务方法设计配套**：被作业调用的 `Run(...)` 建议 ①幂等可重入 ②返回结构化结果对象 ③带 `dryRun` 仅预览开关（上线前先预览再执行）④异常在内部吞掉并记日志。
- **入口唯一化**：抽成作业后**删掉原有启动钩子**（Web 预热 + 其它进程 `IHostedService`），否则多进程并发执行同一写逻辑（本例 `PlaceCodeMigrateJob` 即删了 Web `PreheatHostedService` 调用与 IoT.Server 启动宿主两处）。
- 参考实现：`Web/Jobs/BatteryPredictJob.cs`（业务扫描）、`Web/Jobs/AlertPushJob.cs`（外部通道推送 + 参数回退）。

---

## 十、数据范围权限（行级 / 数据权限）

> 魔方提供**两套互补**的数据权限机制：
> 1. **角色数据范围（DataScope）** —— 基于 `Role.DataScope` + 实体接口（`IDataScope` 等）的“本人 / 本部门 / 本部门及下级 / 自定义 / 全部”自动过滤，由 `DataScopeContext` + `DataScopeInterceptor` 在查询与增删改时统一施加；**这是“数据范围权限”的主体**。
> 2. **控制器表达式过滤（DataPermissionAttribute）** —— 在控制器上写一段 `WhereBuilder` 表达式（支持 `{$user.Id}` / `{#SiteIds}` / `{#TenantId}` 占位符），作为更灵活的补充过滤。
> 二者可叠加：`DataScopeContext` 负责按角色范围，`DataPermissionAttribute` 负责按业务规则。

### 10.1 角色数据范围枚举 DataScopes

`XCode.Membership.DataScopes`（定义在 `Role.DataScope` 字段，角色管理界面下拉）：

| 值 | 枚举 | 含义 | 生成的过滤 |
|----|------|------|-----------|
| 0 | `全部` | 不限（系统角色即此） | 不过滤 |
| 1 | `本部门及下级` | 本人部门 + 所有子部门 | `DepartmentId IN (本部门及下级ID)` |
| 2 | `本部门` | 仅本人部门 | `DepartmentId = 本部门ID` |
| 3 | `仅本人` | 仅自己创建的数据 | `UserId = 当前用户ID` |
| 4 | `自定义` | 角色指定的若干部门 | `DepartmentId IN (角色.DataDepartmentIds)` |

- **多角色时范围取最宽（数值最小者胜出）**：`ctx.DataScope = roles.Min(e => e.DataScope)`（`DataScopes` 枚举数值越小代表权限越大）。
- **系统角色（`Role.IsSystem`）自动 `DataScopes.全部` 且 `ViewSensitive = true`**，免过滤、可见敏感字段。
- 无角色用户默认 `仅本人`。

### 10.2 实体接入数据范围（接口）

让实体“可被数据范围过滤”，实现以下接口之一（XCode 自动识别）：

```csharp
// 完整：同时按 用户 + 部门 过滤（如订单、工单）
public class Order : Entity<Order>, IDataScope
{
    [DisplayName("创建人")] public Int32 UserId { get; set; }      // 默认字段名 UserId
    [DisplayName("部门")]   public Int32 DepartmentId { get; set; } // 默认字段名 DepartmentId
}

// 仅需按用户：IUserScope（个人笔记等）
// 仅需按部门：IDepartmentScope（部门公告等）
// 字段名不是默认 UserId/DepartmentId/TenantId 时，额外实现：
public class Order : Entity<Order>, IDataScope, IDataScopeFieldProvider
{
    public FieldItem GetUserField() => Meta.Table.FindByName("CreateUserID");       // 自定义用户字段
    public FieldItem GetDepartmentField() => Meta.Table.FindByName("DeptID");       // 自定义部门字段
    public FieldItem GetTenantField() => Meta.Table.FindByName("TenantID");
}
```

- 默认字段名：`UserId` / `DepartmentId` / `TenantId`；非默认请用 `IDataScopeFieldProvider` 指定。
- 实体需**注册拦截器**才会在增删改查自动施加范围（见 10.4），或在 `Search` 里手动 `ApplyScope`。

### 10.3 DataScopeContext：范围上下文

```csharp
// 框架在每个请求建立（EntityAuthorize 解析菜单后 SetMenu；DataScopeModule 按当前用户+菜单创建）
var ctx = DataScopeContext.Current;        // AsyncLocal，随请求流转
// ctx.DataScope / ctx.UserId / ctx.DepartmentId
// ctx.AccessibleDepartmentIds  // 可访问部门ID列表（null=不限制）
// ctx.IsSystem                 // == DataScope==全部
// ctx.ViewSensitive            // 是否可见敏感字段（任一角色开启即可）
// ctx.MenuId                   // 当前菜单，用于菜单级数据范围覆盖
```

- **菜单级覆盖优先**：当 `IMenu.DataScope >= 0` 时，该菜单下的数据范围以菜单设置为准，覆盖角色默认值（`DataScopeContext.SetMenu(menu)` 内部处理）。
- 创建：`DataScopeContext.Create(user, menu)`；也可在代码里手动构建并赋值给 `DataScopeContext.Current`。

### 10.4 在查询 / 操作中施加范围

**方式 A（推荐，自动）**：实体静态构造器注册拦截器，之后所有 `FindAll` / 校验自动带范围：

```csharp
public partial class Order
{
    static Order()
    {
        Meta.Interceptors.Add<DataScopeInterceptor>();   // 查询自动 AND 范围条件；增删改自动校验归属
    }
}
```

**方式 B（手动）**：在自定义 `Search` 中拼接：

```csharp
public static IList<Order> Search(Int32 status, Pager page)
{
    var exp = new WhereExpression();
    if (status >= 0) exp &= _.Status == status;
    exp = exp.ApplyScope<Order>();          // 同时应用租户 + 数据范围过滤
    return FindAll(exp, page);
}
```

**单条校验**：改/删前判断归属，越权抛 `InvalidOperationException`：

```csharp
var o = Order.FindByID(id);
if (!DataScopeHelper.CanAccess(o)) throw new InvalidOperationException("无权操作此数据");
```

- `DataScopeInterceptor` 行为：`OnQuery` 给查询 AND 范围条件；`OnCreate` 自动填 `UserId/DepartmentId`；`OnValid` 对 Insert/Update/Delete 做归属校验（非本人/非本部门抛异常）；`IsSystem` 或 `DataScope==全部` 时整体放行。

### 10.5 控制器级表达式过滤（DataPermissionAttribute，补充机制）

```csharp
// 控制器/Action 级：expression 经 WhereBuilder 编译为查询条件
// 占位符：{$user.Id}=当前用户ID、{#SiteIds}=可访问站点集合、{#TenantId}=当前租户
[DataPermission("系统管理员,超级管理员",
    "CreateUserID={$user.Id} or linkId in {#SiteIds}")]
public class OrderController : EntityController<Order, OrderModel> { }
```

- 框架在 `CreateWhere()` 中：当前用户**非系统角色且不在 `SystemRoles` 列表**时，把 `Expression` 编译为 `WhereBuilder` 并对列表查询与 `FindData`（单行访问）施加；属于 `SystemRoles` 则跳过该过滤。
- `DataPermissionAttribute.Valid(roles)`：判断当前用户是否属于不受限的系统角色。
- 多租户下 `EnableTenant` 时还会追加 `TenantId={#TenantId}`（或 `Id={#TenantId}` 对 Tenant 实体）。
- 实体控制器（`ReadOnlyEntityController2`）已内置该逻辑；自定义 Action 若要复用，调用基类 `SearchData(Pager)` 即可继承过滤。

### 10.6 敏感字段遮蔽（IFieldScope）

```csharp
public class UserProfile : Entity<UserProfile>, IFieldScope
{
    public String[] GetSensitiveFields() => new[] { "IDCard", "Salary" };
    public Boolean CanViewSensitiveFields(Int32 userId) => userId == UserId; // 仅本人可看
}
// 查询后遮蔽（无 ViewSensitive 权限且非本人时，敏感字段置 "***"）
list.MaskSensitiveFields(context: DataScopeContext.Current);
```

- 是否可见由 `DataScopeContext.ViewSensitive`（角色 `ViewSensitive`）或“是否为本人数据”决定。

### 10.7 数据范围权限常见陷阱

- **两套机制别混淆**：`DataScopes`（角色范围，按部门/用户自动过滤）≠ `DataPermissionAttribute`（控制器表达式）；前者靠实体接口 + 拦截器，后者靠控制器标注。
- **实体必须实现接口 + 注册拦截器**：只标 `IDataScope` 不注册 `DataScopeInterceptor`、也未 `ApplyScope`，范围不会生效。
- **自定义字段名**：字段不叫 `UserId/DepartmentId/TenantId` 时务必实现 `IDataScopeFieldProvider`，否则过滤条件字段错。
- **多角色范围取最宽**：给用户配多个角色时，数据范围会放大到最宽角色，注意最小权限原则。
- **菜单级覆盖**：`IMenu.DataScope` 一旦设置（≥0），会覆盖角色默认值，排查“范围不对”时先看菜单设置。
- **系统角色免过滤**：`IsSystem` 角色 `DataScope` 自动为 `全部` 且可见敏感字段；后台任务/报表若以系统角色执行将看到全量数据。
- **`DataScopeContext` 随请求**：它是 `AsyncLocal`，仅在请求上下文中有效；脱离请求（如独立线程/后台任务）需手动 `Create` 并赋值 `Current`，否则退化为“按当前用户重建”或“无上下文放行”。
- 原文档里 `DataScopeContext.Disable()` **不存在**（当前版本无此方法）；要绕过范围请让执行用户为系统角色，或临时置 `DataScopeContext.Current` 为 `全部` 上下文。
- **`IDepartmentScope.DepartmentId` 是读写属性**：实体字段名不同（如 `DepartmentID`）时实现接口**必须 `get`+`set` 全写**，只写 `get => DepartmentID` 会触发 **CS0535 接口未实现**（接口成员含 setter）。
- **只读视图 + 本班/本人作用域（AdvisorScope 模式）**：班主任/本人只能看自己范围，用 `ReadOnlyEntityController<T>`（禁写）+ 重写注入作用域（从 Cookie/角色取范围 ID，拼 `Where(x => x.ScopeID == scope)`）；只读控制器天然无 Insert/Update/Delete，配合作用域既防越权又防误写。
- **自定义权限位用 `PermissionFlags` 的 `[Flags]` 高位**：业务动作（连接测试/手动拉取/下发指令）用未占用位（如 `1<<4=16`、`(PermissionFlags)32/64`），避免与内置 CRUD 4 位（1/2/4/8）冲突；`[EntityAuthorize((PermissionFlags)16)]` 即可。

---

## 十一、导出

```http
GET /api/School/Student/ExportFile?format=excel   # WebApi 版“excel”实际输出 CSV（跨平台兼容）
GET /api/School/Student/ExportFile?format=csv
GET /api/School/Student/ExportFile?format=json
GET /api/School/Student/ExportFile?format=xml
```
返回 `FileStreamResult` / `FileContentResult`，文件名含 `DisplayName + 时间戳`。
子类可重写 `OnGetChartData` 提供 ECharts 配置（`GetChartData` 接口）。

---

## 十二、常见陷阱（精选 + 全量入口）

> **全量 35+ 条（含症状→修复与已落地代码指针）已外移 `references/troubleshooting.md`（保真）**。排障先看该文件条目标题命中症状；以下仅保留最高频行为警示：

1. **`[AllowAnonymous]` 只对 Action 方法生效**，标在类/控制器上无效（第 0 层鉴权只认方法级）——匿名接口必须方法级标注（§14.4 门户）。
2. **`AddCube()` 内部注册返回 null 的 `ITracer` 工厂会覆盖外部注册**：`AddSingleton<ILog>`/`AddSingleton<ITracer>` 必须在 `AddCube()` **之后**注册；**`AddControllers()` 是 `UseCube` 的硬依赖**，纯 WebApi 也必须手动调用。
3. **不要混用 `NewLife.Cube.AdminLTE`（魔方 MVC 版前端皮肤）**：本技能是 WebApi 版（控制器返回 JSON）；MVC 版 Razor/Up/Down(302) 与 WebApi 不兼容，给 WebApi 项目加 AdminLTE/UseTabler 等 → 空白/500/路由冲突。前端用独立 SPA（cube-webapi-tdesign）消费 `/api` JSON。
4. **部分字段 PUT 会重置为默认值（账号被禁用事故）**：`EntityController` Insert/Update 按**整实体**绑定，PUT 未传字段被重置为默认——保存须带全必填/关键字段原值；`ConfigController<T>.Update` 走 XCode `Copy(obj, ignoreNull:false)`，缺省字符串属性被清空为 null（数据丢失）。
5. **`ListFields`/`DetailFields.RemoveField("敏感列")` 只裁剪元数据**（GetFields/表单/列表列），**绝不裁剪 JSON 响应体**；投影脱敏**勿原地改** `FindAll`/`FindByKey` 返回的实体（共享缓存实体被污染）——拷贝副本再遮蔽。
6. **不要自定义 `UploadFile` 动作**（`EntityController<T>` 已自带，重名冲突）；上传 `POST /{area}/{ctrl}/UploadFile`，返回 `data:{attId, filePath:/cube/image?id=, contentType}`（§14.3）。
7. **启动时勿手写数据层预热**（`EntityFactory.InitConnection`/`InitAll`）——`UseCube` 已内置，重复调用 + SQLite `:memory:` 连接串覆盖 = 所有接口 500 / `no such table`；SQLite 相对路径基于**进程 CWD** 而非 ContentRoot。
8. **`[Map]` 派生（仅显示）属性被收进新增/编辑表单 → Insert 静默 `code:-2 添加失败`**（不抛异常，极难排查）：表单字段须 RemoveField 裁剪；**重写 `Valid` 做唯一性/业务校验时 Delete 也要排除自身**（否则删除被吞成「删除失败！」）。
9. **`PermissionFlags` 必须 > None，自定义位用更高位**（1/2/4/8 已被 CRUD 占用）；权限项由框架扫描 Action 自动生成（`ScanActionMenu`），勿手写权限项。
10. **`EnableFieldValidation` 默认关闭**：需字段级错误（`fieldErrors`）时子类 `override EnableFieldValidation => true`（§3.4 校验）。
11. ★ **发邮件不要用 `System.Net.Mail.SmtpClient`**：它**不支持 465 隐式 SSL**（`EnableSsl` 实为 STARTTLS，先明文再升级），而 QQ/163/126 的 SMTP 端口正是 465 —— 用它在**连接阶段**就失败，症状是「邮件静默没发出、发件方『已发送』里也没有」（根本没投递）。该类型也已被微软标记 Obsolete。**用 MailKit**（`MailKit 4.8.0` + MimeKit + BouncyCastle）：
    ```csharp
    var opt = cfg.Port switch { 465 => SecureSocketOptions.SslOnConnect,   // 隐式 SSL
                                587 => SecureSocketOptions.StartTls,       // STARTTLS
                                25  => SecureSocketOptions.StartTlsWhenAvailable,
                                _   => SecureSocketOptions.Auto };
    await client.ConnectAsync(cfg.Server, cfg.Port, opt);
    ```
    配套：魔方 `MailConfig.Password` 要填**SMTP 授权码**而非登录密码（否则 535 认证失败）；云厂商常封 25 端口。
12. ★ **魔方邮件有两道静默前置开关**：`Parameter` 键 **`EnableMail`** 必须为 `'true'`，**且** `MailConfig` 至少一条 `Enable=1`（Server/UserName 非空）。任一不满足则邮件被**静默跳过**（不报错、不投递）。排查这类「客户收不到邮件」时不要靠真实业务盲测——加一个**自检 Action**（逐步报告开关值 → 配置条数 → 命中配置 → SSL 模式 → 可选实发测试邮件），一次拿到真实阻断点。
13. **同名类型歧义**：引入 `MailKit`/`MimeKit` 后，`Parameter` 会与 `XCode.Membership.Parameter` 撞名（CS0104）。魔方侧必须写全限定 `XCode.Membership.Parameter`。
14. ★ **项目 `<Nullable>enable</Nullable>` 时，实体 `String` 属性在模型绑定期被隐式 `[Required]`**（NRT 隐式必填，2026-09-19 实测）：WebApi 插入报 `The XX field is required`（fieldErrors），报错发生在**实体 `Valid` 之前**——改 `Valid`/拦截器 `AllowEmpty` 全部无效。诊断特征：请求体**没提供**的字符串字段全报必填、**提供了**的不报，与 XCode `DataObjectField` 可空性无关。修复：`services.AddControllers(o => o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true)`；审计字段（CreateUser/CreateIP 等）自动填充用「`Valid(DataMethod)` 前置 `IEntity` 索引器预填助手」，前端表单渲染与提交载荷同步剔除这 8 个系统字段。
15. ★ **`POST /Auth/Refresh` 契约**：请求体**必须带 `userName`**（缺则 `FindByName(null)` → NRE 500）；响应 `data` 键为 `token/refreshToken/expireIn`（**`new { Token }` 经 camelCase 序列化成全小写 `token`**，不是 `accessToken`；登录响应反而是 snake_case `access_token`）——前端刷新逻辑必须三向兜底，否则「刷新 200 但被判失败 → 整页弹回登录页」。

> 更多索引：路由前缀/区域缺失（新 Area 须标 `[XxxArea]`）、Swagger 双重 `IsDevelopment()`、实体列名撞 SQL 保留字（Order/Group/User…）、启动并发写锁致 Menu.Permission 回填失败、`FindAll` order 用真实数据库列名、字段默认值勿用 SQLite 非法 `DefaultValue`、swagger/`GetFields` 匿名访问边界 → **`references/troubleshooting.md`**。

## 十三、端到端示例：IoTHub 设备 / 协议 API

> 全量示例（选型总览 / 实体接入数据范围（多租户+部门+本人）/ 标准 CRUD 控制器 / 自定义权限位下发指令·远程配置 / 多租户菜单可见性 / 端到端鉴权与数据范围流 / 要点回顾）已保真外移 **`references/example-iothub.md`**。写设备/协议/同形态多租户业务 API 前先对照该文件——把 §三 控制器选型、§六 自定义权限位、§十 数据范围权限串成可直接套用的范例。

## 十四、前端联调契约速查（后端产出事实）

> **归边说明**：本节只记录**后端契约事实**（端点/路由/响应形态/大小写/匿名边界）。前端如何消费——camelize 实现、`normToken` 三向兜底、axios 三件套、Vite 代理、登录页按 LoginConfig 动态组装——**一律归 `cube-webapi-tdesign`**（其 `references/troubleshooting.md` G1/G2/G6/G7），本技能不再重复前端代码。
> ⚠️ 后端 JSON 行为随版本漂移：**HTTP 实测（curl 探针，`references/curl-smoke.md`）比读源码/dll 反射更准**；契约键名以真实 HTTP 响应为唯一权威。

### 14.1 登录契约（实测，与文档有出入）
| 项 | 实测 | 注意 |
|---|---|---|
| 端点 | `POST /Auth/Login`（AuthController，无 `/api` 前缀） | `/Admin/User/Login` 仅保留 MVC 皮肤/SSO 回调 |
| 请求模型 | `LoginModel`（dll 反射：`Category/Username/Password/Remember/ChallengeId/Pkey/CaptchaId/CaptchaCode`） | HTTP 绑定大小写不敏感；前端惯用 `username` |
| `category` | 枚举 `AuthCategory` **整数**（Password=0/Mobile=1/Mail=2/OAuth=3） | **未注册 JsonStringEnumConverter**：传字符串/空串 → `code:-2` |
| 令牌键名 | `data.access_token` / `refresh_token` / `expire_in`（snake_case） | 文档曾写 accessToken；前端 `normToken` 三向兜底 |
| 鉴权头 | `Authorization: Bearer <token>` | `LoadToken` 亦支持 X-Token/Cookie/Query；前端双头保险 |
| 登录配置 | `GET /Auth/LoginConfig`（匿名）；`oAuth` 键**大写 A** | 前端双向归一、页面读 `config.oAuth` |
| MFA/Challenge/Refresh | `/Mfa/*`、`/Auth/Challenge`、`/Auth/Refresh`（均无 `/api`） | 消费细节归 tdesign |

### 14.2 响应 JSON 大小写（后端输出事实）
- **响应体 PascalCase**（`Id`/`Title`/`CreateUserID`/`PublishTime`），非 CamelCase（旧文档误述 FastJson CamelCase）。前端须 `camelize`（缩写白名单 ID/URL/API/HTTP/IP 规则见 tdesign）。
- **请求体大小写不敏感**（ASP.NET ModelBinder 不区分）——前端发 PascalCase 或 camelCase 均可绑定。
- **Int64 序列化为字符串**（大整数 id 防前端精度丢失）。

### 14.3 标准 CRUD 路由（EntityController<T>）
| 操作 | 路由 | 注意 |
|---|---|---|
| 列表 | `GET /api/{area}/{ctrl}?pageIndex=&pageSize=` | `data` 数组 + 独立 `page` |
| 详情 | `GET /api/{area}/{ctrl}/Detail?id=` | **id 在 query**；路径 `/Detail/{id}` 返回空 |
| 新增 | `POST /api/{area}/{ctrl}`（body=实体） | 成功 `code:0` |
| 修改 | `PUT /api/{area}/{ctrl}`（body 带 `id`） | **整实体绑定**：带全原值（§十二 4） |
| 删除 | `DELETE /api/{area}/{ctrl}?id=` | 单条 |
| 自定义动作 | `POST /api/{area}/{ctrl}/{Action}?id=` | 返回 `ApiResponse<String>`（Code=0/500） |

**基类额外动作（实测可用，勿重复造轮子）**：
- `UploadFile`：`POST /api/{area}/{ctrl}/UploadFile`，`multipart/form-data` 字段 `file` → `data:{attId, filePath:"/cube/image?id=xxx.png", contentType}`；`filePath` 相对路径（前端 `src` 直接用；Vite 须代理 `/cube`）；**子类勿定义同名动作**（§十二 6）。
- `ChangePassword`：`POST /api/{area}/User/ChangePassword`，`{id, oldPassword, newPassword, newPassword2}`；同旧密码报「修改密码不能与原密码一致」。
- **WebApi 无 MVC 专属接口**：`MyProfile`(500)、`SysSetting`/`CubeSetting`/`UserCenter/*`(404)。个人中心/改密方案 = 复用 Admin/User 标准 CRUD：`GET /api/Admin/User?key={name}` 定位 → `Detail?id=` 取全 → `PUT /api/Admin/User` 保存（**必须带回 `roleId/departmentId/enable/online` 原值**，否则校验失败或把账号改禁用）→ 头像走 UploadFile 回填 `avatar`。

### 14.4 匿名门户（PortalController 模式）
`PortalController : ControllerBaseX`（**不继承 EntityController**，规避鉴权）：列表接口返回 `{items,totalCount,pageIndex,pageSize,pageCount}`（**`data` 是对象不是数组**，与实体列表格式不同，前端须分支）；`Detail?id=` 等。全部 `[AllowAnonymous]` 且必须标在 **Action 方法**上（§十二 1）。

### 14.5 前端工程落地坑（跨端事实，代码归 tdesign）
Vite 代理 target `127.0.0.1` 勿 localhost / npm registry 换镜像 / manualChunks 拆 vendor / base 子路径 / DialogPlugin.confirm / `@submit.prevent` 崩溃——已全部归 `cube-webapi-tdesign`（troubleshooting G8/G6），此处不重复。
**跨端事实（后端行为，须知）**：SQLite 同页 3+ 并发查询会死锁（busy timeout 不够，前端表现为永久 loading）→ 前端应串行发请求；治本在后端连接串加 `Busy Timeout=15000`（见 `references/troubleshooting.md` `:memory:` 条）。

### 14.6 联调验证清单（冒烟）
`POST /Auth/Login` 返 `access_token` → 带 Bearer `GET /api/{area}/{ctrl}` 200+`data` 数组 → **不带 token 401**（鉴权链路通）→ 门户 `data` 为对象（分支）→ camelize 后字段对齐（`createUserID`）→ 自定义动作 `code:0` → 多接口串行、无永久 loading。

### 14.7 标准冒烟探针脚本（curl）
完整五步脚本（登录→token→401→匿名门户→`Detail?id=`）与判定标准、PowerShell 取 token 替代写法 → **`references/curl-smoke.md`**。改登录/路由契约或部署后必跑（§十五.7 同引用）。

### 14.8 后台项目首次启动排错（实测坑，2026-09）
| 现象 | 根因 | 修法 |
|---|---|---|
| `no such table: Parameter/UserOnline`，Data 目录无 db 文件 | 连接串写成 `DataSource=`（无空格），XCode 解析异常不建表 | 必须写 **`Data Source=`**（带空格）；建议再加 `Journal Mode=Wal;Busy Timeout=30000` |
| 业务库（自建 ConnName）一张表都没有 | `UseCube` 内部 `InitAll` 只扫**已加载**程序集，业务实体 dll 未 JIT 加载 | `Program.cs` 中 `AddControllers()` 后加一行 `_ = typeof(你的实体).Assembly;` 触发加载 |
| 实体控制器 404 | 路由是 Cube 自带的 **`api/{area}/{controller}/{action}`**，漏了 `api` 前缀；也**不要**手写 `MapControllerRoute` | 用 `/api/{Area}/{Ctrl}/GetPage`；诊断可临时加 `/_routes` 端点打印 `EndpointDataSource` |
| `DELETE` 报 `The id field is required` / `GET /Delete?id=` 404 | 删除走 `DELETE /api/{area}/{ctrl}?id={id}`（query，非 body、非路由段） | 按此调用；`DeleteSelect` 同理 |
| 编译 MSB3021/3026/3027（dll 被锁） | 上次 `dotnet run` 的进程未退出 | 编译前先 `Stop-Process -Name <项目名>`（PowerShell），再 build |
| Swagger 里看不到实体控制器 | ApiExplorer 未收录（不影响调用） | 用 `/Cube/Apis` 拿全量 API 清单，或按 §14.7 直接 curl |
| 菜单页硬刷新得到 404 JSON 或实体 JSON（不是页面） | 根命名空间区域路由与前端菜单页路径**同名**，Kestrel 缺 SPA 回退（dev 有 `spaAwareBypass`，prod 没有） | 加 **SPA 导航分流中间件**（§2.1 / `references/spa-hosting.md`） |

## 十五、生成生产部署包（可复用 Playbook）

> 全量 Playbook 已保真外移 **`references/deployment.md`**（适用场景 + 15.1 目标产物结构 + 15.2 后端发布 + 15.3 Production 配置并入 + 15.4 上线前必改红线 + 15.5 Nginx 模板 + 15.6 systemd + 15.7 本地冒烟 + 15.8 README 模板 + 15.9 常见坑）。上线部署时读。快速要点：
- **发布**：`dotnet publish <Web>.csproj -c Release -r linux-x64 --no-self-contained -o publish/backend`（本机 Windows/.NET 10 SDK 也能出 linux-x64 包）；SDK 10 + 新增包时 `dotnet restore` 可能 NuGet 异常 → `--no-restore` 复用已还原资产。
- **上线必改红线**：`Cube.JwtSecret` → 强随机 `openssl rand -hex 32`（占位串上线 = 令牌可伪造）；`Cube.CorsOrigins` → 真实前端域名。
- **本地冒烟**：`DOTNET_ROLL_FORWARD=Major` + `ASPNETCORE_ENVIRONMENT=Development`（Production 的 AllowedHosts 限域名，127.0.0.1 会 400）跑 net8 包 → 执行 `references/curl-smoke.md` 冒烟；**测试库务必清理**再打包。
- 连接串反斜杠（Windows `Data\*.db` → Linux 解析错乱，一律正斜杠）等坑 → `references/deployment.md` §15.9。
- **前端构建与同步**（`npm run build` → dist → `publish/frontend`、base 路径、manualChunks）→ `cube-webapi-tdesign` §十。

## 推荐检查项

- [ ] `Program.cs` 已 `AddControllers()` + `AddCube()`，且 `ITracer`/`ILog` 注册在 `AddCube()` **之后**（防被 AddCube 内部 null 工厂覆盖）
- [ ] 未在 Program.cs 手写数据层预热（`UseCube` 已内部 `InitAll`/`InitAllAsync`，见 §1.2）；运行时动态新增连接（多租户租户库/插件）才用 `EntityFactory.InitConnection(连接名)`，且放在 `UseCube` 之后
- [ ] **自建业务库的实体程序集已被触碰**（`_ = typeof(实体).Assembly;`），否则该库不建表（§14.8）
- [ ] SQLite 连接串写 `Data Source=`（带空格）+ `Journal Mode=Wal;Busy Timeout=30000`（§14.8）
- [ ] 纯自定义匿名控制器（回调/门户/开放 API）的 `[AllowAnonymous]` 标在**每个 Action 方法**上（类上标注对第 0 层鉴权无效）
- [ ] 前后端同域部署：已有 **SPA 导航分流中间件**（注册在 `UseCube` 之前，判 `Sec-Fetch-Mode: navigate` / `Accept: text/html`），且 `MapFallback` **未**维护前缀白名单；业务区域名避开框架前缀 `Auth`/`Cube`/`Sso`/`Mfa`（§2.1，细节 `references/spa-hosting.md`）
- [ ] 实体控制器标注了区域特性（如 `[SchoolArea]`）、`[DisplayName]`、`[Menu]`
- [ ] 已按业务选对基类：标准 CRUD 用 `EntityController`；只读/字典/报表用 `ReadOnlyEntityController`；树形实体（WebApi）用 `EntityTreeApiController`（非 `EntityTreeController`）；纯自定义接口用 `ControllerBaseX`。需要字段级校验的已 `override EnableFieldValidation => true`
- [ ] 字段定制写在 `static XxxController(){}` 而非实例构造器
- [ ] 自定义 Action 已标注 `[EntityAuthorize]` 或 `[AllowAnonymous]`
- [ ] 需要非 CRUD 的业务权限时，已用更高权限位 `(PermissionFlags)16/32` + `[DisplayName]` 标注，且角色管理能正确显示该权限项
- [ ] **同一控制器内权限位无重复**（重复会使整个控制器的权限项注册失败，运行时报「找不到菜单」/权限名为空；用 grep 逐位核对，重启后在 `Menu.Permission` 验证）
- [ ] 控制器已通过 `[Menu]` 声明可见性 `Mode`（`Admin`/`Tenant`/组合），避免租户/后台越权可见
- [ ] 前端调用 `GetFields`/`GetPage` 驱动动态界面，未硬编码字段
- [ ] 生产环境 `CubeSetting.JwtSecret` 为强密钥；`CorsOrigins` 已限制
- [ ] 多租户场景已正确配置 `DataPermission` 表达式与 `EnableTenant`
- [ ] 需要行级数据范围时，实体已实现 `IDataScope`/`IUserScope`/`IDepartmentScope` 并注册 `DataScopeInterceptor`（或在 `Search` 中 `ApplyScope`），角色 `DataScope` 已按“本人/本部门/本部门及下级/自定义/全部”配置，并注意多角色取最宽范围
- [ ] 敏感字段已用 `IFieldScope` + `MaskSensitiveFields` 处理脱敏
- [ ] 纯 WebApi 服务**未引用** `NewLife.Cube.AdminLTE` / 任何主题包（Razor 前端是 MVC 版，与 WebApi 不兼容）；`Program.cs` 仅 `AddCube()` + `UseCube()`
- [ ] Swagger（若启用）已用 `IsDevelopment()` 双重包裹服务注册与中间件（§1.1），且已装 `Swashbuckle.AspNetCore` 包、`using Microsoft.Extensions.Hosting;`；生产环境实测 `/Swagger` 404、业务接口正常

---

