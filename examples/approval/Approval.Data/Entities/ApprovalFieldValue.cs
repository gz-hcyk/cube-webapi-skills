using System.ComponentModel;
using System.Runtime.Serialization;
using System.Text.Json.Nodes;
using NewLife;
using XCode;
using XCode.DataAccessLayer;
using Migration = XCode.DataAccessLayer.Migration;

namespace Approval.Data.Entities;

/// <summary>可检索字段的值。按已发布表单版本的 SearchableKeys 维护，查询是包含匹配。</summary>
[Serializable]
[DataObject]
[Description("字段值索引")]
[BindIndex("IU_ApprovalFieldValue_InstanceId_FieldKey", true, "InstanceId,FieldKey")]
[BindIndex("IX_ApprovalFieldValue_FieldKey", false, "FieldKey")]
[BindTable("ApprovalFieldValue", Description = "可检索字段值。按 SearchableKeys 为每个实例维护", ConnName = "Approval", DbType = DatabaseType.None)]
public class ApprovalFieldValue : Entity<ApprovalFieldValue>
{
    private static Int32 _tableReady;

    /// <summary>查询会先于插入。在审批事务外同步建表，避免别的实体做过模型检查后这张表还不存在，也避免建表语句被回滚。</summary>
    public static void EnsureReady()
    {
        if (Volatile.Read(ref _tableReady) == 1) return;
        if (Interlocked.Exchange(ref _tableReady, 1) == 1) return;
        var dal = DAL.Create(Meta.ConnName);
        dal.Db.CreateMetaData().SetTables(Migration.On, [Meta.Table.DataTable]);
    }

    private Int32 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [DataObjectField(true, true, false, 0)]
    [BindColumn("Id", "编号", "")]
    public Int32 Id { get => _Id; set { if (OnPropertyChanging(nameof(Id), value)) { _Id = value; OnPropertyChanged(nameof(Id)); } } }

    private Int64 _InstanceId;
    /// <summary>审批实例</summary>
    [DisplayName("审批实例")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("InstanceId", "审批实例", "")]
    public Int64 InstanceId { get => _InstanceId; set { if (OnPropertyChanging(nameof(InstanceId), value)) { _InstanceId = value; OnPropertyChanged(nameof(InstanceId)); } } }

    private String _FieldKey = "";
    /// <summary>字段键</summary>
    [DisplayName("字段键")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("FieldKey", "字段键", "")]
    public String FieldKey { get => _FieldKey; set { if (OnPropertyChanging(nameof(FieldKey), value)) { _FieldKey = value; OnPropertyChanged(nameof(FieldKey)); } } }

    private String? _FieldValue;
    /// <summary>字段值。字符串原文，最长 200。</summary>
    [DisplayName("字段值")]
    [DataObjectField(false, false, true, 200)]
    [BindColumn("FieldValue", "字段值", "")]
    public String? FieldValue { get => _FieldValue; set { if (OnPropertyChanging(nameof(FieldValue), value)) { _FieldValue = value; OnPropertyChanged(nameof(FieldValue)); } } }

    /// <summary>获取或设置字段值。插入和更新都走这里。</summary>
    public override Object? this[String name]
    {
        get => name switch
        {
            "Id" => _Id,
            "InstanceId" => _InstanceId,
            "FieldKey" => _FieldKey,
            "FieldValue" => _FieldValue,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToInt(); break;
                case "InstanceId": _InstanceId = value.ToLong(); break;
                case "FieldKey": _FieldKey = Convert.ToString(value) ?? ""; break;
                case "FieldValue": _FieldValue = Convert.ToString(value); break;
                default: base[name] = value; break;
            }
        }
    }

    /// <summary>按当前表单值重建这个实例的可检索字段。空值不写入。</summary>
    public static void Rebuild(Int64 instanceId, Int32 formVersionId, String? dataJson)
    {
        if (instanceId <= 0) return;
        EnsureReady();
        Meta.Cache?.Clear("rebuild", true);
        foreach (var row in FindAll().Where(e => e.InstanceId == instanceId).ToList())
            row.Delete();

        var version = formVersionId > 0 ? ApprovalFormVersion.FindById(formVersionId) : null;
        var raw = version?.SearchableKeys;
        if (raw.IsNullOrEmpty()) return;
        var obj = FieldRules.ParseObject(dataJson);
        foreach (var key in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var text = TextOf(obj, key);
            if (text.IsNullOrEmpty()) continue;
            if (text.Length > 200) text = text[..200];
            new ApprovalFieldValue
            {
                InstanceId = instanceId,
                FieldKey = key,
                FieldValue = text,
            }.Insert();
        }
    }

    /// <summary>按字段键做包含匹配。关键字为空时返回 4001。命中多条实例时都返回。</summary>
    public static IList<ApprovalFieldValue> FindMatches(String fieldKey, String keyword)
    {
        if (fieldKey.IsNullOrEmpty() || keyword.IsNullOrEmpty())
            throw new ApprovalException(4001, "请填写字段和关键字");
        EnsureReady();
        Meta.Cache?.Clear("find", true);
        return FindAll()
            .Where(e => String.Equals(e.FieldKey, fieldKey, StringComparison.Ordinal)
                && (e.FieldValue ?? "").Contains(keyword, StringComparison.Ordinal))
            .ToList();
    }

    private static String? TextOf(JsonObject obj, String key)
    {
        if (!obj.TryGetPropertyValue(key, out var node) || node is not JsonValue value) return null;
        if (value.TryGetValue<String>(out var text)) return text;
        if (value.TryGetValue<Boolean>(out var flag)) return flag ? "true" : "false";
        return value.ToJsonString();
    }
}
