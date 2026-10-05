using System.ComponentModel;
using Approval.Data;
using Approval.Data.Entities;
using Approval.Web.Areas.Approval;
using Microsoft.AspNetCore.Mvc;
using NewLife;
using NewLife.Cube;
using XCode.Membership;

namespace Approval.Web.Areas.ApprovalAdmin.Controllers;

/// <summary>流程定义。</summary>
[DisplayName("流程定义")]
[Menu(20, true, Icon = "share")]
[ApprovalAdminArea]
public class ProcessController : EntityController<ApprovalProcess>
{
    static ProcessController()
    {
        ListFields.RemoveCreateField().RemoveUpdateField();
    }

    /// <summary>按模型做必填校验。</summary>
    protected override Boolean EnableFieldValidation => true;

    /// <summary>读取可编辑的流程草稿。没有草稿时用已发布定义。保存和发布走 SaveDesign、Publish。</summary>
    [EntityAuthorize(PermissionFlags.Detail)]
    [DisplayName("读取设计")]
    [HttpGet]
    public ActionResult Design(Int32 id)
    {
        try
        {
            var process = ApprovalProcess.FindById(id)
                ?? throw new ApprovalException(4041, "流程不存在");
            var draft = ApprovalProcessVersion.FindByProcessIdAndVersion(process.Id, 0);
            var published = process.PublishedVersionId > 0
                ? ApprovalProcessVersion.FindById(process.PublishedVersionId)
                : null;
            var version = draft ?? published;
            var definition = version == null || version.Definition.IsNullOrEmpty()
                ? """{"nodes":[],"edges":[]}"""
                : version.Definition;
            var graph = FlowGraph.Parse(definition);
            var form = ApprovalFormDefinition.FindById(process.FormId);
            var schema = form != null && form.PublishedVersionId > 0
                ? ApprovalFormVersion.FindById(form.PublishedVersionId)?.Schema
                : null;
            return Json(0, "ok", new
            {
                id = process.Id,
                code = process.Code,
                name = process.Name,
                readOnly = false,
                publishedVersion = process.PublishedVersion,
                definition,
                formFields = FormSchema.Labels(schema).Select(field => new { key = field.Key, label = field.Label }),
                users = XCode.Membership.User.FindAll().Where(user => user != null && user.Enable).Select(user => new
                {
                    id = user.ID,
                    name = user.DisplayName.IsNullOrEmpty() ? user.Name : user.DisplayName,
                }),
                roles = Role.FindAll().Select(role => new { id = role.ID, name = role.Name }),
                departments = Department.FindAll().Where(dept => dept.Enable).Select(dept => new { id = dept.ID, name = dept.Name }),
                nodes = graph.Nodes.Select(node => new
                {
                    key = node.Key,
                    name = node.Name,
                    type = node.Type,
                    typeLabel = TypeLabel(node.Type),
                    mode = node.Mode,
                    modeLabel = ModeLabel(node.Type, node.Mode),
                    assigneeType = node.Assignee?.Type,
                    assigneeLabel = AssigneeLabel(node.Assignee),
                    fields = node.Fields.Select(field => new
                    {
                        key = field.Key,
                        access = field.Access,
                        accessLabel = AccessLabel(field.Access),
                    }),
                }),
            }, null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>保存流程草稿。</summary>
    [EntityAuthorize((PermissionFlags)32)]
    [DisplayName("保存设计")]
    [HttpPost]
    public ActionResult SaveDesign([FromBody] DesignInput input)
    {
        try
        {
            var process = ApprovalProcess.FindById(input?.Id ?? 0)
                ?? throw new ApprovalException(4041, "流程不存在");
            var draft = process.SaveDraft(input?.Content ?? "");
            return Json(0, "ok", new { id = draft.Id, version = draft.Version, status = (Int32)draft.Status }, null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>发布为不可变版本，并固化节点和连线。</summary>
    [EntityAuthorize((PermissionFlags)16)]
    [DisplayName("发布")]
    [HttpPost]
    public ActionResult Publish([FromBody] IdInput input)
    {
        try
        {
            var userId = CurrentUser?.ID ?? 0;
            var process = ApprovalProcess.FindById(input?.Id ?? 0)
                ?? throw new ApprovalException(4041, "流程不存在");
            var version = process.Publish(userId);
            return Json(0, "ok", new { id = version.Id, version = version.Version, status = (Int32)version.Status }, null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    private static String TypeLabel(String? type) => (type ?? "").ToLowerInvariant() switch
    {
        "start" => "开始",
        "approve" => "审批",
        "cc" => "抄送",
        "exclusive" => "排他网关",
        "parallel" => "并行网关",
        "end" => "结束",
        _ => type ?? "",
    };

    private static String ModeLabel(String? type, String? mode)
    {
        if (!String.Equals(type, "approve", StringComparison.OrdinalIgnoreCase)) return "";
        return FlowGraph.ParseMode(mode) switch
        {
            ApproveMode.All => "会签",
            ApproveMode.Sequential => "依次审批",
            _ => "或签",
        };
    }

    private static String AccessLabel(String? access) => (access ?? "").ToLowerInvariant() switch
    {
        "editable" => "可编辑",
        "readonly" => "只读",
        "hidden" => "隐藏",
        _ => access ?? "",
    };

    private static String AssigneeLabel(FlowAssignee? assignee)
    {
        var kind = assignee?.Type?.Trim() ?? "";
        return kind switch
        {
            "user" => "指定成员",
            "role" => "指定角色",
            "deptManager" => "部门负责人",
            "applicant" => "相对申请人",
            "deptMember" => "指定部门成员",
            "starterPick" => "发起人自选",
            "formContact" => "表单内联系人",
            "roleDept" => "角色与部门交集",
            "subjectCounselor" => "该生辅导员",
            "" => "",
            _ => kind,
        };
    }
}
