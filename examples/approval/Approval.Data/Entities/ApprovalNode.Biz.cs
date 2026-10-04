using NewLife;
using XCode;

namespace Approval.Data.Entities;

public partial class ApprovalNode : Entity<ApprovalNode>
{
    static ApprovalNode()
    {
    }

    /// <summary>流程版本离开草稿后，节点不可改、不可删。</summary>
    public override Boolean Valid(DataMethod method)
    {
        if (method != DataMethod.Insert) EnsureDraft("已发布的流程节点不可修改");
        if (method == DataMethod.Delete) return true;
        if (!HasDirty) return true;
        if (NodeKey.IsNullOrEmpty()) throw new ArgumentNullException(nameof(NodeKey), "节点键不能为空！");
        if (Name.IsNullOrEmpty()) throw new ArgumentNullException(nameof(Name), "节点名称不能为空！");
        return base.Valid(method);
    }

    /// <summary>已发布节点不可删除。</summary>
    public override Int32 Delete()
    {
        EnsureDraft("已发布的流程节点不可删除");
        return base.Delete();
    }

    private void EnsureDraft(String message)
    {
        var version = ApprovalProcessVersion.FindById(ProcessVersionId);
        if (version != null && version.Status != VersionStatus.Draft)
            throw new ApprovalException(4091, message);
    }
}
