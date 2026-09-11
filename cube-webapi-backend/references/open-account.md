# 挂链开号：业务实体 → 魔方 User 登录账号

适用：项目里业务档案（学生/员工/会员/访客…）已独立建模，需要让他们能登录魔方后台
（NewLife.Cube WebApi），但**不想改业务表结构**（加 UserID 列会与"生成实体已入库、避免改表"约定冲突）。

## 核心思路：挂链（link-on）而非嵌入

- 业务实体保持事实源（唯一约束：学号/工号/手机号），魔方 `XCode.Membership.User` 独立建。
- 桥接键 = `User.Name`（全局唯一登录名）= **人群前缀 + 身份键**，如 `ST+学号` / `EM+工号` / `EX+手机号`。
  前缀天然避免不同人群身份键撞号；`User.Code` 冗余存身份键供反查业务档案。
- 注意前缀拼接结果：`ST` + `S2026002` = `STS2026002`（双字母易看错，测试脚本别打错密码/登录名）。
- **零 schema 变更**：业务表不加列，通过 `User.FindByName(prefix+key)` 即可定位账号。

## User 字段约定（魔方 6.13）

| 字段 | 用途 |
|---|---|
| Name | 前缀+身份键，登录名（UNIQUE） |
| Code | 身份键（反查业务档案；班主任等按 Code=工号 过滤视图） |
| DisplayName / Mobile / Sex | 档案级联（SexKinds: 0未知/1男/2女；无法判定时写 未知，**不要**用业务性别硬映射以免覆盖） |
| DepartmentID | 有部门归属的直挂 Cube Department → 部门数据权限生效；无对应部门（如班级）填 0 |
| RoleID | 统一普通用户 = 3（种子：1管理员/2高级用户/3普通用户/4游客） |
| Ex1 = 1 | 首登强制改密标记（Cube 无内建机制，借扩展位；登录信息接口回传给前端闸门） |
| Ex4 = 'D' | 档案注销标记（恢复开号时清除） |
| Ex2/Ex3 | 档案ID/类型（可选，审计回链） |

## 开号服务骨架（幂等 Ensure + 停用 Deactivate）

```csharp
public static class OpenAccountService
{
    public const Int32 NormalRoleId = 3;
    public const Int32 MustChangePassword = 1;
    static readonly Object _lock = new();   // Name 查重-插入竞态锁（开号频率低无性能影响）

    // 初始密码 = 身份键后6位（不足右补0 恒6位，满足默认强度策略 ^.{5,32}$）
    public static String InitPassword(String key)
    {
        key = key?.Trim() ?? "";
        if (key.Length == 0) return "000000";
        return key.Length >= 6 ? key.Substring(key.Length - 6) : (key + "000000").Substring(0, 6);
    }

    static (Int32 Id, Boolean Created) EnsureCore(String prefix, String key, String displayName,
        String mobile, SexKinds sex, Int32 deptId)
    {
        if (key.IsNullOrEmpty()) return (0, false);
        var loginName = prefix + key;
        lock (_lock)
        {
            try
            {
                var user = User.FindByName(loginName);
                if (user == null)
                {
                    user = new User { Name = loginName, Code = key, DisplayName = displayName,
                        Mobile = mobile, Sex = sex, DepartmentID = deptId, RoleID = NormalRoleId,
                        Ex1 = MustChangePassword, Enable = true };
                    // 密码必须走框架 Provider（与 Login 校验配对），不要自算 hash
                    user.Password = ManageProvider.Provider.PasswordProvider.Hash(InitPassword(key));
                    user.Insert();
                    return (user.ID, true);
                }
                // 已存在：轻量联动（改名/换手机/部门/注销恢复），**不重置密码与改密标记**
                var dirty = false;
                if (!user.Enable) { user.Enable = true; user.Ex4 = ""; dirty = true; }
                if (!displayName.IsNullOrEmpty() && user.DisplayName != displayName) { user.DisplayName = displayName; dirty = true; }
                if (mobile != null && user.Mobile != mobile) { user.Mobile = mobile; dirty = true; }
                if (deptId > 0 && user.DepartmentID != deptId) { user.DepartmentID = deptId; dirty = true; }
                if (dirty) user.Update();
                return (user.ID, false);
            }
            catch (Exception ex) { XTrace.Log.Error($"账号开通失败[{loginName}]: {ex.Message}"); return (0, false); }
        }
    }
    // Deactivate: Enable=false + Ex4='D'（可恢复）。Ensure 内部静默 try/catch——账号问题不阻断业务建档。
    // ProvisionAll(): 全表扫描各实体 Select(EnsureCore)，返回 {created,existed,failed,total}（存量补号/导入后补号）。
}
```

## 实体钩子接线（XCode partial 类）

```csharp
protected override Int32 OnInsert()
{
    var rs = base.OnInsert();
    if (!SyncContext.SuppressPush) OpenAccountService.EnsureStudent(this);  // 批量导入期间抑制
    return rs;
}
protected override Int32 OnUpdate()
{
    var rs = base.OnUpdate();
    if (!SyncContext.SuppressPush) OpenAccountService.EnsureStudent(this);  // 改名/换手机级联
    return rs;
}
protected override Int32 OnDelete()
{
    if (!SyncContext.SuppressPush) OpenAccountService.DeactivateStudent(this);
    return base.OnDelete();
}
```

要点：
- 批量导入（Excel 等）用 AsyncLocal 抑制位（`SyncContext.SuppressPush`）跳过逐行开号，导入完调一次 `ProvisionAll()`。
- 共用身份键的两类档案（如教职工与班主任同为工号）可复用同一前缀 → 幂等共存，覆盖建档先后时序。
- 身份键（学号/工号）变更 = 产生新号、旧号成孤儿 → 管理面禁止改身份键。

## 端点三件套（ControllerBaseX 自定义控制器）

```csharp
[HttpPost, EntityAuthorize((PermissionFlags)16)]      // 超管位：批量补开
public IActionResult ProvisionAll() => Json(0, "批量补开完成", OpenAccountService.ProvisionAll(), null);

[HttpGet, AllowAnonymous]                              // 仅登录态：查 mustChange
public IActionResult MySecurity()
{
    // 关键坑：AllowAnonymous 跳过鉴权过滤器 → ManageProvider.User 为 null，
    // 必须手动 TryLogin(HttpContext) 从 Bearer 令牌解析身份
    var u = ManageProvider.Provider.TryLogin(HttpContext) as XCode.Membership.User;
    if (u == null) return Json(401, "没有登录或登录超时", null, null);
    return Json(0, "OK", new { mustChange = u.Ex1 == OpenAccountService.MustChangePassword,
        name = u.Name, displayName = u.DisplayName }, null);
}

[HttpPost, AllowAnonymous]                             // 自助改密
public IActionResult ChangeMyPassword([FromBody] ChangePwdInput input)
{
    var u = ManageProvider.Provider.TryLogin(HttpContext) as XCode.Membership.User;
    if (u == null) return Json(401, "没有登录或登录超时", null, null);
    // 校验：两次一致/非空/长度5~32/不与旧密相同（与魔方 ChangePassword 语义对齐）
    var rs = ManageProvider.Provider.ChangePassword(u.Name, input.newPassword, input.oldPassword);
    if (rs == null) return Json(1, "修改失败：原密码不正确或账号状态异常", null, null);
    var me = User.FindByName(u.Name);
    if (me != null && me.Ex1 != 0) { me.Ex1 = 0; me.Update(); }  // 清强制改密标记
    return Json(0, "密码修改成功", null, null);
}
```

为什么 MySecurity/ChangeMyPassword 用 `[AllowAnonymous]` + TryLogin 而不是常规鉴权：
普通用户 RoleID=3 只有 `11#1` 权限位，任何带 `EntityAuthorize` 的自定义端点都会 403；
`AllowAnonymous` 跳过菜单权限校验，身份仍由 Bearer 令牌手动解析，等价"仅登录态"。

## 前端强制改密闸门（TDesign Vue Next）

- `ForcePasswordDialog.vue`：不可关闭弹窗（`:close-btn="false"` `:close-on-esc-keydown="false"` `:close-on-overlay-click="false"`），
  onMounted 由布局调用 `check()`（GET MySecurity），mustChange=true 时弹出；提交 POST ChangeMyPassword；`cancel()` = 登出。
- 挂载在 `BasicLayout.vue`（登录成功后的所有页面都在其内），登录页本身不改。

## 验证清单（隔离实例）

- [ ] 建档案 → User 表出现 `{prefix}{key}`，Enable=1、Ex1=1、RoleID=3
- [ ] 初始密码（身份键后6位）登录成功；MySecurity mustChange=true
- [ ] 改密成功 → Ex1=0，旧密码登录被拒，新密码登录 mustChange=false
- [ ] 无 token 调 MySecurity → 401；错旧密码/两次不一致 → code=1 拒
- [ ] 删档案 → Enable=0、Ex4='D'；重建 → 恢复 Enable=1、Ex4 清空、**密码不被重置**
- [ ] 改姓名 → DisplayName 级联；ProvisionAll 幂等（existed 计数，不重复建）
- [ ] 坑：全新空库需双启（首启建菜单、二启授 admin 权限），期间 ProvisionAll 可能瞬态 403

实战项目参考：WeComAddressBook commit 33e3a75（学生/教职工/班主任/校外人员四类挂链开号）。
