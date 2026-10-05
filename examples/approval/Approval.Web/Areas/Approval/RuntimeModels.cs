namespace Approval.Web.Areas.Approval;

/// <summary>发起请求。本人发起不需要学生编号；代发起必须选择学生。</summary>
public class StartInput
{
    /// <summary>已发布流程。</summary>
    public Int32 ProcessId { get; set; }

    /// <summary>true 为代发起。</summary>
    public Boolean Proxy { get; set; }

    /// <summary>业务主体。代发起时必填。</summary>
    public Int32 SubjectUserId { get; set; }

    /// <summary>表单 JSON。学生字段键 studentUserId，辅导员字段键 counselorUserId。</summary>
    public String? Data { get; set; }

    /// <summary>幂等请求号。</summary>
    public String? RequestId { get; set; }

    /// <summary>发起人自选。JSON 对象，键是节点 key，值是用户编号或编号数组。</summary>
    public String? AssigneePicks { get; set; }
}

/// <summary>同意或驳回。任务编号用字符串，避免雪花编号在 JSON 数字里丢精度。</summary>
public class HandleInput
{
    /// <summary>任务编号。</summary>
    public String? TaskId { get; set; }

    /// <summary>意见。驳回必填。</summary>
    public String? Comment { get; set; }

    /// <summary>幂等请求号。</summary>
    public String? RequestId { get; set; }

    /// <summary>实例乐观锁版本。0 表示不校验。</summary>
    public Int32 InstanceVersion { get; set; }

    /// <summary>按当前节点字段权限合并的表单 JSON。空表示不改表单。</summary>
    public String? Data { get; set; }
}

/// <summary>转办。</summary>
public class TransferInput
{
    /// <summary>任务编号。</summary>
    public String? TaskId { get; set; }

    /// <summary>接任人。</summary>
    public Int32 TargetUserId { get; set; }

    /// <summary>意见。</summary>
    public String? Comment { get; set; }

    /// <summary>幂等请求号。</summary>
    public String? RequestId { get; set; }

    /// <summary>实例乐观锁版本。0 表示不校验。</summary>
    public Int32 InstanceVersion { get; set; }
}

/// <summary>撤回后重新提交。仍走原流程版本。</summary>
public class ResubmitInput
{
    /// <summary>实例编号。</summary>
    public String? InstanceId { get; set; }

    /// <summary>表单 JSON。隐藏字段不要带上。</summary>
    public String? Data { get; set; }

    /// <summary>幂等请求号。</summary>
    public String? RequestId { get; set; }

    /// <summary>实例乐观锁版本。0 表示不校验。</summary>
    public Int32 InstanceVersion { get; set; }

    /// <summary>重新提交时改选的办理人。空表示沿用撤回前的选择。</summary>
    public String? AssigneePicks { get; set; }
}

/// <summary>撤回。实例编号用字符串，避免雪花编号在 JSON 数字里丢精度。</summary>
public class WithdrawInput
{
    /// <summary>实例编号。</summary>
    public String? InstanceId { get; set; }

    /// <summary>撤回原因。</summary>
    public String? Reason { get; set; }

    /// <summary>幂等请求号。</summary>
    public String? RequestId { get; set; }

    /// <summary>实例乐观锁版本。0 表示不校验。</summary>
    public Int32 InstanceVersion { get; set; }
}

/// <summary>向后加签一级。</summary>
public class AddSignInput
{
    /// <summary>任务编号。</summary>
    public String? TaskId { get; set; }

    /// <summary>加签对象。</summary>
    public Int32 TargetUserId { get; set; }

    /// <summary>意见。</summary>
    public String? Comment { get; set; }

    /// <summary>幂等请求号。</summary>
    public String? RequestId { get; set; }

    /// <summary>实例乐观锁版本。0 表示不校验。</summary>
    public Int32 InstanceVersion { get; set; }
}

/// <summary>抄送标为已阅。</summary>
public class ReadInput
{
    /// <summary>任务编号。</summary>
    public String? TaskId { get; set; }

    /// <summary>幂等请求号。</summary>
    public String? RequestId { get; set; }
}

/// <summary>保存表单或流程草稿。</summary>
public class DesignInput
{
    /// <summary>定义编号。</summary>
    public Int32 Id { get; set; }

    /// <summary>表单结构或流程定义 JSON。</summary>
    public String? Content { get; set; }
}

/// <summary>发布请求。</summary>
public class IdInput
{
    /// <summary>定义编号。</summary>
    public Int32 Id { get; set; }
}
