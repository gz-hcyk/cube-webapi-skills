using System.ComponentModel;
using Approval.Data;
using Approval.Data.Entities;
using Approval.Web.Areas.Approval;
using Microsoft.AspNetCore.Mvc;
using NewLife.Cube;
using XCode.Membership;

namespace Approval.Web.Areas.ApprovalAdmin.Controllers;

/// <summary>流程定义。</summary>
[DisplayName("流程定义")]
[Menu(20, true, Icon = "fa-random")]
[ApprovalAdminArea]
public class ProcessController : EntityController<ApprovalProcess>
{
    static ProcessController()
    {
        ListFields.RemoveCreateField().RemoveUpdateField();
    }

    /// <summary>按模型做必填校验。</summary>
    protected override Boolean EnableFieldValidation => true;

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
}
