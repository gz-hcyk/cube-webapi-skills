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

/// <summary>流程连线。随流程版本发布后不可变</summary>
[Serializable]
[DataObject]
[Description("流程连线。随流程版本发布后不可变")]
[BindIndex("IU_ApprovalTransition_ProcessVersionId_EdgeKey", true, "ProcessVersionId,EdgeKey")]
[BindIndex("IX_ApprovalTransition_ProcessVersionId_FromKey", false, "ProcessVersionId,FromKey")]
[BindTable("ApprovalTransition", Description = "流程连线。随流程版本发布后不可变", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalTransition
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

    private String _EdgeKey = null!;
    /// <summary>连线键</summary>
    [DisplayName("连线键")]
    [Description("连线键")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("EdgeKey", "连线键", "")]
    public String EdgeKey { get => _EdgeKey; set { if (OnPropertyChanging("EdgeKey", value)) { _EdgeKey = value; OnPropertyChanged("EdgeKey"); } } }

    private String _FromKey = null!;
    /// <summary>起点</summary>
    [DisplayName("起点")]
    [Description("起点")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("FromKey", "起点", "")]
    public String FromKey { get => _FromKey; set { if (OnPropertyChanging("FromKey", value)) { _FromKey = value; OnPropertyChanged("FromKey"); } } }

    private String _ToKey = null!;
    /// <summary>终点</summary>
    [DisplayName("终点")]
    [Description("终点")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("ToKey", "终点", "")]
    public String ToKey { get => _ToKey; set { if (OnPropertyChanging("ToKey", value)) { _ToKey = value; OnPropertyChanged("ToKey"); } } }

    private Boolean _IsDefault;
    /// <summary>默认出线</summary>
    [DisplayName("默认出线")]
    [Description("默认出线")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("IsDefault", "默认出线", "")]
    public Boolean IsDefault { get => _IsDefault; set { if (OnPropertyChanging("IsDefault", value)) { _IsDefault = value; OnPropertyChanged("IsDefault"); } } }

    private Int32 _Priority;
    /// <summary>优先级</summary>
    [DisplayName("优先级")]
    [Description("优先级")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Priority", "优先级", "")]
    public Int32 Priority { get => _Priority; set { if (OnPropertyChanging("Priority", value)) { _Priority = value; OnPropertyChanged("Priority"); } } }

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
            "EdgeKey" => _EdgeKey,
            "FromKey" => _FromKey,
            "ToKey" => _ToKey,
            "IsDefault" => _IsDefault,
            "Priority" => _Priority,
            "Sort" => _Sort,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToInt(); break;
                case "ProcessVersionId": _ProcessVersionId = value.ToInt(); break;
                case "EdgeKey": _EdgeKey = Convert.ToString(value); break;
                case "FromKey": _FromKey = Convert.ToString(value); break;
                case "ToKey": _ToKey = Convert.ToString(value); break;
                case "IsDefault": _IsDefault = value.ToBoolean(); break;
                case "Priority": _Priority = value.ToInt(); break;
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
    public static ApprovalTransition? FindById(Int32 id)
    {
        if (id < 0) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.Id == id);

        // 单对象缓存
        return Meta.SingleCache[id];

        //return Find(_.Id == id);
    }

    /// <summary>根据流程版本、连线键查找</summary>
    /// <param name="processVersionId">流程版本</param>
    /// <param name="edgeKey">连线键</param>
    /// <returns>实体对象</returns>
    public static ApprovalTransition? FindByProcessVersionIdAndEdgeKey(Int32 processVersionId, String edgeKey)
    {
        if (processVersionId < 0) return null;
        if (edgeKey.IsNullOrEmpty()) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.ProcessVersionId == processVersionId && e.EdgeKey.EqualIgnoreCase(edgeKey));

        return Find(_.ProcessVersionId == processVersionId & _.EdgeKey == edgeKey);
    }

    /// <summary>根据流程版本查找</summary>
    /// <param name="processVersionId">流程版本</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalTransition> FindAllByProcessVersionId(Int32 processVersionId)
    {
        if (processVersionId < 0) return [];

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.FindAll(e => e.ProcessVersionId == processVersionId);

        return FindAll(_.ProcessVersionId == processVersionId);
    }

    /// <summary>根据流程版本、起点查找</summary>
    /// <param name="processVersionId">流程版本</param>
    /// <param name="fromKey">起点</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalTransition> FindAllByProcessVersionIdAndFromKey(Int32 processVersionId, String fromKey)
    {
        if (processVersionId < 0) return [];
        if (fromKey.IsNullOrEmpty()) return [];

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.FindAll(e => e.ProcessVersionId == processVersionId && e.FromKey.EqualIgnoreCase(fromKey));

        return FindAll(_.ProcessVersionId == processVersionId & _.FromKey == fromKey);
    }
    #endregion

    #region 高级查询
    /// <summary>高级查询</summary>
    /// <param name="processVersionId">流程版本</param>
    /// <param name="edgeKey">连线键</param>
    /// <param name="fromKey">起点</param>
    /// <param name="isDefault">默认出线</param>
    /// <param name="key">关键字</param>
    /// <param name="page">分页参数信息。可携带统计和数据权限扩展查询等信息</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalTransition> Search(Int32 processVersionId, String edgeKey, String fromKey, Boolean? isDefault, String key, PageParameter page)
    {
        var exp = new WhereExpression();

        if (processVersionId >= 0) exp &= _.ProcessVersionId == processVersionId;
        if (!edgeKey.IsNullOrEmpty()) exp &= _.EdgeKey == edgeKey;
        if (!fromKey.IsNullOrEmpty()) exp &= _.FromKey == fromKey;
        if (isDefault != null) exp &= _.IsDefault == isDefault;
        if (!key.IsNullOrEmpty()) exp &= SearchWhereByKeys(key);

        return FindAll(exp, page);
    }
    #endregion

    #region 字段名
    /// <summary>取得流程连线字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>流程版本</summary>
        public static readonly Field ProcessVersionId = FindByName("ProcessVersionId");

        /// <summary>连线键</summary>
        public static readonly Field EdgeKey = FindByName("EdgeKey");

        /// <summary>起点</summary>
        public static readonly Field FromKey = FindByName("FromKey");

        /// <summary>终点</summary>
        public static readonly Field ToKey = FindByName("ToKey");

        /// <summary>默认出线</summary>
        public static readonly Field IsDefault = FindByName("IsDefault");

        /// <summary>优先级</summary>
        public static readonly Field Priority = FindByName("Priority");

        /// <summary>排序</summary>
        public static readonly Field Sort = FindByName("Sort");

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得流程连线字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号</summary>
        public const String Id = "Id";

        /// <summary>流程版本</summary>
        public const String ProcessVersionId = "ProcessVersionId";

        /// <summary>连线键</summary>
        public const String EdgeKey = "EdgeKey";

        /// <summary>起点</summary>
        public const String FromKey = "FromKey";

        /// <summary>终点</summary>
        public const String ToKey = "ToKey";

        /// <summary>默认出线</summary>
        public const String IsDefault = "IsDefault";

        /// <summary>优先级</summary>
        public const String Priority = "Priority";

        /// <summary>排序</summary>
        public const String Sort = "Sort";
    }
    #endregion
}
