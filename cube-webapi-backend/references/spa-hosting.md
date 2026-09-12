---
name: spa-hosting
description: cube-webapi-backend —— 前后端同域部署时「根命名空间路由撞名」的诊断与修复（SPA 导航分流中间件 + 区域改名 + ApiPrefixes 定位）。菜单页硬刷新 404 / 刷新打到后端接口 / SPA 回退不生效时读本文件。
---

# 前后端同域部署：根命名空间撞名与请求语义分流

> 实测来自 NV8021X（NewLife.Cube 6.13 + XCode + .NET 8 + Vue3/TDesign，Kestrel 自托管 `wwwroot`）。
> 定位：SKILL.md §2.1 的细节展开。**只解决「同域一起部署」的 SPA 回退问题**；纯 Nginx `try_files` 方案见 §15。

## 一、根因

Cube 在**根命名空间**额外注册一条泛型区域路由（AddCube/UseCube 内部自带，**勿手写**）：

```
{area}/{controller=Index}/{action=Index}/{id?}   // Order=1
```

它与前端 SPA 的菜单页路径**完全同名** —— 菜单 Url 就是 `/Iam/NasClient`、`/Admin/User`、`/Cube/App` 这种形态（`/{Area}/{Controller}` 前两段）。

**症状**：前后端一起部署时，浏览器在菜单页按 F5（硬刷新 / 地址栏直达）：

- 无令牌 → 后端路由截获 → **401 JSON**
- 有令牌 → **实体 JSON**（不是页面）

**永不回退 `index.html`**。且现象常是「部分页面刷新 404」——不在回退排除名单里的路径（如 `/FreeRadius/FrConfig`）反而正常，易误判为偶发。

**dev 为什么正常**：`frontend/vite.config.ts` 的 `spaAwareBypass` 已按 `Accept: text/html` 把导航请求放过 → 回退 `index.html`。**prod 的 Kestrel 回退缺这一步 → dev 与 prod 行为不一致**。

## 二、为什么两种"常规修法"都不行

### 2.1 前缀级拆分无解

`/Auth` 前缀**同时**承载：

- 框架认证端点（`/Auth/Login`、`/Auth/LoginConfig`、`/Auth/Captcha`…）—— **真接口**，必须走后端；
- 业务菜单页（`/Auth/NasClient`…）—— **前端路由**，必须回退 HTML。

同一前缀两种意图。按前缀排除必然误伤（曾把 `/Admin/*` 26 项、`/Cube/*` 8 项菜单打成 404）。

### 2.2 `Cube:ApiPrefixes` 也修不了

`CubeSetting.ApiPrefixes`（默认 `/api,/api/v1`）由 `ApiPrefixRewriteMiddleware` + `UseApiPrefixRewrite` 实现，语义是**剥前缀转发**：

```
/api/Iam/Session/List  →（去掉 /api）→  真实路由 Iam/Session/List
```

- **非 3xx 重定向**，**不改变**框架注册的真实路由；
- 实测通常**只有 `/api` 生效**（`/api/Iam/Session/List`→401；`/api/v1/...`→404，视版本）；
- 它能把「业务 API 唯一入口」收口为 `/api`（前端 `http.ts` 只需一个 base），**但 `/api` 的转发目标恰是那条根命名空间路由 —— 删掉它 `/api` 立刻全挂**。

**结论**：`ApiPrefixes` 是「收口唯一入口」，**不是**「搬家」。撞名只能靠**请求语义分流**解决。

## 三、正确修法（两道防线）

### 3.1 请求语义分流中间件（主修）

注册在 `UseCube`（内部 `UseRouting`）**之前**，否则请求先被路由表匹配掉。

- **判据**：浏览器导航（`Sec-Fetch-Mode: navigate` 或 `Accept` 含 `text/html`）→ 回退 `wwwroot/index.html`；程序调用（axios 默认 `Accept: application/json`、curl 无 `text/html`）→ 走 API 路由。
- **豁免前缀**（纯 API / 非 SPA 命名空间，不存在对应前端页面）：`/api`、`/Auth`、`/Mfa`、`/Swagger`、`/Content`、`/Uploads`。
  - `/Content`、`/Uploads` 是 Cube 静态内容与上传目录（`CubeSetting.UploadPath` 默认 `Uploads`）。**已存在的文件由中间件之前的 `UseStaticFiles` 先行处理**；豁免目的是让「**不存在**的内容路径」在地址栏访问时返回 404，而不是回退成 HTML（打开图片/附件不该拿到一张网页）。
- **不可豁免**：`/Admin`、`/Cube`、`/Iam`、`/FreeRadius` —— 既是后端控制器路由，又是前端菜单页前缀。
- `MapFallback` 统一返回 404，**不要**按前缀维护页面前缀白名单。

### 3.2 参考实现（`Program.cs`）

```csharp
// 自托管 SPA：生产发布包已含 wwwroot（vite build 产出）
app.UseDefaultFiles();
app.UseStaticFiles();

// ── SPA 导航分流：必须注册在 UseCube 之前 ──
var spaIndex = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html");
app.Use(async (ctx, next) =>
{
    var p = ctx.Request.Path;
    // 豁免前缀：纯 API / 非 SPA 命名空间
    if (p.StartsWithSegments("/api") || p.StartsWithSegments("/Auth")
        || p.StartsWithSegments("/Mfa") || p.StartsWithSegments("/Swagger")
        || p.StartsWithSegments("/Content") || p.StartsWithSegments("/Uploads"))
    {
        await next();
        return;
    }

    var isNavigate = string.Equals(ctx.Request.Headers["Sec-Fetch-Mode"].ToString(), "navigate", StringComparison.OrdinalIgnoreCase)
                  || ctx.Request.Headers.Accept.ToString().Contains("text/html", StringComparison.OrdinalIgnoreCase);
    if (!isNavigate) { await next(); return; }

    if (!File.Exists(spaIndex))
    {
        ctx.Response.StatusCode = 404;
        await ctx.Response.WriteAsync("SPA entry (wwwroot/index.html) not found");
        return;
    }
    ctx.Response.ContentType = "text/html; charset=utf-8";
    ctx.Response.Headers.CacheControl = "no-cache, no-store";
    await ctx.Response.SendFileAsync(spaIndex);
});

app.UseCube(app.Environment);

// 兜底 404：能走到这里 = 未匹配任何后端路由 且 不是浏览器导航
app.MapFallback(async context =>
{
    context.Response.StatusCode = 404;
    await context.Response.WriteAsync("Not Found");
});
```

**降级行为**：`wwwroot/index.html` 不存在时导航请求返回 404 文本（不崩、不静默吞），API 完全不受影响 —— 便于本地只跑后端联调。

### 3.3 架构性根除：业务区域避开框架前缀（根治）

业务区域**不要**用框架已占用的前缀 `Auth`/`Cube`/`Sso`/`Mfa`。

实践：把业务区域 `Auth` 改名为 **`Iam`**（Identity and Access Management），菜单分组标题改为「认证管理」；`Areas/Auth/` → `Areas/Iam/`、`AuthArea` → `IamArea`、`[AuthArea]` → `[IamArea]`；**框架认证端点 `/Auth/Login` 等保留不动**。

**升级脚本铁律**（幂等，`deploy/sql/upgrade/<date>-menu-area-rename-*.sql`）：

```sql
-- 只改 Name/Url/FullName/DisplayName，绝不改 Menu.ID
UPDATE Menu SET Name='Iam', Url='/Iam',
                FullName='Xxx.Areas.Iam.Controllers', DisplayName='认证管理'
 WHERE ID = 1 AND Name = 'Auth';
UPDATE Menu SET Url = CONCAT('/Iam/', Name),
                FullName = CONCAT('Xxx.Areas.Iam.Controllers.', Name, 'Controller')
 WHERE ParentID = 1 AND FullName LIKE 'Xxx.Areas.Auth.Controllers.%';
```

> **为什么绝不改 `Menu.ID`**：`Role.Permission` 以 `"<菜单ID>#<权限位>"` 形式存储（如 `1#-1,2#-1`）。改 ID → 新 ID 不在授权清单内 → **管理员也会丢失全部菜单权限**。

### 3.4 区域按业务继续拆分（一区拆多区）

单区域扛太多控制器后按业务拆成多区（例：`Iam` → `Iam/Device/Security/Ops/Sys`，与功能模块 1:1）。**保留一个原区**（沿用其 `Menu.ID`，改动最小）+ 新增 N 区。

**区域名禁忌**：不要用 `System` —— `namespace Xxx.Areas.System` 会与 BCL 的 `System` 抢类型解析。用 **`Sys`** / `Platform` 等。动手前先确认框架内置区域（`AdminArea`/`CubeArea` 是区域；`Auth`/`Mfa`/`Sso` 是**控制器级 `~/` 路径不是区域**）。

**两个反直觉行为（决定成败，来自实测）**：
1. **扫描器从不改写已有菜单的 `ParentID`** —— 它会 UPDATE 已有行的 Sort/Icon/Visible/Permission/DisplayName/Url/Remark，但重挂父节点**只能由升级脚本显式 `SET ParentID=...`**，否则子菜单永远留在旧区域下。
2. **脚本预插入区域根节点 → 框架认为"菜单已存在" → 不触发自动授权重建** —— 因此新增根的 ID **必须由脚本自行补进 `Role.Permission`**；靠框架自动补会漏。

**执行顺序铁律：先跑 SQL 改完 `Menu` 表，再部署代码重启**。反序会让 Cube 按新 `Url`（如 `/Ops/Session`）找不到匹配行 → **新增**菜单（新 ID），旧行成孤儿、既有权限串立即失效。

**升级脚本骨架**（幂等，三段：建根 → 重挂 → 补授权）：

```sql
-- ① 建新区域根节点（ParentID=0；不要带 FROM DUAL，SQLite 不支持）
INSERT INTO Menu(Name, DisplayName, ParentID, FullName, Sort, Url, Visible)
SELECT 'Device', '终端管理', 0, 'Xxx.Areas.Device.Controllers', 0, '/Device', 1
 WHERE NOT EXISTS (SELECT 1 FROM Menu WHERE ParentID=0 AND Name='Device');

-- ② 就地重挂子菜单（改 ParentID/Url/FullName，绝不改 ID）
UPDATE Menu
   SET ParentID = (SELECT ID FROM Menu WHERE ParentID=0 AND Name='Device'),
       Url      = '/Device/' || Name,
       FullName = 'Xxx.Areas.Device.Controllers.' || Name || 'Controller'
 WHERE ParentID = 1                                            -- 原区域根
   AND FullName LIKE 'Xxx.Areas.Iam.Controllers.%'
   AND Name IN ('MacWhitelist');

-- ③ 给已含原区域权限的角色补上新根授权（SQLite 用 INSTR，MySQL 用 LOCATE）
UPDATE Role
   SET Permission = Permission || ',' || (SELECT ID FROM Menu WHERE ParentID=0 AND Name='Device') || '#-1'
 WHERE INSTR(',' || Permission || ',', ',1#-1,') > 0
   AND INSTR(',' || Permission || ',', ',' || (SELECT ID FROM Menu WHERE ParentID=0 AND Name='Device') || '#') = 0;
```

**校验清单（重启后再跑一遍）**：区域根行数（含 `NewLife.Cube` 这类框架根，易漏数）｜各区域子菜单归属数｜`Menu` 总数｜`Url` 重复数=0｜旧区域残留行=0｜角色 `Permission` 含新根 `#-1`｜**启动日志应零菜单写入**（仅 `Select * From Menu`，证明框架按 Url 全命中、无新增/孤儿行）。

**代码侧**：新增 `Areas/<Xxx>/XxxArea.cs`（`class XxxArea : AreaBase { public XxxArea() : base("Xxx","中文名"){} static XxxArea() => RegisterArea<XxxArea>(); }`）+ 控制器 `git mv` 后同步 `namespace Xxx.Areas.<Xxx>.Controllers;` 与 `[XxxArea]`。

**前端侧**：`specialControllers.ts` 注册键按区域重分组（键=`area/controller` 小写，查找大小写不敏感）；硬编码的 `/旧区/Ctrl` 路径批量替换。泛型路由 `:area/:controller` 天然支持新区域，**router 逻辑零改动**。

**ConfigController 路由提醒**：真实路由是**控制器根** —— `GET /api/{area}/{ctrl}` 取单对象、`PUT` 保存、`GET /GetFields?kind=` 元数据，**没有 `/Index`**。探针别按 `/Index` 打，否则误判 404。

## 四、验收探针

对每个菜单路径发**带** `Accept: text/html`（或 `Sec-Fetch-Mode: navigate`）的请求 → 应 **200 且含 `<div id="app">`**；再不带头请求 → 应走 API（401/200 JSON 或 404）。

```python
NAV = {"Accept": "text/html,application/xhtml+xml", "Sec-Fetch-Mode": "navigate"}
API = {"Accept": "application/json"}

cases = [
    # (路径, 头, 期望)  期望: 'spa' | '404' | 'notspa'（非 SPA 即通过：如未装 Swagger→404 / 装了→200 动态 HTML）
    ("/Iam/NasClient",   NAV, "spa"), ("/Admin/User", NAV, "spa"), ("/Cube/App", NAV, "spa"),
    ("/Ops/Session",     NAV, "spa"), ("/Sys/ApiToken", NAV, "spa"),   # 拆分后的新区域菜单页同样回退 SPA
    ("/api/Iam/NasClient", API, "401"),          # 无令牌
    ("/api/Ops/Session",   API, "401"),          # 新区域 API 同样要求登录
    ("/Auth/NotExistXyz", NAV, "404"),           # 豁免前缀不给 SPA
    ("/Swagger", NAV, "notspa"), ("/Content/x.png", NAV, "notspa"),
    ("/Uploads/x.png", NAV, "notspa"),
]
# 判定：got=='spa' → 响应体含 MARKER('<div id="app"')；'notspa' → got != 'spa' 即通过
```

配套端到端：登录取 `data.access_token`（**snake_case**）→ Bearer 调 `/api/{Area}/{Ctrl}` 业务接口 → 期望 200。
