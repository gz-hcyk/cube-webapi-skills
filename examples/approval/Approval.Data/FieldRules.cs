using System.Text.Json.Nodes;
using Approval.Data.Entities;
using NewLife;

namespace Approval.Data;

/// <summary>按节点强制表单字段可编辑、只读或隐藏。</summary>
public static class FieldRules
{
    /// <summary>节点上的字段权限。没写的字段按可编辑。</summary>
    public static Dictionary<String, String> ForNode(FlowGraph graph, String? nodeKey)
    {
        var map = new Dictionary<String, String>(StringComparer.Ordinal);
        var node = nodeKey.IsNullOrEmpty() ? null : graph.FindNode(nodeKey!);
        if (node == null) return map;
        foreach (var field in node.Fields)
        {
            if (!field.Key.IsNullOrEmpty()) map[field.Key] = field.Access;
        }

        return map;
    }

    /// <summary>给界面用的字段清单。隐藏字段也返回，由调用方不展示。</summary>
    public static IList<FieldView> Views(String? schema, FlowNode? node)
    {
        var rules = new Dictionary<String, String>(StringComparer.Ordinal);
        if (node != null)
        {
            foreach (var field in node.Fields)
            {
                if (!field.Key.IsNullOrEmpty()) rules[field.Key] = field.Access;
            }
        }

        return FormSchema.Labels(schema).Select(field => new FieldView
        {
            Key = field.Key,
            Label = field.Label,
            Access = rules.TryGetValue(field.Key, out var access) ? access : "editable",
        }).ToList();
    }

    /// <summary>解析表单对象。空串当成空对象。</summary>
    public static JsonObject ParseObject(String? data)
    {
        try
        {
            return JsonNode.Parse(data.IsNullOrEmpty() ? "{}" : data!) as JsonObject
                ?? throw new ApprovalException(4001, "表单值必须是对象");
        }
        catch (ApprovalException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ApprovalException(4001, "表单值无法解析：" + ex.Message);
        }
    }

    /// <summary>发起时：隐藏字段不能出现，未知字段拒绝。只读字段除学生外不能由客户端写入。</summary>
    public static void GuardStart(JsonObject posted, IReadOnlyDictionary<String, String> rules, ISet<String> schemaKeys)
    {
        foreach (var key in posted.Select(e => e.Key).ToList())
        {
            if (!schemaKeys.Contains(key))
                throw new ApprovalException(4221, "表单没有这个字段：" + key);
            var access = AccessOf(rules, key);
            if (access == "hidden")
                throw new ApprovalException(4221, "隐藏字段不可提交：" + key);
            if (access == "readonly" && key != "studentUserId")
                throw new ApprovalException(4221, "只读字段不可修改：" + key);
        }
    }

    /// <summary>
    /// 同意或驳回时合并可编辑字段。只读值必须和当前值相同，隐藏字段不能出现。
    /// 学生字段即使标成可编辑，也不能改成另一个人。
    /// </summary>
    public static JsonObject Merge(JsonObject current, JsonObject? posted, IReadOnlyDictionary<String, String> rules, ISet<String> schemaKeys, Int32 subjectUserId)
    {
        if (posted == null || posted.Count == 0) return current;
        foreach (var item in posted)
        {
            if (!schemaKeys.Contains(item.Key))
                throw new ApprovalException(4221, "表单没有这个字段：" + item.Key);
            var access = AccessOf(rules, item.Key);
            if (access == "hidden")
                throw new ApprovalException(4221, "隐藏字段不可提交：" + item.Key);
            if (access == "readonly")
            {
                if (!Same(current, item.Key, item.Value))
                    throw new ApprovalException(4221, "只读字段不可修改：" + item.Key);
                continue;
            }

            current[item.Key] = item.Value == null ? null : JsonNode.Parse(item.Value.ToJsonString());
        }

        if (ReadInt(current, "studentUserId") != subjectUserId)
            throw new ApprovalException(4221, "学生字段必须与业务主体一致");
        return current;
    }

    private static String AccessOf(IReadOnlyDictionary<String, String> rules, String key) =>
        rules.TryGetValue(key, out var access) ? access : "editable";

    private static Boolean Same(JsonObject current, String key, JsonNode? posted)
    {
        current.TryGetPropertyValue(key, out var old);
        if (old == null && posted == null) return true;
        if (old == null || posted == null) return false;
        return old.ToJsonString() == posted.ToJsonString();
    }

    private static Int32 ReadInt(JsonObject obj, String key)
    {
        if (!obj.TryGetPropertyValue(key, out var node) || node == null) return 0;
        if (node is JsonValue value)
        {
            if (value.TryGetValue<Int32>(out var number)) return number;
            if (value.TryGetValue<Int64>(out var wide)) return (Int32)wide;
            if (Int32.TryParse(value.ToString(), out var parsed)) return parsed;
        }

        return Int32.TryParse(node.ToString(), out var text) ? text : 0;
    }
}

/// <summary>一个字段在某个节点上的展示。</summary>
public sealed class FieldView
{
    /// <summary>字段键。</summary>
    public String Key { get; set; } = "";

    /// <summary>显示名。</summary>
    public String Label { get; set; } = "";

    /// <summary>editable、readonly 或 hidden。</summary>
    public String Access { get; set; } = "editable";
}
