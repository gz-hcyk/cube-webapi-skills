using System.ComponentModel;
using Approval.Data;
using Approval.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using NewLife.Cube;
using XCode.Membership;

namespace Approval.Web.Areas.Approval.Controllers;

/// <summary>审批运行。发起、同意、驳回都调用实例上的业务方法。</summary>
[DisplayName("审批运行")]
[Menu(0, false)]
[ApprovalArea]
public class RuntimeController : ControllerBaseX
{
    /// <summary>发起。本人发起与代发起进入同一条已发布流程。</summary>
    [EntityAuthorize((PermissionFlags)16)]
    [DisplayName("发起")]
    [HttpPost]
    public ActionResult Start([FromBody] StartInput input)
    {
        try
        {
            var user = Current();
            var inst = ApprovalInstance.Start(new ApprovalInstance.StartArgs
            {
                ProcessId = input?.ProcessId ?? 0,
                OperatorUserId = user.ID,
                Proxy = input?.Proxy ?? false,
                SubjectUserId = input?.SubjectUserId ?? 0,
                Data = input?.Data,
                RequestId = input?.RequestId,
                ClientIp = UserHost,
            });
            return Json(0, "ok", Describe(inst), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>同意。</summary>
    [EntityAuthorize((PermissionFlags)32)]
    [DisplayName("同意")]
    [HttpPost]
    public ActionResult Agree([FromBody] HandleInput input) => Handle(input, true);

    /// <summary>驳回给发起人。</summary>
    [EntityAuthorize((PermissionFlags)64)]
    [DisplayName("驳回")]
    [HttpPost]
    public ActionResult Reject([FromBody] HandleInput input) => Handle(input, false);

    /// <summary>查看实例、待办和轨迹。</summary>
    [EntityAuthorize((PermissionFlags)128)]
    [DisplayName("查看单据")]
    [HttpGet]
    public ActionResult View(Int64 instanceId)
    {
        try
        {
            _ = Current();
            var inst = ApprovalInstance.FindById(instanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            return Json(0, "ok", Describe(inst), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    private ActionResult Handle(HandleInput? input, Boolean agree)
    {
        try
        {
            var user = Current();
            if (input == null || !Int64.TryParse(input.TaskId, out var taskId) || taskId <= 0)
                throw new ApprovalException(4001, "缺少任务编号");
            var inst = agree
                ? ApprovalInstance.Agree(taskId, user.ID, input.Comment, input.RequestId ?? "", input.InstanceVersion, UserHost)
                : ApprovalInstance.Reject(taskId, user.ID, input.Comment, input.RequestId ?? "", input.InstanceVersion, UserHost);
            return Json(0, "ok", Describe(inst), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    private User Current()
    {
        var id = CurrentUser?.ID ?? 0;
        if (id <= 0) throw new ApprovalException(401, "没有登录或登录超时！");
        return XCode.Membership.User.FindByID(id) ?? throw new ApprovalException(401, "没有登录或登录超时！");
    }

    private static Object Describe(ApprovalInstance inst)
    {
        var tasks = ApprovalTask.FindAll(ApprovalTask._.InstanceId == inst.Id);
        var history = ApprovalHistory.FindAllByInstanceId(inst.Id);
        var form = ApprovalFormData.FindById(inst.Id);
        return new
        {
            instanceId = inst.Id.ToString(),
            no = inst.No,
            title = inst.Title,
            status = (Int32)inst.Status,
            version = inst.Version,
            userId = inst.UserId,
            userName = inst.UserName,
            subjectUserId = inst.SubjectUserId,
            subjectName = inst.SubjectName,
            proxyUserId = inst.ProxyUserId,
            proxyName = inst.ProxyName,
            counselorUserId = inst.CounselorUserId,
            departmentId = inst.DepartmentId,
            formData = form?.Data,
            tasks = tasks.Select(t => new
            {
                id = t.Id.ToString(),
                assigneeId = t.AssigneeId,
                assigneeName = t.AssigneeName,
                nodeKey = t.NodeKey,
                nodeName = t.NodeName,
                status = (Int32)t.Status,
                mode = (Int32)t.Mode,
                title = t.Title,
            }),
            history = history.Select(h => new
            {
                action = h.Action,
                actionName = h.ActionName,
                comment = h.Comment,
                operatorId = h.OperatorId,
                operatorName = h.OperatorName,
                fromStatus = h.FromStatus,
                toStatus = h.ToStatus,
            }),
        };
    }
}
