---
name: troubleshooting
description: cube-webapi-backend 后端排障手册 —— 常见陷阱全量条目（保真，按需读取）。SKILL.md §十二 只保留最高频警示；遇到后端异常（编译/路由/权限/数据范围/序列化/部署）先查本文件定位症状。
---

# Troubleshooting —— cube-webapi-backend 后端陷阱手册

> 收纳原 SKILL.md §十二「常见陷阱」全部条目（**保真**）。排障路径：**看条目标题（症状关键词）→ 命中再读全文**。文内 `§x.y` 指 SKILL.md 章节号（编号未变）。

## 十二、常见陷阱

- **静态构造器字段配置是全局一次性操作**，禁止在实例方法（`OnActionExecuting` 等）中修改 ListFields。
- **GetFields / GetPage 默认匿名可访问**，但数据接口须登录鉴权，别误以为元数据接口能拿到数据。
- **路由前缀**：实体/后台控制器走 `/api` 前缀；`Auth`/`Cube`/`Sso` 服务控制器**无** `/api` 前缀，自定义路由不要再手写 `/api`。
- **区域缺失**：`[area]` 路由 token 依赖 `[XxxArea]` 区域特性/注册，缺它会 404 或菜单解析错乱。
- **PermissionFlags 必须 > None**；`EntityAuthorize(权限位)` 带参构造禁止传 `None`/`0`（会抛 `ArgumentNullException`）。需“仅登录”依赖全局过滤器，别用空构造。
- **自定义权限位要用更高位**（如 `(PermissionFlags)16/32`），并给 Action 加 `[DisplayName]` 命名；标准 4 位（≤Delete）会自动取“查看/添加/修改/删除”描述。
- **权限项是扫描自动生成的**，不要手写菜单/权限记录；改了 `[EntityAuthorize]`/`[DisplayName]` 后需触发扫描（重启或首次访问）才在角色管理生效。
- **`[Menu]` 的 `Mode` 决定租户隔离**：纯 `Admin` 菜单租户不可见、纯 `Tenant` 菜单后台不可见；跨端可见需用 `Admin | Tenant`。
- **TModel 的来源**：Build.tt 从 Model.xml 生成 `*.Models`；未生成时令 `TModel = TEntity`。
- **生产必须配置强 JwtSecret**，否则令牌不安全。
- **EnableFieldValidation 默认关闭**：想拿到 `FieldErrors` 字段级错误须经子类 `override EnableFieldValidation => true`（源码注释“默认 true”不实，实际 `=> false`），开启后 Insert/Update 才做元数据必填/长度校验。
- **数据范围权限两套机制别混**：`Role.DataScope` + 实体接口（`IDataScope` 等）+ `DataScopeInterceptor` 是“按部门/本人自动过滤”；`DataPermissionAttribute` 是“控制器表达式过滤”。前者不注册拦截器/不 `ApplyScope` 不会生效，自定义字段名必须实现 `IDataScopeFieldProvider`。
- **树形实体用错基类**：WebApi 树形接口必须继承 `EntityTreeApiController<TEntity,TModel>`（Up/Down 返回 JSON）；误用 `EntityTreeController` 会让 `Up/Down` 返回 302 `RedirectToAction`，前端拿不到数据。普通实体不能当树用（`TEntity` 须 `: EntityTree<TEntity>`）。
- **需要写操作却用 `ReadOnlyEntityController`**：它天生无 Insert/Update/Delete，别在子类手写写接口绕过只读——直接改用 `EntityController`。
- **⚠️ 不要混用 `NewLife.Cube.AdminLTE`（魔方 MVC 版前端）**：它是服务器渲染的 Razor 管理前端，依赖 MVC 控制器（`return View()`、`Up/Down` 返回 `RedirectToAction` 等）。与 WebApi 后端（控制器返回 JSON、`EntityTreeApiController.Up/Down` 返回 JsonResult）**不兼容**。给 WebApi 项目加 `AdminLTE` 或 `UseTabler/UseMetronic/UseTDesign` 主题调用，会导致页面空白/500、路由冲突、体积膨胀。WebApi 后端只需 `AddCube + UseCube`，前端用独立 SPA（TDesign Vue / React / 小程序）消费 `/api` JSON。两者二选一，不可混搭。
- **⚠️ `AddControllers()` 是 `UseCube` 的硬依赖，纯 WebApi 也必须手动调用**：`UseCube` 内部 `MapControllerRoute(...)` 要求 DI 已注册 MVC 控制器服务，否则启动即抛 `Unable to find the required services. Please add all the required services by calling 'IServiceCollection.AddControllers'`。**注意：这不代表项目"引入了 MVC 服务器渲染"**——`Microsoft.AspNetCore.Mvc` 程序集提供的是 Controller 基础设施，`[ApiController]`/`[Route]`/`[HttpPost]` 等 REST 特性本就来自它，REST API 与服务器渲染共用同一套；真正的 MVC 标志是 Razor 视图（`.cshtml`）、`return View()`、主题包。纯 WebApi 引用 `AddControllers()` 完全正常，勿因此误判架构跑偏。
- **⚠️ `[AllowAnonymous]` 只对 Action 方法生效，标在类上无效**：魔方第 0 层鉴权 `ControllerBaseX.OnActionExecuting` 用 `MethodInfo.IsDefined(typeof(AllowAnonymousAttribute))` 判匿名，**不回溯类型特性**。纯自定义匿名控制器（RADIUS 回调 / 自助门户 / 开放 API）必须在**每个 Action 方法**上逐个标 `[AllowAnonymous]`，只在类上标会被 `403 "认证失败"` 全链路拦截。三层响应体可据此定位：`{code:403,message:"认证失败"}`（无 traceId/fieldErrors）= 第 0 层；`{code:401,message:"没有登录或登录超时！"}` = EntityAuthorize 未登录；`{code:403,message:"{user}访问资源...需要...权限"}` = EntityAuthorize 无权限。
- **⚠️ `AddCube()` 内部注册了返回 null 的 `ITracer` 工厂，会覆盖外部注册**：MS DI 取**最后**一个描述符。`AddCube` 注册 `ITracer => DefaultTracer.Instance`（未初始化时 null），若在 `AddCube` **之前**注册 `ITracer`/`ILog` 会被覆盖，`UseCube → UseStardust` 内部 `GetRequiredService<NewLife.Log.ITracer>()` 抛 `No service for type ITracer has been registered`。**正确顺序**（详见第一节 Program.cs）：`AddCube()` → `DefaultTracer.Instance ??= new DefaultTracer()` → `AddSingleton<ITracer>(...)` + `AddSingleton<ILog>(XTrace.Log)`。
- **SQLite 连接串相对路径基于进程 CWD 而非 ContentRoot**：`DataSource=..\Data\x.db`，`dotnet run`（CWD=工程目录）与直接跑 `bin/Debug/net8.0/*.dll`（CWD=输出目录）会解析到**不同** Data 目录，造成"建了表却查不到 / 冒烟打到旧库"。调试时固定一种启动方式并核对解析结果。
- **XCode `FindAll` 的 order 是裸 SQL 片段，用真实数据库列名**：SQLite 表若经 `BindColumn` 映射为 snake_case（FreeRADIUS 标准表 `acct_start_time`/`timestamp`），order 必须写 `"acct_start_time DESC"` 而非 C# 属性名 `"AcctStartTime DESC"`，否则 `no such column`。自有库列名即属性名（PascalCase），用驼峰。
- **XCode 实体字段默认值不要用 `[BindColumn(DefaultValue="...")]` 写 SQLite 非法语法**：如 `DefaultValue=":="` 会生成 `DEFAULT :=`（非法），`CreateTable` 静默失败（日志仅"修改表CreateTable失败！SQL logic error"），导致 `no such table`。改在字段初始化器赋值（`private String _Op = ":=";`），Model.xml 同步移除 `DefaultValue`。
- **⚠️ `ListFields`/`DetailFields.RemoveField("敏感列")` 只裁剪元数据(GetFields/表单/列表列定义)，绝不裁剪 JSON 响应体**：实测 `GET 列表` 与 `GET Detail` 仍把被移除列的**明文值序列化返回**（本项脱敏密钥泄露事故）。真正的数据脱敏必须在控制器层做：① `Search(p)` 返回 `FindAll(...).Select(投影新实体{Secret=Mask(...)})`；② 重写 `Detail`：`public override ApiResponse<TEntity> Detail(String id)`（注意基类签名是 **string id** 不是 int，用 `((IEntity)e).IsNullKey` 判空）返回投影脱敏；③ Insert/Update 回显前 `ret.Result.Data.Secret=Mask(...)`；④ 需看明文另开高权限 Action（如 `ShowSecret`，`[EntityAuthorize((PermissionFlags)16)]`+审计）。
- **⚠️ 投影脱敏切勿 `foreach(e in list) e.Secret=Mask(...)` 原地改 FindAll/FindByKey 返回的实体**：XCode 实体是缓存对象，赋未变值仍会标脏（HasDirty），并发/后续 `Save` 可能把掩码 `**` 误写回库覆盖真实密钥。必须 `new TEntity{ 逐字段复制, Secret=Mask }` 生成**游离实例**再返回。
- **⚠️ 新增控制器后 `Menu.Permission` 权限项回填失败 / 菜单行丢失（SQLite 启动并发写锁）**：Cube 启动异步初始化多线程并发写 `Membership.db`，SQLite 默认 busy timeout 常不够 → 日志 `code=Busy(5) database is locked`，`Menu.Save()` 的 INSERT/UPDATE **静默异常**。表现=新菜单行缺失或其 `Permission` 列为空，访问接口报 `{code:403,"...需要 查看 权限"}`（`设计错误！验证权限时无法找到[XxxController/Index]的菜单`）。修复：① 连接串加 `Busy Timeout=15000`（appsettings 各 sqlite 连接串，如 `DataSource=..\Data\Membership.db;Provider=sqlite;Busy Timeout=15000`）治本；② 已发生的补数据：手工 `INSERT Menu 行(Name,DisplayName,FullName,ParentID,Url,Permission='1#查看,2#添加,...')` + 把新菜单 ID 补进 `Role.Permission` 串（格式 `{menuId#位掩码}` 逗号分隔，`-1`=该菜单全部子权限，`19#1` 为系统管理特例）。生产首次部署建议串行初始化或预置 admin 全权。
- **⚠️ 启动直接崩溃：`database is locked`（发生在 `UseCube → EntityFactory.InitAll`）——另一种成因是「上一实例被强杀后残留的锁」**：日志形如 `Unhandled exception. code = Busy (5) ... database is locked`，栈底是 `CubeService.UseCube → EntityFactory.InitAll → SQLiteMetaData.OnGetTables`，**进程根本起不来**（与上一条「起来了但静默丢菜单」不同，别混为一谈）。实测成因（2026-09-13，从零新建后端时踩到）：前一个 `dotnet run` 实例被强杀/异常退出后，`bin/**/Data/*.db-wal`（及 `-shm`）仍是热状态且被残留进程持有 ⇒ 新实例初始化即撞锁。⚠️ 此时 `rm -rf bin/**/Data` 会**假成功**（进程未退出时目录删不掉，但命令不报错、也不残留报错输出），表现为「删了库重启还是撞锁」，极易误判成"删除无效"或"配置错误"。处置顺序：① 用 `tasklist` / `netstat -ano` 确认**没有**残留 dotnet 进程持有该 Data —— 后端**必须单实例**运行；② 确认进程已退后再删净 `Data/`（含 `.db-wal`/`.db-shm`）；③ 重新启动。已启用 `Journal Mode=Wal` 时正常退出会自行清理 wal，**勿用强杀**结束正在初始化的实例。
- **⚠️ `ConfigController<T>.Update` 走 XCode `Copy(obj, ignoreNull=false)`，部分字段 PUT 会把缺省字符串属性清空为 null（数据丢失事故）**：反编译确认 `ConfigController.Value` setter = `current.Copy(value,false)`——第二参 false 即"不忽略 null"，前端只回传部分字段（或 JSON 里字段值为 null）时，未携带/为 null 的 String 列被直接写空，既有配置被毁（实测：冒烟部分 PUT 后 `schoolDomain`/`operatorName` 全变 null，下游渲染器 `Quote(null)` 抛 NullReference → Preview 接口 500）。三层防御：① 渲染/消费侧对 null 容忍（`Quote(String? v){ v ??= "" }` 而非表达式体直接 `v.Replace`）；② 控制器重写 `protected override T Value` 的 setter，把 String 类型 null 回落为类型默认值（`new T()` 的属性值）再 `base.Value=value`；③ 或重写 `[HttpGet] Index()` 读时自愈+Save。**根治**：前端配置表单必须"整对象回传"（GET 全量→改→PUT 全量），不能只 PUT 改动字段。
- **⚠️ 实体列名撞上 SQL 保留字（`Order`/`Group`/`User`/`Key`/`Desc` 等）会让 XCode 生成的 `ORDER BY col` 语法报错**：XCode 的 `FindAll(where, "ParentId ASC, Order ASC", ...)` 里 order 串**原样拼接**进 SQL，SQLite 报 `near "Order": syntax error`。修复：① order 串里给保留字列名加**双引号** `"\"Order\" ASC"`（SQLite 标识符引用符是双引号；MySQL 是反引号，故跨库项目应改列名）；② 更稳妥是 Model.xml 里就把该列命名为非保留字（`Sort` 优于 `Order`），改列名需 `xcode NvX.xml` 重新生成实体 + 迁移既有 DB 列。本项目 WecomDepartment.Order 走双引号转义（开发期 SQLite），若上生产 MySQL 需改列名。
- **⚠️ `EntityController` 的 Insert/Update 按整实体绑定，部分字段 PUT 会把未传字段重置为默认值（账号被禁用事故）**：实测 `PUT /api/Admin/User` 只传 `{id,name,displayName,sex,mail,mobile,remark}`，响应里 `enable:false, online:false` —— 布尔字段被置 false，**admin 账号当场被禁用**，后续登录报 `账号admin被禁用！`（用户只能靠改库 `UPDATE User SET Enable=1` 救回）。同时 `RoleID`/`DepartmentID` 为空还会报 `保存失败！角色不可以为空！`。**根因**：模型绑定后未携带字段取 CLR 默认值，落库即覆盖。**正确做法（前端）**：个人资料类表单先 `GET Detail` 拿全量，以全量对象为基底浅合并可编辑字段后再 `PUT`（`{...detail, displayName, sex, ...}`，并**剔除 `password`** 避免哈希被当新密码）；**后端**若需局部更新，应显式重写 Update 或用 `Copy(model, ignoreNull:true)` 语义，别指望"不传即不改"。
- **⚠️ 不要自定义 `UploadFile` 动作**：`EntityController<T>` 基类已内置附件上传（`POST /api/{area}/{ctrl}/UploadFile`，form-data 字段 `file`，返回 `{attId, filePath, contentType}`），子类再写同名动作会冲突。图片/头像/封面上传一律复用基类，见 14.3。
- **⚠️ 启动时不要手写数据层预热（`EntityFactory.InitConnection`/`InitAll`）**：`UseCube()` 内部已按「首启同步 `InitAll()` / 非首启异步 `InitAllAsync()`」完成全库建厂+反向工程建表+InitData（§1.2 反编译实证）。手写重复预热徒增启动耗时；放在 UseCube **之前**更会破坏其自动建表（实测 `UserOnline` 等系统表缺失、每请求 500）。`InitConnection` 仅用于运行时动态加库（多租户新租户库、插件热加载），参数是连接名而非连接串。

- **⚠️ XCode SQLite 连接串 `:memory:` 覆盖致命 bug（所有接口 500 / `no such table`）**：XCode 的 SQLite DAL 会对**用户自定义连接串**追加 `Data Source=:memory:`。若你的连接串写成 `DataSource=Data\X.db;Provider=sqlite`（**无空格**），XCode 把 `DataSource`（无空格）与 `Data Source`（有空格）解析为**同一键**，后者 `:memory:` 覆盖你的文件路径 → 实际连的是**内存库**。后果：建表在一个连接、建索引/查询在另一连接 → `no such table: UserOnline/Parameter/...`，**所有接口 500**。修复（三处必须同时满足）：① 连接串键名写**带空格**的 `Data Source=`（不要 `DataSource=`）；② 删掉 `Provider=sqlite`（XCode 按扩展名自动识别 SQLite，留着反而干扰）；③ 追加 `Busy Timeout=15000` 防启动并发写锁。正确写法：`"MyBlog": "Data Source=Data\\MyBlog.db;Busy Timeout=15000"`（路径相对进程 CWD，见下方 CWD 陷阱）。**不要手动加建表代码**——用户明确要求"建表是 XCode 内部处理的，只要后端能正常启动 XCode 就会自动建表"，改连接串格式即可，db 会在 `bin/Debug/net8.0/Data/*.db` 落盘。验证：启动日志无 `:memory:`、Portal 接口返回 `code:0`、`Data/*.db` 文件大小 > 0。
- **⚠️ Swagger 必须用 `IsDevelopment()` 双重包裹（服务注册 + 中间件各一处）**：只包中间件，生产仍注册 Swagger 服务（接口清单/模型结构暴露面徒增）；只包服务不挂中间件，开发期 UI 不可达。漏 `using Microsoft.Extensions.Hosting;` 时 `IsDevelopment()` 报 CS1061；漏 `Swashbuckle.AspNetCore` 包时 `AddSwaggerGen/UseSwagger/UseSwaggerUI` 三连 CS1061。生产验证标准：`/Swagger` → **404** 且业务接口（`POST /Auth/Login`）正常 200；开发环境验证：`/Swagger` → 301 → `/Swagger/index.html` 200。详见 §1.1。

- **⚠️ `[Map]` 派生（仅显示）属性被收进新增/编辑表单，导致 Insert 静默 `code=-2 添加失败`（不抛异常，极难排查）**：实体里 `[Map(nameof(CategoryId), typeof(Category), "Id")] public String CategoryName => Category?.Name;`（或任何 `=>` 表达式体计算属性）会被 `AddFormFields`/`EditFormFields` 收录为普通业务字段。`ProcessInsert` 在 `Valid` 之后调用 `ValidateEntityFields`，对**所有 `Nullable=false` 的表单字段做空值校验**；派生属性插入时永远为 null（尚未从外键加载）→ 提前 `return new ApiResponse{Code=-2, Message="添加失败！"}`，**不抛异常**，故 `try/catch` 抓不到、日志无堆栈。识别特征：API 返回 `code=-2`、后端日志有 `添加失败` 但无异常，且**同类无此类派生属性的实体（如 AboutPage）能正常新增**。修复：在控制器**静态构造器**把显示用字段从表单剔除——`AddFormFields.RemoveField("CategoryName")` / `EditFormFields.RemoveField("CategoryName")`（`RemoveField` 逐字段多参，见 3.4 注释）；它们本就不该由用户录入。同理任何「仅展示/由其它字段推导」的非可空属性都要排除出表单字段。
- **⚠️ 重写 `Valid` 做唯一性/业务校验时，Delete 也要排除自身（否则删除被吞成「删除失败！」）**：常见写法 `if (type == DataObjectMethodType.Update) exp &= _.Id != entity.Id;` 只在 Update 排除自身；**Delete 时不排除** → 用实体自身 slug/编码去查重命中自己 → 抛「已被使用」被基类 `BuildFailResponse` 吞成 `删除失败！`（无堆栈，难定位）。正确写法：**只要有有效主键就排除自身**——`if (entity.Id > 0) exp &= _.Id != entity.Id;`（Update/Delete 通用）。任何「X失败」被吞且无堆栈的，优先查 `Valid` 是否被自身数据命中。


---

## 附：§8.1 迁移 —— 动态写实体字段必须走属性 setter（勿用索引器）

> ⚠️ **动态写实体字段必须走属性 setter，勿用 `entity["Field"]=x` 索引器**：XCode 生成实体的 `this[name]` 索引器 setter 直接赋私有字段，**绕过 `OnPropertyChanged` 脏标记**；而 Save 的插入/更新 SQL 只含「必填列 + 脏字段」，**可空且非脏字段会被静默省略 → 落库为列默认值**（典型症状：必填的 StudentNo/Name 正常入库，可空的 Mobile 恒 null，且改值重拉「影响 0 行」）。
> 正确做法——按属性反射 SetValue（setter 触发脏标记）+ 目标类型转换，属性缺失/转换失败再退回索引器：
> ```csharp
> private static void SetByProperty(IEntity e, String name, Object value)
> {
>     var pi = e.GetType().GetProperty(name);
>     if (pi != null && pi.CanWrite)
>     {
>         try
>         {
>             var pt = Nullable.GetUnderlyingType(pi.PropertyType) ?? pi.PropertyType;
>             Object v = value;
>             if (pt == typeof(String)) v = Convert.ToString(value);
>             else if (pt == typeof(Int32)) v = Convert.ToInt32(value);
>             else if (pt == typeof(Int64)) v = Convert.ToInt64(value);
>             else if (pt == typeof(Double)) v = Convert.ToDouble(value);
>             else if (pt == typeof(DateTime)) v = Convert.ToDateTime(value);
>             else if (pt == typeof(Boolean)) v = Convert.ToBoolean(value);
>             pi.SetValue(e, v); return;
>         }
>         catch { /* 类型不匹配退回索引器 */ }
>     }
>     try { e[name] = value; } catch { /* 字段不存在则忽略 */ }
> }
> ```

