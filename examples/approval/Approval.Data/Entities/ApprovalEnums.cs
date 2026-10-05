using System.ComponentModel;

namespace Approval.Data.Entities;

/// <summary>版本状态。</summary>
public enum VersionStatus
{
    /// <summary>草稿。</summary>
    [Description("草稿")]
    Draft = 0,

    /// <summary>已发布。</summary>
    [Description("已发布")]
    Published = 1,

    /// <summary>已归档。</summary>
    [Description("已归档")]
    Archived = 2,
}

/// <summary>实例状态。</summary>
public enum InstanceStatus
{
    /// <summary>草稿。</summary>
    [Description("草稿")]
    Draft = 0,

    /// <summary>审批中。</summary>
    [Description("审批中")]
    Running = 1,

    /// <summary>已通过。</summary>
    [Description("已通过")]
    Approved = 2,

    /// <summary>已驳回。</summary>
    [Description("已驳回")]
    Rejected = 3,

    /// <summary>已取消。</summary>
    [Description("已取消")]
    Canceled = 4,

    /// <summary>已终止。</summary>
    [Description("已终止")]
    Terminated = 5,
}

/// <summary>任务类型。</summary>
public enum TaskKind
{
    /// <summary>审批。</summary>
    [Description("审批")]
    Approve = 1,

    /// <summary>抄送。</summary>
    [Description("抄送")]
    Cc = 2,
}

/// <summary>任务状态。</summary>
public enum TaskStatus
{
    /// <summary>待处理。</summary>
    [Description("待处理")]
    Pending = 0,

    /// <summary>已同意。</summary>
    [Description("已同意")]
    Agreed = 1,

    /// <summary>已驳回。</summary>
    [Description("已驳回")]
    Rejected = 2,

    /// <summary>已转办。</summary>
    [Description("已转办")]
    Transferred = 3,

    /// <summary>已取消。</summary>
    [Description("已取消")]
    Canceled = 4,

    /// <summary>已阅。</summary>
    [Description("已阅")]
    Read = 5,
}

/// <summary>任务来源。</summary>
public enum TaskSource
{
    /// <summary>规则。</summary>
    [Description("规则")]
    Rule = 1,

    /// <summary>转办。</summary>
    [Description("转办")]
    Transfer = 2,

    /// <summary>加签。</summary>
    [Description("加签")]
    AddSign = 3,

    /// <summary>改派。</summary>
    [Description("改派")]
    Reassign = 4,

    /// <summary>转交管理员。</summary>
    [Description("转交管理员")]
    ToAdmin = 5,
}

/// <summary>多人处理方式。或签、会签、依次审批都会执行。</summary>
public enum ApproveMode
{
    /// <summary>未指定。</summary>
    [Description("未指定")]
    None = 0,

    /// <summary>或签。</summary>
    [Description("或签")]
    Any = 1,

    /// <summary>会签。</summary>
    [Description("会签")]
    All = 2,

    /// <summary>依次审批。</summary>
    [Description("依次审批")]
    Sequential = 3,
}
