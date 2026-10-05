using XCode;

namespace Approval.Data.Entities;

public partial class ApprovalTask : Entity<ApprovalTask>
{
    static ApprovalTask()
    {
    }

    /// <summary>某实例当前待处理的审批任务。</summary>
    public static IList<ApprovalTask> FindPending(Int64 instanceId) =>
        FindAll(_.InstanceId == instanceId & _.Status == TaskStatus.Pending & _.Kind == TaskKind.Approve);

    /// <summary>当前用户的待办。只看办理人，不受流程监控的数据范围影响。</summary>
    public static IList<ApprovalTask> Inbox(Int32 userId) =>
        FindAll(_.AssigneeId == userId & _.Kind == TaskKind.Approve & _.Status == TaskStatus.Pending);

    /// <summary>当前用户的已办：已同意、已驳回、已转办。</summary>
    public static IList<ApprovalTask> Done(Int32 userId) =>
        FindAll(_.AssigneeId == userId & _.Kind == TaskKind.Approve)
            .Where(t => t.Status is TaskStatus.Agreed or TaskStatus.Rejected or TaskStatus.Transferred)
            .ToList();
}
