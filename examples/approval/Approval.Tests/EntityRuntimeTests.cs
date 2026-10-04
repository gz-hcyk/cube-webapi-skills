using Xunit;
using Approval.Data;
using Approval.Data.Entities;
using XCode.Membership;

namespace Approval.Tests;

/// <summary>直接调用实体业务方法。不经过 HTTP。</summary>
[Collection("approval")]
public class EntityRuntimeTests
{
    private const String Schema = """{"fields":[{"key":"studentUserId"},{"key":"counselorUserId"},{"key":"reason"}]}""";

    public EntityRuntimeTests(ApprovalWorld world) => _ = world;

    [Fact]
    public void Publish_is_immutable_and_keeps_and_sign()
    {
        var mark = Mark();
        var process = Publish(mark, "不变流程", AndSignGraph());
        var form = ApprovalFormDefinition.FindByCode(process.Code + "-form")!;
        var formVersion = ApprovalFormVersion.FindById(form.PublishedVersionId)!;
        Assert.Equal(VersionStatus.Published, formVersion.Status);
        Assert.NotEqual(0, formVersion.Version);

        formVersion.Schema = Schema.Replace("reason", "days");
        Throws(4091, () => formVersion.Update());

        var nodes = ApprovalNode.FindAllByProcessVersionId(process.PublishedVersionId);
        Assert.Equal(ApproveMode.All, nodes.First(e => e.NodeKey == "all").ApproveMode);
        Assert.Equal(ApproveMode.Sequential, nodes.First(e => e.NodeKey == "seq").ApproveMode);
        var node = nodes.First(e => e.NodeKey == "all");
        node.Name = "改名";
        Throws(4091, () => node.Update());

        var before = ApprovalInstance.FindCount();
        Throws(4222, () => ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = AnyUser().ID,
            Data = "{}",
            RequestId = "and-" + mark,
        }));
        Assert.Equal(before, ApprovalInstance.FindCount());
    }

    [Fact]
    public void Self_start_reject_and_proxy_chain_resolve_counselor_from_subject()
    {
        var mark = Mark();
        var filler = Role.Add("切片填充-" + mark, false, "切片");
        var role = Role.Add("请假审批-" + mark, false, "切片");
        var studentManager = MakeUser("stu-mgr-" + mark, "学生部门负责人", filler.ID, 0);
        var proxyManager = MakeUser("proxy-mgr-" + mark, "代发部门负责人", filler.ID, 0);
        var studentDept = MakeDept("学生部门-" + mark, studentManager.ID);
        var proxyDept = MakeDept("代发部门-" + mark, proxyManager.ID);
        studentManager.DepartmentID = studentDept.ID;
        studentManager.Update();
        proxyManager.DepartmentID = proxyDept.ID;
        proxyManager.Update();

        var approver1 = MakeUser("ap1-" + mark, "指定成员甲", filler.ID, proxyDept.ID);
        var approver2 = MakeUser("ap2-" + mark, "指定成员乙", filler.ID, proxyDept.ID);
        var roleUser = MakeUser("role-" + mark, "角色办理人", role.ID, proxyDept.ID);
        var counselor = MakeUser("counselor-" + mark, "该生辅导员", filler.ID, studentDept.ID);
        var student = MakeUser("student-" + mark, "学生乙", filler.ID, studentDept.ID);
        var proxy = MakeUser("proxy-" + mark, "辅导员丙", filler.ID, proxyDept.ID);

        var process = Publish(mark, "请假", Chain(approver1.ID, approver2.ID, role.ID));

        Throws(4221, () => ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = student.ID,
            Proxy = false,
            Data = Form(proxy.ID, counselor.ID),
            RequestId = "bad-self-" + mark,
        }));
        Throws(4001, () => ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = proxy.ID,
            Proxy = true,
            RequestId = "bad-proxy-" + mark,
        }));

        var self = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = student.ID,
            Proxy = false,
            Data = Form(student.ID, counselor.ID),
            RequestId = "self-" + mark,
            ClientIp = "127.0.0.1",
        });
        Assert.Equal(student.ID, self.SubjectUserId);
        Assert.Equal(0, self.ProxyUserId);
        Assert.Equal(student.ID, self.UserId);
        Assert.Equal("学生乙的请假", self.Title);
        Assert.Equal(counselor.ID, self.CounselorUserId);
        var selfForm = ApprovalFormData.FindById(self.Id);
        Assert.NotNull(selfForm);
        Assert.Equal(self.Id, selfForm.Id);
        Assert.Contains(student.ID.ToString(), selfForm.Data);

        var again = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = student.ID,
            Data = Form(student.ID, counselor.ID),
            RequestId = "self-" + mark,
        });
        Assert.Equal(self.Id, again.Id);

        var selfTasks = ApprovalTask.FindPending(self.Id);
        Assert.Equal(2, selfTasks.Count);
        Assert.All(selfTasks, t => Assert.Equal(self.Title, t.Title));
        var rejectTask = selfTasks.First(t => t.AssigneeId == approver1.ID);
        var other = selfTasks.First(t => t.AssigneeId == approver2.ID);
        Throws(4001, () => ApprovalInstance.Reject(rejectTask.Id, approver1.ID, "", "self-rej-empty-" + mark, self.Version, "127.0.0.1"));
        var rejected = ApprovalInstance.Reject(rejectTask.Id, approver1.ID, "材料不全", "self-rej-" + mark, self.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Rejected, rejected.Status);
        Assert.Equal(student.ID, rejected.UserId);
        var rejectHistory = ApprovalHistory.FindAllByInstanceId(rejected.Id).First(e => e.Action == "reject");
        Assert.Contains("已退回发起人：学生乙", rejectHistory.Comment);
        var canceled = ApprovalTask.FindById(other.Id)!;
        Assert.Equal(Approval.Data.Entities.TaskStatus.Canceled, canceled.Status);
        rejectHistory.Comment = "篡改";
        Throws(4091, () => rejectHistory.Update());
        Throws(4091, () => rejectHistory.Delete());

        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = proxy.ID,
            Proxy = true,
            SubjectUserId = student.ID,
            Data = Form(student.ID, counselor.ID),
            RequestId = "proxy-" + mark,
            ClientIp = "127.0.0.1",
        });
        Assert.Equal(student.ID, inst.SubjectUserId);
        Assert.Equal(proxy.ID, inst.ProxyUserId);
        Assert.Equal(proxy.ID, inst.UserId);
        Assert.Equal(proxy.DepartmentID, inst.DepartmentId);
        Assert.Equal("辅导员丙代学生乙发起的请假", inst.Title);
        Assert.Equal(counselor.ID, inst.CounselorUserId);
        Assert.NotEqual(proxy.ID, inst.CounselorUserId);
        var proxyForm = ApprovalFormData.FindById(inst.Id);
        Assert.NotNull(proxyForm);
        Assert.Equal(inst.Id, proxyForm.Id);

        var submit = ApprovalHistory.FindAllByInstanceId(inst.Id).Single();
        Assert.Equal("代发起", submit.ActionName);
        Assert.Contains("代发起人：辅导员丙", submit.Comment);
        Assert.Contains("业务主体：学生乙", submit.Comment);

        var first = ApprovalTask.FindPending(inst.Id);
        Assert.Equal(new[] { approver1.ID, approver2.ID }.OrderBy(e => e), first.Select(e => e.AssigneeId).OrderBy(e => e));
        Assert.All(first, t => Assert.Equal(inst.Title, t.Title));
        var mine = first.First(t => t.AssigneeId == approver1.ID);
        var sibling = first.First(t => t.AssigneeId == approver2.ID);
        inst = ApprovalInstance.Agree(mine.Id, approver1.ID, "同意", "ag-user-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(Approval.Data.Entities.TaskStatus.Canceled, ApprovalTask.FindById(sibling.Id)!.Status);
        Throws(4092, () => ApprovalInstance.Agree(sibling.Id, approver2.ID, "晚了", "ag-late-" + mark, inst.Version, "127.0.0.1"));

        Assert.Equal(new[] { roleUser.ID }, PendingIds(inst.Id));
        inst = Agree(inst, roleUser.ID, "ag-role-" + mark);

        var deptIds = PendingIds(inst.Id);
        Assert.Equal(new[] { proxyManager.ID }, deptIds);
        Assert.DoesNotContain(studentManager.ID, deptIds);
        Assert.DoesNotContain(proxy.ID, deptIds);
        inst = Agree(inst, proxyManager.ID, "ag-dept-" + mark);

        var counselorIds = PendingIds(inst.Id);
        Assert.Equal(new[] { counselor.ID }, counselorIds);
        Assert.DoesNotContain(proxy.ID, counselorIds);
        Assert.DoesNotContain(proxyManager.ID, counselorIds);
        inst = Agree(inst, counselor.ID, "ag-counselor-" + mark);
        Assert.Equal(InstanceStatus.Approved, inst.Status);
    }

    [Fact]
    public void Empty_assignee_rolls_back()
    {
        var mark = Mark();
        var user = AnyUser();
        var process = Publish(mark, "空办理人", """
        {"nodes":[{"key":"s","type":"start","name":"开始"},{"key":"a","type":"approve","name":"无人","mode":"any","assignee":{"type":"user","userIds":[99999999]}},{"key":"e","type":"end","name":"结束"}],"edges":[{"key":"e1","from":"s","to":"a"},{"key":"e2","from":"a","to":"e"}]}
        """);
        var before = ApprovalInstance.FindCount();
        var forms = ApprovalFormData.FindCount();
        Throws(4223, () => ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = user.ID,
            Data = "{}",
            RequestId = "empty-" + mark,
        }));
        Assert.Equal(before, ApprovalInstance.FindCount());
        Assert.Equal(forms, ApprovalFormData.FindCount());
    }

    private static ApprovalInstance Agree(ApprovalInstance inst, Int32 userId, String requestId)
    {
        var task = ApprovalTask.FindPending(inst.Id).First(t => t.AssigneeId == userId);
        return ApprovalInstance.Agree(task.Id, userId, "同意", requestId, inst.Version, "127.0.0.1");
    }

    private static Int32[] PendingIds(Int64 instanceId) =>
        ApprovalTask.FindPending(instanceId).Select(t => t.AssigneeId).OrderBy(e => e).ToArray();

    private static ApprovalProcess Publish(String mark, String name, String definition)
    {
        var form = new ApprovalFormDefinition
        {
            Code = mark + "-form",
            Name = name + "表单",
            Enable = true,
        };
        form.Insert();
        form.SaveDraft(Schema);
        form.Publish(0);

        var process = new ApprovalProcess
        {
            Code = mark,
            Name = name,
            FormId = form.Id,
            Enable = true,
        };
        process.Insert();
        process.SaveDraft(definition);
        var published = process.Publish(0);
        Assert.Equal(VersionStatus.Published, published.Status);
        Assert.True(published.Version >= 1);
        return ApprovalProcess.FindById(process.Id)!;
    }

    private static String Chain(Int32 user1, Int32 user2, Int32 roleId) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"user\",\"type\":\"approve\",\"name\":\"指定成员\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + user1 + "," + user2 + "]}}," +
        "{\"key\":\"role\",\"type\":\"approve\",\"name\":\"指定角色\",\"mode\":\"any\",\"assignee\":{\"type\":\"role\",\"roleIds\":[" + roleId + "]}}," +
        "{\"key\":\"dept\",\"type\":\"approve\",\"name\":\"部门负责人\",\"mode\":\"any\",\"assignee\":{\"type\":\"deptManager\",\"level\":1}}," +
        "{\"key\":\"counselor\",\"type\":\"approve\",\"name\":\"该生辅导员\",\"mode\":\"any\",\"assignee\":{\"type\":\"subjectCounselor\",\"field\":\"counselorUserId\"}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[" +
        "{\"key\":\"e1\",\"from\":\"s\",\"to\":\"user\"}," +
        "{\"key\":\"e2\",\"from\":\"user\",\"to\":\"role\"}," +
        "{\"key\":\"e3\",\"from\":\"role\",\"to\":\"dept\"}," +
        "{\"key\":\"e4\",\"from\":\"dept\",\"to\":\"counselor\"}," +
        "{\"key\":\"e5\",\"from\":\"counselor\",\"to\":\"e\"}]}";

    private static String AndSignGraph() => """
    {"nodes":[{"key":"s","type":"start","name":"开始"},{"key":"all","type":"approve","name":"会签","mode":"all","assignee":{"type":"user","userIds":[1]}},{"key":"seq","type":"approve","name":"依次","mode":"sequential","assignee":{"type":"user","userIds":[1]}},{"key":"e","type":"end","name":"结束"}],"edges":[{"key":"e1","from":"s","to":"all"},{"key":"e2","from":"all","to":"seq"},{"key":"e3","from":"seq","to":"e"}]}
    """;

    private static String Form(Int32 studentId, Int32 counselorId) =>
        "{\"studentUserId\":" + studentId + ",\"counselorUserId\":" + counselorId + ",\"reason\":\"回家\"}";

    private static User MakeUser(String name, String display, Int32 roleId, Int32 departmentId)
    {
        var user = User.Add(name, "pass1234", roleId, display);
        user.DepartmentID = departmentId;
        user.Enable = true;
        user.Update();
        return User.FindByID(user.ID)!;
    }

    private static Department MakeDept(String name, Int32 managerId)
    {
        var dept = new Department
        {
            Name = name,
            Code = name,
            Enable = true,
            Visible = true,
            ManagerId = managerId,
        };
        dept.Insert();
        if (dept.ManagerId != managerId)
        {
            dept.ManagerId = managerId;
            dept.Update();
        }

        return Department.FindByID(dept.ID)!;
    }

    private static User AnyUser()
    {
        var role = Role.Add("切片普通角色", false, "切片");
        return MakeUser("any-" + Mark(), "任意用户", role.ID, 0);
    }

    private static String Mark() => Guid.NewGuid().ToString("N")[..8];

    private static void Throws(Int32 code, Action action)
    {
        var ex = Assert.Throws<ApprovalException>(action);
        Assert.Equal(code, ex.Code);
    }
}
