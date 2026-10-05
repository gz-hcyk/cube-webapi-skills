using Approval.Data;
using Approval.Data.Entities;
using Xunit;
using XCode.Membership;

namespace Approval.Tests;

/// <summary>第 10 轮：排他网关按当前表单字段选路。数字、字符串、属于，以及字段缺失时走默认出线。</summary>
[Collection("approval")]
public class Round10Tests
{
    public Round10Tests(ApprovalWorld world) => _ = world;

    [Fact]
    public void Choose_matches_number_string_and_list_or_uses_default()
    {
        var number = FlowGraph.Parse("""
        {"nodes":[{"key":"x","type":"exclusive","name":"天数"},{"key":"long","type":"end","name":"长"},{"key":"short","type":"end","name":"短"}],"edges":[{"key":"a","from":"x","to":"long","priority":1,"condition":{"field":"days","op":"gte","value":3}},{"key":"b","from":"x","to":"short","default":true,"priority":9}]}
        """);
        Assert.Equal("long", number.Choose("x", "{\"days\":5}", 1, 1).To);
        Assert.Equal("long", number.Choose("x", "{\"days\":\"5\"}", 1, 1).To);
        Assert.Equal("long", number.Choose("x", "{\"days\":3}", 1, 1).To);
        Assert.Equal("short", number.Choose("x", "{\"days\":2}", 1, 1).To);
        Assert.Equal("short", number.Choose("x", "{\"days\":\"1\"}", 1, 1).To);
        Assert.Equal("short", number.Choose("x", "{}", 1, 1).To);
        Assert.Equal("short", number.Choose("x", "{\"days\":\"lots\"}", 1, 1).To);

        var text = FlowGraph.Parse("""
        {"nodes":[{"key":"x","type":"exclusive","name":"类型"},{"key":"sick","type":"end","name":"病假"},{"key":"normal","type":"end","name":"其他"}],"edges":[{"key":"a","from":"x","to":"sick","priority":1,"condition":{"field":"leaveType","op":"eq","value":"病假"}},{"key":"b","from":"x","to":"normal","default":true,"priority":9}]}
        """);
        Assert.Equal("sick", text.Choose("x", "{\"leaveType\":\"病假\"}", 1, 1).To);
        Assert.Equal("normal", text.Choose("x", "{\"leaveType\":\"事假\"}", 1, 1).To);
        Assert.Equal("normal", text.Choose("x", "{}", 1, 1).To);

        var list = FlowGraph.Parse("""
        {"nodes":[{"key":"x","type":"exclusive","name":"类型"},{"key":"special","type":"end","name":"特殊"},{"key":"normal","type":"end","name":"其他"}],"edges":[{"key":"a","from":"x","to":"special","priority":1,"condition":{"field":"leaveType","op":"in","value":["病假","公假"]}},{"key":"b","from":"x","to":"normal","default":true,"priority":9}]}
        """);
        Assert.Equal("special", list.Choose("x", "{\"leaveType\":\"公假\"}", 1, 1).To);
        Assert.Equal("normal", list.Choose("x", "{\"leaveType\":\"事假\"}", 1, 1).To);
        Assert.Equal("normal", list.Choose("x", "{}", 1, 1).To);
    }

    [Fact]
    public void Runtime_exclusive_reads_the_current_form()
    {
        var mark = Guid.NewGuid().ToString("N")[..8];
        var sick = UserOf("r10-sick-" + mark, "病假审批");
        var other = UserOf("r10-other-" + mark, "其他审批");
        var applicant = UserOf("r10-app-" + mark, "学生乙");
        var process = Publish(mark, "类型分支", Graph(sick.ID, other.ID));

        var matched = Start(process, applicant, "r10-sick-" + mark, "病假");
        Assert.Equal(sick.ID, ApprovalTask.FindPending(matched.Id).Single().AssigneeId);

        var otherType = Start(process, applicant, "r10-other-" + mark, "事假");
        Assert.Equal(other.ID, ApprovalTask.FindPending(otherType.Id).Single().AssigneeId);

        var missing = Start(process, applicant, "r10-miss-" + mark, null);
        Assert.Equal(other.ID, ApprovalTask.FindPending(missing.Id).Single().AssigneeId);
    }

    private static ApprovalInstance Start(ApprovalProcess process, User applicant, String requestId, String? leaveType)
    {
        var data = "{\"studentUserId\":" + applicant.ID + ",\"reason\":\"回家\"";
        if (leaveType != null) data += ",\"leaveType\":\"" + leaveType + "\"";
        data += "}";
        return ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = process.Id,
            OperatorUserId = applicant.ID,
            Data = data,
            RequestId = requestId,
        });
    }

    private static String Graph(Int32 sickUser, Int32 otherUser) =>
        "{\"nodes\":[" +
        "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\"}," +
        "{\"key\":\"x\",\"type\":\"exclusive\",\"name\":\"类型\"}," +
        "{\"key\":\"sick\",\"type\":\"approve\",\"name\":\"病假\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + sickUser + "]}}," +
        "{\"key\":\"other\",\"type\":\"approve\",\"name\":\"其他\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + otherUser + "]}}," +
        "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
        "\"edges\":[" +
        "{\"key\":\"e1\",\"from\":\"s\",\"to\":\"x\"}," +
        "{\"key\":\"e2\",\"from\":\"x\",\"to\":\"sick\",\"priority\":1,\"condition\":{\"field\":\"leaveType\",\"op\":\"eq\",\"value\":\"病假\"}}," +
        "{\"key\":\"e3\",\"from\":\"x\",\"to\":\"other\",\"default\":true,\"priority\":9}," +
        "{\"key\":\"e4\",\"from\":\"sick\",\"to\":\"e\"}," +
        "{\"key\":\"e5\",\"from\":\"other\",\"to\":\"e\"}]}";

    private static ApprovalProcess Publish(String mark, String name, String definition)
    {
        var form = new ApprovalFormDefinition { Code = mark + "-form", Name = name + "表单", Enable = true };
        form.Insert();
        form.SaveDraft("""{"fields":[{"key":"studentUserId"},{"key":"reason"},{"key":"leaveType"}]}""");
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
}
