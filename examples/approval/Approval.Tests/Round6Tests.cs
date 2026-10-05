using Approval.Data;
using Approval.Data.Entities;
using Xunit;
using XCode.Membership;

namespace Approval.Tests;

/// <summary>第 6 轮：发起人自选、表单内联系人、角色与部门交集、事由检索。</summary>
[Collection("approval")]
public class Round6Tests
{
    private const String Schema = """{"fields":[{"key":"studentUserId"},{"key":"counselorUserId"},{"key":"reviewerUserId"},{"key":"reason","search":true},{"key":"days"}]}""";

    public Round6Tests(ApprovalWorld world) => _ = world;

    [Fact]
    public void Starter_pick_assigns_only_the_user_the_proxy_chose()
    {
        var mark = Mark();
        var proxy = UserOf("r6-proxy-" + mark, "辅导员丙");
        var student = UserOf("r6-stu-" + mark, "学生乙");
        var picked = UserOf("r6-pick-" + mark, "自选人");
        var process = Publish(mark, "发起人自选", PickGraph());

        var missing = "r6-miss-" + mark;
        Throws(4223, () => Start(process, proxy, student, missing, null));
        Assert.Empty(ApprovalHistory.FindAllByRequestId(missing));

        var inst = Start(process, proxy, student, "r6-pick-" + mark, "{\"a\":" + picked.ID + "}");
        var task = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(picked.ID, task.AssigneeId);
        Assert.NotEqual(proxy.ID, task.AssigneeId);
        Assert.NotEqual(student.ID, task.AssigneeId);
        Assert.Equal(student.ID, inst.SubjectUserId);
        Assert.Equal(proxy.ID, inst.UserId);
    }

    [Fact]
    public void Form_contact_is_not_the_counselor_and_counselor_still_comes_from_the_subject()
    {
        var mark = Mark();
        var proxy = UserOf("r6-px-" + mark, "辅导员丙");
        var student = UserOf("r6-st-" + mark, "学生乙");
        var reviewer = UserOf("r6-rv-" + mark, "联系人");
        var counselor = UserOf("r6-co-" + mark, "该生辅导员");
        var process = Publish(mark + "-fc", "表单联系人", ContactThenCounselorGraph());

        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = proxy.ID,
            Proxy = true,
            SubjectUserId = student.ID,
            Data = "{\"studentUserId\":" + student.ID + ",\"counselorUserId\":" + counselor.ID + ",\"reviewerUserId\":" + reviewer.ID + ",\"reason\":\"回家\"}",
            RequestId = "r6-fc-" + mark,
            ClientIp = "127.0.0.1",
        });

        var first = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(reviewer.ID, first.AssigneeId);
        Assert.NotEqual(counselor.ID, first.AssigneeId);
        Assert.NotEqual(proxy.ID, first.AssigneeId);

        inst = ApprovalInstance.Agree(first.Id, reviewer.ID, "同意", "r6-fc-ok-" + mark, inst.Version, "127.0.0.1");
        var second = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(counselor.ID, second.AssigneeId);
        Assert.NotEqual(proxy.ID, second.AssigneeId);
        Assert.Equal(counselor.ID, inst.CounselorUserId);
    }

    [Fact]
    public void Role_and_department_assignee_is_their_intersection()
    {
        var mark = Mark();
        var role = Role.Add("r6-role-" + mark, false, "切片");
        var otherRole = Role.Add("r6-other-" + mark, false, "切片");
        var dept = MakeDept("交集-" + mark);
        var other = MakeDept("外院-" + mark);
        var both = MakeUser("r6-both-" + mark, "交集人", role.ID, dept.ID);
        var roleOnly = MakeUser("r6-role-" + mark, "仅角色", role.ID, other.ID);
        var deptOnly = MakeUser("r6-dept-" + mark, "仅部门", otherRole.ID, dept.ID);
        var stopped = MakeUser("r6-off-" + mark, "停用", role.ID, dept.ID);
        stopped.Enable = false;
        stopped.Update();
        var applicant = UserOf("r6-app-" + mark, "学生乙");
        var process = Publish(mark + "-rd", "角色部门", RoleDeptGraph(role.ID, dept.ID));

        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Data = "{\"studentUserId\":" + applicant.ID + ",\"reason\":\"回家\"}",
            RequestId = "r6-rd-" + mark,
            ClientIp = "127.0.0.1",
        });
        var ids = ApprovalTask.FindPending(inst.Id).Select(t => t.AssigneeId).ToHashSet();
        Assert.Contains(both.ID, ids);
        Assert.DoesNotContain(roleOnly.ID, ids);
        Assert.DoesNotContain(deptOnly.ID, ids);
        Assert.DoesNotContain(stopped.ID, ids);
        Assert.DoesNotContain(applicant.ID, ids);
    }

    [Fact]
    public void Incomplete_contact_and_role_department_rules_cannot_publish()
    {
        var mark = Mark();
        var process = Create(mark + "-bad", "缺规则");
        Throws(4222, () => process.SaveDraft(ContactThenCounselorGraph().Replace("\"field\":\"reviewerUserId\"", "\"field\":\"\"")));
        Throws(4222, () => process.SaveDraft(RoleDeptGraph(1, 0)));
        Throws(4222, () => process.SaveDraft(RoleDeptGraph(0, 1)));
    }

    [Fact]
    public void Reason_can_be_found_by_a_contained_keyword()
    {
        var mark = Mark();
        var approver = UserOf("r6-apr-" + mark, "审批人");
        var student = UserOf("r6-who-" + mark, "学生乙");
        var process = Publish(mark + "-se", "检索", UsersGraph(approver.ID));

        var home = StartReason(process, student, "r6-home-" + mark, "回家一天");
        var change = StartReason(process, student, "r6-chg-" + mark, "改期");

        var changed = ApprovalFieldValue.FindMatches("reason", "改期");
        Assert.Contains(change.Id, changed.Select(e => e.InstanceId));
        Assert.DoesNotContain(home.Id, changed.Select(e => e.InstanceId));
        Assert.Equal("改期", changed.Single(e => e.InstanceId == change.Id).FieldValue);

        var homes = ApprovalFieldValue.FindMatches("reason", "回家").Select(e => e.InstanceId).ToHashSet();
        Assert.Contains(home.Id, homes);
        Assert.DoesNotContain(change.Id, homes);
        Throws(4001, () => ApprovalFieldValue.FindMatches("reason", ""));
    }

    [Fact]
    public void Leave_host_passes_starter_picks_through_to_the_instance()
    {
        var mark = Mark();
        var student = UserOf("r6-lv-" + mark, "学生乙");
        var picked = UserOf("r6-lp-" + mark, "自选人");
        var process = Publish(mark + "-lv", "请假自选", PickGraph());

        var row = LeaveHost.Submit(new LeaveSubmit
        {
            ProcessId = process.Id,
            OperatorUserId = student.ID,
            Reason = "回家一天",
            RequestId = "r6-leave-" + mark,
            ClientIp = "127.0.0.1",
            AssigneePicks = "{\"a\":" + picked.ID + "}",
        });

        Assert.Equal(student.ID, row.StudentId);
        Assert.Equal((Int32)InstanceStatus.Running, row.Status);
        var task = ApprovalTask.FindPending(row.ApprovalInstanceId).Single();
        Assert.Equal(picked.ID, task.AssigneeId);
        var hit = ApprovalFieldValue.FindMatches("reason", "回家一天").Select(e => e.InstanceId);
        Assert.Contains(row.ApprovalInstanceId, hit);
    }

    private static ApprovalInstance Start(ApprovalProcess process, User proxy, User student, String requestId, String? picks)
    {
        return ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = proxy.ID,
            Proxy = true,
            SubjectUserId = student.ID,
            Data = "{\"studentUserId\":" + student.ID + ",\"reason\":\"回家\"}",
            RequestId = requestId,
            ClientIp = "127.0.0.1",
            AssigneePicks = picks,
        });
    }

    private static ApprovalInstance StartReason(ApprovalProcess process, User student, String requestId, String reason)
    {
        return ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = student.ID,
            Data = "{\"studentUserId\":" + student.ID + ",\"reason\":" + System.Text.Json.JsonSerializer.Serialize(reason) + "}",
            RequestId = requestId,
            ClientIp = "127.0.0.1",
        });
    }

    private static String PickGraph() =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"自选\",\"mode\":\"any\",\"assignee\":{\"type\":\"starterPick\"}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static String ContactThenCounselorGraph() =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"c\",\"type\":\"approve\",\"name\":\"联系人\",\"mode\":\"any\",\"assignee\":{\"type\":\"formContact\",\"field\":\"reviewerUserId\"}}," +
        "{\"key\":\"k\",\"type\":\"approve\",\"name\":\"辅导员\",\"mode\":\"any\",\"assignee\":{\"type\":\"subjectCounselor\"}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"c\"},{\"key\":\"e2\",\"from\":\"c\",\"to\":\"k\"},{\"key\":\"e3\",\"from\":\"k\",\"to\":\"e\"}]}";

    private static String RoleDeptGraph(Int32 roleId, Int32 departmentId) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"交集\",\"mode\":\"any\",\"assignee\":{\"type\":\"roleDept\",\"roleIds\":[" + roleId + "],\"departmentId\":" + departmentId + "}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static String UsersGraph(Int32 approver) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"审批\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + approver + "]}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static ApprovalProcess Publish(String mark, String name, String definition)
    {
        var process = Create(mark, name);
        process.SaveDraft(definition);
        process.Publish(0);
        return process;
    }

    private static ApprovalProcess Create(String mark, String name)
    {
        var form = new ApprovalFormDefinition { Code = mark + "-form", Name = name + "表单", Enable = true };
        form.Insert();
        form.SaveDraft(Schema);
        form.Publish(0);
        var process = new ApprovalProcess { Code = mark, Name = name, FormId = form.Id, Enable = true };
        process.Insert();
        return process;
    }

    private static User UserOf(String name, String display)
    {
        var role = Role.Add("r6-" + name, false, "切片");
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
