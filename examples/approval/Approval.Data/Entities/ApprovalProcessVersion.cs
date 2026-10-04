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

/// <summary>流程版本。发布后定义不可变，并固化节点与连线</summary>
[Serializable]
[DataObject]
[Description("流程版本。发布后定义不可变，并固化节点与连线")]
[BindIndex("IU_ApprovalProcessVersion_ProcessId_Version", true, "ProcessId,Version")]
[BindIndex("IX_ApprovalProcessVersion_FormVersionId", false, "FormVersionId")]
[BindTable("ApprovalProcessVersion", Description = "流程版本。发布后定义不可变，并固化节点与连线", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalProcessVersion
{
    #region 属性
    private Int32 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [Description("编号")]
    [DataObjectField(true, true, false, 0)]
    [BindColumn("Id", "编号", "")]
    public Int32 Id { get => _Id; set { if (OnPropertyChanging("Id", value)) { _Id = value; OnPropertyChanged("Id"); } } }

    private Int32 _ProcessId;
    /// <summary>流程</summary>
    [DisplayName("流程")]
    [Description("流程")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ProcessId", "流程", "")]
    public Int32 ProcessId { get => _ProcessId; set { if (OnPropertyChanging("ProcessId", value)) { _ProcessId = value; OnPropertyChanged("ProcessId"); } } }

    private Int32 _Version;
    /// <summary>版本号。草稿固定为0</summary>
    [DisplayName("版本号")]
    [Description("版本号。草稿固定为0")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Version", "版本号。草稿固定为0", "")]
    public Int32 Version { get => _Version; set { if (OnPropertyChanging("Version", value)) { _Version = value; OnPropertyChanged("Version"); } } }

    private Approval.Data.Entities.VersionStatus _Status;
    /// <summary>状态</summary>
    [DisplayName("状态")]
    [Description("状态")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Status", "状态", "")]
    public Approval.Data.Entities.VersionStatus Status { get => _Status; set { if (OnPropertyChanging("Status", value)) { _Status = value; OnPropertyChanged("Status"); } } }

    private Int32 _FormVersionId;
    /// <summary>表单版本</summary>
    [DisplayName("表单版本")]
    [Description("表单版本")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("FormVersionId", "表单版本", "")]
    public Int32 FormVersionId { get => _FormVersionId; set { if (OnPropertyChanging("FormVersionId", value)) { _FormVersionId = value; OnPropertyChanged("FormVersionId"); } } }

    private String _Definition = null!;
    /// <summary>流程图</summary>
    [DisplayName("流程图")]
    [Description("流程图")]
    [DataObjectField(false, false, false, -1)]
    [BindColumn("Definition", "流程图", "")]
    public String Definition { get => _Definition; set { if (OnPropertyChanging("Definition", value)) { _Definition = value; OnPropertyChanged("Definition"); } } }

    private Int32 _NodeCount;
    /// <summary>节点数</summary>
    [DisplayName("节点数")]
    [Description("节点数")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("NodeCount", "节点数", "")]
    public Int32 NodeCount { get => _NodeCount; set { if (OnPropertyChanging("NodeCount", value)) { _NodeCount = value; OnPropertyChanged("NodeCount"); } } }

    private DateTime _PublishTime;
    /// <summary>发布时间</summary>
    [DisplayName("发布时间")]
    [Description("发布时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("PublishTime", "发布时间", "")]
    public DateTime PublishTime { get => _PublishTime; set { if (OnPropertyChanging("PublishTime", value)) { _PublishTime = value; OnPropertyChanged("PublishTime"); } } }

    private Int32 _PublishUserId;
    /// <summary>发布人</summary>
    [DisplayName("发布人")]
    [Description("发布人")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("PublishUserId", "发布人", "")]
    public Int32 PublishUserId { get => _PublishUserId; set { if (OnPropertyChanging("PublishUserId", value)) { _PublishUserId = value; OnPropertyChanged("PublishUserId"); } } }

    private String? _PublishUser;
    /// <summary>发布人姓名</summary>
    [DisplayName("发布人姓名")]
    [Description("发布人姓名")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("PublishUser", "发布人姓名", "")]
    public String? PublishUser { get => _PublishUser; set { if (OnPropertyChanging("PublishUser", value)) { _PublishUser = value; OnPropertyChanged("PublishUser"); } } }

    private String? _CreateUser;
    /// <summary>创建者</summary>
    [Category("扩展")]
    [DisplayName("创建者")]
    [Description("创建者")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("CreateUser", "创建者", "")]
    public String? CreateUser { get => _CreateUser; set { if (OnPropertyChanging("CreateUser", value)) { _CreateUser = value; OnPropertyChanged("CreateUser"); } } }

    private Int32 _CreateUserID;
    /// <summary>创建者</summary>
    [Category("扩展")]
    [DisplayName("创建者")]
    [Description("创建者")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("CreateUserID", "创建者", "")]
    public Int32 CreateUserID { get => _CreateUserID; set { if (OnPropertyChanging("CreateUserID", value)) { _CreateUserID = value; OnPropertyChanged("CreateUserID"); } } }

    private DateTime _CreateTime;
    /// <summary>创建时间</summary>
    [Category("扩展")]
    [DisplayName("创建时间")]
    [Description("创建时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("CreateTime", "创建时间", "")]
    public DateTime CreateTime { get => _CreateTime; set { if (OnPropertyChanging("CreateTime", value)) { _CreateTime = value; OnPropertyChanged("CreateTime"); } } }

    private String? _CreateIP;
    /// <summary>创建地址</summary>
    [Category("扩展")]
    [DisplayName("创建地址")]
    [Description("创建地址")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("CreateIP", "创建地址", "")]
    public String? CreateIP { get => _CreateIP; set { if (OnPropertyChanging("CreateIP", value)) { _CreateIP = value; OnPropertyChanged("CreateIP"); } } }

    private String? _UpdateUser;
    /// <summary>更新者</summary>
    [Category("扩展")]
    [DisplayName("更新者")]
    [Description("更新者")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("UpdateUser", "更新者", "")]
    public String? UpdateUser { get => _UpdateUser; set { if (OnPropertyChanging("UpdateUser", value)) { _UpdateUser = value; OnPropertyChanged("UpdateUser"); } } }

    private Int32 _UpdateUserID;
    /// <summary>更新者</summary>
    [Category("扩展")]
    [DisplayName("更新者")]
    [Description("更新者")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("UpdateUserID", "更新者", "")]
    public Int32 UpdateUserID { get => _UpdateUserID; set { if (OnPropertyChanging("UpdateUserID", value)) { _UpdateUserID = value; OnPropertyChanged("UpdateUserID"); } } }

    private DateTime _UpdateTime;
    /// <summary>更新时间</summary>
    [Category("扩展")]
    [DisplayName("更新时间")]
    [Description("更新时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("UpdateTime", "更新时间", "")]
    public DateTime UpdateTime { get => _UpdateTime; set { if (OnPropertyChanging("UpdateTime", value)) { _UpdateTime = value; OnPropertyChanged("UpdateTime"); } } }

    private String? _UpdateIP;
    /// <summary>更新地址</summary>
    [Category("扩展")]
    [DisplayName("更新地址")]
    [Description("更新地址")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("UpdateIP", "更新地址", "")]
    public String? UpdateIP { get => _UpdateIP; set { if (OnPropertyChanging("UpdateIP", value)) { _UpdateIP = value; OnPropertyChanged("UpdateIP"); } } }

    private String? _Remark;
    /// <summary>版本说明</summary>
    [DisplayName("版本说明")]
    [Description("版本说明")]
    [DataObjectField(false, false, true, 500)]
    [BindColumn("Remark", "版本说明", "")]
    public String? Remark { get => _Remark; set { if (OnPropertyChanging("Remark", value)) { _Remark = value; OnPropertyChanged("Remark"); } } }
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
            "ProcessId" => _ProcessId,
            "Version" => _Version,
            "Status" => _Status,
            "FormVersionId" => _FormVersionId,
            "Definition" => _Definition,
            "NodeCount" => _NodeCount,
            "PublishTime" => _PublishTime,
            "PublishUserId" => _PublishUserId,
            "PublishUser" => _PublishUser,
            "CreateUser" => _CreateUser,
            "CreateUserID" => _CreateUserID,
            "CreateTime" => _CreateTime,
            "CreateIP" => _CreateIP,
            "UpdateUser" => _UpdateUser,
            "UpdateUserID" => _UpdateUserID,
            "UpdateTime" => _UpdateTime,
            "UpdateIP" => _UpdateIP,
            "Remark" => _Remark,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToInt(); break;
                case "ProcessId": _ProcessId = value.ToInt(); break;
                case "Version": _Version = value.ToInt(); break;
                case "Status": _Status = (Approval.Data.Entities.VersionStatus)value.ToInt(); break;
                case "FormVersionId": _FormVersionId = value.ToInt(); break;
                case "Definition": _Definition = Convert.ToString(value); break;
                case "NodeCount": _NodeCount = value.ToInt(); break;
                case "PublishTime": _PublishTime = value.ToDateTime(); break;
                case "PublishUserId": _PublishUserId = value.ToInt(); break;
                case "PublishUser": _PublishUser = Convert.ToString(value); break;
                case "CreateUser": _CreateUser = Convert.ToString(value); break;
                case "CreateUserID": _CreateUserID = value.ToInt(); break;
                case "CreateTime": _CreateTime = value.ToDateTime(); break;
                case "CreateIP": _CreateIP = Convert.ToString(value); break;
                case "UpdateUser": _UpdateUser = Convert.ToString(value); break;
                case "UpdateUserID": _UpdateUserID = value.ToInt(); break;
                case "UpdateTime": _UpdateTime = value.ToDateTime(); break;
                case "UpdateIP": _UpdateIP = Convert.ToString(value); break;
                case "Remark": _Remark = Convert.ToString(value); break;
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
    public static ApprovalProcessVersion? FindById(Int32 id)
    {
        if (id < 0) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.Id == id);

        // 单对象缓存
        return Meta.SingleCache[id];

        //return Find(_.Id == id);
    }

    /// <summary>根据流程、版本号查找</summary>
    /// <param name="processId">流程</param>
    /// <param name="version">版本号</param>
    /// <returns>实体对象</returns>
    public static ApprovalProcessVersion? FindByProcessIdAndVersion(Int32 processId, Int32 version)
    {
        if (processId < 0) return null;
        if (version < 0) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.ProcessId == processId && e.Version == version);

        return Find(_.ProcessId == processId & _.Version == version);
    }

    /// <summary>根据流程查找</summary>
    /// <param name="processId">流程</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalProcessVersion> FindAllByProcessId(Int32 processId)
    {
        if (processId < 0) return [];

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.FindAll(e => e.ProcessId == processId);

        return FindAll(_.ProcessId == processId);
    }

    /// <summary>根据表单版本查找</summary>
    /// <param name="formVersionId">表单版本</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalProcessVersion> FindAllByFormVersionId(Int32 formVersionId)
    {
        if (formVersionId < 0) return [];

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.FindAll(e => e.FormVersionId == formVersionId);

        return FindAll(_.FormVersionId == formVersionId);
    }
    #endregion

    #region 高级查询
    /// <summary>高级查询</summary>
    /// <param name="processId">流程</param>
    /// <param name="version">版本号。草稿固定为0</param>
    /// <param name="formVersionId">表单版本</param>
    /// <param name="status">状态</param>
    /// <param name="start">更新时间开始</param>
    /// <param name="end">更新时间结束</param>
    /// <param name="key">关键字</param>
    /// <param name="page">分页参数信息。可携带统计和数据权限扩展查询等信息</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalProcessVersion> Search(Int32 processId, Int32 version, Int32 formVersionId, Approval.Data.Entities.VersionStatus status, DateTime start, DateTime end, String key, PageParameter page)
    {
        var exp = new WhereExpression();

        if (processId >= 0) exp &= _.ProcessId == processId;
        if (version >= 0) exp &= _.Version == version;
        if (formVersionId >= 0) exp &= _.FormVersionId == formVersionId;
        if (status >= 0) exp &= _.Status == status;
        exp &= _.UpdateTime.Between(start, end);
        if (!key.IsNullOrEmpty()) exp &= SearchWhereByKeys(key);

        return FindAll(exp, page);
    }
    #endregion

    #region 字段名
    /// <summary>取得流程版本字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>流程</summary>
        public static readonly Field ProcessId = FindByName("ProcessId");

        /// <summary>版本号。草稿固定为0</summary>
        public static readonly Field Version = FindByName("Version");

        /// <summary>状态</summary>
        public static readonly Field Status = FindByName("Status");

        /// <summary>表单版本</summary>
        public static readonly Field FormVersionId = FindByName("FormVersionId");

        /// <summary>流程图</summary>
        public static readonly Field Definition = FindByName("Definition");

        /// <summary>节点数</summary>
        public static readonly Field NodeCount = FindByName("NodeCount");

        /// <summary>发布时间</summary>
        public static readonly Field PublishTime = FindByName("PublishTime");

        /// <summary>发布人</summary>
        public static readonly Field PublishUserId = FindByName("PublishUserId");

        /// <summary>发布人姓名</summary>
        public static readonly Field PublishUser = FindByName("PublishUser");

        /// <summary>创建者</summary>
        public static readonly Field CreateUser = FindByName("CreateUser");

        /// <summary>创建者</summary>
        public static readonly Field CreateUserID = FindByName("CreateUserID");

        /// <summary>创建时间</summary>
        public static readonly Field CreateTime = FindByName("CreateTime");

        /// <summary>创建地址</summary>
        public static readonly Field CreateIP = FindByName("CreateIP");

        /// <summary>更新者</summary>
        public static readonly Field UpdateUser = FindByName("UpdateUser");

        /// <summary>更新者</summary>
        public static readonly Field UpdateUserID = FindByName("UpdateUserID");

        /// <summary>更新时间</summary>
        public static readonly Field UpdateTime = FindByName("UpdateTime");

        /// <summary>更新地址</summary>
        public static readonly Field UpdateIP = FindByName("UpdateIP");

        /// <summary>版本说明</summary>
        public static readonly Field Remark = FindByName("Remark");

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得流程版本字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号</summary>
        public const String Id = "Id";

        /// <summary>流程</summary>
        public const String ProcessId = "ProcessId";

        /// <summary>版本号。草稿固定为0</summary>
        public const String Version = "Version";

        /// <summary>状态</summary>
        public const String Status = "Status";

        /// <summary>表单版本</summary>
        public const String FormVersionId = "FormVersionId";

        /// <summary>流程图</summary>
        public const String Definition = "Definition";

        /// <summary>节点数</summary>
        public const String NodeCount = "NodeCount";

        /// <summary>发布时间</summary>
        public const String PublishTime = "PublishTime";

        /// <summary>发布人</summary>
        public const String PublishUserId = "PublishUserId";

        /// <summary>发布人姓名</summary>
        public const String PublishUser = "PublishUser";

        /// <summary>创建者</summary>
        public const String CreateUser = "CreateUser";

        /// <summary>创建者</summary>
        public const String CreateUserID = "CreateUserID";

        /// <summary>创建时间</summary>
        public const String CreateTime = "CreateTime";

        /// <summary>创建地址</summary>
        public const String CreateIP = "CreateIP";

        /// <summary>更新者</summary>
        public const String UpdateUser = "UpdateUser";

        /// <summary>更新者</summary>
        public const String UpdateUserID = "UpdateUserID";

        /// <summary>更新时间</summary>
        public const String UpdateTime = "UpdateTime";

        /// <summary>更新地址</summary>
        public const String UpdateIP = "UpdateIP";

        /// <summary>版本说明</summary>
        public const String Remark = "Remark";
    }
    #endregion
}
