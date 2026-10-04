using NewLife;
using XCode;

namespace Approval.Data.Entities;

public partial class ApprovalTransition : Entity<ApprovalTransition>
{
    static ApprovalTransition()
    {
    }

    /// <summary>流程版本离开草稿后，连线不可改。</summary>
    public override Boolean Valid(DataMethod method)
    {
        if (method != DataMethod.Insert) EnsureDraft("已发布的流程连线不可修改");
        if (method == DataMethod.Delete) return true;
        if (!HasDirty) return true;
        if (EdgeKey.IsNullOrEmpty()) throw new ArgumentNullException(nameof(EdgeKey), "连线键不能为空！");
        if (FromKey.IsNullOrEmpty()) throw new ArgumentNullException(nameof(FromKey), "连线起点不能为空！");
        if (ToKey.IsNullOrEmpty()) throw new ArgumentNullException(nameof(ToKey), "连线终点不能为空！");
        return base.Valid(method);
    }

    /// <summary>已发布连线不可删除。</summary>
    public override Int32 Delete()
    {
        EnsureDraft("已发布的流程连线不可删除");
        return base.Delete();
    }

    private void EnsureDraft(String message)
    {
        var version = ApprovalProcessVersion.FindById(ProcessVersionId);
        if (version != null && version.Status != VersionStatus.Draft)
            throw new ApprovalException(4091, message);
    }
}
