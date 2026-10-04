using NewLife;
using XCode;

namespace Approval.Data.Entities;

public partial class ApprovalProcessVersion : Entity<ApprovalProcessVersion>
{
    static ApprovalProcessVersion()
    {
        Meta.Interceptors.Add(new UserInterceptor { AllowEmpty = true });
        Meta.Interceptors.Add<TimeInterceptor>();
        Meta.Interceptors.Add(new IPInterceptor { AllowEmpty = true });
    }

    /// <summary>已发布或已归档的流程图不可再改。</summary>
    public override Boolean Valid(DataMethod method)
    {
        if (method == DataMethod.Update && Dirtys[nameof(Definition)] && Status != VersionStatus.Draft)
            throw new ApprovalException(4091, "已发布的流程版本不可修改");
        if (method == DataMethod.Delete) return true;
        if (!HasDirty) return true;
        if (Definition.IsNullOrEmpty()) throw new ArgumentNullException(nameof(Definition), "流程定义不能为空！");
        return base.Valid(method);
    }

    /// <summary>已发布版本不允许删除。</summary>
    public override Int32 Delete()
    {
        if (Status != VersionStatus.Draft)
            throw new ApprovalException(4091, "已发布的流程版本不可删除");
        return base.Delete();
    }
}
