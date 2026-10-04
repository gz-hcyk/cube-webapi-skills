# 审批运行时切片实现记录

日期：2026-10-04。范围是 `examples/approval`，不包含 TDesign 页面，也不重建魔方的用户、角色、部门、菜单和登录。

技能以 main 上的 `cube-webapi-backend/SKILL.md` 为准。PR #2（`cursor/skill-fix-from-ledger-validation-7836`）当时仍是草稿，冲突处采用该分支：`net8.0`、`NewLife.Cube 6.15.2026.901`、`NewLife.XCode 12.2.2026.901`、`Swashbuckle.AspNetCore 6.9.0`，SQLite 连接串使用 `Data Source=...;Provider=sqlite`。

## 结论

`dotnet build examples/approval/Approval.sln` 成功。`dotnet test examples/approval/Approval.sln` 连续两轮全部通过：4 个测试，0 失败。Web 项目能通过 `WebApplicationFactory` 启动，HTTP 覆盖了同一条已发布流程上的本人发起、代发起、同意、驳回，以及「该生辅导员」按业务主体而不是代发人解析。

本轮在确认通过之后没有再发现这个切片里的新缺陷，按约定停止。

## 已通过

实体方法（不经 HTTP）：

- 表单草稿发布为不可变版本。已发布结构再改、已发布节点再改，都返回 4091。
- 会签、依次审批写入节点（`ApproveMode` 分别为 All、Sequential）。发起进入会签节点时返回 4222，并且实例和表单数据回滚。
- 办理人为空时返回 4223，实例和表单数据回滚。
- 本人发起：学生字段与当前用户不一致时返回 4221；成功后业务主体和发起人是当前用户，`ProxyUserId = 0`，标题为「学生乙的请假」。
- 代发起：必须选择学生。标题为「辅导员丙代学生乙发起的请假」。历史动作名是「代发起」，意见里有代发人和业务主体。待办标题与实例标题相同。
- 同一请求号再次发起返回原实例。
- 或签：一人同意后，同节点另一待办变为已取消；后者再同意返回 4092。
- 指定成员、指定角色、部门负责人、该生辅导员四段都能走到。部门负责人取发起人部门，代发起时是代发人的部门负责人，不是学生部门的负责人。辅导员取实例上的 `CounselorUserId`（来自表单 `counselorUserId`），不是代发人，也不是代发人的部门负责人。
- 驳回意见必填。驳回后状态为已驳回，历史含「已退回发起人：学生乙」。代发起时发起人是代发人。
- 表单数据主键等于实例主键。
- 历史 `Update` / `Delete` 返回 4091。

HTTP（`WebApplicationFactory` 启动 `Approval.Web`，关闭 Cookie，只带 Bearer）：

- `POST /Auth/Login` 可用测试用户登录。
- 同一条已发布请假流程：本人发起学生字段被改掉返回 4221；本人发起成功后待办人是表单里的辅导员；辅导员驳回，历史含退回发起人。
- 代发起标题、历史、`proxyUserId`、`subjectUserId` 正确。待办人是学生的辅导员，不是代发人。辅导员同意后实例状态为已通过。

## 本轮失败与修复

编译：

- `EntityCache.Clear` 和 `ISingleEntityCache.Clear` 必须带原因。运行时清理缓存已补上 `"runtime"`。
- 控制器里的 `User` 指向 `ClaimsPrincipal`。取当前魔方用户改为 `XCode.Membership.User.FindByID`。

测试过程中看到、但不是引擎缺陷的现象：

- 自定义权限位不会因为角色 `IsSystem` 自动放行。宿主扫完菜单后，测试把「发起 / 同意 / 驳回 / 查看单据」授给测试角色并 `Update`，之后 HTTP 才返回 200。菜单上的权限串是 `16#发起,32#同意,64#驳回,128#查看单据`。
- `HttpClient` 默认保存登录 Cookie。后一次请求同时带旧 Cookie 和新 Bearer 时，当前用户仍是上一个登录人，同意接口返回 4031。测试关闭了 Cookie。

实体测试第一次就通过，其中包括回滚、表单主键和辅导员解析。修复测试夹具后再跑，全量通过；又完整跑了一轮，仍是 4 通过、0 失败。没有进入第三轮产品修复。

## 与设计文档的差异

- 流程草稿仍把图放在版本 `Definition` JSON 里。发布时另外写成 `ApprovalNode`、`ApprovalTransition` 行。DBDD 只要求 JSON；本切片按任务把节点和连线也做成了实体。运行时读的是这两张表。
- 领域方法在 `Approval.Data` 的 Biz 上，Web 只做薄控制器。SDD 里的独立引擎程序集没有单独建，Data 也不引用 Cube。
- 审计拦截器 `AllowEmpty = true`。这样无登录的实体测试可以写定义和实例；有登录时仍会填充用户和 IP。DBDD 对定义要求不允许空。
- 未建分类、字段索引、令牌表。`CategoryId` 只是整数。
- 部门负责人按发起人部门上溯。只有「该生辅导员」按业务主体。辅导员不是新的用户表，而是发起时从表单抄到实例的用户编号。
- 会签、依次审批只保存。进入这种节点直接 4222，不会偷偷当成或签。
- 多条出线只走 `Sort` 最小的一条。没有排他网关和并行网关的执行。
- 没有学生信息系统。请假实例用 `SubjectUserId` 和可选的 `ProxyUserId`。

## 怎样运行

```bash
cd examples/approval
dotnet build Approval.sln
dotnet test Approval.sln
dotnet run --project Approval.Web
```

开发环境监听 `http://127.0.0.1:5052`，Swagger 在 `/Swagger`。`Config/Cube.config` 里的 `JwtSecret` 只给示例，不能用于生产。魔方初始化后的管理员仍是框架种子的 `admin` / `admin`。运行接口要在角色上授予审批运行菜单的对应权限位。

生成实体里的可空警告来自 xcode 输出，本轮没有手改 `*.cs`。

## 下一步

- 待办收件箱和已办列表。
- 会签、依次审批的执行，以及排他、并行网关。
- 撤回、取消、转办。
- 其余办理人规则。
- DBDD 里尚未落地的分类、字段值、令牌。
- 按已确认原型做 TDesign 页面。
