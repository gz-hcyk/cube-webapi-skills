using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.Serialization;
using System.Web.Script.Serialization;
using System.Xml.Serialization;
using NewLife;
using NewLife.Data;
using XCode;
using XCode.Cache;
using XCode.Configuration;
using XCode.DataAccessLayer;

namespace Approval.Data.Entities;

/// <summary>审批任务。办理人在到达节点时解析并固定</summary>
[Serializable]
[DataObject]
[Description("审批任务。办理人在到达节点时解析并固定")]
[BindIndex("IX_ApprovalTask_AssigneeId_Kind_Status_ReceiveTime", false, "AssigneeId,Kind,Status,ReceiveTime")]
[BindIndex("IX_ApprovalTask_InstanceId_Round_NodeKey_Status", false, "InstanceId,Round,NodeKey,Status")]
[BindIndex("IX_ApprovalTask_ProcessId_Status", false, "ProcessId,Status")]
[BindTable("ApprovalTask", Description = "审批任务。办理人在到达节点时解析并固定", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalTask
{
    #region 属性
    private Int64 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [Description("编号")]
    [DataObjectField(true, false, false, 0)]
    [BindColumn("Id", "编号", "", DataScale = "time")]
    public Int64 Id { get => _Id; set { if (OnPropertyChanging("Id", value)) { _Id = value; OnPropertyChanged("Id"); } } }

    private Int64 _InstanceId;
    /// <summary>实例</summary>
    [DisplayName("实例")]
    [Description("实例")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("InstanceId", "实例", "")]
    public Int64 InstanceId { get => _InstanceId; set { if (OnPropertyChanging("InstanceId", value)) { _InstanceId = value; OnPropertyChanged("InstanceId"); } } }

    private Int32 _Round;
    /// <summary>轮次</summary>
    [DisplayName("轮次")]
    [Description("轮次")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Round", "轮次", "")]
    public Int32 Round { get => _Round; set { if (OnPropertyChanging("Round", value)) { _Round = value; OnPropertyChanged("Round"); } } }

    private Int32 _ProcessId;
    /// <summary>流程</summary>
    [DisplayName("流程")]
    [Description("流程")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ProcessId", "流程", "")]
    public Int32 ProcessId { get => _ProcessId; set { if (OnPropertyChanging("ProcessId", value)) { _ProcessId = value; OnPropertyChanged("ProcessId"); } } }

    private String _NodeKey = null!;
    /// <summary>节点键</summary>
    [DisplayName("节点键")]
    [Description("节点键")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("NodeKey", "节点键", "")]
    public String NodeKey { get => _NodeKey; set { if (OnPropertyChanging("NodeKey", value)) { _NodeKey = value; OnPropertyChanged("NodeKey"); } } }

    private String _NodeName = null!;
    /// <summary>节点名</summary>
    [DisplayName("节点名")]
    [Description("节点名")]
    [DataObjectField(false, false, false, 100)]
    [BindColumn("NodeName", "节点名", "")]
    public String NodeName { get => _NodeName; set { if (OnPropertyChanging("NodeName", value)) { _NodeName = value; OnPropertyChanged("NodeName"); } } }

    private Approval.Data.Entities.TaskKind _Kind;
    /// <summary>任务类型</summary>
    [DisplayName("任务类型")]
    [Description("任务类型")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Kind", "任务类型", "")]
    public Approval.Data.Entities.TaskKind Kind { get => _Kind; set { if (OnPropertyChanging("Kind", value)) { _Kind = value; OnPropertyChanged("Kind"); } } }

    private Approval.Data.Entities.ApproveMode _Mode;
    /// <summary>处理方式</summary>
    [DisplayName("处理方式")]
    [Description("处理方式")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Mode", "处理方式", "")]
    public Approval.Data.Entities.ApproveMode Mode { get => _Mode; set { if (OnPropertyChanging("Mode", value)) { _Mode = value; OnPropertyChanged("Mode"); } } }

    private Int32 _Seq;
    /// <summary>顺序号</summary>
    [DisplayName("顺序号")]
    [Description("顺序号")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Seq", "顺序号", "")]
    public Int32 Seq { get => _Seq; set { if (OnPropertyChanging("Seq", value)) { _Seq = value; OnPropertyChanged("Seq"); } } }

    private Approval.Data.Entities.TaskSource _Source;
    /// <summary>来源</summary>
    [DisplayName("来源")]
    [Description("来源")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Source", "来源", "")]
    public Approval.Data.Entities.TaskSource Source { get => _Source; set { if (OnPropertyChanging("Source", value)) { _Source = value; OnPropertyChanged("Source"); } } }

    private Int32 _AssigneeId;
    /// <summary>处理人</summary>
    [DisplayName("处理人")]
    [Description("处理人")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("AssigneeId", "处理人", "")]
    public Int32 AssigneeId { get => _AssigneeId; set { if (OnPropertyChanging("AssigneeId", value)) { _AssigneeId = value; OnPropertyChanged("AssigneeId"); } } }

    private String _AssigneeName = null!;
    /// <summary>处理人姓名</summary>
    [DisplayName("处理人姓名")]
    [Description("处理人姓名")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("AssigneeName", "处理人姓名", "")]
    public String AssigneeName { get => _AssigneeName; set { if (OnPropertyChanging("AssigneeName", value)) { _AssigneeName = value; OnPropertyChanged("AssigneeName"); } } }

    private Approval.Data.Entities.TaskStatus _Status;
    /// <summary>状态</summary>
    [DisplayName("状态")]
    [Description("状态")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Status", "状态", "")]
    public Approval.Data.Entities.TaskStatus Status { get => _Status; set { if (OnPropertyChanging("Status", value)) { _Status = value; OnPropertyChanged("Status"); } } }

    private String? _Comment;
    /// <summary>意见</summary>
    [DisplayName("意见")]
    [Description("意见")]
    [DataObjectField(false, false, true, 2000)]
    [BindColumn("Comment", "意见", "")]
    public String? Comment { get => _Comment; set { if (OnPropertyChanging("Comment", value)) { _Comment = value; OnPropertyChanged("Comment"); } } }

    private String _Title = null!;
    /// <summary>标题</summary>
    [DisplayName("标题")]
    [Description("标题")]
    [DataObjectField(false, false, false, 200)]
    [BindColumn("Title", "标题", "", Master = true)]
    public String Title { get => _Title; set { if (OnPropertyChanging("Title", value)) { _Title = value; OnPropertyChanged("Title"); } } }

    private Int32 _ApplicantId;
    /// <summary>发起人</summary>
    [DisplayName("发起人")]
    [Description("发起人")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ApplicantId", "发起人", "")]
    public Int32 ApplicantId { get => _ApplicantId; set { if (OnPropertyChanging("ApplicantId", value)) { _ApplicantId = value; OnPropertyChanged("ApplicantId"); } } }

    private String _ApplicantName = null!;
    /// <summary>发起人姓名</summary>
    [DisplayName("发起人姓名")]
    [Description("发起人姓名")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("ApplicantName", "发起人姓名", "")]
    public String ApplicantName { get => _ApplicantName; set { if (OnPropertyChanging("ApplicantName", value)) { _ApplicantName = value; OnPropertyChanged("ApplicantName"); } } }

    private DateTime _ReceiveTime;
    /// <summary>到达时间</summary>
    [DisplayName("到达时间")]
    [Description("到达时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("ReceiveTime", "到达时间", "")]
    public DateTime ReceiveTime { get => _ReceiveTime; set { if (OnPropertyChanging("ReceiveTime", value)) { _ReceiveTime = value; OnPropertyChanged("ReceiveTime"); } } }

    private DateTime _HandleTime;
    /// <summary>处理时间</summary>
    [DisplayName("处理时间")]
    [Description("处理时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("HandleTime", "处理时间", "")]
    public DateTime HandleTime { get => _HandleTime; set { if (OnPropertyChanging("HandleTime", value)) { _HandleTime = value; OnPropertyChanged("HandleTime"); } } }

    private DateTime _CreateTime;
    /// <summary>创建时间</summary>
    [DisplayName("创建时间")]
    [Description("创建时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("CreateTime", "创建时间", "")]
    public DateTime CreateTime { get => _CreateTime; set { if (OnPropertyChanging("CreateTime", value)) { _CreateTime = value; OnPropertyChanged("CreateTime"); } } }

    private DateTime _UpdateTime;
    /// <summary>更新时间</summary>
    [DisplayName("更新时间")]
    [Description("更新时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("UpdateTime", "更新时间", "")]
    public DateTime UpdateTime { get => _UpdateTime; set { if (OnPropertyChanging("UpdateTime", value)) { _UpdateTime = value; OnPropertyChanged("UpdateTime"); } } }
    #endregion

    #region 获取/设置 字段值
    /// <summary>获取/设置 字段值</summary>
    /// <param name="name">字段名</param>
    /// <returns></returns>
    public override Object? this[String name]
    {
        get => name switch
        {
            "Id" => _Id,
            "InstanceId" => _InstanceId,
            "Round" => _Round,
            "ProcessId" => _ProcessId,
            "NodeKey" => _NodeKey,
            "NodeName" => _NodeName,
            "Kind" => _Kind,
            "Mode" => _Mode,
            "Seq" => _Seq,
            "Source" => _Source,
            "AssigneeId" => _AssigneeId,
            "AssigneeName" => _AssigneeName,
            "Status" => _Status,
            "Comment" => _Comment,
            "Title" => _Title,
            "ApplicantId" => _ApplicantId,
            "ApplicantName" => _ApplicantName,
            "ReceiveTime" => _ReceiveTime,
            "HandleTime" => _HandleTime,
            "CreateTime" => _CreateTime,
            "UpdateTime" => _UpdateTime,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToLong(); break;
                case "InstanceId": _InstanceId = value.ToLong(); break;
                case "Round": _Round = value.ToInt(); break;
                case "ProcessId": _ProcessId = value.ToInt(); break;
                case "NodeKey": _NodeKey = Convert.ToString(value); break;
                case "NodeName": _NodeName = Convert.ToString(value); break;
                case "Kind": _Kind = (Approval.Data.Entities.TaskKind)value.ToInt(); break;
                case "Mode": _Mode = (Approval.Data.Entities.ApproveMode)value.ToInt(); break;
                case "Seq": _Seq = value.ToInt(); break;
                case "Source": _Source = (Approval.Data.Entities.TaskSource)value.ToInt(); break;
                case "AssigneeId": _AssigneeId = value.ToInt(); break;
                case "AssigneeName": _AssigneeName = Convert.ToString(value); break;
                case "Status": _Status = (Approval.Data.Entities.TaskStatus)value.ToInt(); break;
                case "Comment": _Comment = Convert.ToString(value); break;
                case "Title": _Title = Convert.ToString(value); break;
                case "ApplicantId": _ApplicantId = value.ToInt(); break;
                case "ApplicantName": _ApplicantName = Convert.ToString(value); break;
                case "ReceiveTime": _ReceiveTime = value.ToDateTime(); break;
                case "HandleTime": _HandleTime = value.ToDateTime(); break;
                case "CreateTime": _CreateTime = value.ToDateTime(); break;
                case "UpdateTime": _UpdateTime = value.ToDateTime(); break;
                default: base[name] = value; break;
            }
        }
    }
    #endregion

    #region 关联映射
    #endregion

    #region 扩展查询
    /// <summary>根据编号查找</summary>
    /// <param name="id">编号</param>
    /// <returns>实体对象</returns>
    public static ApprovalTask? FindById(Int64 id)
    {
        if (id < 0) return null;

        return Find(_.Id == id);
    }

    /// <summary>根据流程、状态查找</summary>
    /// <param name="processId">流程</param>
    /// <param name="status">状态</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalTask> FindAllByProcessIdAndStatus(Int32 processId, Approval.Data.Entities.TaskStatus status)
    {
        if (processId < 0) return [];
        if (status < 0) return [];

        return FindAll(_.ProcessId == processId & _.Status == status);
    }
    #endregion

    #region 高级查询
    /// <summary>高级查询</summary>
    /// <param name="instanceId">实例</param>
    /// <param name="round">轮次</param>
    /// <param name="processId">流程</param>
    /// <param name="nodeKey">节点键</param>
    /// <param name="kind">任务类型</param>
    /// <param name="assigneeId">处理人</param>
    /// <param name="status">状态</param>
    /// <param name="receiveTime">到达时间</param>
    /// <param name="mode">处理方式</param>
    /// <param name="source">来源</param>
    /// <param name="start">编号开始</param>
    /// <param name="end">编号结束</param>
    /// <param name="key">关键字</param>
    /// <param name="page">分页参数信息。可携带统计和数据权限扩展查询等信息</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalTask> Search(Int64 instanceId, Int32 round, Int32 processId, String nodeKey, Approval.Data.Entities.TaskKind kind, Int32 assigneeId, Approval.Data.Entities.TaskStatus status, DateTime receiveTime, Approval.Data.Entities.ApproveMode mode, Approval.Data.Entities.TaskSource source, DateTime start, DateTime end, String key, PageParameter page)
    {
        var exp = new WhereExpression();

        if (instanceId >= 0) exp &= _.InstanceId == instanceId;
        if (round >= 0) exp &= _.Round == round;
        if (processId >= 0) exp &= _.ProcessId == processId;
        if (!nodeKey.IsNullOrEmpty()) exp &= _.NodeKey == nodeKey;
        if (kind >= 0) exp &= _.Kind == kind;
        if (assigneeId >= 0) exp &= _.AssigneeId == assigneeId;
        if (status >= 0) exp &= _.Status == status;
        if (mode >= 0) exp &= _.Mode == mode;
        if (source >= 0) exp &= _.Source == source;
        exp &= _.Id.Between(start, end, Meta.Factory.Snow);
        if (!key.IsNullOrEmpty()) exp &= SearchWhereByKeys(key);

        return FindAll(exp, page);
    }
    #endregion

    #region 数据清理
    /// <summary>清理指定时间段内的数据</summary>
    /// <param name="start">开始时间。未指定时清理小于指定时间的所有数据</param>
    /// <param name="end">结束时间</param>
    /// <param name="maximumRows">最大删除行数。清理历史数据时，避免一次性删除过多导致数据库IO跟不上，0表示所有</param>
    /// <returns>清理行数</returns>
    public static Int32 DeleteWith(DateTime start, DateTime end, Int32 maximumRows = 0)
    {
        return Delete(_.Id.Between(start, end, Meta.Factory.Snow), maximumRows);
    }
    #endregion

    #region 字段名
    /// <summary>取得审批任务字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>实例</summary>
        public static readonly Field InstanceId = FindByName("InstanceId");

        /// <summary>轮次</summary>
        public static readonly Field Round = FindByName("Round");

        /// <summary>流程</summary>
        public static readonly Field ProcessId = FindByName("ProcessId");

        /// <summary>节点键</summary>
        public static readonly Field NodeKey = FindByName("NodeKey");

        /// <summary>节点名</summary>
        public static readonly Field NodeName = FindByName("NodeName");

        /// <summary>任务类型</summary>
        public static readonly Field Kind = FindByName("Kind");

        /// <summary>处理方式</summary>
        public static readonly Field Mode = FindByName("Mode");

        /// <summary>顺序号</summary>
        public static readonly Field Seq = FindByName("Seq");

        /// <summary>来源</summary>
        public static readonly Field Source = FindByName("Source");

        /// <summary>处理人</summary>
        public static readonly Field AssigneeId = FindByName("AssigneeId");

        /// <summary>处理人姓名</summary>
        public static readonly Field AssigneeName = FindByName("AssigneeName");

        /// <summary>状态</summary>
        public static readonly Field Status = FindByName("Status");

        /// <summary>意见</summary>
        public static readonly Field Comment = FindByName("Comment");

        /// <summary>标题</summary>
        public static readonly Field Title = FindByName("Title");

        /// <summary>发起人</summary>
        public static readonly Field ApplicantId = FindByName("ApplicantId");

        /// <summary>发起人姓名</summary>
        public static readonly Field ApplicantName = FindByName("ApplicantName");

        /// <summary>到达时间</summary>
        public static readonly Field ReceiveTime = FindByName("ReceiveTime");

        /// <summary>处理时间</summary>
        public static readonly Field HandleTime = FindByName("HandleTime");

        /// <summary>创建时间</summary>
        public static readonly Field CreateTime = FindByName("CreateTime");

        /// <summary>更新时间</summary>
        public static readonly Field UpdateTime = FindByName("UpdateTime");

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得审批任务字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号</summary>
        public const String Id = "Id";

        /// <summary>实例</summary>
        public const String InstanceId = "InstanceId";

        /// <summary>轮次</summary>
        public const String Round = "Round";

        /// <summary>流程</summary>
        public const String ProcessId = "ProcessId";

        /// <summary>节点键</summary>
        public const String NodeKey = "NodeKey";

        /// <summary>节点名</summary>
        public const String NodeName = "NodeName";

        /// <summary>任务类型</summary>
        public const String Kind = "Kind";

        /// <summary>处理方式</summary>
        public const String Mode = "Mode";

        /// <summary>顺序号</summary>
        public const String Seq = "Seq";

        /// <summary>来源</summary>
        public const String Source = "Source";

        /// <summary>处理人</summary>
        public const String AssigneeId = "AssigneeId";

        /// <summary>处理人姓名</summary>
        public const String AssigneeName = "AssigneeName";

        /// <summary>状态</summary>
        public const String Status = "Status";

        /// <summary>意见</summary>
        public const String Comment = "Comment";

        /// <summary>标题</summary>
        public const String Title = "Title";

        /// <summary>发起人</summary>
        public const String ApplicantId = "ApplicantId";

        /// <summary>发起人姓名</summary>
        public const String ApplicantName = "ApplicantName";

        /// <summary>到达时间</summary>
        public const String ReceiveTime = "ReceiveTime";

        /// <summary>处理时间</summary>
        public const String HandleTime = "HandleTime";

        /// <summary>创建时间</summary>
        public const String CreateTime = "CreateTime";

        /// <summary>更新时间</summary>
        public const String UpdateTime = "UpdateTime";
    }
    #endregion
}
