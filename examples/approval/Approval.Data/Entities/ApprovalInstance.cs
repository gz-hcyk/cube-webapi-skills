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

/// <summary>审批实例。请假单携带业务主体与可选代发人</summary>
[Serializable]
[DataObject]
[Description("审批实例。请假单携带业务主体与可选代发人")]
[BindIndex("IU_ApprovalInstance_No", true, "No")]
[BindIndex("IX_ApprovalInstance_UserId_Status_Id", false, "UserId,Status,Id")]
[BindIndex("IX_ApprovalInstance_ProcessId_Status_Id", false, "ProcessId,Status,Id")]
[BindIndex("IX_ApprovalInstance_SubjectUserId", false, "SubjectUserId")]
[BindTable("ApprovalInstance", Description = "审批实例。请假单携带业务主体与可选代发人", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalInstance
{
    #region 属性
    private Int64 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [Description("编号")]
    [DataObjectField(true, false, false, 0)]
    [BindColumn("Id", "编号", "", DataScale = "time")]
    public Int64 Id { get => _Id; set { if (OnPropertyChanging("Id", value)) { _Id = value; OnPropertyChanged("Id"); } } }

    private String? _No;
    /// <summary>实例编号</summary>
    [DisplayName("实例编号")]
    [Description("实例编号")]
    [DataObjectField(false, false, true, 30)]
    [BindColumn("No", "实例编号", "")]
    public String? No { get => _No; set { if (OnPropertyChanging("No", value)) { _No = value; OnPropertyChanged("No"); } } }

    private String _Title = null!;
    /// <summary>标题</summary>
    [DisplayName("标题")]
    [Description("标题")]
    [DataObjectField(false, false, false, 200)]
    [BindColumn("Title", "标题", "", Master = true)]
    public String Title { get => _Title; set { if (OnPropertyChanging("Title", value)) { _Title = value; OnPropertyChanged("Title"); } } }

    private Int32 _ProcessId;
    /// <summary>流程</summary>
    [DisplayName("流程")]
    [Description("流程")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ProcessId", "流程", "")]
    public Int32 ProcessId { get => _ProcessId; set { if (OnPropertyChanging("ProcessId", value)) { _ProcessId = value; OnPropertyChanged("ProcessId"); } } }

    private Int32 _ProcessVersionId;
    /// <summary>流程版本</summary>
    [DisplayName("流程版本")]
    [Description("流程版本")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ProcessVersionId", "流程版本", "")]
    public Int32 ProcessVersionId { get => _ProcessVersionId; set { if (OnPropertyChanging("ProcessVersionId", value)) { _ProcessVersionId = value; OnPropertyChanged("ProcessVersionId"); } } }

    private Int32 _FormVersionId;
    /// <summary>表单版本</summary>
    [DisplayName("表单版本")]
    [Description("表单版本")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("FormVersionId", "表单版本", "")]
    public Int32 FormVersionId { get => _FormVersionId; set { if (OnPropertyChanging("FormVersionId", value)) { _FormVersionId = value; OnPropertyChanged("FormVersionId"); } } }

    private String _ProcessName = null!;
    /// <summary>流程名</summary>
    [DisplayName("流程名")]
    [Description("流程名")]
    [DataObjectField(false, false, false, 100)]
    [BindColumn("ProcessName", "流程名", "")]
    public String ProcessName { get => _ProcessName; set { if (OnPropertyChanging("ProcessName", value)) { _ProcessName = value; OnPropertyChanged("ProcessName"); } } }

    private Int32 _CategoryId;
    /// <summary>分类</summary>
    [DisplayName("分类")]
    [Description("分类")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("CategoryId", "分类", "")]
    public Int32 CategoryId { get => _CategoryId; set { if (OnPropertyChanging("CategoryId", value)) { _CategoryId = value; OnPropertyChanged("CategoryId"); } } }

    private Int32 _UserId;
    /// <summary>发起人</summary>
    [DisplayName("发起人")]
    [Description("发起人")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("UserId", "发起人", "")]
    public Int32 UserId { get => _UserId; set { if (OnPropertyChanging("UserId", value)) { _UserId = value; OnPropertyChanged("UserId"); } } }

    private String _UserName = null!;
    /// <summary>发起人姓名</summary>
    [DisplayName("发起人姓名")]
    [Description("发起人姓名")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("UserName", "发起人姓名", "")]
    public String UserName { get => _UserName; set { if (OnPropertyChanging("UserName", value)) { _UserName = value; OnPropertyChanged("UserName"); } } }

    private Int32 _DepartmentId;
    /// <summary>发起部门</summary>
    [DisplayName("发起部门")]
    [Description("发起部门")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("DepartmentId", "发起部门", "")]
    public Int32 DepartmentId { get => _DepartmentId; set { if (OnPropertyChanging("DepartmentId", value)) { _DepartmentId = value; OnPropertyChanged("DepartmentId"); } } }

    private String? _DepartmentName;
    /// <summary>部门名</summary>
    [DisplayName("部门名")]
    [Description("部门名")]
    [DataObjectField(false, false, true, 100)]
    [BindColumn("DepartmentName", "部门名", "")]
    public String? DepartmentName { get => _DepartmentName; set { if (OnPropertyChanging("DepartmentName", value)) { _DepartmentName = value; OnPropertyChanged("DepartmentName"); } } }

    private Int32 _SubjectUserId;
    /// <summary>业务主体。学生</summary>
    [DisplayName("业务主体")]
    [Description("业务主体。学生")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("SubjectUserId", "业务主体。学生", "")]
    public Int32 SubjectUserId { get => _SubjectUserId; set { if (OnPropertyChanging("SubjectUserId", value)) { _SubjectUserId = value; OnPropertyChanged("SubjectUserId"); } } }

    private String _SubjectName = null!;
    /// <summary>业务主体姓名</summary>
    [DisplayName("业务主体姓名")]
    [Description("业务主体姓名")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("SubjectName", "业务主体姓名", "")]
    public String SubjectName { get => _SubjectName; set { if (OnPropertyChanging("SubjectName", value)) { _SubjectName = value; OnPropertyChanged("SubjectName"); } } }

    private Int32 _ProxyUserId;
    /// <summary>代发人。0表示本人发起</summary>
    [DisplayName("代发人")]
    [Description("代发人。0表示本人发起")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("ProxyUserId", "代发人。0表示本人发起", "")]
    public Int32 ProxyUserId { get => _ProxyUserId; set { if (OnPropertyChanging("ProxyUserId", value)) { _ProxyUserId = value; OnPropertyChanged("ProxyUserId"); } } }

    private String? _ProxyName;
    /// <summary>代发人姓名</summary>
    [DisplayName("代发人姓名")]
    [Description("代发人姓名")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("ProxyName", "代发人姓名", "")]
    public String? ProxyName { get => _ProxyName; set { if (OnPropertyChanging("ProxyName", value)) { _ProxyName = value; OnPropertyChanged("ProxyName"); } } }

    private Int32 _CounselorUserId;
    /// <summary>该生辅导员。存在业务单上</summary>
    [DisplayName("该生辅导员")]
    [Description("该生辅导员。存在业务单上")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("CounselorUserId", "该生辅导员。存在业务单上", "")]
    public Int32 CounselorUserId { get => _CounselorUserId; set { if (OnPropertyChanging("CounselorUserId", value)) { _CounselorUserId = value; OnPropertyChanged("CounselorUserId"); } } }

    private Approval.Data.Entities.InstanceStatus _Status;
    /// <summary>状态</summary>
    [DisplayName("状态")]
    [Description("状态")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Status", "状态", "")]
    public Approval.Data.Entities.InstanceStatus Status { get => _Status; set { if (OnPropertyChanging("Status", value)) { _Status = value; OnPropertyChanged("Status"); } } }

    private Int32 _Round;
    /// <summary>轮次</summary>
    [DisplayName("轮次")]
    [Description("轮次")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Round", "轮次", "")]
    public Int32 Round { get => _Round; set { if (OnPropertyChanging("Round", value)) { _Round = value; OnPropertyChanged("Round"); } } }

    private String? _CurrentNodes;
    /// <summary>当前节点</summary>
    [DisplayName("当前节点")]
    [Description("当前节点")]
    [DataObjectField(false, false, true, 500)]
    [BindColumn("CurrentNodes", "当前节点", "")]
    public String? CurrentNodes { get => _CurrentNodes; set { if (OnPropertyChanging("CurrentNodes", value)) { _CurrentNodes = value; OnPropertyChanged("CurrentNodes"); } } }

    private DateTime _StartTime;
    /// <summary>提交时间</summary>
    [DisplayName("提交时间")]
    [Description("提交时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("StartTime", "提交时间", "")]
    public DateTime StartTime { get => _StartTime; set { if (OnPropertyChanging("StartTime", value)) { _StartTime = value; OnPropertyChanged("StartTime"); } } }

    private DateTime _EndTime;
    /// <summary>结束时间</summary>
    [DisplayName("结束时间")]
    [Description("结束时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("EndTime", "结束时间", "")]
    public DateTime EndTime { get => _EndTime; set { if (OnPropertyChanging("EndTime", value)) { _EndTime = value; OnPropertyChanged("EndTime"); } } }

    private DateTime _LastActionTime;
    /// <summary>最后动作时间</summary>
    [DisplayName("最后动作时间")]
    [Description("最后动作时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("LastActionTime", "最后动作时间", "")]
    public DateTime LastActionTime { get => _LastActionTime; set { if (OnPropertyChanging("LastActionTime", value)) { _LastActionTime = value; OnPropertyChanged("LastActionTime"); } } }

    private Int32 _Version;
    /// <summary>乐观锁</summary>
    [DisplayName("乐观锁")]
    [Description("乐观锁")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Version", "乐观锁", "")]
    public Int32 Version { get => _Version; set { if (OnPropertyChanging("Version", value)) { _Version = value; OnPropertyChanged("Version"); } } }

    private Boolean _IsAbnormal;
    /// <summary>异常</summary>
    [DisplayName("异常")]
    [Description("异常")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("IsAbnormal", "异常", "")]
    public Boolean IsAbnormal { get => _IsAbnormal; set { if (OnPropertyChanging("IsAbnormal", value)) { _IsAbnormal = value; OnPropertyChanged("IsAbnormal"); } } }

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
            "No" => _No,
            "Title" => _Title,
            "ProcessId" => _ProcessId,
            "ProcessVersionId" => _ProcessVersionId,
            "FormVersionId" => _FormVersionId,
            "ProcessName" => _ProcessName,
            "CategoryId" => _CategoryId,
            "UserId" => _UserId,
            "UserName" => _UserName,
            "DepartmentId" => _DepartmentId,
            "DepartmentName" => _DepartmentName,
            "SubjectUserId" => _SubjectUserId,
            "SubjectName" => _SubjectName,
            "ProxyUserId" => _ProxyUserId,
            "ProxyName" => _ProxyName,
            "CounselorUserId" => _CounselorUserId,
            "Status" => _Status,
            "Round" => _Round,
            "CurrentNodes" => _CurrentNodes,
            "StartTime" => _StartTime,
            "EndTime" => _EndTime,
            "LastActionTime" => _LastActionTime,
            "Version" => _Version,
            "IsAbnormal" => _IsAbnormal,
            "CreateUser" => _CreateUser,
            "CreateUserID" => _CreateUserID,
            "CreateTime" => _CreateTime,
            "CreateIP" => _CreateIP,
            "UpdateUser" => _UpdateUser,
            "UpdateUserID" => _UpdateUserID,
            "UpdateTime" => _UpdateTime,
            "UpdateIP" => _UpdateIP,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToLong(); break;
                case "No": _No = Convert.ToString(value); break;
                case "Title": _Title = Convert.ToString(value); break;
                case "ProcessId": _ProcessId = value.ToInt(); break;
                case "ProcessVersionId": _ProcessVersionId = value.ToInt(); break;
                case "FormVersionId": _FormVersionId = value.ToInt(); break;
                case "ProcessName": _ProcessName = Convert.ToString(value); break;
                case "CategoryId": _CategoryId = value.ToInt(); break;
                case "UserId": _UserId = value.ToInt(); break;
                case "UserName": _UserName = Convert.ToString(value); break;
                case "DepartmentId": _DepartmentId = value.ToInt(); break;
                case "DepartmentName": _DepartmentName = Convert.ToString(value); break;
                case "SubjectUserId": _SubjectUserId = value.ToInt(); break;
                case "SubjectName": _SubjectName = Convert.ToString(value); break;
                case "ProxyUserId": _ProxyUserId = value.ToInt(); break;
                case "ProxyName": _ProxyName = Convert.ToString(value); break;
                case "CounselorUserId": _CounselorUserId = value.ToInt(); break;
                case "Status": _Status = (Approval.Data.Entities.InstanceStatus)value.ToInt(); break;
                case "Round": _Round = value.ToInt(); break;
                case "CurrentNodes": _CurrentNodes = Convert.ToString(value); break;
                case "StartTime": _StartTime = value.ToDateTime(); break;
                case "EndTime": _EndTime = value.ToDateTime(); break;
                case "LastActionTime": _LastActionTime = value.ToDateTime(); break;
                case "Version": _Version = value.ToInt(); break;
                case "IsAbnormal": _IsAbnormal = value.ToBoolean(); break;
                case "CreateUser": _CreateUser = Convert.ToString(value); break;
                case "CreateUserID": _CreateUserID = value.ToInt(); break;
                case "CreateTime": _CreateTime = value.ToDateTime(); break;
                case "CreateIP": _CreateIP = Convert.ToString(value); break;
                case "UpdateUser": _UpdateUser = Convert.ToString(value); break;
                case "UpdateUserID": _UpdateUserID = value.ToInt(); break;
                case "UpdateTime": _UpdateTime = value.ToDateTime(); break;
                case "UpdateIP": _UpdateIP = Convert.ToString(value); break;
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
    public static ApprovalInstance? FindById(Int64 id)
    {
        if (id < 0) return null;

        return Find(_.Id == id);
    }

    /// <summary>根据实例编号查找</summary>
    /// <param name="no">实例编号</param>
    /// <returns>实体对象</returns>
    public static ApprovalInstance? FindByNo(String? no)
    {
        if (no == null) return null;

        return Find(_.No == no);
    }

    /// <summary>根据发起人、状态查找</summary>
    /// <param name="userId">发起人</param>
    /// <param name="status">状态</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalInstance> FindAllByUserIdAndStatus(Int32 userId, Approval.Data.Entities.InstanceStatus status)
    {
        if (userId < 0) return [];
        if (status < 0) return [];

        return FindAll(_.UserId == userId & _.Status == status);
    }

    /// <summary>根据流程、状态查找</summary>
    /// <param name="processId">流程</param>
    /// <param name="status">状态</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalInstance> FindAllByProcessIdAndStatus(Int32 processId, Approval.Data.Entities.InstanceStatus status)
    {
        if (processId < 0) return [];
        if (status < 0) return [];

        return FindAll(_.ProcessId == processId & _.Status == status);
    }

    /// <summary>根据业务主体查找</summary>
    /// <param name="subjectUserId">业务主体</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalInstance> FindAllBySubjectUserId(Int32 subjectUserId)
    {
        if (subjectUserId < 0) return [];

        return FindAll(_.SubjectUserId == subjectUserId);
    }
    #endregion

    #region 高级查询
    /// <summary>高级查询</summary>
    /// <param name="no">实例编号</param>
    /// <param name="processId">流程</param>
    /// <param name="userId">发起人</param>
    /// <param name="subjectUserId">业务主体。学生</param>
    /// <param name="status">状态</param>
    /// <param name="isAbnormal">异常</param>
    /// <param name="start">编号开始</param>
    /// <param name="end">编号结束</param>
    /// <param name="key">关键字</param>
    /// <param name="page">分页参数信息。可携带统计和数据权限扩展查询等信息</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalInstance> Search(String? no, Int32 processId, Int32 userId, Int32 subjectUserId, Approval.Data.Entities.InstanceStatus status, Boolean? isAbnormal, DateTime start, DateTime end, String key, PageParameter page)
    {
        var exp = new WhereExpression();

        if (!no.IsNullOrEmpty()) exp &= _.No == no;
        if (processId >= 0) exp &= _.ProcessId == processId;
        if (userId >= 0) exp &= _.UserId == userId;
        if (subjectUserId >= 0) exp &= _.SubjectUserId == subjectUserId;
        if (status >= 0) exp &= _.Status == status;
        if (isAbnormal != null) exp &= _.IsAbnormal == isAbnormal;
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
    /// <summary>取得审批实例字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>实例编号</summary>
        public static readonly Field No = FindByName("No");

        /// <summary>标题</summary>
        public static readonly Field Title = FindByName("Title");

        /// <summary>流程</summary>
        public static readonly Field ProcessId = FindByName("ProcessId");

        /// <summary>流程版本</summary>
        public static readonly Field ProcessVersionId = FindByName("ProcessVersionId");

        /// <summary>表单版本</summary>
        public static readonly Field FormVersionId = FindByName("FormVersionId");

        /// <summary>流程名</summary>
        public static readonly Field ProcessName = FindByName("ProcessName");

        /// <summary>分类</summary>
        public static readonly Field CategoryId = FindByName("CategoryId");

        /// <summary>发起人</summary>
        public static readonly Field UserId = FindByName("UserId");

        /// <summary>发起人姓名</summary>
        public static readonly Field UserName = FindByName("UserName");

        /// <summary>发起部门</summary>
        public static readonly Field DepartmentId = FindByName("DepartmentId");

        /// <summary>部门名</summary>
        public static readonly Field DepartmentName = FindByName("DepartmentName");

        /// <summary>业务主体。学生</summary>
        public static readonly Field SubjectUserId = FindByName("SubjectUserId");

        /// <summary>业务主体姓名</summary>
        public static readonly Field SubjectName = FindByName("SubjectName");

        /// <summary>代发人。0表示本人发起</summary>
        public static readonly Field ProxyUserId = FindByName("ProxyUserId");

        /// <summary>代发人姓名</summary>
        public static readonly Field ProxyName = FindByName("ProxyName");

        /// <summary>该生辅导员。存在业务单上</summary>
        public static readonly Field CounselorUserId = FindByName("CounselorUserId");

        /// <summary>状态</summary>
        public static readonly Field Status = FindByName("Status");

        /// <summary>轮次</summary>
        public static readonly Field Round = FindByName("Round");

        /// <summary>当前节点</summary>
        public static readonly Field CurrentNodes = FindByName("CurrentNodes");

        /// <summary>提交时间</summary>
        public static readonly Field StartTime = FindByName("StartTime");

        /// <summary>结束时间</summary>
        public static readonly Field EndTime = FindByName("EndTime");

        /// <summary>最后动作时间</summary>
        public static readonly Field LastActionTime = FindByName("LastActionTime");

        /// <summary>乐观锁</summary>
        public static readonly Field Version = FindByName("Version");

        /// <summary>异常</summary>
        public static readonly Field IsAbnormal = FindByName("IsAbnormal");

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

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得审批实例字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号</summary>
        public const String Id = "Id";

        /// <summary>实例编号</summary>
        public const String No = "No";

        /// <summary>标题</summary>
        public const String Title = "Title";

        /// <summary>流程</summary>
        public const String ProcessId = "ProcessId";

        /// <summary>流程版本</summary>
        public const String ProcessVersionId = "ProcessVersionId";

        /// <summary>表单版本</summary>
        public const String FormVersionId = "FormVersionId";

        /// <summary>流程名</summary>
        public const String ProcessName = "ProcessName";

        /// <summary>分类</summary>
        public const String CategoryId = "CategoryId";

        /// <summary>发起人</summary>
        public const String UserId = "UserId";

        /// <summary>发起人姓名</summary>
        public const String UserName = "UserName";

        /// <summary>发起部门</summary>
        public const String DepartmentId = "DepartmentId";

        /// <summary>部门名</summary>
        public const String DepartmentName = "DepartmentName";

        /// <summary>业务主体。学生</summary>
        public const String SubjectUserId = "SubjectUserId";

        /// <summary>业务主体姓名</summary>
        public const String SubjectName = "SubjectName";

        /// <summary>代发人。0表示本人发起</summary>
        public const String ProxyUserId = "ProxyUserId";

        /// <summary>代发人姓名</summary>
        public const String ProxyName = "ProxyName";

        /// <summary>该生辅导员。存在业务单上</summary>
        public const String CounselorUserId = "CounselorUserId";

        /// <summary>状态</summary>
        public const String Status = "Status";

        /// <summary>轮次</summary>
        public const String Round = "Round";

        /// <summary>当前节点</summary>
        public const String CurrentNodes = "CurrentNodes";

        /// <summary>提交时间</summary>
        public const String StartTime = "StartTime";

        /// <summary>结束时间</summary>
        public const String EndTime = "EndTime";

        /// <summary>最后动作时间</summary>
        public const String LastActionTime = "LastActionTime";

        /// <summary>乐观锁</summary>
        public const String Version = "Version";

        /// <summary>异常</summary>
        public const String IsAbnormal = "IsAbnormal";

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
    }
    #endregion
}
