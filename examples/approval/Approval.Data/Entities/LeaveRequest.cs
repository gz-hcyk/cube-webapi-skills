using System.ComponentModel;
using System.Runtime.Serialization;
using NewLife;
using XCode;
using XCode.DataAccessLayer;

namespace Approval.Data.Entities;

/// <summary>请假宿主。学生只记魔方用户编号，审批结果回写到状态。</summary>
[Serializable]
[DataObject]
[Description("请假单")]
[BindIndex("IU_LeaveRequest_ApprovalInstanceId", true, "ApprovalInstanceId")]
[BindIndex("IX_LeaveRequest_StudentId", false, "StudentId")]
[BindTable("LeaveRequest", Description = "请假宿主。只记学生用户编号和审批实例", ConnName = "Approval", DbType = DatabaseType.None)]
public class LeaveRequest : Entity<LeaveRequest>
{
    private Int32 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [DataObjectField(true, true, false, 0)]
    [BindColumn("Id", "编号", "")]
    public Int32 Id { get => _Id; set { if (OnPropertyChanging(nameof(Id), value)) { _Id = value; OnPropertyChanged(nameof(Id)); } } }

    private Int32 _StudentId;
    /// <summary>学生。魔方用户编号，不是学籍主键。</summary>
    [DisplayName("学生")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("StudentId", "学生。魔方用户编号", "")]
    public Int32 StudentId { get => _StudentId; set { if (OnPropertyChanging(nameof(StudentId), value)) { _StudentId = value; OnPropertyChanged(nameof(StudentId)); } } }

    private Int64 _ApprovalInstanceId;
    /// <summary>审批实例</summary>
    [DisplayName("审批实例")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ApprovalInstanceId", "审批实例", "")]
    public Int64 ApprovalInstanceId { get => _ApprovalInstanceId; set { if (OnPropertyChanging(nameof(ApprovalInstanceId), value)) { _ApprovalInstanceId = value; OnPropertyChanged(nameof(ApprovalInstanceId)); } } }

    private Int32 _Status;
    /// <summary>状态。与审批实例状态使用同一套数值。</summary>
    [DisplayName("状态")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Status", "状态。与审批实例状态相同", "")]
    public Int32 Status { get => _Status; set { if (OnPropertyChanging(nameof(Status), value)) { _Status = value; OnPropertyChanged(nameof(Status)); } } }

    private String? _Reason;
    /// <summary>事由</summary>
    [DisplayName("事由")]
    [DataObjectField(false, false, true, 200)]
    [BindColumn("Reason", "事由", "")]
    public String? Reason { get => _Reason; set { if (OnPropertyChanging(nameof(Reason), value)) { _Reason = value; OnPropertyChanged(nameof(Reason)); } } }

    /// <summary>获取或设置字段值。插入和更新都走这里。</summary>
    public override Object? this[String name]
    {
        get => name switch
        {
            "Id" => _Id,
            "StudentId" => _StudentId,
            "ApprovalInstanceId" => _ApprovalInstanceId,
            "Status" => _Status,
            "Reason" => _Reason,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToInt(); break;
                case "StudentId": _StudentId = value.ToInt(); break;
                case "ApprovalInstanceId": _ApprovalInstanceId = value.ToLong(); break;
                case "Status": _Status = value.ToInt(); break;
                case "Reason": _Reason = Convert.ToString(value); break;
                default: base[name] = value; break;
            }
        }
    }

    /// <summary>按审批实例查找。请假单很少，查询前丢掉全表缓存。</summary>
    public static LeaveRequest? FindByApprovalInstanceId(Int64 instanceId)
    {
        if (instanceId <= 0) return null;
        Meta.Cache?.Clear("find", true);
        return FindAll().FirstOrDefault(e => e.ApprovalInstanceId == instanceId);
    }
}
