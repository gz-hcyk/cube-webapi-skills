using Approval.Data;
using Approval.Data.Entities;
using Xunit;
using XCode.Membership;

namespace Approval.Tests;

/// <summary>第 8 轮：发布校验、越权查看、隐藏字段和检索注入。</summary>
[Collection("approval")]
public class Round8Tests
{
    private const String Schema = """{"fields":[{"key":"studentUserId"},{"key":"reason","search":true},{"key":"days"}]}""";

    public Round8Tests(ApprovalWorld world) => _ = world;

    [Fact]
    public void Publish_rejects_missing_end_unpaired_parallel_and_exclusive_without_default()
    {
        var missingEnd = Assert.Throws<ApprovalException>(() => FlowGraph.Parse(
            """{"nodes":[{"key":"s","type":"start","name":"开始"},{"key":"a","type":"approve","name":"审批","mode":"any","assignee":{"type":"applicant"}}],"edges":[{"key":"e1","from":"s","to":"a"}]}""").Validate());
        Assert.Equal(4222, missingEnd.Code);
        Assert.Contains("结束", missingEnd.Message);

        var parallel = Assert.Throws<ApprovalException>(() => FlowGraph.Parse(
            """{"nodes":[{"key":"s","type":"start","name":"开始"},{"key":"p","type":"parallel","name":"分支"},{"key":"e","type":"end","name":"结束"}],"edges":[{"key":"e1","from":"s","to":"p"},{"key":"e2","from":"p","to":"e"}]}""").Validate());
        Assert.Equal(4222, parallel.Code);
        Assert.Contains("并行", parallel.Message);

        var exclusive = Assert.Throws<ApprovalException>(() => FlowGraph.Parse(
            """{"nodes":[{"key":"s","type":"start","name":"开始"},{"key":"x","type":"exclusive","name":"排他"},{"key":"e","type":"end","name":"结束"}],"edges":[{"key":"e1","from":"s","to":"x"},{"key":"e2","from":"x","to":"e","condition":{"field":"days","op":"ge","value":3}}]}""").Validate());
        Assert.Equal(4222, exclusive.Code);
        Assert.Contains("默认", exclusive.Message);
    }

    [Fact]
    public void Stranger_cannot_view_or_search_and_owner_cannot_read_hidden_days()
    {
        var mark = Guid.NewGuid().ToString("N")[..8];
        var owner = UserOf("r8-owner-" + mark, "学生甲");
        var approver = UserOf("r8-appr-" + mark, "审批人");
        var stranger = UserOf("r8-str-" + mark, "旁观者");
        var process = Publish(mark, approver.ID);
        var reason = "r8-secret-" + mark;
        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = owner.ID,
            Data = "{\"studentUserId\":" + owner.ID + ",\"reason\":\"" + reason + "\"}",
            RequestId = "r8-start-" + mark,
        });
        var task = ApprovalTask.FindAll(ApprovalTask._.InstanceId == inst.Id).Single();
        var ex = Assert.Throws<ApprovalException>(() => ApprovalInstance.Agree(task.Id, stranger.ID, "不行", "r8-steal-" + mark, inst.Version, "127.0.0.1"));
        Assert.Equal(4031, ex.Code);

        Assert.False(ApprovalAccess.CanView(stranger, inst, null));
        Assert.True(ApprovalAccess.CanView(owner, inst, null));
        Assert.True(ApprovalAccess.CanView(approver, inst, null));
        Assert.Empty(ApprovalFieldValue.FindMatches("reason' OR '1'='1", reason));
        Assert.Contains(ApprovalFieldValue.FindMatches("reason", reason), row => row.InstanceId == inst.Id);

        inst = ApprovalInstance.Agree(task.Id, approver.ID, "同意", "r8-ok-" + mark, inst.Version, "127.0.0.1", "{\"days\":4}");
        var raw = ApprovalFormData.FindById(inst.Id)!.Data!;
        Assert.Contains("days", raw);
        var ownerForm = ApprovalAccess.RedactForm(owner, inst, raw, null);
        var approverForm = ApprovalAccess.RedactForm(approver, inst, raw, null);
        Assert.DoesNotContain("days", ownerForm);
        Assert.Contains("days", approverForm);
        Assert.Contains(reason, ownerForm);
    }

    [Fact]
    public void Client_cannot_smuggle_starter_picks_inside_form_data()
    {
        var mark = Guid.NewGuid().ToString("N")[..8];
        var owner = UserOf("r8-pick-" + mark, "发起人");
        var process = Publish(mark + "p", owner.ID);
        var ex = Assert.Throws<ApprovalException>(() => ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = owner.ID,
            Data = "{\"studentUserId\":" + owner.ID + ",\"reason\":\"回家\",\"_starterPicks\":{\"a\":" + owner.ID + "}}",
            RequestId = "r8-smuggle-" + mark,
        }));
        Assert.Equal(4221, ex.Code);
    }

    private static ApprovalProcess Publish(String mark, Int32 approverId)
    {
        var form = new ApprovalFormDefinition { Code = "r8-" + mark, Name = "第八轮", Enable = true };
        form.Insert();
        form.SaveDraft(Schema);
        form.Publish(0);
        var process = new ApprovalProcess { Code = "r8p-" + mark, Name = "第八轮流程", FormId = form.Id, Enable = true };
        process.Insert();
        process.SaveDraft(
            "{\"nodes\":[" +
            "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\",\"fields\":[{\"key\":\"studentUserId\",\"access\":\"readonly\"},{\"key\":\"reason\",\"access\":\"editable\"},{\"key\":\"days\",\"access\":\"hidden\"}]}," +
            "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"审批\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + approverId + "]},\"fields\":[{\"key\":\"studentUserId\",\"access\":\"readonly\"},{\"key\":\"reason\",\"access\":\"readonly\"},{\"key\":\"days\",\"access\":\"editable\"}]}," +
            "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
            "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}");
        process.Publish(0);
        return process;
    }

    private static User UserOf(String name, String display)
    {
        var role = Role.Add("r8-" + name, false, "切片");
        var user = User.Add(name, "pass1234", role.ID, display);
        user.Enable = true;
        user.Update();
        return user;
    }
}
