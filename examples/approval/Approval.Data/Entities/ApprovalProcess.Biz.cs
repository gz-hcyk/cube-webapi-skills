using System.Text.Json;
using NewLife;
using XCode;
using XCode.Membership;

namespace Approval.Data.Entities;

public partial class ApprovalProcess : Entity<ApprovalProcess>
{
    static ApprovalProcess()
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

    /// <summary>保存流程草稿。节点和连线仍在 JSON 里，发布时才落成实体。</summary>
    public ApprovalProcessVersion SaveDraft(String definition)
    {
        var graph = FlowGraph.Parse(definition);
        graph.Validate();
        var json = JsonSerializer.Serialize(graph, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });
        var draft = ApprovalProcessVersion.FindByProcessIdAndVersion(Id, 0);
        if (draft == null)
        {
            draft = new ApprovalProcessVersion
            {
                ProcessId = Id,
                Version = 0,
                Status = VersionStatus.Draft,
                Definition = json,
                NodeCount = graph.Nodes.Count,
                FormVersionId = 0,
            };
            draft.Insert();
            return draft;
        }

        if (draft.Status != VersionStatus.Draft)
            throw new ApprovalException(4091, "当前流程草稿不可修改");
        draft.Definition = json;
        draft.NodeCount = graph.Nodes.Count;
        draft.Update();
        return draft;
    }

    /// <summary>发布草稿：绑定已发布表单版本，写入不可变节点和连线。</summary>
    public ApprovalProcessVersion Publish(Int32 userId)
    {
        var draft = ApprovalProcessVersion.FindByProcessIdAndVersion(Id, 0)
            ?? throw new ApprovalException(4222, "没有可发布的流程草稿");
        var graph = FlowGraph.Parse(draft.Definition);
        graph.Validate();
        var form = ApprovalFormDefinition.FindById(FormId)
            ?? throw new ApprovalException(4222, "流程没有绑定表单");
        if (form.PublishedVersionId <= 0)
            throw new ApprovalException(4222, "绑定的表单尚未发布");
        var formVersion = ApprovalFormVersion.FindById(form.PublishedVersionId)
            ?? throw new ApprovalException(4222, "找不到已发布的表单版本");
        if (formVersion.Status != VersionStatus.Published)
            throw new ApprovalException(4222, "绑定的表单版本不是已发布状态");

        var next = ApprovalProcessVersion.FindAllByProcessId(Id).Max(e => e.Version) + 1;
        if (next < 1) next = 1;
        var publisher = User.FindByID(userId);

        if (PublishedVersionId > 0)
        {
            var old = ApprovalProcessVersion.FindById(PublishedVersionId);
            if (old != null && old.Status == VersionStatus.Published)
            {
                old.Status = VersionStatus.Archived;
                old.Update();
            }
        }

        ReplaceGraph(draft.Id, graph);

        draft.Version = next;
        draft.Status = VersionStatus.Published;
        draft.FormVersionId = formVersion.Id;
        draft.NodeCount = graph.Nodes.Count;
        draft.PublishTime = DateTime.Now;
        draft.PublishUserId = userId;
        draft.PublishUser = publisher?.DisplayName.IsNullOrEmpty() == false ? publisher.DisplayName : publisher?.Name;
        draft.Update();

        PublishedVersionId = draft.Id;
        PublishedVersion = next;
        Update();
        return draft;
    }

    private static void ReplaceGraph(Int32 versionId, FlowGraph graph)
    {
        foreach (var row in ApprovalNode.FindAllByProcessVersionId(versionId))
            row.Delete();
        foreach (var row in ApprovalTransition.FindAllByProcessVersionId(versionId))
            row.Delete();

        var sort = 0;
        foreach (var node in graph.Nodes)
        {
            sort++;
            var row = new ApprovalNode
            {
                ProcessVersionId = versionId,
                NodeKey = node.Key,
                Name = node.Name,
                NodeType = node.Type,
                ApproveMode = node.Type == "approve" ? node.ApproveMode : ApproveMode.None,
                AssigneeType = node.Type == "approve" ? node.Assignee?.Type : null,
                AssigneeJson = node.Assignee == null ? null : JsonSerializer.Serialize(node.Assignee, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                }),
                Sort = sort,
            };
            row.Insert();
        }

        sort = 0;
        foreach (var edge in graph.Edges)
        {
            sort++;
            new ApprovalTransition
            {
                ProcessVersionId = versionId,
                EdgeKey = edge.Key,
                FromKey = edge.From,
                ToKey = edge.To,
                Sort = edge.Sort == 0 ? sort : edge.Sort,
            }.Insert();
        }
    }
}
