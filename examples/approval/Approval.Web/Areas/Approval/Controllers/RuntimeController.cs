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

    /// <summary>转办给另一名魔方用户。</summary>
    [EntityAuthorize((PermissionFlags)256)]
    [DisplayName("转办")]
    [HttpPost]
    public ActionResult Transfer([FromBody] TransferInput input)
    {
        try
        {
            var user = Current();
            if (input == null || !Int64.TryParse(input.TaskId, out var taskId) || taskId <= 0)
                throw new ApprovalException(4001, "缺少任务编号");
            var inst = ApprovalInstance.Transfer(taskId, user.ID, input.TargetUserId, input.Comment, input.RequestId ?? "", input.InstanceVersion, UserHost);
            return Json(0, "ok", Describe(inst), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>发起人撤回。代发起时发起人是代发人。</summary>
    [EntityAuthorize((PermissionFlags)512)]
    [DisplayName("撤回")]
    [HttpPost]
    public ActionResult Withdraw([FromBody] WithdrawInput input)
    {
        try
        {
            var user = Current();
            if (input == null || !Int64.TryParse(input.InstanceId, out var instanceId) || instanceId <= 0)
                throw new ApprovalException(4001, "缺少实例编号");
            var inst = ApprovalInstance.Withdraw(instanceId, user.ID, input.Reason, input.RequestId ?? "", input.InstanceVersion, UserHost);
            return Json(0, "ok", Describe(inst), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>向后加签一级。</summary>
    [EntityAuthorize((PermissionFlags)8192)]
    [DisplayName("加签")]
    [HttpPost]
    public ActionResult AddSign([FromBody] AddSignInput input)
    {
        try
        {
            var user = Current();
            if (input == null || !Int64.TryParse(input.TaskId, out var taskId) || taskId <= 0)
                throw new ApprovalException(4001, "缺少任务编号");
            var inst = ApprovalInstance.AddSign(taskId, user.ID, input.TargetUserId, input.Comment, input.RequestId ?? "", input.InstanceVersion, UserHost);
            return Json(0, "ok", Describe(inst), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>抄送标为已阅。</summary>
    [EntityAuthorize((PermissionFlags)4096)]
    [DisplayName("已阅")]
    [HttpPost]
    public ActionResult Read([FromBody] ReadInput input)
    {
        try
        {
            var user = Current();
            if (input == null || !Int64.TryParse(input.TaskId, out var taskId) || taskId <= 0)
                throw new ApprovalException(4001, "缺少任务编号");
            var inst = ApprovalInstance.Read(taskId, user.ID, input.RequestId ?? "", UserHost);
            return Json(0, "ok", Describe(inst), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>流程监控。按当前用户的数据范围过滤，不改变待办的办理人过滤。</summary>
    [EntityAuthorize((PermissionFlags)16384)]
    [DisplayName("监控")]
    [HttpGet]
    public ActionResult Monitor()
    {
        try
        {
            var user = Current();
            return Json(0, "ok", ApprovalInstance.Monitor(user).Select(inst => new
            {
                instanceId = inst.Id.ToString(),
                no = inst.No,
                title = inst.Title,
                status = (Int32)inst.Status,
                userId = inst.UserId,
                departmentId = inst.DepartmentId,
            }), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>当前用户的待办。</summary>
    [EntityAuthorize((PermissionFlags)1024)]
    [DisplayName("待办")]
    [HttpGet]
    public ActionResult Inbox()
    {
        try
        {
            var user = Current();
            return Json(0, "ok", ApprovalTask.Inbox(user.ID).Select(DescribeTask), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

    /// <summary>当前用户的已办。</summary>
    [EntityAuthorize((PermissionFlags)2048)]
    [DisplayName("已办")]
    [HttpGet]
    public ActionResult Done()
    {
        try
        {
            var user = Current();
            return Json(0, "ok", ApprovalTask.Done(user.ID).Select(DescribeTask), null);
        }
        catch (ApprovalException ex)
        {
            return Json(ex.Code, ex.Message, null, null);
        }
    }

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
            tasks = tasks.Select(DescribeTask),
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

    private static Object DescribeTask(ApprovalTask t) => new
    {
        id = t.Id.ToString(),
        instanceId = t.InstanceId.ToString(),
        assigneeId = t.AssigneeId,
        assigneeName = t.AssigneeName,
        nodeKey = t.NodeKey,
        nodeName = t.NodeName,
        status = (Int32)t.Status,
        mode = (Int32)t.Mode,
        title = t.Title,
        kind = (Int32)t.Kind,
        seq = t.Seq,
        source = (Int32)t.Source,
    };
}
