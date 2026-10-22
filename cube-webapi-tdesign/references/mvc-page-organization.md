# 内置功能页的页面组织（MVC 版基线）

> 本文回答一个问题：**魔方框架内置功能的页面，在前端应该长成什么样、怎么组织。**
> 答案不靠猜——全部取自 MVC 版（`NewLife.CubeNC`）的真实视图与样式表。新增的任何内置功能页
> （安全中心 / 值集配置 / 系统设置 / 权限矩阵 / 账号激活）都必须按本文的版式结构落地。
>
> 取证来源（2026-10-22，master 分支）：
>
> | 文件 | 作用 |
> |---|---|
> | `NewLife.CubeNC/Areas/Admin/Views/Shared/_User_Nav.cshtml` | 用户中心页内导航（10 项 + 图标 + 权限收敛） |
> | `NewLife.CubeNC/Areas/Admin/Views/Shared/_Object_Nav.cshtml` | 系统设置页内导航（5 项 + 「更多设置」下拉） |
> | `NewLife.CubeNC/Areas/Admin/Views/User/Info.cshtml` | 个人资料页骨架（头卡 + 4 分区 + 操作栏 + 安全中心） |
> | `NewLife.CubeNC/Areas/Admin/Views/User/ChangePassword.cshtml` | 表单页最小骨架（分区 + 操作栏） |
> | `NewLife.CubeNC/Areas/Admin/Views/Role/SetPermission.cshtml` | 权限矩阵（4 列表格 + 树形缩进 + 级联勾选） |
> | `NewLife.CubeNC/wwwroot/Content/profile.css` | 上述版式的样式规范（间距/边框/圆角/字阶） |

---

## 一、四条组织铁律（MVC 版的实际做法）

### 1. 同主题功能 = 一组平级页 + 一条顶部导航，而不是一个巨型页

MVC 版把「用户中心」拆成 4 个独立动作页（Info / ChangePassword / Binds / TenantSetting），
再由 `_User_Nav` 在**每个页面顶部**渲染同一条导航串起来。用户点导航就是在平级页之间跳转，
不是在同一页里切 tab。

```
_User_Nav（横向 tab 条，白底卡片）
├─ 基础信息      /Admin/User/Info            ← 仅本人可见
├─ 修改密码      /Admin/User/ChangePassword  ← 仅本人可见
├─ 第三方授权    /Admin/User/Binds           ← 仅本人可见
├─ 租户信息      /Admin/User/TenantSetting   ← 仅本人可见
├─ 用户详情      /Admin/User/Detail?Id=      ← 管理员看他人时
├─ 关联账号      /Admin/UserConnect?userId=
├─ 令牌          /Admin/UserToken?userId=
├─ OAuth 日志    /Admin/OAuthLog?userId=
├─ 日志          /Admin/Log?userId=
└─ 通知记录      /Admin/NotificationRecord?userId=&channel=InApp
```

**前端等价物**：`components/cube/PageNav.vue`（数据驱动，见 §二）。同一个实体相关的一组功能，
导航项集中在一处声明，页面只负责内容区。

### 2. 系统设置类控制器 = 一条「胶囊导航」+ 下拉归拢次要项

`_Object_Nav` 用 `nav-pills`：Core / Sys / Star / XCode / Cube 五项平铺，
把 SmsConfig / MailConfig / OAuthConfig / AccessRule 收进「更多设置」下拉（附加 `?nav=1`）。

**前端等价物**：同一个 `PageNav.vue` 的 `groups` 形态（主项 + 下拉子项）。

### 3. 表单页 = 分区卡片（form-section）+ 底部操作栏，字段两列

`ChangePassword.cshtml` 给出最小骨架，`Info.cshtml` 是完整形态：

```
PageNav
（可选）状态提示条
ProfileHeader             ← 仅资料类页面有：头像 + 名称 + 角色徽章 + 统计条
PageSection  基础信息      ← 标题栏（图标 + 文案）+ 内容区（两列字段）
PageSection  联系方式
PageSection  身份信息      ← 含头像上传
PageSection  登录信息      ← 只读统计 + 备注
操作栏         保存 / 取消
PageSection  安全中心      ← 导出个人数据 / 注销账号（危险区独立成块）
```

字段布局固定为：`row > col-sm-6`（每行两列），`label` 右对齐占 1/3 + 控件占 2/3 + 控件下方
`help-text`（12px，次要色）放说明。**只读字段用 disabled 输入框或纯文本值呈现，不要藏起来。**

**前端等价物**：`components/cube/PageSection.vue` + `components/cube/ProfileHeader.vue`。

### 4. 权限矩阵 = 4 列表格，树形缩进 + 双向级联

`SetPermission.cshtml` 的表头固定为：**名称 / 显示名 / 授权 / 操作权限**；名称列用全角空格
按 `Deepth` 缩进表达层级；父行复选框级联全部子行，子行全灭时回算父行；
非叶子行给「只读 / 全部」两个快捷勾选。

**前端等价物**：已有的 `components/cube/RoleMenuEditor.vue`（列与级联语义按本节对齐）。

---

## 二、样式规范（profile.css → 设计令牌映射）

**禁止照抄字面色值**。MVC 用的是 Bootstrap 主色 `#2b7dbc`；前端一律取设计令牌
（`styles/tokens.css`），这样换肤 / 暗色模式才成立。

| 元素 | MVC 实测值 | 前端令牌 / 写法 |
|---|---|---|
| 页面容器 | `max-width:1200px; margin:0 auto; padding:0 15px` | `.page-wrap { max-width:1200px; margin:0 auto; }` |
| 卡片 | 白底 + `1px #e4e6e9` + `4px` 圆角 + `0 1px 2px rgba(0,0,0,.05)` | `background:var(--td-bg-color-container); border:1px solid var(--td-component-stroke); border-radius:var(--td-radius-medium); box-shadow:var(--td-shadow-1)` |
| 头卡 | 顶部 `4px` 主色边 | `border-top:3px solid var(--td-brand-color)` |
| 卡片间距 | 统一 `16px` | `margin-bottom:16px` |
| 导航项 | `padding:12px 14px`，悬停浅底，选中底部 `3px` 主色下划线 + 加粗 | 同理，色值取 `--td-brand-color` / `--td-brand-color-light` |
| 分区标题栏 | `padding:12px 20px`，15px/700，浅底 `#fafbfc`，下分隔线 | `padding:12px 20px; font-size:15px; font-weight:700; background:var(--td-bg-color-secondarycontainer); border-bottom:1px solid var(--td-component-stroke)` |
| 分区内容区 | `padding:20px 24px 6px` | 同值 |
| 字段行距 | `margin-bottom:18px` | 同值 |
| 标签 | `font-weight:600`，右对齐，顶部 `7px` 对齐基线 | 用 `t-form` 的 `label-align="right"` + `label-width` |
| 说明文字 | `font-size:12px; color:#999` | `font-size:12px; color:var(--td-text-color-placeholder)` |
| 操作栏 | 白底卡片，按钮居中，`min-width:100px`，间距 6px | 主按钮 `theme=primary`、次按钮 `theme=default` |
| 头像 | `96px` 圆形，3px 白边 + 阴影 | `t-avatar :size="96px"` + 同款阴影 |
| 统计条 | 浅底、4 列等分、数值 18px/700 主色、标签 12px 次要色 | `display:flex` + `flex:1` + 分隔线 |
| 分类小标题 | 图标在主色、右侧 8px 间距 | `t-icon` + `color:var(--td-brand-color)` |

响应式：宽度 <768px 时头卡转纵向居中、统计条两列、导航条横向滚动（`overflow-x:auto`）。

---

## 三、页面清单与落地组件（内置功能页）

| 页面 | MVC 参照 | 前端资产 | 组织要点 |
|---|---|---|---|
| 个人资料 | `User/Info.cshtml` | `pages/AccountView.vue` + `ProfileHeader` | 头卡 + 4 分区 + 操作栏 + 安全中心危险区 |
| 修改密码 | `User/ChangePassword.cshtml` | `AccountView` 内「修改密码」分区 | 分区 + 操作栏；SSO 登录时隐藏旧密码项并说明原因 |
| 第三方授权 | `User/Binds.cshtml` | `AccountView` 内「第三方授权」分区 | 列表项：Logo + 名称 + 昵称 + 状态 + 操作（`oauth-list` 形态） |
| 租户信息 | `User/TenantSetting.cshtml` | `TenantSwitcher` + `AccountView` 分区 | 当前租户只读展示 + 切换入口 |
| 用户中心导航 | `_User_Nav.cshtml` | `PageNav.vue`（用户中心预设） | 10 项含图标与权限收敛 |
| 系统设置 | `_Object_Nav.cshtml` | `PageNav.vue`（设置组预设，挂在 `ConfigView` 顶部） | 5 主项 + 「更多设置」下拉 |
| 角色权限 | `Role/SetPermission.cshtml` | `RoleMenuEditor.vue` | 4 列表格 + 树形缩进 + 级联 |
| 值集配置 | 无 MVC 视图（仅 WebApi） | `LovConfigDrawer.vue` | 沿用分区卡片组织，4 个分区 + 操作栏 |
| 账号激活 | `_Login_Register.cshtml` 系列 | `pages/ActivateView.vue` | 复用 `AuthShell` 认证外壳 |
| 列表页扩展动作 | MVC 各行内按钮 | `entityActions.ts` + `EntityActions.vue` | 行内链接按钮，破坏性动作二次确认 |

---

## 四、落地检查表

新增一个内置功能页时，逐条自检：

- [ ] 有同主题页面吗？有 → 用 `PageNav` 串联，**不要**另起一套导航
- [ ] 页面结构是否为「导航 + 分区卡片 + 操作栏」？字段是否两列、说明是否在控件下方？
- [ ] 颜色是否全部走令牌（不得出现 `#2b7dbc` 等 MVC 字面色值）？
- [ ] 只读字段是否以只读控件/文本呈现，而不是直接隐藏？
- [ ] 危险操作（注销、清空密码、强制下线）是否独立成块并有二次确认？
- [ ] 权限收敛：非系统角色是否只能看本人数据（同 `_User_Nav` 的 `IsSystem` 判定）？
