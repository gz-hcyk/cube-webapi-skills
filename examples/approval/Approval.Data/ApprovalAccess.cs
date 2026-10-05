using Approval.Data.Entities;
using NewLife;
using XCode.Membership;

namespace Approval.Data;

/// <summary>审批单谁可以看，以及隐藏字段对这个人是否还可见。</summary>
public static class ApprovalAccess
{
    /// <summary>
    /// 参与人可以看。没有参与时，只有调用方已经确认拥有监控权限，并且该单落在其数据范围内，才可以看。
    /// </summary>
    public static Boolean CanView(User user, ApprovalInstance inst, ISet<Int64>? monitorIds)
    {
        if (user == null || !user.Enable || inst == null) return false;
        if (IsParticipant(user, inst)) return true;
        return monitorIds != null && monitorIds.Contains(inst.Id);
    }

    /// <summary>发起人、代发人、业务主体，以及该单上任一任务的办理人。</summary>
    public static Boolean IsParticipant(User user, ApprovalInstance inst)
    {
        if (inst.UserId == user.ID || inst.SubjectUserId == user.ID || inst.ProxyUserId == user.ID) return true;
        return ApprovalTask.FindAll(ApprovalTask._.InstanceId == inst.Id).Any(task => task.AssigneeId == user.ID);
    }

    /// <summary>对这个人来说，所有相关节点都标成隐藏的字段。</summary>
    public static HashSet<String> HiddenFrom(User user, ApprovalInstance inst)
    {
        var hidden = new HashSet<String>(StringComparer.Ordinal);
        var version = ApprovalProcessVersion.FindById(inst.ProcessVersionId);
        if (version == null || version.Definition.IsNullOrEmpty()) return hidden;
        var graph = FlowGraph.Parse(version.Definition);
        var nodes = new List<FlowNode>();
        if (inst.UserId == user.ID || inst.SubjectUserId == user.ID || inst.ProxyUserId == user.ID)
        {
            var start = graph.Nodes.FirstOrDefault(node => node.Type == "start");
            if (start != null) nodes.Add(start);
        }

        foreach (var task in ApprovalTask.FindAll(ApprovalTask._.InstanceId == inst.Id & ApprovalTask._.AssigneeId == user.ID))
        {
            var node = graph.FindNode(task.NodeKey);
            if (node != null && nodes.All(item => item.Key != node.Key)) nodes.Add(node);
        }

        if (nodes.Count == 0) return hidden;
        var schema = inst.FormVersionId > 0 ? ApprovalFormVersion.FindById(inst.FormVersionId)?.Schema : null;
        foreach (var key in FormSchema.Keys(schema))
        {
            if (nodes.All(node => Access(node, key) == "hidden")) hidden.Add(key);
        }

        return hidden;
    }

    /// <summary>监控范围内的人看全文。其他人去掉对自己隐藏的字段。</summary>
    public static String RedactForm(User user, ApprovalInstance inst, String? data, ISet<Int64>? monitorIds)
    {
        if (monitorIds != null && monitorIds.Contains(inst.Id)) return data ?? "";
        var hidden = HiddenFrom(user, inst);
        if (hidden.Count == 0 || data.IsNullOrEmpty()) return data ?? "";
        var obj = FieldRules.ParseObject(data);
        foreach (var key in hidden) obj.Remove(key);
        return obj.ToJsonString();
    }

    private static String Access(FlowNode node, String key)
    {
        var rule = node.Fields.FirstOrDefault(field => field.Key == key);
        if (rule == null || rule.Access.IsNullOrEmpty()) return "editable";
        return rule.Access.Trim().ToLowerInvariant();
    }
}
