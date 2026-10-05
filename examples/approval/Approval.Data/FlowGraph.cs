using System.Text.Json;
using System.Text.Json.Nodes;
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
            if (node.Type is not ("start" or "approve" or "end" or "cc" or "exclusive" or "parallel"))
                throw new ApprovalException(4222, "节点类型不支持：" + node.Key);
            if (node.Type is "approve" or "cc")
            {
                var kind = node.Assignee?.Type?.Trim() ?? "";
                if (kind is not ("user" or "role" or "deptManager" or "subjectCounselor"))
                    throw new ApprovalException(4222, "节点办理人规则不合法：" + node.Key);
                if (node.Type == "approve") node.ApproveMode = ParseMode(node.Mode);
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

        foreach (var node in Nodes.Where(e => e.Type == "exclusive"))
        {
            var outs = Edges.Where(e => e.From == node.Key).ToList();
            if (outs.Count(e => e.Default) != 1)
                throw new ApprovalException(4222, "排他网关必须恰好有一条默认出线：" + node.Key);
            if (outs.Any(e => !e.Default && e.Condition == null))
                throw new ApprovalException(4222, "排他网关的非默认出线必须有条件：" + node.Key);
        }

        foreach (var node in Nodes.Where(e => e.Type == "parallel"))
        {
            var outs = Edges.Count(e => e.From == node.Key);
            var ins = Edges.Count(e => e.To == node.Key);
            if (outs >= 2 && ins >= 2)
                throw new ApprovalException(4222, "并行网关不能同时分支和汇聚：" + node.Key);
            if (outs < 2 && ins < 2)
                throw new ApprovalException(4222, "并行网关必须是分支或汇聚：" + node.Key);
        }

        CheckParallelPairs();
    }

    /// <summary>成对、不嵌套。每条分支在结束前都汇入同一个汇聚。</summary>
    private void CheckParallelPairs()
    {
        foreach (var split in Nodes.Where(e => e.Type == "parallel" && Edges.Count(x => x.From == e.Key) >= 2))
        {
            String? join = null;
            foreach (var edge in Edges.Where(e => e.From == split.Key))
            {
                var found = WalkToJoin(edge.To, split.Key);
                if (join == null) join = found;
                else if (join != found)
                    throw new ApprovalException(4222, "并行分支必须汇入同一个汇聚：" + split.Key);
            }
        }
    }

    private String WalkToJoin(String key, String splitKey)
    {
        var guard = 0;
        while (true)
        {
            if (++guard > 50) throw new ApprovalException(4222, "并行分支过长");
            var node = FindNode(key) ?? throw new ApprovalException(4222, "并行分支指向了不存在的节点");
            if (node.Type == "end") throw new ApprovalException(4222, "并行分支内不能放结束节点");
            if (node.Key == splitKey || (node.Type == "parallel" && Edges.Count(e => e.From == node.Key) >= 2))
                throw new ApprovalException(4222, "不允许嵌套并行");
            if (node.Type == "parallel" && Edges.Count(e => e.To == node.Key) >= 2) return node.Key;
            var next = Edges.Where(e => e.From == key).OrderBy(e => e.Priority).ThenBy(e => e.Sort).FirstOrDefault()
                ?? throw new ApprovalException(4222, "并行分支没有汇聚：" + key);
            key = next.To;
        }
    }

    /// <summary>排他网关按优先级取第一条成立的条件，否则走默认出线。</summary>
    public FlowEdge Choose(String fromKey, String? formJson, Int32 applicantUserId, Int32 applicantDepartmentId)
    {
        var edges = Edges.Where(e => e.From == fromKey).OrderBy(e => e.Priority).ThenBy(e => e.Sort).ThenBy(e => e.Key, StringComparer.Ordinal).ToList();
        foreach (var edge in edges.Where(e => !e.Default && e.Condition != null))
        {
            if (ConditionMatch(edge.Condition!, formJson, applicantUserId, applicantDepartmentId)) return edge;
        }

        return edges.FirstOrDefault(e => e.Default)
            ?? throw new ApprovalException(4222, "排他网关没有可用出线");
    }

    private static Boolean ConditionMatch(FlowCondition condition, String? formJson, Int32 applicantUserId, Int32 applicantDepartmentId)
    {
        if (!condition.Logic.IsNullOrEmpty())
        {
            var items = condition.Items ?? [];
            var hits = items.Select(e => ConditionMatch(e, formJson, applicantUserId, applicantDepartmentId)).ToList();
            return condition.Logic.Equals("or", StringComparison.OrdinalIgnoreCase) ? hits.Any(e => e) : hits.All(e => e);
        }

        JsonNode? left = null;
        if (!condition.Field.IsNullOrEmpty())
        {
            try
            {
                var obj = JsonNode.Parse(formJson.IsNullOrEmpty() ? "{}" : formJson!) as JsonObject;
                if (obj != null && obj.TryGetPropertyValue(condition.Field, out var node)) left = node;
            }
            catch
            {
                return false;
            }
        }
        else if (condition.Var == "applicant.userId") left = applicantUserId;
        else if (condition.Var == "applicant.departmentId") left = applicantDepartmentId;
        else return false;

        if (left == null) return false;
        return Compare(left, condition.Op, condition.Value);
    }

    private static Boolean Compare(JsonNode left, String? op, JsonNode? right)
    {
        var text = (op ?? "eq").Trim().ToLowerInvariant();
        if (text == "in")
        {
            if (right is not JsonArray array) return false;
            return array.Any(item => Same(left, item));
        }

        var ln = AsDecimal(left);
        var rn = AsDecimal(right);
        if (ln != null && rn != null)
        {
            return text switch
            {
                "gt" => ln > rn,
                "ge" => ln >= rn,
                "lt" => ln < rn,
                "le" => ln <= rn,
                "ne" => ln != rn,
                _ => ln == rn,
            };
        }

        var ls = left.ToString();
        var rs = right?.ToString() ?? "";
        return text switch
        {
            "ne" => !String.Equals(ls, rs, StringComparison.Ordinal),
            "gt" or "ge" or "lt" or "le" => false,
            _ => String.Equals(ls, rs, StringComparison.Ordinal),
        };
    }

    private static Boolean Same(JsonNode? left, JsonNode? right)
    {
        if (left == null || right == null) return false;
        var ln = AsDecimal(left);
        var rn = AsDecimal(right);
        return ln != null && rn != null ? ln == rn : String.Equals(left.ToString(), right.ToString(), StringComparison.Ordinal);
    }

    private static Decimal? AsDecimal(JsonNode? node)
    {
        if (node is not JsonValue value) return null;
        if (value.TryGetValue<Decimal>(out var number)) return number;
        if (value.TryGetValue<Int32>(out var integer)) return integer;
        if (value.TryGetValue<Int64>(out var wide)) return wide;
        if (value.TryGetValue<Double>(out var real)) return (Decimal)real;
        return Decimal.TryParse(value.ToString(), out var parsed) ? parsed : null;
    }

    /// <summary>从某节点出发的下一条连线。排他网关用 Choose；其余多条出线取得分最低的一条。</summary>
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

    /// <summary>any、all、sequential。</summary>
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

    /// <summary>排他网关的默认出线。</summary>
    public Boolean Default { get; set; }

    /// <summary>条件优先级，数字小的先判断。</summary>
    public Int32 Priority { get; set; }

    /// <summary>排他条件。默认出线不填。</summary>
    public FlowCondition? Condition { get; set; }
}

/// <summary>条件。logic 为 and/or 时看 items，否则是叶子。</summary>
public sealed class FlowCondition
{
    /// <summary>and 或 or。</summary>
    public String? Logic { get; set; }

    /// <summary>表单字段。</summary>
    public String? Field { get; set; }

    /// <summary>内置变量，如 applicant.departmentId。</summary>
    public String? Var { get; set; }

    /// <summary>eq、ne、gt、ge、lt、le、in。</summary>
    public String? Op { get; set; }

    /// <summary>比较值。</summary>
    public JsonNode? Value { get; set; }

    /// <summary>组合条件的子项。</summary>
    public List<FlowCondition>? Items { get; set; }
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
