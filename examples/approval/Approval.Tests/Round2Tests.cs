using Approval.Data;
using Approval.Data.Entities;
using Xunit;
using XCode.Membership;
using TaskStatus = Approval.Data.Entities.TaskStatus;

namespace Approval.Tests;

/// <summary>第 2 轮：排他网关、并行网关、抄送已阅、向后加签、监控数据范围。</summary>
[Collection("approval")]
public class Round2Tests
{
    private const String Schema = """{"fields":[{"key":"studentUserId"},{"key":"counselorUserId"},{"key":"reason"},{"key":"days"}]}""";

    public Round2Tests(ApprovalWorld world) => _ = world;

    [Fact]
    public void Exclusive_gateway_uses_condition_or_the_default_path()
    {
        var mark = Mark();
        var longLeave = UserOf("ex-long-" + mark, "长假审批");
        var shortLeave = UserOf("ex-short-" + mark, "短假审批");
        var applicant = UserOf("ex-app-" + mark, "学生乙");
        var process = Publish(mark, "排他请假", ExclusiveGraph(longLeave.ID, shortLeave.ID));

        var small = Start(process, applicant, "ex-small-" + mark, 1);
        Assert.Equal(shortLeave.ID, ApprovalTask.FindPending(small.Id).Single().AssigneeId);
        Assert.DoesNotContain(ApprovalTask.Inbox(longLeave.ID), t => t.InstanceId == small.Id);

        var missing = Start(process, applicant, "ex-miss-" + mark, null);
        Assert.Equal(shortLeave.ID, ApprovalTask.FindPending(missing.Id).Single().AssigneeId);

        var text = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Data = "{\"studentUserId\":" + applicant.ID + ",\"days\":\"lots\",\"reason\":\"回家\"}",
            RequestId = "ex-text-" + mark,
        });
        Assert.Equal(shortLeave.ID, ApprovalTask.FindPending(text.Id).Single().AssigneeId);

        var big = Start(process, applicant, "ex-big-" + mark, 5);
        Assert.Equal(longLeave.ID, ApprovalTask.FindPending(big.Id).Single().AssigneeId);
        Assert.DoesNotContain(ApprovalTask.Inbox(shortLeave.ID), t => t.InstanceId == big.Id);

        var version = ApprovalProcessVersion.FindById(process.PublishedVersionId)!;
        var transitions = ApprovalTransition.FindAllByProcessVersionId(version.Id);
        Assert.Contains(transitions, e => e.FromKey == "x" && e.IsDefault && e.ToKey == "short");
        big = ApprovalInstance.Agree(ApprovalTask.FindPending(big.Id).Single().Id, longLeave.ID, "同意", "ex-ag-" + mark, big.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, big.Status);
    }

    [Fact]
    public void Parallel_gateway_waits_for_both_branches()
    {
        var mark = Mark();
        var a = UserOf("par-a-" + mark, "并行甲");
        var b = UserOf("par-b-" + mark, "并行乙");
        var applicant = UserOf("par-app-" + mark, "学生乙");
        var process = Publish(mark, "并行请假", ParallelGraph(a.ID, b.ID));
        var inst = Start(process, applicant, "par-" + mark, null);

        Assert.Equal(InstanceStatus.Running, inst.Status);
        Assert.Equal(2, ApprovalTask.FindPending(inst.Id).Count);
        Assert.Contains(ApprovalTask.Inbox(a.ID), t => t.InstanceId == inst.Id);
        Assert.Contains(ApprovalTask.Inbox(b.ID), t => t.InstanceId == inst.Id);

        var taskA = ApprovalTask.FindPending(inst.Id).Single(t => t.AssigneeId == a.ID);
        inst = ApprovalInstance.Agree(taskA.Id, a.ID, "同意", "par-a-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Running, inst.Status);
        Assert.Equal(b.ID, ApprovalTask.FindPending(inst.Id).Single().AssigneeId);
        Assert.DoesNotContain(ApprovalTask.Inbox(a.ID), t => t.InstanceId == inst.Id);

        inst = ApprovalInstance.Agree(ApprovalTask.FindPending(inst.Id).Single().Id, b.ID, "同意", "par-b-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, inst.Status);

        var rejected = Start(process, applicant, "par-rej-" + mark, null);
        var rejectTask = ApprovalTask.FindPending(rejected.Id).Single(t => t.AssigneeId == a.ID);
        rejected = ApprovalInstance.Reject(rejectTask.Id, a.ID, "不行", "par-no-" + mark, rejected.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Rejected, rejected.Status);
        Assert.Equal(TaskStatus.Canceled, ApprovalTask.FindAll(ApprovalTask._.InstanceId == rejected.Id).Single(t => t.AssigneeId == b.ID).Status);
        Assert.DoesNotContain(ApprovalTask.Inbox(b.ID), t => t.InstanceId == rejected.Id);
    }

    [Fact]
    public void Cc_does_not_block_approval_and_can_be_marked_read()
    {
        var mark = Mark();
        var approver = UserOf("cc-ap-" + mark, "审批人");
        var copied = UserOf("cc-cc-" + mark, "抄送人");
        var applicant = UserOf("cc-app-" + mark, "学生乙");
        var process = Publish(mark, "抄送请假", CcGraph(copied.ID, approver.ID));
        var inst = Start(process, applicant, "cc-" + mark, null);

        var cc = ApprovalTask.FindAll(ApprovalTask._.InstanceId == inst.Id & ApprovalTask._.Kind == TaskKind.Cc).Single();
        Assert.Equal(copied.ID, cc.AssigneeId);
        Assert.Equal(TaskStatus.Pending, cc.Status);
        Assert.DoesNotContain(ApprovalTask.Inbox(copied.ID), t => t.Id == cc.Id);
        var approve = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(approver.ID, approve.AssigneeId);

        inst = ApprovalInstance.Agree(approve.Id, approver.ID, "同意", "cc-ag-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, inst.Status);
        Assert.Equal(TaskStatus.Pending, ApprovalTask.FindById(cc.Id)!.Status);

        var version = inst.Version;
        inst = ApprovalInstance.Read(cc.Id, copied.ID, "cc-read-" + mark, "127.0.0.1");
        Assert.Equal(version, inst.Version);
        Assert.Equal(TaskStatus.Read, ApprovalTask.FindById(cc.Id)!.Status);
        Assert.Contains(ApprovalHistory.FindAllByInstanceId(inst.Id), h => h.Action == "read" && h.OperatorId == copied.ID);
        Throws(4031, () => ApprovalInstance.Read(cc.Id, approver.ID, "cc-other-" + mark, "127.0.0.1"));
        Throws(4092, () => ApprovalInstance.Read(cc.Id, copied.ID, "cc-again-" + mark, "127.0.0.1"));

        var withdrawn = Start(process, applicant, "cc-wd-" + mark, null);
        var pendingCc = ApprovalTask.FindAll(ApprovalTask._.InstanceId == withdrawn.Id & ApprovalTask._.Kind == TaskKind.Cc).Single();
        withdrawn = ApprovalInstance.Withdraw(withdrawn.Id, applicant.ID, "撤回", "cc-wd-do-" + mark, withdrawn.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Draft, withdrawn.Status);
        Assert.Equal(TaskStatus.Canceled, ApprovalTask.FindById(pendingCc.Id)!.Status);
    }

    [Fact]
    public void Add_sign_is_one_level_and_blocks_until_that_person_agrees()
    {
        var mark = Mark();
        var a = UserOf("add-a-" + mark, "审批甲");
        var b = UserOf("add-b-" + mark, "审批乙");
        var extra = UserOf("add-x-" + mark, "加签人");
        var applicant = UserOf("add-app-" + mark, "学生乙");
        var process = Publish(mark, "加签请假", UsersGraph("any", a.ID, b.ID));
        var inst = Start(process, applicant, "add-" + mark, null);
        var taskA = ApprovalTask.FindPending(inst.Id).Single(t => t.AssigneeId == a.ID);

        inst = ApprovalInstance.AddSign(taskA.Id, a.ID, extra.ID, "请再看一眼", "add-do-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Running, inst.Status);
        Assert.Equal(TaskStatus.Agreed, ApprovalTask.FindById(taskA.Id)!.Status);
        var added = ApprovalTask.Inbox(extra.ID).Single(t => t.InstanceId == inst.Id);
        Assert.Equal(TaskSource.AddSign, added.Source);
        Assert.Equal(taskA.NodeKey, added.NodeKey);
        Assert.Contains(ApprovalTask.Inbox(b.ID), t => t.InstanceId == inst.Id && t.Status == TaskStatus.Pending);
        Assert.Contains(ApprovalHistory.FindAllByInstanceId(inst.Id), h => h.Action == "addSign");
        Throws(4091, () => ApprovalInstance.AddSign(added.Id, extra.ID, a.ID, "再加", "add-again-" + mark, inst.Version, "127.0.0.1"));
        Throws(4091, () => ApprovalInstance.Withdraw(inst.Id, applicant.ID, "晚了", "add-wd-" + mark, inst.Version, "127.0.0.1"));

        var taskB = ApprovalTask.FindPending(inst.Id).Single(t => t.AssigneeId == b.ID);
        inst = ApprovalInstance.Agree(taskB.Id, b.ID, "同意", "add-b-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Running, inst.Status);
        Assert.Equal(extra.ID, ApprovalTask.FindPending(inst.Id).Single().AssigneeId);

        inst = ApprovalInstance.Agree(added.Id, extra.ID, "同意", "add-x-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, inst.Status);
    }

    [Fact]
    public void Monitor_uses_department_scope_without_hiding_the_assignee_inbox()
    {
        var mark = Mark();
        var role = Role.Add("mon-" + mark, false, "切片");
        role.IsSystem = false;
        role.DataScope = DataScopes.本部门;
        role.Update();
        Role.Meta.Cache?.Clear("scope", true);
        Role.Meta.SingleCache.Clear("scope");
        DataScopeContext.ClearCache(0);
        role = Role.FindByID(role.ID)!;
        Assert.False(role.IsSystem);
        Assert.Equal(DataScopes.本部门, role.DataScope);

        var deptA = MakeDept("甲部门-" + mark);
        var deptB = MakeDept("乙部门-" + mark);
        var viewer = MakeUser("mon-view-" + mark, "监控人", role.ID, deptA.ID);
        var outsider = MakeUser("mon-out-" + mark, "外部门学生", role.ID, deptB.ID);
        Assert.NotEqual(deptA.ID, deptB.ID);
        Assert.Equal(deptA.ID, viewer.DepartmentID);
        Assert.Equal(deptB.ID, outsider.DepartmentID);

        var process = Publish(mark, "监控请假", UsersGraph("any", viewer.ID));
        var foreign = Start(process, outsider, "mon-out-" + mark, null);
        var local = Start(process, viewer, "mon-in-" + mark, null);
        Assert.Equal(deptB.ID, foreign.DepartmentId);
        Assert.Equal(deptA.ID, local.DepartmentId);
        Assert.NotNull(ApprovalInstance.FindById(foreign.Id));

        Assert.Contains(ApprovalTask.Inbox(viewer.ID), t => t.InstanceId == foreign.Id);
        Assert.Contains(ApprovalTask.Inbox(viewer.ID), t => t.InstanceId == local.Id);
        var visible = ApprovalInstance.Monitor(viewer).Select(e => e.Id).ToHashSet();
        Assert.Contains(local.Id, visible);
        Assert.DoesNotContain(foreign.Id, visible);
    }

    private static ApprovalInstance Start(ApprovalProcess process, User applicant, String requestId, Int32? days)
    {
        var data = "{\"studentUserId\":" + applicant.ID + ",\"reason\":\"回家\"";
        if (days != null) data += ",\"days\":" + days.Value;
        data += "}";
        return ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Data = data,
            RequestId = requestId,
        });
    }

    private static String ExclusiveGraph(Int32 longUser, Int32 shortUser) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"x\",\"type\":\"exclusive\",\"name\":\"天数\"}," +
        "{\"key\":\"long\",\"type\":\"approve\",\"name\":\"长假\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + longUser + "]}}," +
        "{\"key\":\"short\",\"type\":\"approve\",\"name\":\"短假\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + shortUser + "]}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[" +
        "{\"key\":\"e1\",\"from\":\"s\",\"to\":\"x\"}," +
        "{\"key\":\"e2\",\"from\":\"x\",\"to\":\"long\",\"priority\":1,\"condition\":{\"field\":\"days\",\"op\":\"ge\",\"value\":3}}," +
        "{\"key\":\"e3\",\"from\":\"x\",\"to\":\"short\",\"default\":true,\"priority\":9}," +
        "{\"key\":\"e4\",\"from\":\"long\",\"to\":\"e\"}," +
        "{\"key\":\"e5\",\"from\":\"short\",\"to\":\"e\"}]}";

    private static String ParallelGraph(Int32 a, Int32 b) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"split\",\"type\":\"parallel\",\"name\":\"分支\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"甲\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + a + "]}}," +
        "{\"key\":\"b\",\"type\":\"approve\",\"name\":\"乙\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + b + "]}}," +
        "{\"key\":\"join\",\"type\":\"parallel\",\"name\":\"汇聚\"}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[" +
        "{\"key\":\"e1\",\"from\":\"s\",\"to\":\"split\"}," +
        "{\"key\":\"e2\",\"from\":\"split\",\"to\":\"a\",\"sort\":1}," +
        "{\"key\":\"e3\",\"from\":\"split\",\"to\":\"b\",\"sort\":2}," +
        "{\"key\":\"e4\",\"from\":\"a\",\"to\":\"join\"}," +
        "{\"key\":\"e5\",\"from\":\"b\",\"to\":\"join\"}," +
        "{\"key\":\"e6\",\"from\":\"join\",\"to\":\"e\"}]}";

    private static String CcGraph(Int32 copied, Int32 approver) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"c\",\"type\":\"cc\",\"name\":\"抄送\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + copied + "]}}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"审批\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + approver + "]}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[" +
        "{\"key\":\"e1\",\"from\":\"s\",\"to\":\"c\"}," +
        "{\"key\":\"e2\",\"from\":\"c\",\"to\":\"a\"}," +
        "{\"key\":\"e3\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static String UsersGraph(String mode, params Int32[] users) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"审批\",\"mode\":\"" + mode + "\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + String.Join(",", users) + "]}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static ApprovalProcess Publish(String mark, String name, String definition)
    {
        var form = new ApprovalFormDefinition { Code = mark + "-form", Name = name + "表单", Enable = true };
        form.Insert();
        form.SaveDraft(Schema);
        form.Publish(0);
        var process = new ApprovalProcess { Code = mark, Name = name, FormId = form.Id, Enable = true };
        process.Insert();
        process.SaveDraft(definition);
        process.Publish(0);
        return process;
    }

    private static User UserOf(String name, String display)
    {
        var role = Role.Add("切片填充", false, "切片");
        var user = User.Add(name, "pass1234", role.ID, display);
        user.Enable = true;
        user.Update();
        return user;
    }

    private static User MakeUser(String name, String display, Int32 roleId, Int32 departmentId)
    {
        var user = User.Add(name, "pass1234", roleId, display);
        user.DepartmentID = departmentId;
        user.Enable = true;
        user.Update();
        return User.FindByID(user.ID)!;
    }

    private static Department MakeDept(String name)
    {
        var dept = new Department
        {
            Name = name,
            Code = name,
            Enable = true,
            Visible = true,
        };
        dept.Insert();
        return Department.FindByID(dept.ID)!;
    }

    private static String Mark() => Guid.NewGuid().ToString("N")[..8];

    private static void Throws(Int32 code, Action action)
    {
        var ex = Assert.Throws<ApprovalException>(action);
        Assert.Equal(code, ex.Code);
    }
}
