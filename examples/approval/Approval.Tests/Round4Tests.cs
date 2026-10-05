using System.Text.Json.Nodes;
using Xunit;
using Approval.Data;
using Approval.Data.Entities;
using XCode.Membership;

namespace Approval.Tests;

/// <summary>撤回后重提、节点字段权限、分类和可检索字段。</summary>
[Collection("approval")]
public class Round4Tests
{
    private const String Schema = """{"fields":[{"key":"studentUserId","label":"学生"},{"key":"counselorUserId","label":"辅导员"},{"key":"reason","label":"事由","search":true},{"key":"days","label":"天数"}]}""";

    public Round4Tests(ApprovalWorld world) => _ = world;

    [Fact]
    public void Withdraw_then_resubmit_increments_round_on_the_same_version()
    {
        var mark = Mark();
        var applicant = UserOf("r4-me-" + mark, "学生乙");
        var counselor = UserOf("r4-co-" + mark, "该生辅导员");
        var process = Publish(mark, CounselorGraph());
        var versionId = process.PublishedVersionId;

        var inst = StartSelf(process, applicant, counselor, "r4-start-" + mark);
        Assert.Equal(1, inst.Round);
        inst = ApprovalInstance.Withdraw(inst.Id, applicant.ID, "先撤", "r4-wd-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(InstanceStatus.Draft, inst.Status);

        var newer = ApprovalProcess.FindById(process.Id)!;
        newer.SaveDraft(CounselorGraph().Replace("该生辅导员", "新版本"));
        newer.Publish(0);
        Assert.NotEqual(versionId, newer.PublishedVersionId);

        inst = ApprovalInstance.Resubmit(inst.Id, applicant.ID,
            "{\"studentUserId\":" + applicant.ID + ",\"counselorUserId\":" + counselor.ID + ",\"reason\":\"改期\"}",
            "r4-again-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(2, inst.Round);
        Assert.Equal(InstanceStatus.Running, inst.Status);
        Assert.Equal(versionId, inst.ProcessVersionId);
        Assert.Equal(applicant.ID, inst.SubjectUserId);
        Assert.Equal(0, inst.ProxyUserId);
        Assert.Equal(counselor.ID, inst.CounselorUserId);
        var pending = ApprovalTask.FindPending(inst.Id).Single();
        Assert.Equal(2, pending.Round);
        Assert.Equal(counselor.ID, pending.AssigneeId);
        Assert.Contains(ApprovalHistory.FindAllByInstanceId(inst.Id), h => h.Action == "resubmit" && h.Round == 2);
        Assert.Equal("改期", JsonNode.Parse(ApprovalFormData.FindById(inst.Id)!.Data)!["reason"]!.GetValue<String>());

        Throws(4091, () => ApprovalInstance.Resubmit(inst.Id, applicant.ID, null, "r4-running-" + mark, inst.Version, "127.0.0.1"));
    }

    [Fact]
    public void Proxy_resubmit_keeps_subject_and_rejects_the_student()
    {
        var mark = Mark();
        var student = UserOf("r4-stu-" + mark, "学生乙");
        var proxy = UserOf("r4-px-" + mark, "辅导员丙");
        var counselor = UserOf("r4-coa-" + mark, "该生辅导员");
        var process = Publish(mark, CounselorGraph());
        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = proxy.ID,
            Proxy = true,
            SubjectUserId = student.ID,
            Data = "{\"studentUserId\":" + student.ID + ",\"counselorUserId\":" + counselor.ID + ",\"reason\":\"回家\"}",
            RequestId = "r4-proxy-" + mark,
            ClientIp = "127.0.0.1",
        });
        inst = ApprovalInstance.Withdraw(inst.Id, proxy.ID, "撤", "r4-pwd-" + mark, inst.Version, "127.0.0.1");
        Throws(4031, () => ApprovalInstance.Resubmit(inst.Id, student.ID, null, "r4-stu-again-" + mark, inst.Version, "127.0.0.1"));
        Throws(4221, () => ApprovalInstance.Resubmit(inst.Id, proxy.ID,
            "{\"studentUserId\":" + proxy.ID + ",\"counselorUserId\":" + counselor.ID + ",\"reason\":\"回家\"}",
            "r4-bad-subject-" + mark, inst.Version, "127.0.0.1"));

        inst = ApprovalInstance.Resubmit(inst.Id, proxy.ID,
            "{\"counselorUserId\":" + counselor.ID + ",\"reason\":\"改事由\"}",
            "r4-proxy-again-" + mark, inst.Version, "127.0.0.1");
        Assert.Equal(student.ID, inst.SubjectUserId);
        Assert.Equal(proxy.ID, inst.ProxyUserId);
        Assert.Equal(counselor.ID, inst.CounselorUserId);
        Assert.NotEqual(proxy.ID, inst.CounselorUserId);
        Assert.Equal("改事由", JsonNode.Parse(ApprovalFormData.FindById(inst.Id)!.Data)!["reason"]!.GetValue<String>());
    }

    [Fact]
    public void Node_field_rules_reject_hidden_and_readonly_writes()
    {
        var mark = Mark();
        var applicant = UserOf("r4-f-" + mark, "学生乙");
        var approver = UserOf("r4-a-" + mark, "审批人");
        var process = Publish(mark, RuledGraph(approver.ID));
        Throws(4221, () => StartSelf(process, applicant, null, "r4-hidden-" + mark, ",\"days\":3"));

        var inst = StartSelf(process, applicant, null, "r4-ok-" + mark);
        Assert.DoesNotContain("days", ApprovalFormData.FindById(inst.Id)!.Data);
        var task = ApprovalTask.FindPending(inst.Id).Single();

        Throws(4221, () => ApprovalInstance.Agree(task.Id, approver.ID, "同意", "r4-ro-" + mark, inst.Version, "127.0.0.1",
            "{\"reason\":\"改事由\"}"));
        Assert.Equal(InstanceStatus.Running, ApprovalInstance.FindById(inst.Id)!.Status);

        Throws(4221, () => ApprovalInstance.Reject(task.Id, approver.ID, "不行", "r4-hid-rej-" + mark, inst.Version, "127.0.0.1",
            "{\"studentUserId\":" + applicant.ID + "}"));
        Assert.Equal(Approval.Data.Entities.TaskStatus.Pending, ApprovalTask.FindById(task.Id)!.Status);

        inst = ApprovalInstance.Agree(task.Id, approver.ID, "同意", "r4-days-" + mark, inst.Version, "127.0.0.1",
            "{\"days\":2}");
        Assert.Equal(InstanceStatus.Approved, inst.Status);
        Assert.Contains("\"days\":2", ApprovalFormData.FindById(inst.Id)!.Data.Replace(" ", ""));
    }

    [Fact]
    public void Category_lists_the_form_and_searchable_key_is_on_the_version()
    {
        var mark = Mark();
        var category = new ApprovalCategory { Code = "cat-" + mark, Name = "学工", Enable = true, Sort = 1 };
        category.Insert();
        Assert.True(ApprovalCategory.FindByCode(category.Code)!.Enable);
        var form = new ApprovalFormDefinition { Code = mark + "-form", Name = "请假表单", Enable = true, CategoryId = category.Id };
        form.Insert();
        form.SaveDraft(Schema);
        var published = form.Publish(0);
        Assert.Equal("reason", published.SearchableKeys);

        var process = new ApprovalProcess { Code = mark, Name = "请假", FormId = form.Id, Enable = true, CategoryId = category.Id };
        process.Insert();
        var forms = ApprovalFormDefinition.FindAll().Where(e => e.CategoryId == category.Id).Select(e => e.Code).ToList();
        var processes = ApprovalProcess.FindAll().Where(e => e.CategoryId == category.Id).Select(e => e.Name).ToList();
        Assert.Contains(form.Code, forms);
        Assert.Contains("请假", processes);
        Assert.Equal(form.Id, SubjectLink.UserId(new ApprovalInstance { SubjectUserId = form.Id }) == form.Id ? form.Id : 0);
    }

    private static ApprovalInstance StartSelf(ApprovalProcess process, User applicant, User? counselor, String requestId, String extra = "")
    {
        var counselorJson = counselor == null ? "" : ",\"counselorUserId\":" + counselor.ID;
        return ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Data = "{\"studentUserId\":" + applicant.ID + counselorJson + ",\"reason\":\"回家\"" + extra + "}",
            RequestId = requestId,
            ClientIp = "127.0.0.1",
        });
    }

    private static String CounselorGraph() =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\",\"fields\":[{\"key\":\"studentUserId\",\"access\":\"readonly\"},{\"key\":\"counselorUserId\",\"access\":\"editable\"},{\"key\":\"reason\",\"access\":\"editable\"},{\"key\":\"days\",\"access\":\"hidden\"}]}," +
        "{\"key\":\"c\",\"type\":\"approve\",\"name\":\"该生辅导员\",\"mode\":\"any\",\"assignee\":{\"type\":\"subjectCounselor\",\"field\":\"counselorUserId\"},\"fields\":[{\"key\":\"studentUserId\",\"access\":\"readonly\"},{\"key\":\"reason\",\"access\":\"editable\"}]}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"c\"},{\"key\":\"e2\",\"from\":\"c\",\"to\":\"e\"}]}";

    private static String RuledGraph(Int32 approverId) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\",\"fields\":[{\"key\":\"days\",\"access\":\"hidden\"},{\"key\":\"reason\",\"access\":\"editable\"}]}," +
        "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"审批\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + approverId + "]},\"fields\":[{\"key\":\"reason\",\"access\":\"readonly\"},{\"key\":\"days\",\"access\":\"editable\"},{\"key\":\"studentUserId\",\"access\":\"hidden\"}]}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}";

    private static ApprovalProcess Publish(String mark, String definition)
    {
        var form = new ApprovalFormDefinition { Code = mark + "-form", Name = "请假表单", Enable = true };
        form.Insert();
        form.SaveDraft(Schema);
        form.Publish(0);
        var process = new ApprovalProcess { Code = mark, Name = "请假", FormId = form.Id, Enable = true };
        process.Insert();
        process.SaveDraft(definition);
        process.Publish(0);
        return process;
    }

    private static User UserOf(String name, String display)
    {
        var role = Role.Add("第四轮-" + name, false, "切片");
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
