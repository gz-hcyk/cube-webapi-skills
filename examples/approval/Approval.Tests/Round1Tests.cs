using Approval.Data;
using Approval.Data.Entities;
using Xunit;
using XCode.Membership;
using TaskStatus = Approval.Data.Entities.TaskStatus;

namespace Approval.Tests;

/// <summary>第 1 轮：待办已办、转办、撤回、会签、依次审批。</summary>
[Collection("approval")]
public class Round1Tests
{
    private const String Schema = """{"fields":[{"key":"studentUserId"},{"key":"counselorUserId"},{"key":"reason"}]}""";

    public Round1Tests(ApprovalWorld world) => _ = world;

    [Fact]
    public void And_sign_needs_everyone_and_one_reject_returns_to_applicant()
    {
        var mark = Mark();
        var a = UserOf("and-a-" + mark, "会签甲");
        var b = UserOf("and-b-" + mark, "会签乙");
        var applicant = UserOf("and-app-" + mark, "学生乙");
        var process = Publish(mark, "会签请假", UsersGraph("all", a.ID, b.ID));

        var inst = Start(process, applicant, "and-" + mark);
        var pending = ApprovalTask.FindPending(inst.Id);
        Assert.Equal(2, pending.Count);
        Assert.Equal(new[] { a.ID, b.ID }.OrderBy(e => e).ToArray(), Ids(ApprovalTask.Inbox(a.ID).Concat(ApprovalTask.Inbox(b.ID)).Where(t => t.InstanceId == inst.Id)));
        Assert.Empty(ApprovalTask.Done(a.ID).Where(t => t.InstanceId == inst.Id));

        inst = ApprovalInstance.Agree(pending.First(t => t.AssigneeId == a.ID).Id, a.ID, "同意", "and-ag-a-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Running, inst.Status);
        Assert.Equal(new[] { b.ID }, Ids(ApprovalTask.FindPending(inst.Id)));
        Assert.Contains(ApprovalTask.Done(a.ID), t => t.InstanceId == inst.Id && t.Status == TaskStatus.Agreed);
        Assert.Empty(ApprovalTask.Inbox(a.ID).Where(t => t.InstanceId == inst.Id));

        var rejected = Start(process, applicant, "and-rej-" + mark);
        var rejectTask = ApprovalTask.FindPending(rejected.Id).First(t => t.AssigneeId == b.ID);
        rejected = ApprovalInstance.Reject(rejectTask.Id, b.ID, "不同意", "and-no-" + mark, rejected.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Rejected, rejected.Status);
        Assert.Equal(applicant.ID, rejected.UserId);
        Assert.Contains(ApprovalHistory.FindAllByInstanceId(rejected.Id), h => h.Action == "reject" && h.Comment!.Contains("已退回发起人：学生乙"));
        Assert.All(ApprovalTask.FindAll(ApprovalTask._.InstanceId == rejected.Id), t =>
            Assert.NotEqual(TaskStatus.Pending, t.Status));
        Assert.Contains(ApprovalTask.Done(b.ID), t => t.InstanceId == rejected.Id && t.Status == TaskStatus.Rejected);

        inst = ApprovalInstance.Agree(ApprovalTask.FindPending(inst.Id).Single().Id, b.ID, "同意", "and-ag-b-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, inst.Status);
    }

    [Fact]
    public void Sequential_runs_in_order()
    {
        var mark = Mark();
        var a = UserOf("seq-a-" + mark, "依次甲");
        var b = UserOf("seq-b-" + mark, "依次乙");
        var c = UserOf("seq-c-" + mark, "依次丙");
        var applicant = UserOf("seq-app-" + mark, "学生乙");
        var process = Publish(mark, "依次请假", UsersGraph("sequential", a.ID, b.ID, c.ID));
        var inst = Start(process, applicant, "seq-" + mark);

        var first = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(a.ID, first.AssigneeId);
        Assert.Equal(1, first.Seq);
        Assert.Empty(ApprovalTask.Inbox(b.ID).Where(t => t.InstanceId == inst.Id));
        Assert.Empty(ApprovalTask.Inbox(c.ID).Where(t => t.InstanceId == inst.Id));

        inst = ApprovalInstance.Agree(first.Id, a.ID, "同意", "seq-a-" + mark, inst.Version, "127.0.0.1");
        var second = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(b.ID, second.AssigneeId);
        Assert.Equal(2, second.Seq);
        Assert.Equal(InstanceStatus.Running, inst.Status);

        inst = ApprovalInstance.Agree(second.Id, b.ID, "同意", "seq-b-" + mark, inst.Version, "127.0.0.1");
        var third = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(c.ID, third.AssigneeId);
        Assert.Equal(3, third.Seq);

        inst = ApprovalInstance.Agree(third.Id, c.ID, "同意", "seq-c-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, inst.Status);
        Assert.Contains(ApprovalTask.Done(c.ID), t => t.InstanceId == inst.Id);
    }

    [Fact]
    public void Transfer_moves_the_task_and_withdraw_is_applicant_only_before_anyone_acts()
    {
        var mark = Mark();
        var approver = UserOf("tr-ap-" + mark, "审批人");
        var target = UserOf("tr-to-" + mark, "接任人");
        var applicant = UserOf("tr-proxy-" + mark, "辅导员丙");
        var student = UserOf("tr-stu-" + mark, "学生乙");
        var process = Publish(mark, "转办请假", UsersGraph("any", approver.ID));

        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Proxy = true,
            SubjectUserId = student.ID,
            Data = "{\"studentUserId\":" + student.ID + ",\"counselorUserId\":" + approver.ID + ",\"reason\":\"回家\"}",
            RequestId = "tr-start-" + mark,
        });
        var task = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Contains(ApprovalTask.Inbox(approver.ID), t => t.Id == task.Id);

        Throws(4031, () => ApprovalInstance.Withdraw(inst.Id, student.ID, "学生想撤", "tr-stu-wd-" + mark, inst.Version, "127.0.0.1"));
        inst = ApprovalInstance.Withdraw(inst.Id, applicant.ID, "代发人撤回", "tr-wd-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Draft, inst.Status);
        Assert.Equal(TaskStatus.Canceled, ApprovalTask.FindById(task.Id)!.Status);
        Assert.Empty(ApprovalTask.Inbox(approver.ID).Where(t => t.InstanceId == inst.Id));
        Assert.Contains(ApprovalHistory.FindAllByInstanceId(inst.Id), h => h.Action == "withdraw" && h.OperatorId == applicant.ID);

        inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Proxy = true,
            SubjectUserId = student.ID,
            Data = "{\"studentUserId\":" + student.ID + ",\"counselorUserId\":" + approver.ID + ",\"reason\":\"回家\"}",
            RequestId = "tr-start2-" + mark,
        });
        task = ApprovalTask.FindPending(inst.Id).Single();
        inst = ApprovalInstance.Transfer(task.Id, approver.ID, target.ID, "请你看", "tr-move-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(TaskStatus.Transferred, ApprovalTask.FindById(task.Id)!.Status);
        Assert.Contains(ApprovalTask.Done(approver.ID), t => t.Id == task.Id && t.Status == TaskStatus.Transferred);
        var moved = ApprovalTask.Inbox(target.ID).Single(t => t.InstanceId == inst.Id);
        Assert.Equal(TaskSource.Transfer, moved.Source);
        Assert.Equal(TaskStatus.Pending, moved.Status);
        Assert.Empty(ApprovalTask.Inbox(approver.ID).Where(t => t.InstanceId == inst.Id));
        Throws(4091, () => ApprovalInstance.Withdraw(inst.Id, applicant.ID, "晚了", "tr-late-" + mark, inst.Version, "127.0.0.1"));

        inst = ApprovalInstance.Agree(moved.Id, target.ID, "同意", "tr-ag-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, inst.Status);
    }

    private static ApprovalInstance Start(ApprovalProcess process, User applicant, String requestId) =>
        ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Data = "{\"studentUserId\":" + applicant.ID + ",\"reason\":\"回家\"}",
            RequestId = requestId,
        });

    private static Int32[] Ids(IEnumerable<ApprovalTask> tasks) =>
        tasks.Select(t => t.AssigneeId).OrderBy(e => e).ToArray();

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

    private static String Mark() => Guid.NewGuid().ToString("N")[..8];

    private static void Throws(Int32 code, Action action)
    {
        var ex = Assert.Throws<ApprovalException>(action);
        Assert.Equal(code, ex.Code);
    }
}
