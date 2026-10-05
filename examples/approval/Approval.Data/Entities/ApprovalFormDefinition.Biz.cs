using Approval.Data;
using NewLife;
using XCode;
using XCode.Membership;

namespace Approval.Data.Entities;

public partial class ApprovalFormDefinition : Entity<ApprovalFormDefinition>
{
    static ApprovalFormDefinition()
    {
        Meta.Interceptors.Add(new UserInterceptor { AllowEmpty = true });
        Meta.Interceptors.Add<TimeInterceptor>();
        Meta.Interceptors.Add(new IPInterceptor { AllowEmpty = true });
    }

    /// <summary>验证数据。</summary>
    public override Boolean Valid(DataMethod method)
    {
        if (method == DataMethod.Delete) return true;
        if (!HasDirty) return true;
        if (Code.IsNullOrEmpty()) throw new ArgumentNullException(nameof(Code), "编码不能为空！");
        if (Name.IsNullOrEmpty()) throw new ArgumentNullException(nameof(Name), "名称不能为空！");
        return base.Valid(method);
    }

    /// <summary>保存草稿结构。同一表单只有一个版本号为 0 的草稿。</summary>
    public ApprovalFormVersion SaveDraft(String schema)
    {
        var count = FormSchema.Check(schema);
        var draft = ApprovalFormVersion.FindByFormIdAndVersion(Id, 0);
        if (draft == null)
        {
            draft = new ApprovalFormVersion
            {
                FormId = Id,
                Version = 0,
                Status = VersionStatus.Draft,
                Schema = schema,
                FieldCount = count,
            };
            draft.Insert();
            return draft;
        }

        if (draft.Status != VersionStatus.Draft)
            throw new ApprovalException(4091, "当前草稿不可修改");
        draft.Schema = schema;
        draft.FieldCount = count;
        draft.Update();
        return draft;
    }

    /// <summary>把草稿发布成不可变版本，并归档上一份已发布版本。</summary>
    public ApprovalFormVersion Publish(Int32 userId)
    {
        var draft = ApprovalFormVersion.FindByFormIdAndVersion(Id, 0)
            ?? throw new ApprovalException(4222, "没有可发布的表单草稿");
        var count = FormSchema.Check(draft.Schema);
        var next = ApprovalFormVersion.FindAllByFormId(Id).Max(e => e.Version) + 1;
        if (next < 1) next = 1;
        var publisher = User.FindByID(userId);

        if (PublishedVersionId > 0)
        {
            var old = ApprovalFormVersion.FindById(PublishedVersionId);
            if (old != null && old.Status == VersionStatus.Published)
            {
                old.Status = VersionStatus.Archived;
                old.Update();
            }
        }

        draft.Version = next;
        draft.Status = VersionStatus.Published;
        draft.FieldCount = count;
        draft.SearchableKeys = FormSchema.SearchableKeys(draft.Schema);
        draft.PublishTime = DateTime.Now;
        draft.PublishUserId = userId;
        draft.PublishUser = publisher?.DisplayName.IsNullOrEmpty() == false ? publisher.DisplayName : publisher?.Name;
        draft.Update();

        PublishedVersionId = draft.Id;
        PublishedVersion = next;
        Update();
        return draft;
    }
}
