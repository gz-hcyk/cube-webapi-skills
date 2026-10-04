using System.Text.Json;
using NewLife;
using Approval.Data.Entities;

namespace Approval.Data;

/// <summary>流程图。草稿以 JSON 保存，发布时拆成节点和连线。</summary>
public sealed class FlowGraph
{
    /// <summary>节点。</summary>
    public List<FlowNode> Nodes { get; set; } = [];

    /// <summary>连线。</summary>
    public List<FlowEdge> Edges { get; set; } = [];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>解析流程定义。</summary>
    public static FlowGraph Parse(String? json)
    {
        if (json.IsNullOrEmpty()) throw new ApprovalException(4222, "流程定义为空");
        try
        {
            return JsonSerializer.Deserialize<FlowGraph>(json, JsonOptions)
                ?? throw new ApprovalException(4222, "流程定义无法解析");
        }
        catch (ApprovalException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ApprovalException(4222, "流程定义无法解析：" + ex.Message);
        }
    }

    /// <summary>序列化，供草稿保存。</summary>
    public String ToJson() => JsonSerializer.Serialize(this, JsonOptions);

    /// <summary>发布前校验。会签、依次审批允许保存，不在这里拒绝。</summary>
    public void Validate()
    {
        if (Nodes.Count == 0) throw new ApprovalException(4222, "流程没有节点");
        var keys = new HashSet<String>(StringComparer.Ordinal);
        foreach (var node in Nodes)
        {
            if (node.Key.IsNullOrEmpty()) throw new ApprovalException(4222, "节点键不能为空");
            if (!keys.Add(node.Key)) throw new ApprovalException(4222, "节点键重复：" + node.Key);
            if (node.Name.IsNullOrEmpty()) node.Name = node.Key;
            node.Type = (node.Type ?? "").Trim().ToLowerInvariant();
            if (node.Type is not ("start" or "approve" or "end"))
                throw new ApprovalException(4222, "本切片节点类型只接受 start、approve、end：" + node.Key);
            if (node.Type == "approve")
            {
                var kind = node.Assignee?.Type?.Trim() ?? "";
                if (kind is not ("user" or "role" or "deptManager" or "subjectCounselor"))
                    throw new ApprovalException(4222, "审批节点办理人规则不合法：" + node.Key);
                node.ApproveMode = ParseMode(node.Mode);
            }
        }

        if (Nodes.Count(e => e.Type == "start") != 1)
            throw new ApprovalException(4222, "流程必须有且只有一个开始节点");
        if (!Nodes.Any(e => e.Type == "end"))
            throw new ApprovalException(4222, "流程至少要有一个结束节点");

        var index = 0;
        foreach (var edge in Edges)
        {
            index++;
            if (edge.Key.IsNullOrEmpty()) edge.Key = "e" + index;
            if (edge.From.IsNullOrEmpty() || edge.To.IsNullOrEmpty())
                throw new ApprovalException(4222, "连线两端不能为空");
            if (!keys.Contains(edge.From) || !keys.Contains(edge.To))
                throw new ApprovalException(4222, "连线指向了不存在的节点：" + edge.Key);
        }

        if (Edges.Select(e => e.Key).Distinct(StringComparer.Ordinal).Count() != Edges.Count)
            throw new ApprovalException(4222, "连线键重复");

        var start = Nodes.First(e => e.Type == "start").Key;
        var seen = new HashSet<String>(StringComparer.Ordinal);
        var stack = new Stack<String>();
        stack.Push(start);
        while (stack.Count > 0)
        {
            var key = stack.Pop();
            if (!seen.Add(key)) continue;
            foreach (var edge in Edges.Where(e => e.From == key))
                stack.Push(edge.To);
        }

        var missed = Nodes.Where(e => !seen.Contains(e.Key)).Select(e => e.Key).ToList();
        if (missed.Count > 0)
            throw new ApprovalException(4222, "有节点从开始节点不可达：" + String.Join(",", missed));
    }

    /// <summary>从某节点出发的下一条连线。本切片不执行排他网关，多条出线时取得分最低的一条。</summary>
    public FlowEdge? NextEdge(String fromKey) =>
        Edges.Where(e => e.From == fromKey).OrderBy(e => e.Sort).ThenBy(e => e.Key, StringComparer.Ordinal).FirstOrDefault();

    /// <summary>按键取节点。</summary>
    public FlowNode? FindNode(String key) => Nodes.FirstOrDefault(e => e.Key == key);

    /// <summary>把处理方式文本转成枚举。无法识别时按或签保存。</summary>
    public static ApproveMode ParseMode(String? mode)
    {
        var text = (mode ?? "").Trim().ToLowerInvariant();
        return text switch
        {
            "all" or "and" or "会签" => ApproveMode.All,
            "sequential" or "seq" or "依次" or "依次审批" => ApproveMode.Sequential,
            _ => ApproveMode.Any,
        };
    }
}

/// <summary>流程节点。</summary>
public sealed class FlowNode
{
    /// <summary>节点键。</summary>
    public String Key { get; set; } = "";

    /// <summary>start、approve、end。</summary>
    public String Type { get; set; } = "";

    /// <summary>名称。</summary>
    public String Name { get; set; } = "";

    /// <summary>any、all、sequential。只执行 any。</summary>
    public String? Mode { get; set; }

    /// <summary>办理人规则。</summary>
    public FlowAssignee? Assignee { get; set; }

    /// <summary>解析后的处理方式，不写入 JSON。</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public ApproveMode ApproveMode { get; set; } = ApproveMode.Any;
}

/// <summary>办理人规则。</summary>
public sealed class FlowAssignee
{
    /// <summary>user、role、deptManager、subjectCounselor。</summary>
    public String Type { get; set; } = "";

    /// <summary>指定成员。</summary>
    public List<Int32> UserIds { get; set; } = [];

    /// <summary>指定角色。</summary>
    public List<Int32> RoleIds { get; set; } = [];

    /// <summary>部门负责人上溯层级，1 表示发起人部门。</summary>
    public Int32 Level { get; set; } = 1;

    /// <summary>相对业务单的字段名。辅导员用户编号写在实例上，不另建用户表。</summary>
    public String? Field { get; set; }
}

/// <summary>连线。</summary>
public sealed class FlowEdge
{
    /// <summary>连线键。</summary>
    public String Key { get; set; } = "";

    /// <summary>起点。</summary>
    public String From { get; set; } = "";

    /// <summary>终点。</summary>
    public String To { get; set; } = "";

    /// <summary>排序。</summary>
    public Int32 Sort { get; set; }
}

/// <summary>表单结构的最低校验：字段键唯一。</summary>
public static class FormSchema
{
    /// <summary>校验并返回字段数。</summary>
    public static Int32 Check(String? schema)
    {
        if (schema.IsNullOrEmpty()) throw new ApprovalException(4222, "表单结构为空");
        try
        {
            using var doc = JsonDocument.Parse(schema);
            if (doc.RootElement.ValueKind != JsonValueKind.Object ||
                !doc.RootElement.TryGetProperty("fields", out var fields) ||
                fields.ValueKind != JsonValueKind.Array)
                throw new ApprovalException(4222, "表单结构缺少 fields");

            var keys = new HashSet<String>(StringComparer.Ordinal);
            foreach (var field in fields.EnumerateArray())
            {
                if (!field.TryGetProperty("key", out var keyNode))
                    throw new ApprovalException(4222, "字段缺少 key");
                var key = keyNode.GetString();
                if (key.IsNullOrEmpty() || !keys.Add(key))
                    throw new ApprovalException(4222, "字段键重复或为空");
            }

            if (keys.Count == 0) throw new ApprovalException(4222, "表单至少要有一个字段");
            return keys.Count;
        }
        catch (ApprovalException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ApprovalException(4222, "表单结构无法解析：" + ex.Message);
        }
    }
}
