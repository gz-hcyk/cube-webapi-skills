using System.ComponentModel;
using Approval.Data;
using Approval.Data.Entities;
using Approval.Web.Areas.Approval;
using Microsoft.AspNetCore.Mvc;
using NewLife;
using NewLife.Cube;
using NewLife.Cube.ViewModels;
using XCode.Configuration;
using XCode.Membership;
using static Approval.Data.Entities.ApprovalFormDefinition;

namespace Approval.Web.Areas.ApprovalAdmin.Controllers;

/// <summary>表单定义。</summary>
[DisplayName("表单定义")]
[Menu(30, true, Icon = "edit")]
[ApprovalAdminArea]
public class FormDefinitionController : EntityController<ApprovalFormDefinition>
{
    static FormDefinitionController()
    {
        ListFields.RemoveCreateField().RemoveUpdateField();
    }

    /// <summary>按模型做必填校验。</summary>
    protected override Boolean EnableFieldValidation => true;

    /// <summary>读取草稿结构。没有草稿时退回已发布结构，供设计页展示字段。</summary>
    [EntityAuthorize(PermissionFlags.Detail)]
    [DisplayName("读取设计")]
    [HttpGet]
    public ActionResult Design(Int32 id)
    {
        try
        {
            var form = ApprovalFormDefinition.FindById(id)
                ?? throw new ApprovalException(4041, "表单不存在");
            var draft = ApprovalFormVersion.FindByFormIdAndVersion(form.Id, 0);
            var published = form.PublishedVersionId > 0 ? ApprovalFormVersion.FindById(form.PublishedVersionId) : null;
            var schema = draft?.Schema;
            if (schema.IsNullOrEmpty()) schema = published?.Schema;
            if (schema.IsNullOrEmpty()) schema = """{"fields":[]}""";
            return Json(0, "ok", new
            {
                id = form.Id,
                code = form.Code,
                name = form.Name,
                schema,
                publishedVersion = form.PublishedVersion,
                status = (Int32)(draft?.Status ?? published?.Status ?? VersionStatus.Draft),
            }, null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>保存草稿结构。</summary>
    [EntityAuthorize((PermissionFlags)32)]
    [DisplayName("保存设计")]
    [HttpPost]
    public ActionResult SaveDesign([FromBody] DesignInput input)
    {
        try
        {
            var form = ApprovalFormDefinition.FindById(input?.Id ?? 0)
                ?? throw new ApprovalException(4041, "表单不存在");
            var draft = form.SaveDraft(input?.Content ?? "");
            return Json(0, "ok", new { id = draft.Id, version = draft.Version, status = (Int32)draft.Status }, null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>发布为不可变版本。</summary>
    [EntityAuthorize((PermissionFlags)16)]
    [DisplayName("发布")]
    [HttpPost]
    public ActionResult Publish([FromBody] IdInput input)
    {
        try
        {
            var userId = CurrentUser?.ID ?? 0;
            var form = ApprovalFormDefinition.FindById(input?.Id ?? 0)
                ?? throw new ApprovalException(4041, "表单不存在");
            var version = form.Publish(userId);
            return Json(0, "ok", new { id = version.Id, version = version.Version, status = (Int32)version.Status }, null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }
}
