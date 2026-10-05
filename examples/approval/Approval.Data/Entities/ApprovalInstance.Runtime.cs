using System.Text.Json;
using System.Text.Json.Nodes;
using Approval.Data;
using NewLife;
using XCode;
using XCode.Membership;

namespace Approval.Data.Entities;

/// <summary>审批运行时。发起、同意、驳回和办理人解析都在实例上。</summary>
public partial class ApprovalInstance
{
    /// <summary>本人发起或代发起，进入同一条已发布流程。</summary>
    public static ApprovalInstance Start(StartArgs args)
    {
        if (args.RequestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        var existed = ApprovalHistory.FindAllByRequestId(args.RequestId);
        if (existed.Count > 0)
        {
            var old = FindById(existed[0].InstanceId);
            if (old != null) return old;
        }

        var process = ApprovalProcess.FindById(args.ProcessId)
            ?? throw new ApprovalException(4041, "流程不存在");
        if (!process.Enable || process.PublishedVersionId <= 0)
            throw new ApprovalException(4091, "流程未启用或尚未发布");
        var version = ApprovalProcessVersion.FindById(process.PublishedVersionId)
            ?? throw new ApprovalException(4041, "已发布的流程版本不存在");
        if (version.Status != VersionStatus.Published)
            throw new ApprovalException(4091, "流程版本不是已发布状态");

        var op = User.FindByID(args.OperatorUserId)
            ?? throw new ApprovalException(4041, "当前用户不存在");
        if (!op.Enable) throw new ApprovalException(4031, "当前用户已停用");

        User subject;
        User? proxy = null;
        if (!args.Proxy)
        {
            subject = op;
        }
        else
        {
            if (args.SubjectUserId <= 0) throw new ApprovalException(4001, "代发起必须选择学生");
            if (args.SubjectUserId == op.ID) throw new ApprovalException(4001, "代发起不能选择自己");
            subject = User.FindByID(args.SubjectUserId)
                ?? throw new ApprovalException(4041, "学生不存在");
            if (!subject.Enable) throw new ApprovalException(4221, "学生已停用");
            proxy = op;
        }

        var nodes = ApprovalNode.FindAllByProcessVersionId(version.Id).OrderBy(e => e.Sort).ToList();
        var transitions = ApprovalTransition.FindAllByProcessVersionId(version.Id);
        if (nodes.Count == 0) throw new ApprovalException(4222, "已发布流程没有节点");
        var needsCounselor = nodes.Any(e => e.AssigneeType == "subjectCounselor");
        var graph = FlowGraph.Parse(version.Definition);
        var schema = SchemaOf(version.FormVersionId);
        var posted = FieldRules.ParseObject(args.Data);
        var startNode = graph.Nodes.FirstOrDefault(e => e.Type == "start")
            ?? throw new ApprovalException(4222, "流程没有开始节点");
        FieldRules.GuardStart(posted, FieldRules.ForNode(graph, startNode.Key), FormSchema.Keys(schema));
        var data = NormalizeForm(posted.ToJsonString(), args.Proxy, subject.ID, out var counselorId);
        AttachPicks(data, args.AssigneePicks);
        if (needsCounselor)
        {
            var counselor = counselorId > 0 ? User.FindByID(counselorId) : null;
            if (counselor == null || !counselor.Enable)
                throw new ApprovalException(4223, "该生辅导员没有可用用户");
        }

        var dept = Department.FindByID(op.DepartmentID);
        var now = DateTime.Now;
        var subjectName = Display(subject);
        var proxyName = proxy == null ? null : Display(proxy);
        var title = proxy == null
            ? $"{subjectName}的{process.Name}"
            : $"{proxyName}代{subjectName}发起的{process.Name}";
        if (title.Length > 200) title = title[..200];

        ApprovalFieldValue.EnsureReady();
        ApprovalInstance? created = null;
        Run(() =>
        {
            var inst = new ApprovalInstance
            {
                No = NextNo(now),
                Title = title,
                ProcessId = process.Id,
                ProcessVersionId = version.Id,
                FormVersionId = version.FormVersionId,
                ProcessName = process.Name,
                CategoryId = process.CategoryId,
                UserId = op.ID,
                UserName = Display(op),
                DepartmentId = op.DepartmentID,
                DepartmentName = dept?.Name,
                SubjectUserId = subject.ID,
                SubjectName = subjectName,
                ProxyUserId = proxy?.ID ?? 0,
                ProxyName = proxyName,
                CounselorUserId = counselorId,
                Status = InstanceStatus.Running,
                Round = 1,
                StartTime = now,
                LastActionTime = now,
                Version = 1,
            };
            inst.Insert();

            var body = data.ToJsonString();
            new ApprovalFormData
            {
                Id = inst.Id,
                FormVersionId = version.FormVersionId,
                Data = body,
                DataSize = System.Text.Encoding.UTF8.GetByteCount(body),
                UpdateUser = Display(op),
                UpdateUserID = op.ID,
                UpdateTime = now,
            }.Insert();
            ApprovalFieldValue.Rebuild(inst.Id, version.FormVersionId, body);

            WriteHistory(inst, null, null, proxy == null ? "submit" : "submit", proxy == null ? "提交" : "代发起",
                proxy == null ? null : $"代发起人：{proxyName}，业务主体：{subjectName}",
                InstanceStatus.Draft, InstanceStatus.Running, args.RequestId, args.ClientIp, op, now);

            var start = nodes.FirstOrDefault(e => e.NodeType == "start")
                ?? throw new ApprovalException(4222, "流程没有开始节点");
            Enter(inst, start, nodes, transitions, now);
            inst.Update();
            created = inst;
        });

        return FindById(created!.Id) ?? created;
    }

    /// <summary>同意。或签一人即可；会签要全员同意；依次同意后才产生下一人。</summary>
    public static ApprovalInstance Agree(Int64 taskId, Int32 operatorUserId, String? comment, String requestId, Int32 instanceVersion, String? clientIp, String? data = null)
    {
        if (requestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        ApprovalFieldValue.EnsureReady();
        ApprovalInstance? result = null;
        Run(() =>
        {
            var task = ApprovalTask.FindById(taskId) ?? throw new ApprovalException(4041, "任务不存在");
            var inst = FindById(task.InstanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            var dup = ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId);
            if (dup != null)
            {
                LeaveHost.Sync(inst.Id);
                result = inst;
                return;
            }

            EnsureHandle(task, inst, operatorUserId, instanceVersion);
            var op = User.FindByID(operatorUserId)!;
            var now = DateTime.Now;
            ApplyHandleData(inst, task.NodeKey, data, now, op);
            var claimed = ApprovalTask.Update(
                ["Status", "HandleTime", "Comment", "UpdateTime"],
                [TaskStatus.Agreed, now, comment ?? "", now],
                ["Id", "Status"],
                [task.Id, TaskStatus.Pending]);
            if (claimed != 1) throw new ApprovalException(4092, "该任务已由他人处理");

            ClearTaskCache();
            var nodes = ApprovalNode.FindAllByProcessVersionId(inst.ProcessVersionId);
            var transitions = ApprovalTransition.FindAllByProcessVersionId(inst.ProcessVersionId);
            var node = nodes.First(e => e.NodeKey == task.NodeKey);
            var before = inst.Status;
            CompleteAfterAgree(inst, task, node, nodes, transitions, now);
            inst.LastActionTime = now;
            inst.Version++;
            inst.Update();
            WriteHistory(inst, task, node, "agree", "同意", comment,
                before, inst.Status, requestId, clientIp, op, now);
            LeaveHost.Sync(inst.Id);
            result = inst;
        });
        return FindById(result!.Id) ?? result;
    }

    /// <summary>驳回给发起人。发起人在代发起时是代发人。</summary>
    public static ApprovalInstance Reject(Int64 taskId, Int32 operatorUserId, String? comment, String requestId, Int32 instanceVersion, String? clientIp, String? data = null)
    {
        if (requestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        if (comment.IsNullOrEmpty()) throw new ApprovalException(4001, "驳回意见必填");
        ApprovalFieldValue.EnsureReady();
        ApprovalInstance? result = null;
        Run(() =>
        {
            var task = ApprovalTask.FindById(taskId) ?? throw new ApprovalException(4041, "任务不存在");
            var inst = FindById(task.InstanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            var dup = ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId);
            if (dup != null)
            {
                LeaveHost.Sync(inst.Id);
                result = inst;
                return;
            }

            EnsureHandle(task, inst, operatorUserId, instanceVersion);
            var op = User.FindByID(operatorUserId)!;
            var now = DateTime.Now;
            ApplyHandleData(inst, task.NodeKey, data, now, op);
            var claimed = ApprovalTask.Update(
                ["Status", "HandleTime", "Comment", "UpdateTime"],
                [TaskStatus.Rejected, now, comment, now],
                ["Id", "Status"],
                [task.Id, TaskStatus.Pending]);
            if (claimed != 1) throw new ApprovalException(4092, "该任务已由他人处理");

            ClearTaskCache();
            CancelPending(inst.Id, task.Id, "单据已驳回", now);

            var before = inst.Status;
            inst.Status = InstanceStatus.Rejected;
            inst.CurrentNodes = "";
            inst.EndTime = now;
            inst.LastActionTime = now;
            inst.Version++;
            inst.Update();
            var node = ApprovalNode.FindAllByProcessVersionId(inst.ProcessVersionId).FirstOrDefault(e => e.NodeKey == task.NodeKey);
            var note = $"已退回发起人：{inst.UserName}。{comment}";
            WriteHistory(inst, task, node, "reject", "驳回", note, before, inst.Status, requestId, clientIp, op, now);
            LeaveHost.Sync(inst.Id);
            result = inst;
        });
        return FindById(result!.Id) ?? result;
    }

    /// <summary>转办给另一名启用用户。原待办变为已转办，接任人收到同一节点的新待办。</summary>
    public static ApprovalInstance Transfer(Int64 taskId, Int32 operatorUserId, Int32 targetUserId, String? comment, String requestId, Int32 instanceVersion, String? clientIp)
    {
        if (requestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        if (targetUserId <= 0) throw new ApprovalException(4001, "请选择转办对象");
        if (targetUserId == operatorUserId) throw new ApprovalException(4001, "不能转办给自己");
        ApprovalInstance? result = null;
        Run(() =>
        {
            var task = ApprovalTask.FindById(taskId) ?? throw new ApprovalException(4041, "任务不存在");
            var inst = FindById(task.InstanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            var dup = ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId);
            if (dup != null)
            {
                result = inst;
                return;
            }

            EnsureHandle(task, inst, operatorUserId, instanceVersion);
            var target = User.FindByID(targetUserId) ?? throw new ApprovalException(4041, "转办对象不存在");
            if (!target.Enable) throw new ApprovalException(4221, "转办对象已停用");
            if (PendingOnNode(inst, task).Any(t => t.AssigneeId == target.ID))
                throw new ApprovalException(4001, "该用户已是当前节点的处理人");

            var op = User.FindByID(operatorUserId)!;
            var now = DateTime.Now;
            var claimed = ApprovalTask.Update(
                ["Status", "HandleTime", "Comment", "UpdateTime"],
                [TaskStatus.Transferred, now, comment ?? "", now],
                ["Id", "Status"],
                [task.Id, TaskStatus.Pending]);
            if (claimed != 1) throw new ApprovalException(4092, "该任务已由他人处理");

            ClearTaskCache();
            var node = ApprovalNode.FindAllByProcessVersionId(inst.ProcessVersionId).First(e => e.NodeKey == task.NodeKey);
            CreateTask(inst, node, target, task.Mode, task.Seq, TaskSource.Transfer, TaskKind.Approve, now);
            var before = inst.Status;
            inst.LastActionTime = now;
            inst.Version++;
            inst.Update();
            WriteHistory(inst, task, node, "transfer", "转办", $"转给{Display(target)}。{comment}", before, inst.Status, requestId, clientIp, op, now);
            result = inst;
        });
        return FindById(result!.Id) ?? result;
    }

    /// <summary>撤回。默认只允许本轮还没有同意、驳回、转办或加签。代发起时只有发起人（代发人）可以撤。</summary>
    public static ApprovalInstance Withdraw(Int64 instanceId, Int32 operatorUserId, String? reason, String requestId, Int32 instanceVersion, String? clientIp)
    {
        if (requestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        ApprovalInstance? result = null;
        Run(() =>
        {
            var inst = FindById(instanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            var dup = ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId);
            if (dup != null)
            {
                LeaveHost.Sync(inst.Id);
                result = inst;
                return;
            }

            if (inst.UserId != operatorUserId) throw new ApprovalException(4031, "只有发起人可以撤回");
            if (inst.Status != InstanceStatus.Running) throw new ApprovalException(4091, "当前状态不允许撤回");
            if (instanceVersion > 0 && inst.Version != instanceVersion)
                throw new ApprovalException(4093, "单据已变化，请刷新后重试");
            var handled = ApprovalHistory.FindAllByInstanceId(inst.Id)
                .Any(h => h.Round == inst.Round && h.Action is "agree" or "reject" or "transfer" or "addSign");
            if (handled) throw new ApprovalException(4091, "已有人处理，不能撤回");

            var op = User.FindByID(operatorUserId) ?? throw new ApprovalException(4041, "当前用户不存在");
            var now = DateTime.Now;
            CancelPending(inst.Id, 0, "发起人已撤回", now);

            var before = inst.Status;
            inst.Status = InstanceStatus.Draft;
            inst.CurrentNodes = "";
            inst.LastActionTime = now;
            inst.Version++;
            inst.Update();
            WriteHistory(inst, null, null, "withdraw", "撤回", reason, before, inst.Status, requestId, clientIp, op, now);
            LeaveHost.Sync(inst.Id);
            result = inst;
        });
        return FindById(result!.Id) ?? result;
    }

    /// <summary>
    /// 撤回后的重新提交。轮次加一，仍走这张单当初绑定的流程版本，不跟随后来发布的新版本。
    /// 代发起时只有发起人可以重提，学生字段仍必须是业务主体。
    /// </summary>
    public static ApprovalInstance Resubmit(Int64 instanceId, Int32 operatorUserId, String? data, String requestId, Int32 instanceVersion, String? clientIp, String? assigneePicks = null)
    {
        if (requestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        ApprovalFieldValue.EnsureReady();
        ApprovalInstance? result = null;
        Run(() =>
        {
            var inst = FindById(instanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            var dup = ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId);
            if (dup != null)
            {
                LeaveHost.Sync(inst.Id);
                result = inst;
                return;
            }

            if (inst.UserId != operatorUserId) throw new ApprovalException(4031, "只有发起人可以重新提交");
            if (inst.Status != InstanceStatus.Draft) throw new ApprovalException(4091, "只有撤回后的草稿可以重新提交");
            if (instanceVersion > 0 && inst.Version != instanceVersion)
                throw new ApprovalException(4093, "单据已变化，请刷新后重试");

            var version = ApprovalProcessVersion.FindById(inst.ProcessVersionId)
                ?? throw new ApprovalException(4041, "流程版本不存在");
            var nodes = ApprovalNode.FindAllByProcessVersionId(version.Id).OrderBy(e => e.Sort).ToList();
            var transitions = ApprovalTransition.FindAllByProcessVersionId(version.Id);
            if (nodes.Count == 0) throw new ApprovalException(4222, "已发布流程没有节点");

            var graph = FlowGraph.Parse(version.Definition);
            var schema = SchemaOf(inst.FormVersionId);
            var startNode = graph.Nodes.FirstOrDefault(e => e.Type == "start")
                ?? throw new ApprovalException(4222, "流程没有开始节点");
            var current = FieldRules.ParseObject(ApprovalFormData.FindById(inst.Id)?.Data);
            var posted = data.IsNullOrEmpty() ? null : FieldRules.ParseObject(data);
            var merged = FieldRules.Merge(current, posted, FieldRules.ForNode(graph, startNode.Key), FormSchema.Keys(schema), inst.SubjectUserId);
            var normalized = NormalizeForm(merged.ToJsonString(), inst.ProxyUserId > 0, inst.SubjectUserId, out var counselorId);
            AttachPicks(normalized, assigneePicks);
            if (nodes.Any(e => e.AssigneeType == "subjectCounselor"))
            {
                var counselor = counselorId > 0 ? User.FindByID(counselorId) : null;
                if (counselor == null || !counselor.Enable)
                    throw new ApprovalException(4223, "该生辅导员没有可用用户");
            }

            var op = User.FindByID(operatorUserId) ?? throw new ApprovalException(4041, "当前用户不存在");
            var now = DateTime.Now;
            SaveForm(inst, normalized, op, now);
            var before = inst.Status;
            inst.Round++;
            inst.Status = InstanceStatus.Running;
            inst.CounselorUserId = counselorId;
            inst.EndTime = DateTime.MinValue;
            inst.LastActionTime = now;
            inst.Version++;
            inst.CurrentNodes = "";
            var start = nodes.FirstOrDefault(e => e.NodeType == "start")
                ?? throw new ApprovalException(4222, "流程没有开始节点");
            Enter(inst, start, nodes, transitions, now);
            inst.Update();
            WriteHistory(inst, null, null, "resubmit", "重新提交", null, before, inst.Status, requestId, clientIp, op, now);
            LeaveHost.Sync(inst.Id);
            result = inst;
        });
        return FindById(result!.Id) ?? result;
    }

    /// <summary>向后加签一级。当前任务记为已同意，同节点挂上加签待办，节点先不往下走。</summary>
    public static ApprovalInstance AddSign(Int64 taskId, Int32 operatorUserId, Int32 targetUserId, String? comment, String requestId, Int32 instanceVersion, String? clientIp)
    {
        if (requestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        if (targetUserId <= 0) throw new ApprovalException(4001, "请选择加签对象");
        if (targetUserId == operatorUserId) throw new ApprovalException(4001, "不能加签给自己");
        ApprovalInstance? result = null;
        Run(() =>
        {
            var task = ApprovalTask.FindById(taskId) ?? throw new ApprovalException(4041, "任务不存在");
            var inst = FindById(task.InstanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            var dup = ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId);
            if (dup != null)
            {
                result = inst;
                return;
            }

            EnsureHandle(task, inst, operatorUserId, instanceVersion);
            if (task.Kind != TaskKind.Approve) throw new ApprovalException(4091, "只有审批任务可以加签");
            if (task.Source == TaskSource.AddSign) throw new ApprovalException(4091, "向后加签只允许一级");
            var target = User.FindByID(targetUserId) ?? throw new ApprovalException(4041, "加签对象不存在");
            if (!target.Enable) throw new ApprovalException(4221, "加签对象已停用");
            if (PendingOnNode(inst, task).Any(t => t.AssigneeId == target.ID))
                throw new ApprovalException(4001, "该用户已是当前节点的处理人");

            var op = User.FindByID(operatorUserId)!;
            var now = DateTime.Now;
            var claimed = ApprovalTask.Update(
                ["Status", "HandleTime", "Comment", "UpdateTime"],
                [TaskStatus.Agreed, now, comment ?? "", now],
                ["Id", "Status"],
                [task.Id, TaskStatus.Pending]);
            if (claimed != 1) throw new ApprovalException(4092, "该任务已由他人处理");

            ClearTaskCache();
            var node = ApprovalNode.FindAllByProcessVersionId(inst.ProcessVersionId).First(e => e.NodeKey == task.NodeKey);
            CreateTask(inst, node, target, task.Mode, task.Seq, TaskSource.AddSign, TaskKind.Approve, now);
            var before = inst.Status;
            inst.LastActionTime = now;
            inst.Version++;
            inst.Update();
            WriteHistory(inst, task, node, "addSign", "加签", $"加签给{Display(target)}。{comment}", before, inst.Status, requestId, clientIp, op, now);
            result = inst;
        });
        return FindById(result!.Id) ?? result;
    }

    /// <summary>抄送标为已阅。不推进流程，也不改实例版本，避免挡住正在办理的同意。</summary>
    public static ApprovalInstance Read(Int64 taskId, Int32 operatorUserId, String requestId, String? clientIp)
    {
        if (requestId.IsNullOrEmpty()) throw new ApprovalException(4001, "缺少请求号");
        ApprovalInstance? result = null;
        Run(() =>
        {
            var task = ApprovalTask.FindById(taskId) ?? throw new ApprovalException(4041, "任务不存在");
            var inst = FindById(task.InstanceId) ?? throw new ApprovalException(4041, "审批单不存在");
            var dup = ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId);
            if (dup != null)
            {
                result = inst;
                return;
            }

            if (task.Kind != TaskKind.Cc) throw new ApprovalException(4091, "只有抄送可以标为已阅");
            if (task.AssigneeId != operatorUserId) throw new ApprovalException(4031, "您不是该抄送的接收人");
            if (task.Status != TaskStatus.Pending) throw new ApprovalException(4092, "该抄送已处理");
            var op = User.FindByID(operatorUserId) ?? throw new ApprovalException(4041, "当前用户不存在");
            var now = DateTime.Now;
            var claimed = ApprovalTask.Update(
                ["Status", "HandleTime", "UpdateTime"],
                [TaskStatus.Read, now, now],
                ["Id", "Status"],
                [task.Id, TaskStatus.Pending]);
            if (claimed != 1) throw new ApprovalException(4092, "该抄送已处理");

            ClearTaskCache();
            var node = ApprovalNode.FindAllByProcessVersionId(inst.ProcessVersionId).FirstOrDefault(e => e.NodeKey == task.NodeKey);
            WriteHistory(inst, task, node, "read", "已阅", null, inst.Status, inst.Status, requestId, clientIp, op, now);
            result = inst;
        });
        return FindById(result!.Id) ?? result;
    }

    /// <summary>
    /// 流程监控。只在这里套数据范围，不注册拦截器，因此待办仍只按办理人过滤。
    /// </summary>
    public static IList<ApprovalInstance> Monitor(User viewer)
    {
        if (viewer == null || !viewer.Enable) throw new ApprovalException(4031, "当前用户已停用");
        var ctx = DataScopeContext.Create(viewer, null);
        var exp = new WhereExpression();
        exp = exp.ApplyScope<ApprovalInstance>(ctx);
        return FindAll(exp);
    }

    private static void EnsureHandle(ApprovalTask task, ApprovalInstance inst, Int32 operatorUserId, Int32 instanceVersion)
    {
        if (task.AssigneeId != operatorUserId) throw new ApprovalException(4031, "您不是该任务的处理人");
        if (task.Status != TaskStatus.Pending) throw new ApprovalException(4092, "该任务已由他人处理");
        if (inst.Status != InstanceStatus.Running) throw new ApprovalException(4091, "当前状态不允许该操作");
        if (instanceVersion > 0 && inst.Version != instanceVersion)
            throw new ApprovalException(4093, "单据已变化，请刷新后重试");
    }

    /// <summary>进入节点。或签、会签为每个办理人生成待办；依次审批只生成当前这一人。</summary>
    private static void Enter(ApprovalInstance inst, ApprovalNode node, IList<ApprovalNode> nodes, IList<ApprovalTransition> transitions, DateTime now)
    {
        if (node.NodeType == "end")
        {
            inst.Status = InstanceStatus.Approved;
            inst.CurrentNodes = node.Name;
            inst.EndTime = now;
            return;
        }

        if (node.NodeType is "start" or "cc" or "exclusive" or "parallel")
        {
            EnterGateway(inst, node, nodes, transitions, now);
            return;
        }

        if (node.NodeType != "approve")
            throw new ApprovalException(4222, "本切片不执行该节点类型：" + node.NodeType);

        var users = ResolveAssignees(inst, node);
        if (users.Count == 0) throw new ApprovalException(4223, $"节点“{node.Name}”没有可用审批人");
        var mode = node.ApproveMode is ApproveMode.None ? ApproveMode.Any : node.ApproveMode;
        if (mode == ApproveMode.Sequential)
            CreateTask(inst, node, users[0], mode, 1, TaskSource.Rule, TaskKind.Approve, now);
        else
        {
            var seq = 1;
            foreach (var user in users)
            {
                CreateTask(inst, node, user, mode, seq, TaskSource.Rule, TaskKind.Approve, now);
                seq++;
            }
        }

        inst.CurrentNodes = node.Name;
        inst.Status = InstanceStatus.Running;
    }

    /// <summary>
    /// 同意之后判断节点是否走完。或签取消其余待办；会签留下其他人；依次未到最后一人时只生成下一位。
    /// </summary>
    private static void CompleteAfterAgree(ApprovalInstance inst, ApprovalTask task, ApprovalNode node, IList<ApprovalNode> nodes, IList<ApprovalTransition> transitions, DateTime now)
    {
        var mode = task.Mode is ApproveMode.None ? ApproveMode.Any : task.Mode;
        if (mode == ApproveMode.Any)
        {
            if (NodeTasks(inst, node.NodeKey).Any(t => t.Source == TaskSource.AddSign && t.Status == TaskStatus.Pending))
                return;
            CancelOthers(inst.Id, task, "他人已处理", now);
            Advance(inst, node.NodeKey, nodes, transitions, now);
            return;
        }

        if (PendingOnNode(inst, task).Count > 0) return;

        if (mode == ApproveMode.Sequential)
        {
            var users = ResolveAssignees(inst, node);
            var done = SequentialSlotsDone(inst, task.NodeKey);
            if (done < users.Count)
            {
                CreateTask(inst, node, users[done], ApproveMode.Sequential, done + 1, TaskSource.Rule, TaskKind.Approve, now);
                return;
            }
        }

        Advance(inst, node.NodeKey, nodes, transitions, now);
    }

    private static void Advance(ApprovalInstance inst, String nodeKey, IList<ApprovalNode> nodes, IList<ApprovalTransition> transitions, DateTime now)
    {
        var edge = transitions.Where(e => e.FromKey == nodeKey).OrderBy(e => e.Sort).FirstOrDefault()
            ?? throw new ApprovalException(4222, "当前节点没有出线");
        var next = nodes.FirstOrDefault(e => e.NodeKey == edge.ToKey)
            ?? throw new ApprovalException(4222, "出线指向了不存在的节点");
        Enter(inst, next, nodes, transitions, now);
    }

    private static IList<ApprovalTask> NodeTasks(ApprovalInstance inst, String nodeKey) =>
        ApprovalTask.FindAll(ApprovalTask._.InstanceId == inst.Id & ApprovalTask._.NodeKey == nodeKey & ApprovalTask._.Round == inst.Round & ApprovalTask._.Kind == TaskKind.Approve);

    private static IList<ApprovalTask> PendingOnNode(ApprovalInstance inst, ApprovalTask task) =>
        ApprovalTask.FindPending(inst.Id).Where(t => t.NodeKey == task.NodeKey && t.Round == task.Round).ToList();

    /// <summary>依次审批已经走完的前缀长度。转办出去的那一位，要等接任人同意才算完成。</summary>
    private static Int32 SequentialSlotsDone(ApprovalInstance inst, String nodeKey)
    {
        var tasks = NodeTasks(inst, nodeKey);
        var done = 0;
        while (true)
        {
            var seq = done + 1;
            var rule = tasks.FirstOrDefault(t => t.Source == TaskSource.Rule && t.Seq == seq);
            if (rule == null) break;
            if (rule.Status == TaskStatus.Agreed)
            {
                done++;
                continue;
            }

            if (rule.Status == TaskStatus.Transferred &&
                tasks.Any(t => t.Source == TaskSource.Transfer && t.Seq == seq && t.Status == TaskStatus.Agreed))
            {
                done++;
                continue;
            }

            break;
        }

        return done;
    }

    private static void EnterGateway(ApprovalInstance inst, ApprovalNode node, IList<ApprovalNode> nodes, IList<ApprovalTransition> transitions, DateTime now)
    {
        if (node.NodeType == "parallel")
        {
            var outs = transitions.Where(e => e.FromKey == node.NodeKey).OrderBy(e => e.Sort).ToList();
            var ins = transitions.Where(e => e.ToKey == node.NodeKey).Select(e => e.FromKey).Distinct().ToList();
            if (outs.Count >= 2)
            {
                var names = new List<String>();
                foreach (var edge in outs)
                {
                    var target = nodes.FirstOrDefault(e => e.NodeKey == edge.ToKey)
                        ?? throw new ApprovalException(4222, "并行分支没有目标");
                    Enter(inst, target, nodes, transitions, now);
                    names.Add(target.Name);
                }

                inst.CurrentNodes = String.Join(",", names);
                inst.Status = InstanceStatus.Running;
                return;
            }

            if (!BranchesReady(inst, ins, nodes)) return;
            if (outs.Count == 0) throw new ApprovalException(4222, "并行汇聚没有出线");
            var next = nodes.FirstOrDefault(e => e.NodeKey == outs[0].ToKey)
                ?? throw new ApprovalException(4222, "并行汇聚的出线没有目标");
            Enter(inst, next, nodes, transitions, now);
            return;
        }

        if (node.NodeType == "exclusive")
        {
            var version = ApprovalProcessVersion.FindById(inst.ProcessVersionId)
                ?? throw new ApprovalException(4041, "流程版本不存在");
            var graph = FlowGraph.Parse(version.Definition);
            var form = ApprovalFormData.FindById(inst.Id);
            var chosen = graph.Choose(node.NodeKey, form?.Data, inst.UserId, inst.DepartmentId);
            var target = nodes.FirstOrDefault(e => e.NodeKey == chosen.To)
                ?? throw new ApprovalException(4222, "排他网关的出线没有目标");
            RememberChoice(inst, node, chosen.To, now);
            Enter(inst, target, nodes, transitions, now);
            return;
        }

        if (node.NodeType == "cc")
        {
            var users = ResolveAssignees(inst, node);
            if (users.Count == 0) throw new ApprovalException(4223, $"节点“{node.Name}”没有可用抄送人");
            var seq = 1;
            foreach (var user in users)
            {
                CreateTask(inst, node, user, ApproveMode.None, seq, TaskSource.Rule, TaskKind.Cc, now);
                seq++;
            }
        }

        var forward = transitions.Where(e => e.FromKey == node.NodeKey).OrderBy(e => e.Sort).FirstOrDefault()
            ?? throw new ApprovalException(4222, "节点没有出线：" + node.Name);
        var following = nodes.FirstOrDefault(e => e.NodeKey == forward.ToKey)
            ?? throw new ApprovalException(4222, "出线指向了不存在的节点");
        Enter(inst, following, nodes, transitions, now);
    }

    private static Boolean BranchesReady(ApprovalInstance inst, IList<String> fromKeys, IList<ApprovalNode> nodes)
    {
        foreach (var key in fromKeys)
        {
            var from = nodes.FirstOrDefault(e => e.NodeKey == key);
            if (from == null) return false;
            if (from.NodeType == "approve")
            {
                var tasks = NodeTasks(inst, key);
                if (tasks.Count == 0)
                {
                    if (!OnActivePath(inst, key)) continue;
                    return false;
                }

                if (tasks.Any(t => t.Status == TaskStatus.Pending)) return false;
            }
            else if (from.NodeType == "cc")
            {
                var copied = ApprovalTask.FindAll(ApprovalTask._.InstanceId == inst.Id & ApprovalTask._.NodeKey == key & ApprovalTask._.Kind == TaskKind.Cc);
                if (copied.Count == 0) return false;
            }
        }

        return true;
    }

    private static void CreateTask(ApprovalInstance inst, ApprovalNode node, User user, ApproveMode mode, Int32 seq, TaskSource source, TaskKind kind, DateTime now)
    {
        new ApprovalTask
        {
            InstanceId = inst.Id,
            Round = inst.Round,
            ProcessId = inst.ProcessId,
            NodeKey = node.NodeKey,
            NodeName = node.Name,
            Kind = kind,
            Mode = mode,
            Seq = seq,
            Source = source,
            AssigneeId = user.ID,
            AssigneeName = Display(user),
            Status = TaskStatus.Pending,
            Title = inst.Title,
            ApplicantId = inst.UserId,
            ApplicantName = inst.UserName,
            ReceiveTime = now,
            CreateTime = now,
            UpdateTime = now,
        }.Insert();
    }

    /// <summary>
    /// 解析办理人。指定成员、指定角色、部门负责人、相对申请人按发起人；
    /// 指定部门成员取规则里的部门；发起人自选读表单里的 <c>_starterPicks</c>；
    /// 表单内联系人读规则指定的字段；角色与部门取两者交集。
    /// 「该生辅导员」只读业务单上的辅导员用户，不读代发人，也不读表单联系人字段。
    /// </summary>
    public static IList<User> ResolveAssignees(ApprovalInstance inst, ApprovalNode node)
    {
        var rule = ParseAssignee(node.AssigneeJson);
        var found = new List<User>();
        switch (node.AssigneeType)
        {
            case "user":
                foreach (var id in rule.UserIds.Distinct())
                {
                    var user = User.FindByID(id);
                    if (user != null && user.Enable) found.Add(user);
                }
                break;
            case "role":
                foreach (var user in User.FindAll())
                {
                    if (user == null || !user.Enable) continue;
                    if (rule.RoleIds.Any(roleId => HasRole(user, roleId))) found.Add(user);
                }
                break;
            case "deptManager":
                var manager = FindManager(inst.DepartmentId, rule.Level <= 0 ? 1 : rule.Level);
                if (manager != null) found.Add(manager);
                break;
            case "applicant":
                var applicant = inst.UserId > 0 ? User.FindByID(inst.UserId) : null;
                if (applicant != null && applicant.Enable) found.Add(applicant);
                break;
            case "deptMember":
                var departments = rule.Departments().ToHashSet();
                foreach (var user in User.FindAll())
                {
                    if (user == null || !user.Enable || user.DepartmentID <= 0) continue;
                    if (departments.Contains(user.DepartmentID)) found.Add(user);
                }
                break;
            case "starterPick":
                AddEnabled(found, PicksFor(inst, node.NodeKey));
                break;
            case "formContact":
                if (!rule.Field.IsNullOrEmpty())
                    AddEnabled(found, ReadUserIds(FormObject(inst), rule.Field));
                break;
            case "roleDept":
                var roleSet = rule.RoleIds;
                var deptSet = rule.Departments().ToHashSet();
                foreach (var user in User.FindAll())
                {
                    if (user == null || !user.Enable || user.DepartmentID <= 0) continue;
                    if (!deptSet.Contains(user.DepartmentID)) continue;
                    if (roleSet.Any(roleId => HasRole(user, roleId))) found.Add(user);
                }
                break;
            case "subjectCounselor":
                // 辅导员编号在发起时从业务主体的表单值抄到实例上，这里不再看操作者或代发人。
                var counselor = inst.CounselorUserId > 0 ? User.FindByID(inst.CounselorUserId) : null;
                if (counselor != null && counselor.Enable) found.Add(counselor);
                break;
            default:
                throw new ApprovalException(4222, "未知的办理人规则：" + node.AssigneeType);
        }

        return found.GroupBy(e => e.ID).Select(e => e.First()).ToList();
    }

    /// <summary>记下排他网关选中的出线。汇聚时用它忽略没走进去的分支，不另建令牌表。</summary>
    private static void RememberChoice(ApprovalInstance inst, ApprovalNode node, String toKey, DateTime now)
    {
        var requestId = "choose-" + inst.Round + "-" + node.NodeKey;
        if (ApprovalHistory.FindByInstanceIdAndRequestId(inst.Id, requestId) != null) return;
        var op = User.FindByID(inst.UserId) ?? throw new ApprovalException(4041, "发起人不存在");
        WriteHistory(inst, null, node, "choose", "选择分支", toKey, inst.Status, inst.Status, requestId, null, op, now);
    }

    /// <summary>当前轮次里，这条节点是否还在已选路径上。没选过的排他出线返回 false。</summary>
    private static Boolean OnActivePath(ApprovalInstance inst, String nodeKey)
    {
        try
        {
            var version = ApprovalProcessVersion.FindById(inst.ProcessVersionId);
            if (version == null || version.Definition.IsNullOrEmpty()) return true;
            var choices = new Dictionary<String, String>(StringComparer.Ordinal);
            foreach (var row in ApprovalHistory.FindAllByInstanceId(inst.Id))
            {
                if (row.Round != inst.Round || row.Action != "choose") continue;
                if (row.NodeKey.IsNullOrEmpty() || row.Comment.IsNullOrEmpty()) continue;
                choices[row.NodeKey] = row.Comment;
            }

            return FlowGraph.Parse(version.Definition).ActiveNodes(choices).Contains(nodeKey);
        }
        catch (ApprovalException)
        {
            return true;
        }
    }

    private static User? FindManager(Int32 departmentId, Int32 level)
    {
        var dept = Department.FindByID(departmentId);
        for (var i = 1; i < level && dept != null; i++)
            dept = dept.ParentID > 0 ? Department.FindByID(dept.ParentID) : null;
        if (dept == null || dept.ManagerId <= 0) return null;
        var manager = User.FindByID(dept.ManagerId);
        return manager != null && manager.Enable ? manager : null;
    }

    private static Boolean HasRole(User user, Int32 roleId)
    {
        if (user.RoleID == roleId) return true;
        var raw = user.RoleIds;
        if (raw.IsNullOrEmpty()) return false;
        var wrapped = raw.StartsWith(',') ? raw : "," + raw;
        if (!wrapped.EndsWith(',')) wrapped += ",";
        return wrapped.Contains("," + roleId + ",");
    }

    private static FlowAssignee ParseAssignee(String? json)
    {
        if (json.IsNullOrEmpty()) return new FlowAssignee();
        return JsonSerializer.Deserialize<FlowAssignee>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? new FlowAssignee();
    }

    /// <summary>同意或驳回附带的表单值，按当前节点的字段权限合并。</summary>
    private static void ApplyHandleData(ApprovalInstance inst, String nodeKey, String? data, DateTime now, User op)
    {
        if (data.IsNullOrEmpty()) return;
        var version = ApprovalProcessVersion.FindById(inst.ProcessVersionId)
            ?? throw new ApprovalException(4041, "流程版本不存在");
        var graph = FlowGraph.Parse(version.Definition);
        var schema = SchemaOf(inst.FormVersionId);
        var current = FieldRules.ParseObject(ApprovalFormData.FindById(inst.Id)?.Data);
        var merged = FieldRules.Merge(current, FieldRules.ParseObject(data), FieldRules.ForNode(graph, nodeKey), FormSchema.Keys(schema), inst.SubjectUserId);
        SaveForm(inst, merged, op, now);
    }

    private static void SaveForm(ApprovalInstance inst, JsonObject data, User op, DateTime now)
    {
        var body = data.ToJsonString();
        var row = ApprovalFormData.FindById(inst.Id) ?? throw new ApprovalException(4041, "表单值不存在");
        row.Data = body;
        row.DataSize = System.Text.Encoding.UTF8.GetByteCount(body);
        row.UpdateUser = Display(op);
        row.UpdateUserID = op.ID;
        row.UpdateTime = now;
        row.Update();
        ApprovalFieldValue.Rebuild(inst.Id, inst.FormVersionId, body);
    }

    /// <summary>把发起人自选挂到表单值上。这一键不在表单结构里，发起校验不会把它当成未知字段。</summary>
    private static void AttachPicks(JsonObject data, String? picks)
    {
        if (picks.IsNullOrEmpty()) return;
        JsonObject obj;
        try
        {
            obj = JsonNode.Parse(picks!) as JsonObject
                ?? throw new ApprovalException(4001, "发起人自选必须是对象");
        }
        catch (ApprovalException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ApprovalException(4001, "发起人自选无法解析：" + ex.Message);
        }

        data["_starterPicks"] = JsonNode.Parse(obj.ToJsonString());
    }

    private static JsonObject FormObject(ApprovalInstance inst)
    {
        ApprovalFormData.Meta.Cache?.Clear("resolve", true);
        ApprovalFormData.Meta.SingleCache.Clear("resolve");
        return FieldRules.ParseObject(ApprovalFormData.FindById(inst.Id)?.Data);
    }

    /// <summary>发起人自选在当前节点上点名的用户。没选过则空。</summary>
    private static List<Int32> PicksFor(ApprovalInstance inst, String nodeKey)
    {
        var form = FormObject(inst);
        if (!form.TryGetPropertyValue("_starterPicks", out var bag) || bag is not JsonObject map) return [];
        return map.TryGetPropertyValue(nodeKey, out var chosen) ? ReadUserIds(chosen) : [];
    }

    private static List<Int32> ReadUserIds(JsonObject form, String field)
    {
        return form.TryGetPropertyValue(field, out var node) ? ReadUserIds(node) : [];
    }

    private static List<Int32> ReadUserIds(JsonNode? node)
    {
        var ids = new List<Int32>();
        if (node == null) return ids;
        if (node is JsonArray array)
        {
            foreach (var item in array)
            {
                var id = OneId(item);
                if (id > 0) ids.Add(id);
            }
        }
        else
        {
            var id = OneId(node);
            if (id > 0) ids.Add(id);
        }

        return ids.Distinct().ToList();
    }

    private static Int32 OneId(JsonNode? node)
    {
        if (node is not JsonValue value) return 0;
        if (value.TryGetValue<Int32>(out var number)) return number;
        if (value.TryGetValue<Int64>(out var wide)) return (Int32)wide;
        if (value.TryGetValue<String>(out var text) && Int32.TryParse(text, out var parsed)) return parsed;
        return 0;
    }

    private static void AddEnabled(List<User> found, IEnumerable<Int32> ids)
    {
        foreach (var id in ids.Distinct())
        {
            var user = User.FindByID(id);
            if (user != null && user.Enable) found.Add(user);
        }
    }

    private static String SchemaOf(Int32 formVersionId)
    {
        var row = formVersionId > 0 ? ApprovalFormVersion.FindById(formVersionId) : null;
        return row?.Schema ?? """{"fields":[]}""";
    }

    /// <summary>
    /// 本人发起时学生字段强制为当前用户。代发起时必须等于所选学生。
    /// 辅导员字段写入表单值，供实例保存。业务主体只是用户编号，见 <see cref="SubjectLink"/>。
    /// </summary>
    private static JsonObject NormalizeForm(String? data, Boolean proxy, Int32 subjectUserId, out Int32 counselorId)
    {
        JsonObject obj;
        try
        {
            obj = JsonNode.Parse(data.IsNullOrEmpty() ? "{}" : data!) as JsonObject
                ?? throw new ApprovalException(4001, "表单值必须是对象");
        }
        catch (ApprovalException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ApprovalException(4001, "表单值无法解析：" + ex.Message);
        }

        var postedStudent = ReadInt(obj, "studentUserId");
        if (!proxy)
        {
            if (postedStudent > 0 && postedStudent != subjectUserId)
                throw new ApprovalException(4221, "本人发起时学生字段不可修改");
        }
        else if (postedStudent != subjectUserId)
        {
            throw new ApprovalException(4221, "代发起时学生字段必须是所选学生");
        }

        obj["studentUserId"] = subjectUserId;
        counselorId = ReadInt(obj, "counselorUserId");
        return obj;
    }

    private static Int32 ReadInt(JsonObject obj, String key)
    {
        if (!obj.TryGetPropertyValue(key, out var node) || node == null) return 0;
        if (node is JsonValue value)
        {
            if (value.TryGetValue<Int32>(out var number)) return number;
            if (value.TryGetValue<Int64>(out var wide)) return (Int32)wide;
            if (Int32.TryParse(value.ToString(), out var parsed)) return parsed;
        }

        return Int32.TryParse(node.ToString(), out var text) ? text : 0;
    }

    private static void CancelOthers(Int64 instanceId, ApprovalTask kept, String comment, DateTime now)
    {
        var pending = ApprovalTask.FindPending(instanceId);
        foreach (var item in pending)
        {
            if (item.Id == kept.Id || item.NodeKey != kept.NodeKey || item.Round != kept.Round) continue;
            item.Status = TaskStatus.Canceled;
            item.Comment = comment;
            item.HandleTime = now;
            item.UpdateTime = now;
            item.Update();
        }
    }

    /// <summary>单据结束或撤回时，取消本实例上所有仍待处理的审批和抄送。</summary>
    private static void CancelPending(Int64 instanceId, Int64 keptTaskId, String comment, DateTime now)
    {
        var pending = ApprovalTask.FindAll(ApprovalTask._.InstanceId == instanceId & ApprovalTask._.Status == TaskStatus.Pending);
        foreach (var item in pending)
        {
            if (item.Id == keptTaskId) continue;
            item.Status = TaskStatus.Canceled;
            item.Comment = comment;
            item.HandleTime = now;
            item.UpdateTime = now;
            item.Update();
        }
    }

    private static void WriteHistory(ApprovalInstance inst, ApprovalTask? task, ApprovalNode? node, String action, String actionName, String? comment, InstanceStatus from, InstanceStatus to, String requestId, String? ip, User op, DateTime now)
    {
        var dept = Department.FindByID(op.DepartmentID);
        new ApprovalHistory
        {
            InstanceId = inst.Id,
            Round = inst.Round,
            TaskId = task?.Id ?? 0,
            NodeKey = node?.NodeKey ?? task?.NodeKey,
            NodeName = node?.Name ?? task?.NodeName,
            Action = action,
            ActionName = actionName,
            OperatorId = op.ID,
            OperatorName = Display(op),
            OperatorDept = dept?.Name,
            Comment = comment,
            FromStatus = (Int32)from,
            ToStatus = (Int32)to,
            RequestId = requestId,
            CreateTime = now,
            CreateIP = ip,
        }.Insert();
    }

    private static String NextNo(DateTime now)
    {
        var prefix = "SP" + now.ToString("yyyyMMdd");
        var count = FindCount(_.No.StartsWith(prefix));
        return prefix + (count + 1).ToString("0000");
    }

    private static String Display(User user) =>
        user.DisplayName.IsNullOrEmpty() ? user.Name : user.DisplayName;

    private static void Run(Action action)
    {
        Meta.BeginTrans();
        try
        {
            action();
            Meta.Commit();
        }
        catch
        {
            Meta.Rollback();
            throw;
        }
        finally
        {
            ClearTaskCache();
            Meta.Cache?.Clear("runtime", true);
            Meta.SingleCache.Clear("runtime");
        }
    }

    private static void ClearTaskCache()
    {
        ApprovalTask.Meta.Cache?.Clear("runtime", true);
        ApprovalTask.Meta.SingleCache.Clear("runtime");
        ApprovalHistory.Meta.Cache?.Clear("runtime", true);
        ApprovalHistory.Meta.SingleCache.Clear("runtime");
        ApprovalFieldValue.Meta.Cache?.Clear("runtime", true);
        ApprovalFieldValue.Meta.SingleCache.Clear("runtime");
    }
}
