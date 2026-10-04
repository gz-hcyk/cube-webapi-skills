using NewLife;
using XCode;

namespace Approval.Data.Entities;

public partial class ApprovalFormVersion : Entity<ApprovalFormVersion>
{
    static ApprovalFormVersion()
    {
        Meta.Interceptors.Add(new UserInterceptor { AllowEmpty = true });
        Meta.Interceptors.Add<TimeInterceptor>();
        Meta.Interceptors.Add(new IPInterceptor { AllowEmpty = true });
    }

    /// <summary>已发布或已归档的结构不可再改。</summary>
    public override Boolean Valid(DataMethod method)
    {
        if (method == DataMethod.Update && Dirtys[nameof(Schema)] && Status != VersionStatus.Draft)
            throw new ApprovalException(4091, "已发布的表单版本不可修改");
        if (method == DataMethod.Delete) return true;
        if (!HasDirty) return true;
        if (Schema.IsNullOrEmpty()) throw new ArgumentNullException(nameof(Schema), "表单结构不能为空！");
        return base.Valid(method);
    }

    /// <summary>已发布版本不允许删除。</summary>
    public override Int32 Delete()
    {
        if (Status != VersionStatus.Draft)
            throw new ApprovalException(4091, "已发布的表单版本不可删除");
        return base.Delete();
    }
}
