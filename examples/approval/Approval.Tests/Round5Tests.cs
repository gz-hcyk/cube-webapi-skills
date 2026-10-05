using Approval.Data;
using Approval.Data.Entities;
using Xunit;
using XCode.Membership;

namespace Approval.Tests;

/// <summary>第 5 轮：相对申请人、指定部门成员、并行分支内的排他网关、请假宿主。</summary>
[Collection("approval")]
public class Round5Tests
{
    private const String Schema = """{"fields":[{"key":"studentUserId"},{"key":"counselorUserId"},{"key":"reason"},{"key":"days"}]}""";

    public Round5Tests(ApprovalWorld world) => _ = world;

    [Fact]
    public void Applicant_assignee_is_the_starter_even_when_someone_else_is_the_student()
    {
        var mark = Mark();
        var proxy = UserOf("r5-proxy-" + mark, "辅导员丙");
        var student = UserOf("r5-stu-" + mark, "学生乙");
        var process = Publish(mark, "相对申请人", ApplicantGraph());

        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = proxy.ID,
            Proxy = true,
            SubjectUserId = student.ID,
            Data = "{\"studentUserId\":" + student.ID + ",\"reason\":\"回家\"}",
            RequestId = "r5-app-" + mark,
            ClientIp = "127.0.0.1",
        });

        var task = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(proxy.ID, task.AssigneeId);
        Assert.NotEqual(student.ID, task.AssigneeId);
    }

    [Fact]
    public void Dept_members_are_enabled_users_of_the_named_department()
    {
        var mark = Mark();
        var role = Role.Add("r5-role-" + mark, false, "切片");
        var dept = MakeDept("学院-" + mark);
        var other = MakeDept("外院-" + mark);
        var member = MakeUser("r5-m1-" + mark, "成员甲", role.ID, dept.ID);
        var peer = MakeUser("r5-m2-" + mark, "成员乙", role.ID, dept.ID);
        var stopped = MakeUser("r5-off-" + mark, "停用", role.ID, dept.ID);
        stopped.Enable = false;
        stopped.Update();
        var outsider = MakeUser("r5-out-" + mark, "外院", role.ID, other.ID);
        var applicant = MakeUser("r5-app-" + mark, "学生乙", role.ID, dept.ID);
        var process = Publish(mark, "指定部门", DeptGraph(dept.ID));

        var inst = Start(process, applicant, "r5-dept-" + mark, null);
        var ids = ApprovalTask.FindPending(inst.Id).Select(t => t.AssigneeId).ToHashSet();
        Assert.Contains(member.ID, ids);
        Assert.Contains(peer.ID, ids);
        Assert.DoesNotContain(stopped.ID, ids);
        Assert.DoesNotContain(outsider.ID, ids);
        Assert.Contains(applicant.ID, ids);
    }

    [Fact]
    public void Dept_member_without_a_department_cannot_publish()
    {
        var mark = Mark();
        var process = Create(mark, "缺部门");
        Throws(4222, () => process.SaveDraft(DeptGraph(0)));
        Throws(4222, () => process.SaveDraft(ApplicantGraph().Replace("applicant", "notARule")));
    }

    [Fact]
    public void Exclusive_inside_parallel_must_cover_every_outgoing_path()
    {
        var mark = Mark();
        var process = Create(mark, "非法并行");
        Throws(4222, () => process.SaveDraft(ExclusiveParallelGraph(1, 2, 3, endInsteadOfJoin: true)));
        Throws(4222, () => process.SaveDraft(SplitJoinsGraph(1, 2, 3, 4)));
    }

    [Fact]
    public void Exclusive_inside_parallel_runs_only_the_chosen_arm()
    {
        var mark = Mark();
        var longLeave = UserOf("r5-long-" + mark, "长假");
        var shortLeave = UserOf("r5-short-" + mark, "短假");
        var side = UserOf("r5-side-" + mark, "并行");
        var applicant = UserOf("r5-who-" + mark, "学生乙");
        var process = Publish(mark, "并行排他", ExclusiveParallelGraph(longLeave.ID, shortLeave.ID, side.ID, endInsteadOfJoin: false));

        var big = Start(process, applicant, "r5-big-" + mark, 5);
        var bigIds = ApprovalTask.FindPending(big.Id).Select(t => t.AssigneeId).ToHashSet();
        Assert.Contains(longLeave.ID, bigIds);
        Assert.Contains(side.ID, bigIds);
        Assert.DoesNotContain(shortLeave.ID, bigIds);
        big = ApprovalInstance.Agree(ApprovalTask.FindPending(big.Id).First(t => t.AssigneeId == longLeave.ID).Id,
            longLeave.ID, "同意", "r5-big-a-" + mark, big.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Running, big.Status);
        big = ApprovalInstance.Agree(ApprovalTask.FindPending(big.Id).Single().Id,
            side.ID, "同意", "r5-big-b-" + mark, big.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Approved, big.Status);

        var small = Start(process, applicant, "r5-small-" + mark, 1);
        var smallIds = ApprovalTask.FindPending(small.Id).Select(t => t.AssigneeId).ToHashSet();
        Assert.Contains(shortLeave.ID, smallIds);
        Assert.Contains(side.ID, smallIds);
        Assert.DoesNotContain(longLeave.ID, smallIds);
    }

    [Fact]
    public void Leave_host_updates_status_when_the_instance_is_approved_or_rejected()
    {
        var mark = Mark();
        var approver = UserOf("r5-apr-" + mark, "审批人");
        var student = UserOf("r5-stu2-" + mark, "学生乙");
        var process = Publish(mark, "请假宿主", UsersGraph(approver.ID));

        var approved = LeaveHost.Submit(new LeaveSubmit
        {
            ProcessId = process.Id,
            OperatorUserId = student.ID,
            Reason = "回家",
            RequestId = "r5-leave-ok-" + mark,
            ClientIp = "127.0.0.1",
        });
        Assert.Equal(student.ID, approved.StudentId);
        Assert.True(approved.ApprovalInstanceId > 0);
        Assert.Equal((Int32)InstanceStatus.Running, approved.Status);
        var task = ApprovalTask.FindPending(approved.ApprovalInstanceId).Single();
        ApprovalInstance.Agree(task.Id, approver.ID, "同意", "r5-leave-agree-" + mark, 0, "127.0.0.1");
        var afterOk = LeaveRequest.FindByApprovalInstanceId(approved.ApprovalInstanceId);
        Assert.Equal((Int32)InstanceStatus.Approved, afterOk!.Status);

        var rejected = LeaveHost.Submit(new LeaveSubmit
        {
            ProcessId = process.Id,
            OperatorUserId = student.ID,
            Reason = "再请",
            RequestId = "r5-leave-no-" + mark,
            ClientIp = "127.0.0.1",
        });
        var rejectTask = ApprovalTask.FindPending(rejected.ApprovalInstanceId).Single();
        ApprovalInstance.Reject(rejectTask.Id, approver.ID, "不行", "r5-leave-rej-" + mark, 0, "127.0.0.1");
        var afterNo = LeaveRequest.FindByApprovalInstanceId(rejected.ApprovalInstanceId);
        Assert.Equal((Int32)InstanceStatus.Rejected, afterNo!.Status);
        Assert.Equal(student.ID, afterNo.StudentId);
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
            ClientIp = "127.0.0.1",
        });
    }

    private static String ApplicantGraph() =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"申请人\",\"mode\":\"any\",\"assignee\":{\"type\":\"applicant\"}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static String DeptGraph(Int32 departmentId) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"部门\",\"mode\":\"any\",\"assignee\":{\"type\":\"deptMember\",\"departmentId\":" + departmentId + "}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static String UsersGraph(Int32 approver) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"审批\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + approver + "]}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static String ExclusiveParallelGraph(Int32 longUser, Int32 shortUser, Int32 sideUser, Boolean endInsteadOfJoin)
    {
        var shortTo = endInsteadOfJoin ? "e" : "join";
        return "{\"nodes\":[" +
            "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
            "{\"key\":\"split\",\"type\":\"parallel\",\"name\":\"分支\"}," +
            "{\"key\":\"x\",\"type\":\"exclusive\",\"name\":\"天数\"}," +
            "{\"key\":\"long\",\"type\":\"approve\",\"name\":\"长假\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + longUser + "]}}," +
            "{\"key\":\"short\",\"type\":\"approve\",\"name\":\"短假\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + shortUser + "]}}," +
            "{\"key\":\"side\",\"type\":\"approve\",\"name\":\"并行\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + sideUser + "]}}," +
            "{\"key\":\"join\",\"type\":\"parallel\",\"name\":\"汇聚\"}," +
            "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
            "\"edges\":[" +
            "{\"key\":\"e1\",\"from\":\"s\",\"to\":\"split\"}," +
            "{\"key\":\"e2\",\"from\":\"split\",\"to\":\"x\",\"sort\":1}," +
            "{\"key\":\"e3\",\"from\":\"split\",\"to\":\"side\",\"sort\":2}," +
            "{\"key\":\"e4\",\"from\":\"x\",\"to\":\"long\",\"priority\":1,\"condition\":{\"field\":\"days\",\"op\":\"ge\",\"value\":3}}," +
            "{\"key\":\"e5\",\"from\":\"x\",\"to\":\"short\",\"default\":true,\"priority\":9}," +
            "{\"key\":\"e6\",\"from\":\"long\",\"to\":\"join\"}," +
            "{\"key\":\"e7\",\"from\":\"short\",\"to\":\"" + shortTo + "\"}," +
            "{\"key\":\"e8\",\"from\":\"side\",\"to\":\"join\"}," +
            "{\"key\":\"e9\",\"from\":\"join\",\"to\":\"e\"}]}";
    }

    private static String SplitJoinsGraph(Int32 longUser, Int32 shortUser, Int32 sideA, Int32 sideB) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"split\",\"type\":\"parallel\",\"name\":\"分支\"}," +
        "{\"key\":\"x\",\"type\":\"exclusive\",\"name\":\"天数\"}," +
        "{\"key\":\"long\",\"type\":\"approve\",\"name\":\"长假\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + longUser + "]}}," +
        "{\"key\":\"short\",\"type\":\"approve\",\"name\":\"短假\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + shortUser + "]}}," +
        "{\"key\":\"sa\",\"type\":\"approve\",\"name\":\"甲\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + sideA + "]}}," +
        "{\"key\":\"sb\",\"type\":\"approve\",\"name\":\"乙\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + sideB + "]}}," +
        "{\"key\":\"join\",\"type\":\"parallel\",\"name\":\"汇聚甲\"}," +
        "{\"key\":\"join2\",\"type\":\"parallel\",\"name\":\"汇聚乙\"}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}," +
        "{\"key\":\"e2\",\"type\":\"end\",\"name\":\"结束乙\"}]," +
        "\"edges\":[" +
        "{\"key\":\"e1\",\"from\":\"s\",\"to\":\"split\"}," +
        "{\"key\":\"e2\",\"from\":\"split\",\"to\":\"x\",\"sort\":1}," +
        "{\"key\":\"e3\",\"from\":\"split\",\"to\":\"sa\",\"sort\":2}," +
        "{\"key\":\"e4\",\"from\":\"split\",\"to\":\"sb\",\"sort\":3}," +
        "{\"key\":\"e5\",\"from\":\"x\",\"to\":\"long\",\"priority\":1,\"condition\":{\"field\":\"days\",\"op\":\"ge\",\"value\":3}}," +
        "{\"key\":\"e6\",\"from\":\"x\",\"to\":\"short\",\"default\":true,\"priority\":9}," +
        "{\"key\":\"e7\",\"from\":\"long\",\"to\":\"join\"}," +
        "{\"key\":\"e8\",\"from\":\"sa\",\"to\":\"join\"}," +
        "{\"key\":\"e9\",\"from\":\"short\",\"to\":\"join2\"}," +
        "{\"key\":\"e10\",\"from\":\"sb\",\"to\":\"join2\"}," +
        "{\"key\":\"e11\",\"from\":\"join\",\"to\":\"e\"}," +
        "{\"key\":\"e12\",\"from\":\"join2\",\"to\":\"e2\"}]}";

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
        var role = Role.Add("r5-" + name, false, "切片");
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
