# FEATURES.md —— 内置功能页资产索引

> 这份清单回答：「魔方框架内置的那些功能页，前端资产在哪、怎么启用、接线点在哪」。
> 与 `README.md` 的分工：README 讲**怎么拷**（`cp -r assets/core/. src/`）与逐文件作用；
> 本文讲**拷完之后哪些要接线、接到哪、什么条件下才该启用**。
>
> 页面版式基线见 `references/mvc-page-organization.md`（取自 MVC 版真实视图与 profile.css）。
> 端点契约以**实测**为准，标注了实测版本；带 ⚠️ 的是实测与历史文档冲突、已按实测修正的项。

---

## 一、版式基元（三个，页面都靠它们拼）

| 资产 | 作用 | 接线点 | 何时用 |
|---|---|---|---|
| `components/cube/PageNav.vue` | 页内导航条（对齐 MVC `_User_Nav` / `_Object_Nav`） | 传 `items` + `v-model`（tab 型） | 一组平级功能页需要互相串起来时 |
| `components/cube/PageSection.vue` | 分区卡片（对齐 MVC `.form-section`） | 默认插槽放内容，`#extra` 放右侧按钮 | **所有**内置功能页的表单/列表分区 |
| `components/cube/ProfileHeader.vue` | 个人信息头卡（对齐 MVC `.profile-card`） | 传 name/username/avatar/roles/stats | 资料类页面的顶部概览 |

配套数据声明：`src/pageNav.ts` 的 `userCenterNav()` / `settingsNav()`。

---

## 二、内置功能页资产

| 页面 | 资产 | 启用条件 | 接线点 | 端点实测（6.15.2026.901） |
|---|---|---|---|---|
| 个人资料 / 安全中心 | `pages/AccountView.vue` | 需要「用户自助改资料」 | 路由 `/account` + 顶栏用户菜单「个人资料」 | `GET/POST /api/Admin/User/Info` ✅、`POST .../ChangePassword` ✅、`POST .../UploadFile` ✅、`GET /api/Admin/User/Binds` ✅、`GET /Sso/UnBind?id=` ✅、`GET /api/Admin/User/ExportFile?format=json` ✅ |
| 值集配置 | `components/cube/LovConfigDrawer.vue` | 后端有 `Admin/Lov` 控制器 | `entityActions.ts` 的 `Admin/Lov` 行「配置」（客户端动作） | `GET /api/Admin/Lov/GetConfig?id=` ✅、`POST .../SaveConfig` ✅ ⚠️ 四个 `BatchSave*` 分存端点**不存在** |
| 实体页额外行操作 | `components/cube/EntityActions.vue` + `src/entityActions.ts` | 无（ListPage 内置渲染） | 无需接线；新增动作只改 `entityActions.ts` | 见下表 |
| 租户切换 | `components/cube/TenantSwitcher.vue` | 多租户部署 | 顶栏 `<TenantSwitcher compact />`（已接）、`AccountView` 租户分区 | `GET /api/Admin/Tenant/GetPage` ✅ ⚠️ `Auth/SwitchTenant` **不存在** |
| 账号激活 | `pages/ActivateView.vue` | **仅后端自建了激活端点时** | 路由 `/activate`（已注册为 guest 页） | ⚠️ `Auth/Activate` 与 `Auth/SendActivateCode` 在 6.15 **均 404**；页面已做「明确提示 + 降级到 `Auth/SendCode`」 |
| 第三方登录回跳 | `pages/SsoCallbackView.vue` | 使用 OAuth / SSO 登录时 | 登录页 OAuth 按钮的 `r` 指向 `/sso-callback` | `GET /Sso/LoginInfo(id, code, state)` ✅ |

### 行操作实测矩阵（`entityActions.ts` 已按此修正）

| 动作 | 端点形态（实测签名） | 参数 | 易错点 |
|---|---|---|---|
| 吊销令牌 | `POST User/RevokeTokens(Int32 id)` | query `id` | — |
| 清空密码 | `POST User/ClearPassword(Int32 id)` | query `id` | — |
| 强制下线 | **`GET UserOnline/Kick(Int32 id)`** | query `id` | 写成 POST 会 **405** |
| 立即执行 | `POST CronJob/ExecuteNow(String id)` | query `id` | 形参是 `id`，**不是** `name`；传 name 会静默不执行 |

---

## 三、能力开关（避免做出「点了必报错」的按钮）

| 开关来源 | 控制的 UI | 实测值示例 |
|---|---|---|
| `LoginConfig.security.mfaAvailable` | `AccountView` 的「两步验证」整块显隐 | 该部署 `false` → **整块不渲染**（`/Mfa/*` 端点存在但未开放） |
| `LoginConfig.login.sms/mail` | 登录页通道、激活页通道 | 均 `false` |
| `LoginConfig.register.sms/mail` | 注册/激活的验证码通道 | 均 `false` |
| `GET /api/Admin/Tenant/GetPage` 可达性 | `TenantSwitcher` 是否可切换 | 普通用户 403 → 选择器禁用（不隐藏） |
| `GetPage.setting.isReadOnly` | `ListPage` 的新增/编辑/删除 | 由后端下发 |

---

## 四、已知缺口（不要重复踩）

| 缺口 | 现状 | 建议 |
|---|---|---|
| 角色权限矩阵 | ✅ **已资产化**（`RoleMenuEditor.vue` = 四列授权表格）。**不需要自建端点**：`Role.Permission` 走 Role 实体标准 `PUT` 保存，前端只需把勾选结果序列化成 `菜单ID#掩码` 串。⚠ 6.15 确实**没有** `Role/PermissionTree` / `SavePermission` 动作——那是 MVC 版的路由，WebApi 版靠实体 PUT | 照 SKILL §4.12.1 接线；写串后读回校验（掩码 0 的段会被 XCode 丢弃） |
| 账号注销 | 无 `User/CloseAccount` 端点 | 已改为「导出个人数据」；真要做注销须后端自建 |
| 账号激活 | 无 `Auth/Activate` | 同上；页面已做显式降级提示 |
| 统计图表页 / 地区地图页 / AI 浮窗 | 本轮**未资产化**（不在「高频必用子集」内） | 仍按 `cube-page-catalog.md` §5.5/§5.6/§5.9 的配方落地 |

---

## 五、复用操作顺序（新建工程时）

1. `cp -r assets/core/. <工程>/src/` —— 一次拷全（当前 50 件）。
2. 路由接线：`/account`（AccountView）、`/activate`（guest）、`/sso-callback`（public，**不能**被「已登录→dashboard」拦）。
3. 布局接线：顶栏放 `<TenantSwitcher compact />`；用户下拉加「个人资料」→ `/account`。
4. 动作接线：按目标后端版本核对 `entityActions.ts` 的矩阵；新增动作只加对象。
5. 能力开关：按 `LoginConfig` 收敛 MFA / 验证码通道，别把未开放的功能渲染成按钮。
6. 验收：`vue-tsc --noEmit` + `vite build` 双 0 错误；必要时启动后端跑 `GET /Cube/Apis` 核签名。
