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

/// <summary>流程节点。随流程版本发布后不可变</summary>
[Serializable]
[DataObject]
[Description("流程节点。随流程版本发布后不可变")]
[BindIndex("IU_ApprovalNode_ProcessVersionId_NodeKey", true, "ProcessVersionId,NodeKey")]
[BindTable("ApprovalNode", Description = "流程节点。随流程版本发布后不可变", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalNode
{
    #region 属性
    private Int32 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [Description("编号")]
    [DataObjectField(true, true, false, 0)]
    [BindColumn("Id", "编号", "")]
    public Int32 Id { get => _Id; set { if (OnPropertyChanging("Id", value)) { _Id = value; OnPropertyChanged("Id"); } } }

    private Int32 _ProcessVersionId;
    /// <summary>流程版本</summary>
    [DisplayName("流程版本")]
    [Description("流程版本")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ProcessVersionId", "流程版本", "")]
    public Int32 ProcessVersionId { get => _ProcessVersionId; set { if (OnPropertyChanging("ProcessVersionId", value)) { _ProcessVersionId = value; OnPropertyChanged("ProcessVersionId"); } } }

    private String _NodeKey = null!;
    /// <summary>节点键</summary>
    [DisplayName("节点键")]
    [Description("节点键")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("NodeKey", "节点键", "")]
    public String NodeKey { get => _NodeKey; set { if (OnPropertyChanging("NodeKey", value)) { _NodeKey = value; OnPropertyChanged("NodeKey"); } } }

    private String _Name = null!;
    /// <summary>名称</summary>
    [DisplayName("名称")]
    [Description("名称")]
    [DataObjectField(false, false, false, 100)]
    [BindColumn("Name", "名称", "", Master = true)]
    public String Name { get => _Name; set { if (OnPropertyChanging("Name", value)) { _Name = value; OnPropertyChanged("Name"); } } }

    private String _NodeType = null!;
    /// <summary>节点类型</summary>
    [DisplayName("节点类型")]
    [Description("节点类型")]
    [DataObjectField(false, false, false, 20)]
    [BindColumn("NodeType", "节点类型", "")]
    public String NodeType { get => _NodeType; set { if (OnPropertyChanging("NodeType", value)) { _NodeType = value; OnPropertyChanged("NodeType"); } } }

    private Approval.Data.Entities.ApproveMode _ApproveMode;
    /// <summary>处理方式</summary>
    [DisplayName("处理方式")]
    [Description("处理方式")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ApproveMode", "处理方式", "")]
    public Approval.Data.Entities.ApproveMode ApproveMode { get => _ApproveMode; set { if (OnPropertyChanging("ApproveMode", value)) { _ApproveMode = value; OnPropertyChanged("ApproveMode"); } } }

    private String? _AssigneeType;
    /// <summary>办理人规则</summary>
    [DisplayName("办理人规则")]
    [Description("办理人规则")]
    [DataObjectField(false, false, true, 30)]
    [BindColumn("AssigneeType", "办理人规则", "")]
    public String? AssigneeType { get => _AssigneeType; set { if (OnPropertyChanging("AssigneeType", value)) { _AssigneeType = value; OnPropertyChanged("AssigneeType"); } } }

    private String? _AssigneeJson;
    /// <summary>办理人参数</summary>
    [DisplayName("办理人参数")]
    [Description("办理人参数")]
    [DataObjectField(false, false, true, 2000)]
    [BindColumn("AssigneeJson", "办理人参数", "")]
    public String? AssigneeJson { get => _AssigneeJson; set { if (OnPropertyChanging("AssigneeJson", value)) { _AssigneeJson = value; OnPropertyChanged("AssigneeJson"); } } }

    private Int32 _Sort;
    /// <summary>排序</summary>
    [DisplayName("排序")]
    [Description("排序")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Sort", "排序", "")]
    public Int32 Sort { get => _Sort; set { if (OnPropertyChanging("Sort", value)) { _Sort = value; OnPropertyChanged("Sort"); } } }
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
            "ProcessVersionId" => _ProcessVersionId,
            "NodeKey" => _NodeKey,
            "Name" => _Name,
            "NodeType" => _NodeType,
            "ApproveMode" => _ApproveMode,
            "AssigneeType" => _AssigneeType,
            "AssigneeJson" => _AssigneeJson,
            "Sort" => _Sort,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToInt(); break;
                case "ProcessVersionId": _ProcessVersionId = value.ToInt(); break;
                case "NodeKey": _NodeKey = Convert.ToString(value); break;
                case "Name": _Name = Convert.ToString(value); break;
                case "NodeType": _NodeType = Convert.ToString(value); break;
                case "ApproveMode": _ApproveMode = (Approval.Data.Entities.ApproveMode)value.ToInt(); break;
                case "AssigneeType": _AssigneeType = Convert.ToString(value); break;
                case "AssigneeJson": _AssigneeJson = Convert.ToString(value); break;
                case "Sort": _Sort = value.ToInt(); break;
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
    public static ApprovalNode? FindById(Int32 id)
    {
        if (id < 0) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.Id == id);

        // 单对象缓存
        return Meta.SingleCache[id];

        //return Find(_.Id == id);
    }

    /// <summary>根据流程版本、节点键查找</summary>
    /// <param name="processVersionId">流程版本</param>
    /// <param name="nodeKey">节点键</param>
    /// <returns>实体对象</returns>
    public static ApprovalNode? FindByProcessVersionIdAndNodeKey(Int32 processVersionId, String nodeKey)
    {
        if (processVersionId < 0) return null;
        if (nodeKey.IsNullOrEmpty()) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.ProcessVersionId == processVersionId && e.NodeKey.EqualIgnoreCase(nodeKey));

        return Find(_.ProcessVersionId == processVersionId & _.NodeKey == nodeKey);
    }

    /// <summary>根据流程版本查找</summary>
    /// <param name="processVersionId">流程版本</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalNode> FindAllByProcessVersionId(Int32 processVersionId)
    {
        if (processVersionId < 0) return [];

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.FindAll(e => e.ProcessVersionId == processVersionId);

        return FindAll(_.ProcessVersionId == processVersionId);
    }
    #endregion

    #region 高级查询
    /// <summary>高级查询</summary>
    /// <param name="processVersionId">流程版本</param>
    /// <param name="nodeKey">节点键</param>
    /// <param name="approveMode">处理方式</param>
    /// <param name="key">关键字</param>
    /// <param name="page">分页参数信息。可携带统计和数据权限扩展查询等信息</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalNode> Search(Int32 processVersionId, String nodeKey, Approval.Data.Entities.ApproveMode approveMode, String key, PageParameter page)
    {
        var exp = new WhereExpression();

        if (processVersionId >= 0) exp &= _.ProcessVersionId == processVersionId;
        if (!nodeKey.IsNullOrEmpty()) exp &= _.NodeKey == nodeKey;
        if (approveMode >= 0) exp &= _.ApproveMode == approveMode;
        if (!key.IsNullOrEmpty()) exp &= SearchWhereByKeys(key);

        return FindAll(exp, page);
    }
    #endregion

    #region 字段名
    /// <summary>取得流程节点字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>流程版本</summary>
        public static readonly Field ProcessVersionId = FindByName("ProcessVersionId");

        /// <summary>节点键</summary>
        public static readonly Field NodeKey = FindByName("NodeKey");

        /// <summary>名称</summary>
        public static readonly Field Name = FindByName("Name");

        /// <summary>节点类型</summary>
        public static readonly Field NodeType = FindByName("NodeType");

        /// <summary>处理方式</summary>
        public static readonly Field ApproveMode = FindByName("ApproveMode");

        /// <summary>办理人规则</summary>
        public static readonly Field AssigneeType = FindByName("AssigneeType");

        /// <summary>办理人参数</summary>
        public static readonly Field AssigneeJson = FindByName("AssigneeJson");

        /// <summary>排序</summary>
        public static readonly Field Sort = FindByName("Sort");

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得流程节点字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号</summary>
        public const String Id = "Id";

        /// <summary>流程版本</summary>
        public const String ProcessVersionId = "ProcessVersionId";

        /// <summary>节点键</summary>
        public const String NodeKey = "NodeKey";

        /// <summary>名称</summary>
        public const String Name = "Name";

        /// <summary>节点类型</summary>
        public const String NodeType = "NodeType";

        /// <summary>处理方式</summary>
        public const String ApproveMode = "ApproveMode";

        /// <summary>办理人规则</summary>
        public const String AssigneeType = "AssigneeType";

        /// <summary>办理人参数</summary>
        public const String AssigneeJson = "AssigneeJson";

        /// <summary>排序</summary>
        public const String Sort = "Sort";
    }
    #endregion
}
