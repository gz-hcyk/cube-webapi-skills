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

/// <summary>审批历史。只追加</summary>
[Serializable]
[DataObject]
[Description("审批历史。只追加")]
[BindIndex("IX_ApprovalHistory_InstanceId_Id", false, "InstanceId,Id")]
[BindIndex("IU_ApprovalHistory_InstanceId_RequestId", true, "InstanceId,RequestId")]
[BindIndex("IX_ApprovalHistory_RequestId", false, "RequestId")]
[BindTable("ApprovalHistory", Description = "审批历史。只追加", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalHistory
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

    private Int64 _TaskId;
    /// <summary>任务</summary>
    [DisplayName("任务")]
    [Description("任务")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("TaskId", "任务", "")]
    public Int64 TaskId { get => _TaskId; set { if (OnPropertyChanging("TaskId", value)) { _TaskId = value; OnPropertyChanged("TaskId"); } } }

    private String? _NodeKey;
    /// <summary>节点键</summary>
    [DisplayName("节点键")]
    [Description("节点键")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("NodeKey", "节点键", "")]
    public String? NodeKey { get => _NodeKey; set { if (OnPropertyChanging("NodeKey", value)) { _NodeKey = value; OnPropertyChanged("NodeKey"); } } }

    private String? _NodeName;
    /// <summary>节点名</summary>
    [DisplayName("节点名")]
    [Description("节点名")]
    [DataObjectField(false, false, true, 100)]
    [BindColumn("NodeName", "节点名", "")]
    public String? NodeName { get => _NodeName; set { if (OnPropertyChanging("NodeName", value)) { _NodeName = value; OnPropertyChanged("NodeName"); } } }

    private String _Action = null!;
    /// <summary>动作</summary>
    [DisplayName("动作")]
    [Description("动作")]
    [DataObjectField(false, false, false, 20)]
    [BindColumn("Action", "动作", "")]
    public String Action { get => _Action; set { if (OnPropertyChanging("Action", value)) { _Action = value; OnPropertyChanged("Action"); } } }

    private String _ActionName = null!;
    /// <summary>动作名称</summary>
    [DisplayName("动作名称")]
    [Description("动作名称")]
    [DataObjectField(false, false, false, 20)]
    [BindColumn("ActionName", "动作名称", "")]
    public String ActionName { get => _ActionName; set { if (OnPropertyChanging("ActionName", value)) { _ActionName = value; OnPropertyChanged("ActionName"); } } }

    private Int32 _OperatorId;
    /// <summary>操作人</summary>
    [DisplayName("操作人")]
    [Description("操作人")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("OperatorId", "操作人", "")]
    public Int32 OperatorId { get => _OperatorId; set { if (OnPropertyChanging("OperatorId", value)) { _OperatorId = value; OnPropertyChanged("OperatorId"); } } }

    private String _OperatorName = null!;
    /// <summary>操作人姓名</summary>
    [DisplayName("操作人姓名")]
    [Description("操作人姓名")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("OperatorName", "操作人姓名", "")]
    public String OperatorName { get => _OperatorName; set { if (OnPropertyChanging("OperatorName", value)) { _OperatorName = value; OnPropertyChanged("OperatorName"); } } }

    private String? _OperatorDept;
    /// <summary>操作人部门</summary>
    [DisplayName("操作人部门")]
    [Description("操作人部门")]
    [DataObjectField(false, false, true, 100)]
    [BindColumn("OperatorDept", "操作人部门", "")]
    public String? OperatorDept { get => _OperatorDept; set { if (OnPropertyChanging("OperatorDept", value)) { _OperatorDept = value; OnPropertyChanged("OperatorDept"); } } }

    private String? _Comment;
    /// <summary>意见</summary>
    [DisplayName("意见")]
    [Description("意见")]
    [DataObjectField(false, false, true, 2000)]
    [BindColumn("Comment", "意见", "")]
    public String? Comment { get => _Comment; set { if (OnPropertyChanging("Comment", value)) { _Comment = value; OnPropertyChanged("Comment"); } } }

    private Int32 _FromStatus;
    /// <summary>动作前状态</summary>
    [DisplayName("动作前状态")]
    [Description("动作前状态")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("FromStatus", "动作前状态", "")]
    public Int32 FromStatus { get => _FromStatus; set { if (OnPropertyChanging("FromStatus", value)) { _FromStatus = value; OnPropertyChanged("FromStatus"); } } }

    private Int32 _ToStatus;
    /// <summary>动作后状态</summary>
    [DisplayName("动作后状态")]
    [Description("动作后状态")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ToStatus", "动作后状态", "")]
    public Int32 ToStatus { get => _ToStatus; set { if (OnPropertyChanging("ToStatus", value)) { _ToStatus = value; OnPropertyChanged("ToStatus"); } } }

    private String _RequestId = null!;
    /// <summary>请求号</summary>
    [DisplayName("请求号")]
    [Description("请求号")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("RequestId", "请求号", "")]
    public String RequestId { get => _RequestId; set { if (OnPropertyChanging("RequestId", value)) { _RequestId = value; OnPropertyChanged("RequestId"); } } }

    private DateTime _CreateTime;
    /// <summary>时间</summary>
    [DisplayName("时间")]
    [Description("时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("CreateTime", "时间", "")]
    public DateTime CreateTime { get => _CreateTime; set { if (OnPropertyChanging("CreateTime", value)) { _CreateTime = value; OnPropertyChanged("CreateTime"); } } }

    private String? _CreateIP;
    /// <summary>地址</summary>
    [DisplayName("地址")]
    [Description("地址")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("CreateIP", "地址", "")]
    public String? CreateIP { get => _CreateIP; set { if (OnPropertyChanging("CreateIP", value)) { _CreateIP = value; OnPropertyChanged("CreateIP"); } } }
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
            "TaskId" => _TaskId,
            "NodeKey" => _NodeKey,
            "NodeName" => _NodeName,
            "Action" => _Action,
            "ActionName" => _ActionName,
            "OperatorId" => _OperatorId,
            "OperatorName" => _OperatorName,
            "OperatorDept" => _OperatorDept,
            "Comment" => _Comment,
            "FromStatus" => _FromStatus,
            "ToStatus" => _ToStatus,
            "RequestId" => _RequestId,
            "CreateTime" => _CreateTime,
            "CreateIP" => _CreateIP,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToLong(); break;
                case "InstanceId": _InstanceId = value.ToLong(); break;
                case "Round": _Round = value.ToInt(); break;
                case "TaskId": _TaskId = value.ToLong(); break;
                case "NodeKey": _NodeKey = Convert.ToString(value); break;
                case "NodeName": _NodeName = Convert.ToString(value); break;
                case "Action": _Action = Convert.ToString(value); break;
                case "ActionName": _ActionName = Convert.ToString(value); break;
                case "OperatorId": _OperatorId = value.ToInt(); break;
                case "OperatorName": _OperatorName = Convert.ToString(value); break;
                case "OperatorDept": _OperatorDept = Convert.ToString(value); break;
                case "Comment": _Comment = Convert.ToString(value); break;
                case "FromStatus": _FromStatus = value.ToInt(); break;
                case "ToStatus": _ToStatus = value.ToInt(); break;
                case "RequestId": _RequestId = Convert.ToString(value); break;
                case "CreateTime": _CreateTime = value.ToDateTime(); break;
                case "CreateIP": _CreateIP = Convert.ToString(value); break;
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
    public static ApprovalHistory? FindById(Int64 id)
    {
        if (id < 0) return null;

        return Find(_.Id == id);
    }

    /// <summary>根据实例查找</summary>
    /// <param name="instanceId">实例</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalHistory> FindAllByInstanceId(Int64 instanceId)
    {
        if (instanceId < 0) return [];

        return FindAll(_.InstanceId == instanceId);
    }

    /// <summary>根据实例、请求号查找</summary>
    /// <param name="instanceId">实例</param>
    /// <param name="requestId">请求号</param>
    /// <returns>实体对象</returns>
    public static ApprovalHistory? FindByInstanceIdAndRequestId(Int64 instanceId, String requestId)
    {
        if (instanceId < 0) return null;
        if (requestId.IsNullOrEmpty()) return null;

        return Find(_.InstanceId == instanceId & _.RequestId == requestId);
    }

    /// <summary>根据请求号查找</summary>
    /// <param name="requestId">请求号</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalHistory> FindAllByRequestId(String requestId)
    {
        if (requestId.IsNullOrEmpty()) return [];

        return FindAll(_.RequestId == requestId);
    }
    #endregion

    #region 高级查询
    /// <summary>高级查询</summary>
    /// <param name="instanceId">实例</param>
    /// <param name="requestId">请求号</param>
    /// <param name="start">编号开始</param>
    /// <param name="end">编号结束</param>
    /// <param name="key">关键字</param>
    /// <param name="page">分页参数信息。可携带统计和数据权限扩展查询等信息</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalHistory> Search(Int64 instanceId, String requestId, DateTime start, DateTime end, String key, PageParameter page)
    {
        var exp = new WhereExpression();

        if (instanceId >= 0) exp &= _.InstanceId == instanceId;
        if (!requestId.IsNullOrEmpty()) exp &= _.RequestId == requestId;
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
    /// <summary>取得审批历史字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>实例</summary>
        public static readonly Field InstanceId = FindByName("InstanceId");

        /// <summary>轮次</summary>
        public static readonly Field Round = FindByName("Round");

        /// <summary>任务</summary>
        public static readonly Field TaskId = FindByName("TaskId");

        /// <summary>节点键</summary>
        public static readonly Field NodeKey = FindByName("NodeKey");

        /// <summary>节点名</summary>
        public static readonly Field NodeName = FindByName("NodeName");

        /// <summary>动作</summary>
        public static readonly Field Action = FindByName("Action");

        /// <summary>动作名称</summary>
        public static readonly Field ActionName = FindByName("ActionName");

        /// <summary>操作人</summary>
        public static readonly Field OperatorId = FindByName("OperatorId");

        /// <summary>操作人姓名</summary>
        public static readonly Field OperatorName = FindByName("OperatorName");

        /// <summary>操作人部门</summary>
        public static readonly Field OperatorDept = FindByName("OperatorDept");

        /// <summary>意见</summary>
        public static readonly Field Comment = FindByName("Comment");

        /// <summary>动作前状态</summary>
        public static readonly Field FromStatus = FindByName("FromStatus");

        /// <summary>动作后状态</summary>
        public static readonly Field ToStatus = FindByName("ToStatus");

        /// <summary>请求号</summary>
        public static readonly Field RequestId = FindByName("RequestId");

        /// <summary>时间</summary>
        public static readonly Field CreateTime = FindByName("CreateTime");

        /// <summary>地址</summary>
        public static readonly Field CreateIP = FindByName("CreateIP");

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得审批历史字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号</summary>
        public const String Id = "Id";

        /// <summary>实例</summary>
        public const String InstanceId = "InstanceId";

        /// <summary>轮次</summary>
        public const String Round = "Round";

        /// <summary>任务</summary>
        public const String TaskId = "TaskId";

        /// <summary>节点键</summary>
        public const String NodeKey = "NodeKey";

        /// <summary>节点名</summary>
        public const String NodeName = "NodeName";

        /// <summary>动作</summary>
        public const String Action = "Action";

        /// <summary>动作名称</summary>
        public const String ActionName = "ActionName";

        /// <summary>操作人</summary>
        public const String OperatorId = "OperatorId";

        /// <summary>操作人姓名</summary>
        public const String OperatorName = "OperatorName";

        /// <summary>操作人部门</summary>
        public const String OperatorDept = "OperatorDept";

        /// <summary>意见</summary>
        public const String Comment = "Comment";

        /// <summary>动作前状态</summary>
        public const String FromStatus = "FromStatus";

        /// <summary>动作后状态</summary>
        public const String ToStatus = "ToStatus";

        /// <summary>请求号</summary>
        public const String RequestId = "RequestId";

        /// <summary>时间</summary>
        public const String CreateTime = "CreateTime";

        /// <summary>地址</summary>
        public const String CreateIP = "CreateIP";
    }
    #endregion
}
