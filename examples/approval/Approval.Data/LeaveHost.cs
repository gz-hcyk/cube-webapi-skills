using System.Text.Json;
using Approval.Data.Entities;
using NewLife;

namespace Approval.Data;

/// <summary>
/// 请假业务宿主。发起审批，并在同意、驳回、撤回、重新提交后把实例状态抄回请假单。
/// 学生只是魔方用户编号，不建学籍、班级或辅导员档案。
/// </summary>
public static class LeaveHost
{
    /// <summary>提交请假并启动已发布流程。</summary>
    public static LeaveRequest Submit(LeaveSubmit args)
    {
        if (args.RequestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        var studentId = args.Proxy ? args.SubjectUserId : args.OperatorUserId;
        var data = args.Data;
        if (data.IsNullOrEmpty())
            data = "{\"studentUserId\":" + studentId + ",\"reason\":" + JsonSerializer.Serialize(args.Reason ?? "") + "}";

        var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
        {
            ProcessId = args.ProcessId,
            OperatorUserId = args.OperatorUserId,
            Proxy = args.Proxy,
            SubjectUserId = args.Proxy ? args.SubjectUserId : 0,
            Data = data,
            RequestId = args.RequestId,
            ClientIp = args.ClientIp,
            AssigneePicks = args.AssigneePicks,
        });

        var existing = LeaveRequest.FindByApprovalInstanceId(inst.Id);
        if (existing != null) return existing;

        var row = new LeaveRequest
        {
            StudentId = inst.SubjectUserId,
            ApprovalInstanceId = inst.Id,
            Status = (Int32)inst.Status,
            Reason = args.Reason,
        };
        row.Insert();
        return row;
    }

    /// <summary>把审批实例的状态写回请假单。没有对应请假单时什么都不做。</summary>
    public static void Sync(Int64 instanceId)
    {
        if (instanceId <= 0) return;
        var row = LeaveRequest.FindByApprovalInstanceId(instanceId);
        if (row == null) return;
        var inst = ApprovalInstance.FindById(instanceId);
        if (inst == null) return;
        if (row.Status == (Int32)inst.Status) return;
        row.Status = (Int32)inst.Status;
        row.Update();
    }
}

/// <summary>请假提交参数。</summary>
public sealed class LeaveSubmit
{
    /// <summary>已发布流程。</summary>
    public Int32 ProcessId { get; set; }

    /// <summary>当前操作者。代发起时是代发人。</summary>
    public Int32 OperatorUserId { get; set; }

    /// <summary>是否代发起。</summary>
    public Boolean Proxy { get; set; }

    /// <summary>代发起时的学生。</summary>
    public Int32 SubjectUserId { get; set; }

    /// <summary>事由。写入请假单，并在未给 <see cref="Data"/> 时放进表单。</summary>
    public String? Reason { get; set; }

    /// <summary>表单 JSON。为空时按学生和事由拼一份。</summary>
    public String? Data { get; set; }

    /// <summary>请求号。</summary>
    public String RequestId { get; set; } = "";

    /// <summary>客户端地址。</summary>
    public String? ClientIp { get; set; }

    /// <summary>发起人自选。交给审批发起，请假单本身不保存这份名单。</summary>
    public String? AssigneePicks { get; set; }
}
