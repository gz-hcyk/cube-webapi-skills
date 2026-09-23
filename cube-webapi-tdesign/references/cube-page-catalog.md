# 魔方 WebApi 全量功能页面目录（cube-page-catalog）

> 目标：让前端**默认就能覆盖魔方框架的全部功能页面**——不留占位、不留死链、不留空白页。
> 本文是「有哪些页面 / 每个页面怎么落地 / 用什么组件」的**单一权威清单**。
>
> 配套：`page-composition.md`（页面构成与覆盖机制）、`field-renderers.md`（字段→控件）、
> `config-controller.md`（配置页）、`lov-list-field.md`（值集）、`permission-editor-integration.md`（角色权限树）。

---

## 一、权威来源与取证方式（**先看这一节，别凭命名猜**）

| 来源 | 权威性 | 怎么用 |
|---|---|---|
| 框架程序集 XML 文档 `NewLife.Cube.xml` | **控制器/动作签名**的权威（包内 `lib/net8.0/NewLife.Cube.xml`） | 查「有哪些控制器、每个控制器有哪些动作、形参是什么」 |
| `GET /Cube/Apis` | **运行时接口清单**的权威（框架自省端点） | 确认某部署实际暴露了哪些接口 |
| `GET /api/Admin/Index/GetMenuTree`（或 `/Cube/MenuTree`） | **菜单/页面可见性**的权威 | 前端菜单与路由落地的唯一依据；**不要在前端硬编码菜单** |
| `GET /api/{area}/{controller}/GetPage` 是否 200 | **「是不是实体页」**的判定探针 | 404 ⇒ 非实体 ⇒ 必须走专用页（配置页 / 工具页），进 ListPage 会空白 |

⚠️ **反例症状（最难查）**：把区域族端点的 `/api` 漏掉时**不报错**——会落到 SPA 兜底返回
`200 + text/html`，菜单/列表**静默为空**。前缀判据见下节。

---

## 二、路由前缀判据（唯一判据：**控制器有没有 `[Area]`**）

框架的路由模板为 `api/{area}/{controller=Index}/{action=Index}/{id?}`（**自带字面量 `api/`**，硬编码于 DLL）。

| 族 | 判据 | 前缀 | 例子 |
|---|---|---|---|
| **区域族** | 控制器带 `[Area]` | **必须带 `/api`** | 业务实体 `/api/{area}/{controller}/GetPage`；框架区 `/api/Admin/User/...`、`/api/Cube/Widget/Index`、`/api/Admin/Index/GetMenuTree` |
| **根族** | `NewLife.Cube.Controllers.*`（无 Area） | **不带 `/api`** | `/Auth/Login`、`/Auth/Register`、`/Mfa/Verify`、`/Sso/*`、`/Cube/Apis`、`/Cube/MenuTree`、`/Cube/Lookup` |

落地到 HTTP 层：`http` 实例（baseURL 已含 `/api`）服务区域族；`rawHttp` 服务根族。
调用方写区域族路径时**不要再写 `/api`**（双重前缀 → 404）。

---

## 三、控制器三分类 → 页面落地（决定「用哪个组件」）

| 类别 | 识别特征 | 页面形态 | 组件 | 是否需登记 |
|---|---|---|---|---|
| **① 实体控制器** | `GetPage` 返回 200 | 列表 + 表单 + 详情（通用） | `ListPage` + `FormDialog` + `DetailDrawer` | **不需要**（泛型路由自动兜住） |
| **② 配置控制器** | `GetPage` 404，但有 `GetFields` + 单对象 `Get`/`Update` | 单对象表单页 | `ConfigView` | 需要（`specialControllers.ts`） |
| **③ 工具型控制器** | `GetPage` 404，且是自定义端点（Db/File/Index/Widget…） | 各自专属页 | 专属视图 | 需要 |

> **命名不可靠，禁止启发式**：`*Config` / `Parameter` 多是**实体**（走 ListPage）；
> 真正的 `Config<T>` 反而**不带 Config 名**（`Cube` / `Sys` / `Core` / `XCode`）。
> 故第 ②③ 类必须**显式策划**（`src/specialControllers.ts`）。

---

## 四、全量页面目录

图例：**类别** ①实体 ②配置 ③工具；**状态** ✅ 已有组件落地 / 🧩 配方（本技能给出落地配方）/ 🔎 需实测后启用

### 4.1 认证与账号（根族，**不带 `/api`**）

| 页面 | 端点（`NewLife.Cube.Controllers.AuthController`） | 类别 | 默认落地 | 状态 |
|---|---|---|---|---|
| 登录 | `POST /Auth/Login`、`GET /Auth/LoginConfig`、`GET /Auth/Captcha`、`GET /Auth/Challenge` | — | `pages/LoginView.vue` | ✅ |
| 两步验证（登录中） | `POST /Mfa/Verify`（`MfaController`） | — | `LoginView` 内 MFA 步骤 | ✅ |
| 注册 | `POST /Auth/Register` | — | `pages/RegisterView.vue` | ✅ |
| 忘记密码 / 重置 | `POST /Auth/SendCode`（`action=ResetPassword`）+ `POST /Auth/ResetPassword` | — | `pages/ForgotPasswordView.vue` | ✅ |
| 账号激活 | `POST /Auth/Activate`（验证码）/ `POST /Auth/SendActivateCode`（重发） | — | 复用 `AuthShell`，见 §五.2 配方 | 🧩 |
| 邮箱激活直达 | `GET /Auth/Activate?token=&account=` | — | 同上（前端解析 query 后调接口） | 🧩 |
| 刷新令牌 | `POST /Auth/Refresh` | — | `api/http.ts` 401 拦截器自动重放 | ✅ |
| 切换租户 | `POST /Auth/SwitchTenant` | — | 顶栏租户切换器 + 成功后整页刷新 | 🧩 |
| 安全中心：改密 | `POST /api/Admin/User/ChangePassword` | ① | 见 §5.3 配方 | 🧩 |
| 安全中心：绑定邮箱/手机 | `POST /api/Admin/User/BindByVerifyCode`、`SendVerifyCode` | ① | 同上 | 🧩 |
| 安全中心：验证/更换联系方式 | `POST /Auth/VerifyContact`（`action=bind` 发码） | — | 同上 | 🧩 |
| MFA 自助开通/关闭 | `GET /Mfa/Setup`、`POST /Mfa/Activate`、`POST /Mfa/Disable`、`GET /Mfa/Status` | — | 同上（二维码 + 备用码） | 🧩 |
| 单人单点/SSO 回调 | `SsoController`：`Login` / `Auth2` / `LoginInfo` / `Bind` / `UnBind`（24 动作） | — | 登录页 OAuth 按钮已指向 `/Sso/Login/{name}`；回跳页配方见 §5.4 | 🧩 |

### 4.2 工作台与运行监控（`Areas/Admin`）

| 页面 | 端点（`IndexController`） | 类别 | 默认落地 | 状态 |
|---|---|---|---|---|
| 工作台 / 仪表盘 | `GET /api/Admin/Index/Dashboard`（KPI/快捷入口）、`GetMenuTree` | ③ | `pages/DashboardView.vue` | ✅ |
| 服务器信息 | `GET /api/Admin/Index/Main` | ③ | `components/cube/ServerInfoView.vue` | ✅ |
| 运行监控曲线 | `GET /api/Admin/Index/MonitorData`（轮询） | ③ | 同上（自适应数值折线） | ✅ |
| 程序集 / 进程 / 服务器变量 | `AssemblyList` / `ProcessList` / `ServerVarList` | ③ | 同上（选项卡） | ✅ |
| 释放内存 / 重启 | `MemoryFree` / `Restart` | ③ | 同上（二次确认） | ✅ |
| AI 系统诊断 | `GET /api/Admin/Index/AiDiagnose`（SSE） | ③ | 见 §5.5 配方 | 🧩 |
| 工作台卡片布局 | `GetWidgetLayout` / `SaveWidgetLayout` / `ResetWidgetLayout` | ③ | 工作台拖拽排序后回存 | 🧩 |
| 工作台部件管理 | `WidgetController`（见 4.7） | ③ | `components/cube/WidgetBoardView.vue` | ✅ |

### 4.3 组织与权限

| 页面 | 控制器 | 类别 | 默认落地 | 状态 |
|---|---|---|---|---|
| 用户管理 | `Admin/User`（实体，18 动作） | ① | `ListPage`（泛型） | ✅ |
| ↳ 吊销用户令牌 | `POST /api/Admin/User/RevokeTokens?id=` | ① | `#row-actions` 配方 §5.1 | 🧩 |
| ↳ 清空密码 | `POST /api/Admin/User/ClearPassword?id=` | ① | 同上 | 🧩 |
| ↳ 头像上传 | `POST /api/Admin/User/UploadFile` → 再 `Info(avatar=)` | ① | 表单内上传（`FormDialog` 已支持 upload） | 🧩 |
| 角色管理 | `Admin/Role`（实体） | ① | `ListPage` | ✅ |
| ↳ **角色权限设置** | `GET /api/Admin/Role/PermissionTree?id=`、`POST SavePermission` | ① | `RoleMenuEditor.vue`，接线配方见 `permission-editor-integration.md` | 🧩 |
| 菜单管理 | `Admin/Menu`（**实体树** + `BuildMenuSource` 父级路径字典） | ① | `ListPage`（**自动树形表格**，见 SKILL §4.7）；父级下拉用映射列 | ✅ |
| 部门管理 | `Admin/Department`（实体树） | ① | `ListPage`（自动树形） | ✅ |
| 租户管理 | `Admin/Tenant` | ① | `ListPage` | ✅ |
| 租户关系 | `Admin/TenantUser` | ① | `ListPage` | ✅ |
| 访问规则 | `Admin/AccessRule`（`AccessActionKinds`/`LimitDimensions` 枚举） | ① | `ListPage`（枚举→下拉） | ✅ |
| 用户关联 | `Admin/UserConnect`（`?userId=` 由 User 链接列跳转） | ① | `ListPage` | ✅ |
| 用户在线 | `Admin/UserOnline` | ① | `ListPage` | ✅ |
| ↳ **强制下线** | `POST /api/Admin/UserOnline/Kick?id=` | ① | `#row-actions` 配方 §5.1 | 🧩 |
| 用户令牌 | `Admin/UserToken` | ① | `ListPage` | ✅ |
| 访问统计 | `Admin/UserStat` + `OnGetChartData`（主折线三 Y 轴 + 箱线 + K 线） | ① | `ListPage` + 图表配方 §5.6 | 🧩 |
| 委托代理 | `Cube/PrincipalAgent` | ① | `ListPage` | ✅ |

### 4.4 系统设置（**配置控制器 ②**，全部走 `ConfigView`）

| 页面 | 控制器 | 说明 | 默认落地 | 状态 |
|---|---|---|---|---|
| 系统设置（Cube） | `Admin/Cube` | `CubeSetting` 单对象（JWT/令牌/注册/登录/主题/版权…） | `ConfigView` | ✅ |
| 系统信息（Sys） | `Admin/Sys` | `SysSetting` 单对象 | `ConfigView` | ✅ |
| 核心设置（Core） | `Admin/Core` | 核心设置 | `ConfigView` | ✅ |
| 数据层设置（XCode） | `Admin/XCode` | 数据层设置 | `ConfigView` | ✅ |
| 星尘设置（Star） | `Admin/Star` | 星尘设置 | 待核实（见 §六） | 🔎 |
| 字典参数 | `Admin/Parameter` | **实体**（有 GetPage）→ `ListPage` | `ListPage` | ✅ |
| 邮件 / 短信 / OAuth 配置 | `Admin/MailConfig`、`SmsConfig`、`OAuthConfig` | 疑为**实体** → `ListPage`（若 GetPage 404 再改登记） | `ListPage` | 🔎 |
| OAuth 日志 | `Admin/OAuthLog` | 实体 | `ListPage` | ✅ |

### 4.5 值集（Lov）

| 页面 | 端点（`Admin/LovController`） | 类别 | 默认落地 | 状态 |
|---|---|---|---|---|
| 值集管理（列表） | `Search`（实体列） | ① | `ListPage` | ✅ |
| 值集完整配置 | `GET GetConfig?id=`、`POST SaveConfig` | ① | 值集配置页配方 §5.7 | 🧩 |
| 枚举值（子表） | `BatchSaveEnumItems?id=&items=` | ① | 同上 | 🧩 |
| 列表配置（子表） | `SaveListConfig?id=&config=` | ① | 同上 | 🧩 |
| 搜索字段 / 表格列（子表） | `BatchSaveSearchFields` / `BatchSaveTableColumns` | ① | 同上 | 🧩 |
| 值集元数据 / 取数代理 | `GET Meta?codes=`、`POST ListData`、`POST BatchLabel` | ① | 运行时由 `api/useLov.ts` 消费（已落地） | ✅ |
| LIST 型值集选择弹窗 | 同上 | — | `components/cube/LovListField.vue` | ✅ |

### 4.6 运维与集成

| 页面 | 控制器 | 类别 | 默认落地 | 状态 |
|---|---|---|---|---|
| 数据库管理 | `Admin/Db`（`Index`/`Backup`/`BackupAndCompress`/`Download`） | ③ | `components/cube/DbView.vue` | ✅ |
| 文件管理 | `Admin/File`（`Index`/`Upload`/`Download`/`Delete`/`Compress`/`Decompress`/Copy/Move/Paste/CancelCopy/ClearClipboard） | ③ | `components/cube/FileView.vue` | ✅ |
| 定时任务 | `Cube/CronJob` | ① | `ListPage` | ✅ |
| ↳ **立即执行** | `POST /api/Cube/CronJob/ExecuteNow?name=` | ① | `#row-actions` 配方 §5.1 | 🧩 |
| 审计日志 | `Admin/Log`（只读） | ① | `ListPage` | ✅ |
| 应用日志 | `Cube/AppLog` | ① | `ListPage` | ✅ |
| 应用系统 / 应用模块 | `Cube/App`、`Cube/AppModule` | ① | `ListPage` | ✅ |
| 附件管理 | `Cube/Attachment` | ① | `ListPage`（`typeName=file/image` → 预览列） | ✅ |
| 通知记录 | `Entity/NotificationRecord`（无独立控制器） | — | 随业务内嵌，无独立菜单 | — |
| 订单管理 | `Cube/OrderManager` + `GET GetInfo?code=` | ① | `ListPage`（`GetInfo` 配方见 §5.8） | 🧩 |
| 地区管理 | `Cube/Area`（实体树 + `InitAreaData`/`Map`） | ① | `ListPage`（自动树形） | ✅ |
| ↳ 中国地图散点 | `GET /api/Cube/Area/Map`（省级 + 有经纬度城市） | ① | 地图页配方 §5.9 | 🧩 |
| 地区三级联动/搜索 | `CubeController`：`AreaParents` / `AreaChilds` / `AreaAllParents` / `GetArea`、`DepartmentSearch` / `UserSearch` / `Lookup` | 根族 | 表单/搜索联动由 `useLookups` 承担 | ✅ |
| 消息/头像/附件直读 | `Cube/Avatar?id=`、`/Cube/Image`、`/Cube/File`、`CheckAttachmentAccess` | 根族 | `serverUrl()` 拼接直链 | ✅ |

### 4.7 工作台部件与 AI

| 页面 | 端点 | 类别 | 默认落地 | 状态 |
|---|---|---|---|---|
| 部件管理 | `Cube/Widget`：`Index`/`Enable`/`SaveGroupOrder`/`SaveGroupItemOrder` | ③ | `components/cube/WidgetBoardView.vue` | ✅ |
| AI 助手浮窗 | `GET /Cube/GetAiConfig`（开关/配色）+ `POST /Ai/AiChat`（SSE）+ `POST /Ai/OperationResult`（浏览器操作回传） | 根族 | 浮窗配方 §5.5 | 🧩 |
| 页面配置（列表/表单字段显隐） | `GET /Cube/GetPageConfig?area=&controller=`、`POST SetPageConfig`、`POST SaveLayout` | 根族 | 用户级列配置，`ApplyColumnConfig`/`LoadColumnConfig` 已在后端 | 🧩 |
| 服务器健康检测 | `GET /Cube/Info` | 根族 | 部署探活脚本用 | ✅ |

---

## 五、配方索引（🧩 项的落地做法）

> 配方 = **已给出端点与接线方式、但需在真实工程内落地并编译验收**的页面。
> 每个配方都遵循同一纪律：**先用探针确认响应结构，再写渲染**（`DataProbe.vue`）。

### 5.1 实体页加「额外动作」——用 `ListPage` 的 `#row-actions` 插槽

适用于：用户（吊销令牌 / 清空密码）、在线用户（强制下线）、定时任务（立即执行）、
委托代理等**实体控制器 + 额外动作端点**的组合。

```vue
<!-- src/pages/admin/UserPage.vue —— 薄页面：组合 ListPage + 覆盖行操作 -->
<script setup lang="ts">
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import ListPage from '@/components/cube/ListPage.vue';
import http from '@/api/http';

const props = defineProps<{ area?: string; controller?: string; title?: string }>();

async function revokeTokens(row: any, reload: () => void) {
  const dlg = DialogPlugin.confirm({
    header: '吊销令牌',
    body: `确定吊销「${row.name ?? row.id}」的全部访问令牌？该用户将立即下线。`,
    theme: 'danger',
    onConfirm: async () => {
      dlg.hide();
      await http.post(`/Admin/User/RevokeTokens`, null, { params: { id: row.id } });
      MessagePlugin.success('已吊销');
      reload();
    },
  });
}
</script>

<template>
  <ListPage :area="props.area ?? 'Admin'" :controller="props.controller ?? 'User'" :title="props.title">
    <!-- 覆盖点 L2：行操作扩展（原始「详情/编辑/删除」仍由 ListPage 提供） -->
    <template #row-actions="{ row }">
      <t-link theme="warning" @click="revokeTokens(row, () => {})">吊销令牌</t-link>
    </template>
  </ListPage>
</template>
```

**注意**：`#row-actions` 的 `reload` 需自行接 `ListPage` 暴露的 `res.loadData`（或直接 `getExposeProxy`）；
最稳的做法是在薄页面里自持 `ref` 调 `listRef.value?.res.loadData()`（`ListPage` 已 `defineExpose({ res, ... })`）。

### 5.2 账号激活页（`AuthShell` 复用）

```vue
<!-- src/pages/ActivateView.vue -->
<template>
  <AuthShell :brand="BRAND" heading="账号激活" subheading="完成验证后即可登录">
    <t-form :data="form" @submit="onSubmit">
      <t-form-item name="account"><t-input v-model="form.account" placeholder="邮箱 / 手机号" size="large" /></t-form-item>
      <t-form-item name="code">
        <div class="code-row">
          <t-input v-model="form.code" placeholder="验证码" size="large" />
          <t-button variant="outline" size="large" @click="onSend">重新发送</t-button>
        </div>
      </t-form-item>
      <t-button theme="primary" type="submit" block size="large">激 活</t-button>
    </t-form>
  </AuthShell>
</template>
```
- 激活：`POST /Auth/Activate { account, code, ... }`（`ActivateModel`）
- 重发：`POST /Auth/SendActivateCode { channel, account }`（`VerifyCodeModel`）
- 邮箱链接直达：`AuthController.Activate(token, account)` —— 前端取 query 后直接调接口。

### 5.3 安全中心（个人中心）

承载位置：顶栏用户下拉 →「安全中心」（独立路由 `/account`，或用 `t-drawer` 承载）。四个区块各自独立、可整块替换：

| 区块 | 端点 | 要点 |
|---|---|---|
| 基本资料 | `GET /api/Admin/User/Info`、`POST /api/Admin/User/Info`（传 User 对象） | 头像走 `POST /api/Admin/User/UploadFile` 拿 `filePath` 再回存 |
| 修改密码 | `POST /api/Admin/User/ChangePassword` | 若 `LoginConfig.security.challengeRequired` 则先 `GET /Auth/Challenge` 加密 |
| 绑定联系方式 | `POST /api/Admin/User/BindByVerifyCode`、`POST /api/Admin/User/SendVerifyCode` | 验证码 `action=bind` |
| 两步验证 | `/Mfa/Status`、`/Mfa/Setup`、`/Mfa/Activate`、`/Mfa/Disable` | `Setup` 返回二维码 URI 与手动密钥；`Activate` 校验首码后回**备用码**（务必提示用户保存） |
| 我的登录设备 | `GET /api/Admin/UserOnline`（`?userId=`）、`POST /api/Admin/UserOnline/Kick` | 与用户在线页共用组件（传 userId 过滤） |
| 我的令牌 | `GET /api/Admin/UserToken` | 只读列表 + 吊销入口 |

### 5.4 SSO / 第三方登录回跳页

- 入口：登录页 OAuth 按钮 → `/Sso/Login/{provider}?r={returnUrl}`（已落地）
- 回跳落地：`SsoController.Auth2` / `LoginInfo` 会带 `code`/`token` 回到 `r`；
  前端做法：新增 `/sso-callback` 路由，解析 query → 调 `GET /Sso/Verify`（或带 `?token=` 直接落库）
  → 写令牌（`api/token.ts`）→ `router.replace('/dashboard')`。
- 待注册预填：`GET /Auth/OAuthPendingInfo?state=` → 跳到 `/register` 预填邮箱/昵称，注册时带 `OAuth` 类别。

### 5.5 AI 助手浮窗（全局）

| 步骤 | 端点 | 说明 |
|---|---|---|
| 1. 取配置 | `GET /Cube/GetAiConfig` | 是否启用 + 配色；关闭时**不渲染浮窗** |
| 2. 对话 | `POST /Ai/AiChat`（SSE 流式） | 请求体带当前页面上下文（`_query` Base64 编码，后端 `DecodePager` 解析） |
| 3. 浏览器操作回传 | `POST /Ai/OperationResult` | 前端执行后端下发的 `run_js` 后回传结果，完成等待中的工具调用 |

实现要点：SSE 用 `fetch` + `ReadableStream` 手工解析（axios 不便流式）；浮窗挂 `BasicLayout`（与 `SettingPanel` 同级），**全局一份**。

### 5.6 统计图表页（`OnGetChartData`）

- 端点：`GET /api/{area}/{controller}/GetChartData`（父类 `ReadOnlyEntityController.GetChartData`，
  业务控制器 `OnGetChartData` 返回 ECharts 配置；`Admin/UserStatController` 返回**多 Y 轴折线 + 箱线 + K 线**）。
- 落地：列表页顶部加「图表」选项卡，`echarts.init` 后**直接 `setOption(后端返回的配置)`**——
  后端已产出 ECharts option，前端不要再自造数据映射。
- 配色：图表色板取 `theme/tokens.ts`（与 `tokens.css` 同源，铁律 C2 三处同源之一）。

### 5.7 值集配置页（四个子表）

| 子表 | 端点 | 交互 |
|---|---|---|
| 枚举值 | `BatchSaveEnumItems`（整表覆盖） | 可编辑表格（值 + 标签 + 排序），整表提交 |
| 列表配置 | `SaveListConfig`（单条） | 表单（数据源 URL / 分页 / 主键 / 显示字段） |
| 搜索字段 | `BatchSaveSearchFields`（整表覆盖） | 可编辑表格 |
| 表格列 | `BatchSaveTableColumns`（整表覆盖） | 可编辑表格（字段 + 标题 + 宽度 + 对齐） |

- 一次性读写：`GET GetConfig?id=` 拿全量、`POST SaveConfig` 整份存回（**推荐**，避免多处半提交）。
- 预览：用 `LovListField.vue` 直接预览该值集的选择弹窗效果。

### 5.8 订单管理自定义端点

`GET /api/Cube/OrderManager/GetInfo?code=` —— 按 code 取指令集合。
落地：`#row-actions` 加「查看指令」，弹窗内渲染返回结构（先用 `DataProbe` 确认）。

### 5.9 地区地图页（`Area/Map`）

`GET /api/Cube/Area/Map` 返回「省级 + 有经纬度城市散点」。
落地：ECharts `geo`/`map` 系列；**地图数据合规**：中国地图必须使用合规地图数据源
（GeoJSON 需来自权威渠道并保留审图号），不得使用境外来源或缺少南海诸岛/钓鱼岛/赤尾屿的底图。

---

## 六、需实测后启用的清单（🔎）——**不要凭命名直接改注册表**

| 候选 | 判定方法 | 若 404 则 |
|---|---|---|
| `Admin/Star`（星尘设置） | 请求 `GET /api/Admin/Star/GetPage` | 在 `specialControllers.ts` 登记 `{ kind:'config', view: ConfigView }` |
| `Admin/SmsConfig` / `MailConfig` / `OAuthConfig` | 同上 | 同上（登记为 config） |
| `Cube/OrderManager` | 同上 | 若 404 但 `GetInfo` 可用 → 登记专用页 |
| 其它自定义控制器 | 同上 | 按 §三 分类选择组件 |

---

## 七、验收清单（「页面全覆盖」的退出条件）

按 §4 目录**逐行**核对，每条必须落到 ✅ 或 🧩（已给配方），**不允许出现「空白页 / 死链 / 占位」**：

- [ ] 认证族 6 页可达（登录 / 注册 / 忘记密码 / 激活 / MFA / SSO 回跳），**无 404 链接**
- [ ] `SPECIAL_CONTROLLERS` 覆盖全部 `GetPage` 404 的控制器（逐个 GetPage 探针确认）
- [ ] 菜单树（`GetMenuTree`）里每个节点都能落到**有内容**的页面（实体页 / 配置页 / 专用页三者之一）
- [ ] 实体页的「额外动作端点」已接线（吊销令牌 / 强制下线 / 立即执行 / 角色权限 / 图表）
- [ ] 未实测契约的页面均带 `DataProbe`（DEV 可见），运行时结构一目了然
- [ ] `vue-tsc --noEmit` **0 错误**（编译清零铁律）
