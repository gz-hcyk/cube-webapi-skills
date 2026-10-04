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
}
