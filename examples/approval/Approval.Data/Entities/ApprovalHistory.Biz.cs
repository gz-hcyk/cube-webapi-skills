using NewLife;
using XCode;

namespace Approval.Data.Entities;

public partial class ApprovalHistory : Entity<ApprovalHistory>
{
    static ApprovalHistory()
    {
        Meta.Table.DataTable.InsertOnly = true;
        Meta.Interceptors.Add<TimeInterceptor>();
        Meta.Interceptors.Add(new IPInterceptor { AllowEmpty = true });
    }

    /// <summary>只追加，不接受修改。</summary>
    public override Boolean Valid(DataMethod method)
    {
        if (method == DataMethod.Update || method == DataMethod.Delete)
            throw new ApprovalException(4091, "审批历史只允许追加");
        if (!HasDirty) return true;
        if (Action.IsNullOrEmpty()) throw new ArgumentNullException(nameof(Action), "动作不能为空！");
        if (ActionName.IsNullOrEmpty()) throw new ArgumentNullException(nameof(ActionName), "动作名称不能为空！");
        if (RequestId.IsNullOrEmpty()) throw new ArgumentNullException(nameof(RequestId), "请求号不能为空！");
        return base.Valid(method);
    }

    /// <summary>禁止更新。</summary>
    public override Int32 Update() => throw new ApprovalException(4091, "审批历史只允许追加");

    /// <summary>禁止删除。</summary>
    public override Int32 Delete() => throw new ApprovalException(4091, "审批历史只允许追加");
}
