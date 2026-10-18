# 魔方 WebApi 元数据契约（前端视角）

> 后端权威定义见 `cube-webapi-backend` 技能。本文只写**前端怎么消费**。
> 所有响应经 `ApiFilter` 统一序列化：**Int64 以字符串传输**（避免 JS 精度丢失）。

## 1. 响应信封

```ts
interface ApiEnvelope<T> {
  code: number;      // 0 成功；401 未登录；403 无权限；其它为业务错误
  message: string;
  data: T;
  traceId?: string;
  page?: { pageIndex: number; pageSize: number; totalCount: number; sort?: string; desc?: boolean };
  stat?: T;          // 合计行
  fieldErrors?: { field: string; message: string }[];  // 字段级校验错误
}
```

`http.ts` 的响应拦截器：`code !== 0` 直接 reject，并把 `fieldErrors` 挂到 error 上；`code === 401` 清令牌跳登录。

## 2. 路由前缀：按「控制器有没有 `[Area]`」分族

| 族 | 判据 | 前缀 | 例子 |
|---|---|---|---|
| 区域族 | 控制器带 `[Area]` | **必须 `/api`** | `/api/Admin/User`、`/api/Admin/Index/GetMenuTree`、`/api/Lab/LabAsset/GetPage` |
| 根族 | `NewLife.Cube.Controllers.*`，无 Area | **不带 `/api`** | `/Auth/Login`、`/Mfa/Verify`、`/Sso/*`、`/Cube/Lookup`、`/Cube/Apis` |

- `http` 实例 `baseURL = /api` → 调用方写 `/{area}/{controller}`；
- `rawHttp` 实例 `baseURL = 后端根` → 调用方写全路径。

⚠️ **漏写或多写 `/api` 都不会报错**：请求落到 SPA 兜底，返回 `200 + text/html`，axios 解析出 `undefined` → 菜单/列表静默为空。这是本技能排障的第一嫌疑。

## 3. 实体标准接口

| 动作 | 路由 | 动词 | 关键点 |
|---|---|---|---|
| 列表 | `/api/{area}/{controller}` | GET | 参数 `pageIndex` `pageSize` `Q` `sort` `desc` + 字段参数 |
| 详情 | `/api/{area}/{controller}/{id}` | GET | |
| 新增 | `/api/{area}/{controller}` | POST | |
| 修改 | `/api/{area}/{controller}` | PUT | **主键在 body，不在 URL** |
| 删除 | `/api/{area}/{controller}?id=xxx` | DELETE | **id 在 query**，写进 path 会 405 |
| 元数据 | `.../GetFields?kind=n` | GET | 匿名 |
| 页面 | `.../GetPage` | GET | 匿名，**核心** |
| 上传 | `.../UploadFile` | POST | form-data `file`，参数 `id`/`title` |
| 图表 | `.../GetChartData` | GET | |
| 导出 | `.../ExportFile?format=csv` | GET | 文件流，需带令牌 → 用 axios blob |

## 4. GetPage —— 一次取齐 schema

```jsonc
{
  "code": 0,
  "data": {
    "setting": {
      "enableAdd": true,        // 是否允许新增
      "isReadOnly": false,      // 只读控制器
      "enableSelect": true,     // 是否允许打开详情
      "enableTableDoubleClick": true,
      "doubleDelete": false,
      "orderByKey": true
    },
    "list": [],     // 列表列
    "addForm": [],  // 新增表单
    "editForm": [], // 编辑表单
    "detail": [],   // 详情
    "search": []    // 搜索条件
  }
}
```

`GetPage` **只给 schema，不含行数据**；行数据由 `Index`（`GET /{area}/{controller}`）单独拉。

前端权限只认 `setting`：

- `enableAdd !== false && !isReadOnly` → 显示「新增」；
- `!isReadOnly` → 显示「编辑 / 删除」；
- 自定义权限位（16/32…）由后端在动作级拦截；前端若要按位隐藏，需后端在 `GetPage` 扩展字段下发。

## 5. DataField

```jsonc
{
  "name": "DepartmentName",     // ★ 取值是 PascalCase（键名是 camelCase）
  "displayName": "部门",
  "description": "部门。组织机构",
  "category": "登录信息",
  "typeName": "String",         // 或枚举类型名，如 SexKinds
  "itemType": null,             // html / mail / mobile / image
  "length": 0, "precision": 0, "scale": 0,
  "nullable": false, "primaryKey": false, "readOnly": false,
  "visible": false, "required": false,
  "mapField": "DepartmentID",
  "lovCode": null,
  "map": { "1": "启用", "0": "停用" },
  "dataSource": [{ "text": "启用", "value": "1" }]
}
```

| 属性 | 前端用途 |
|---|---|
| `name` | 行 key / 表单字段名，经 `camel()` 归一 |
| `displayName` | 列标题、表单 label |
| `category` | 表单 tab / 详情分区 |
| `typeName` | 控件选型核心 |
| `length` | `maxlength`；> 200 走 textarea |
| `required` / `nullable` | 必填三级判定（见 field-renderers §3） |
| `primaryKey` / `isIdentity` | 新增隐藏、编辑禁用 |
| `readOnly` | 控件 disabled |
| `mapField` | **非空即映射字段 ⇒ 下拉** |
| `lovCode` | 异步值集标识（可选能力） |
| `map` / `dataSource` | 选项源 / 列表回显 |
| `sortable` | `el-table-column sortable="custom"` |
| `visible` | ⚠️ 实测恒为 `false`，**不可用于判断隐藏列** |

> **布尔位一律写 `=== true`**：Cube 的 `DataField` 是非空 `bool`，`false` 也会下发，不能靠"键缺失"判断。
> 唯一例外是 `nullable`：它需要区分"未下发"这第三态，判据是 `!== false`。

## 6. 命名大小写（两层，别混）

- **JSON 键名**：camelCase（`displayName`、`mapField`、`parentID`）；
- **字段名取值**：PascalCase（`Id`、`Name`、`ParentID`、`CategoryName`）。

`normalizeRow()` 对行 key 做幂等 camel 归一。判定后缀（`ID`/`IDs`）时用**原值**，不要先 camel 再判。

## 7. 查询参数（实测）

| 字段类型 | 传参方式 | 例子 |
|---|---|---|
| 字符串 | **`Q` 关键词模糊**，字段精确参数**不生效** | `?Q=行政部` |
| 数值 / 枚举 / 布尔 / 日期 | 字段参数，大小写不敏感 | `?parentID=1`、`?enable=true` |
| 虚拟映射字段（如 `User.RoleID`） | **不参与**，需映射到真实字段 | `?roleIds=999` |

`useEntityResource.buildQuery` + `fieldRender.toSearchParams` 已实现上述分流；虚拟字段用 `searchParamMap` 适配。

## 8. 鉴权

```http
POST /Auth/Login          body { username, password }
  → { code:0, data:{ access_token, refresh_token, expire_in } }
POST /Auth/Refresh        body { refreshToken }
POST /Auth/Logout
GET  /api/Admin/Index/GetMenuTree   → 仅当前用户有权限的节点
```

- 令牌头只发 **`Authorization: Bearer <jwt>`**；发 `Authentication`、或只带 Cookie `.Cube.Session` 都 401（症状：登录成功但列表/菜单全空）。
- 令牌字段三向兼容：`access_token` / `accessToken` / `AccessToken`（`normToken`）。
- 登录失败次数过多会触发**内存锁**（约 300s），最快解锁是重启后端进程；测试期别批量试口令。
- 轮换：401 且非认证端点时用 refresh token 自动续期一次并重放，并发用 `refreshInFlight` 去重。

## 9. 多租户

- 租户上下文唯一来源：**登录响应头 `X-Tenant`**；拦截器捕获 → `token.ts` 落盘 → 之后每请求注入 `X-Tenant`（主）/`X-Tenant-Id`（legacy）。
- 登录页 / 注册页**不得**出现租户选择控件（E5-L4）；切换租户只在登录后的顶栏做（当前实现为只读展示，需要切换时再调 `setTenant` + 刷新）。
- 未处于有效租户上下文，后端 fail-closed 返回 403。

## 10. 数据范围

行级权限由后端按 `DataScope` 自动过滤，前端**不自行过滤**，只负责按钮显隐。前端隐藏 ≠ 安全，后端必须独立校验。
