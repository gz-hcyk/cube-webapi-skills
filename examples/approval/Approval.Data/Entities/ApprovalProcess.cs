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

/// <summary>流程定义。绑定表单，发布后按版本运行</summary>
[Serializable]
[DataObject]
[Description("流程定义。绑定表单，发布后按版本运行")]
[BindIndex("IU_ApprovalProcess_Code", true, "Code")]
[BindIndex("IX_ApprovalProcess_CategoryId_Sort", false, "CategoryId,Sort")]
[BindIndex("IX_ApprovalProcess_FormId", false, "FormId")]
[BindTable("ApprovalProcess", Description = "流程定义。绑定表单，发布后按版本运行", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalProcess
{
    #region 属性
    private Int32 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [Description("编号")]
    [DataObjectField(true, true, false, 0)]
    [BindColumn("Id", "编号", "")]
    public Int32 Id { get => _Id; set { if (OnPropertyChanging("Id", value)) { _Id = value; OnPropertyChanged("Id"); } } }

    private String _Code = null!;
    /// <summary>编码</summary>
    [DisplayName("编码")]
    [Description("编码")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("Code", "编码", "")]
    public String Code { get => _Code; set { if (OnPropertyChanging("Code", value)) { _Code = value; OnPropertyChanged("Code"); } } }

    private String _Name = null!;
    /// <summary>名称</summary>
    [DisplayName("名称")]
    [Description("名称")]
    [DataObjectField(false, false, false, 100)]
    [BindColumn("Name", "名称", "", Master = true)]
    public String Name { get => _Name; set { if (OnPropertyChanging("Name", value)) { _Name = value; OnPropertyChanged("Name"); } } }

    private Int32 _CategoryId;
    /// <summary>分类</summary>
    [DisplayName("分类")]
    [Description("分类")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("CategoryId", "分类", "")]
    public Int32 CategoryId { get => _CategoryId; set { if (OnPropertyChanging("CategoryId", value)) { _CategoryId = value; OnPropertyChanged("CategoryId"); } } }

    private Int32 _FormId;
    /// <summary>表单</summary>
    [DisplayName("表单")]
    [Description("表单")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("FormId", "表单", "")]
    public Int32 FormId { get => _FormId; set { if (OnPropertyChanging("FormId", value)) { _FormId = value; OnPropertyChanged("FormId"); } } }

    private String? _Icon;
    /// <summary>图标</summary>
    [DisplayName("图标")]
    [Description("图标")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("Icon", "图标", "")]
    public String? Icon { get => _Icon; set { if (OnPropertyChanging("Icon", value)) { _Icon = value; OnPropertyChanged("Icon"); } } }

    private Int32 _Sort;
    /// <summary>排序</summary>
    [DisplayName("排序")]
    [Description("排序")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Sort", "排序", "")]
    public Int32 Sort { get => _Sort; set { if (OnPropertyChanging("Sort", value)) { _Sort = value; OnPropertyChanged("Sort"); } } }

    private Boolean _Enable;
    /// <summary>启用</summary>
    [DisplayName("启用")]
    [Description("启用")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Enable", "启用", "")]
    public Boolean Enable { get => _Enable; set { if (OnPropertyChanging("Enable", value)) { _Enable = value; OnPropertyChanged("Enable"); } } }

    private Int32 _PublishedVersionId;
    /// <summary>已发布版本</summary>
    [DisplayName("已发布版本")]
    [Description("已发布版本")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("PublishedVersionId", "已发布版本", "")]
    public Int32 PublishedVersionId { get => _PublishedVersionId; set { if (OnPropertyChanging("PublishedVersionId", value)) { _PublishedVersionId = value; OnPropertyChanged("PublishedVersionId"); } } }

    private Int32 _PublishedVersion;
    /// <summary>已发布版本号</summary>
    [DisplayName("已发布版本号")]
    [Description("已发布版本号")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("PublishedVersion", "已发布版本号", "")]
    public Int32 PublishedVersion { get => _PublishedVersion; set { if (OnPropertyChanging("PublishedVersion", value)) { _PublishedVersion = value; OnPropertyChanged("PublishedVersion"); } } }

    private String? _StarterScope;
    /// <summary>可发起范围</summary>
    [DisplayName("可发起范围")]
    [Description("可发起范围")]
    [DataObjectField(false, false, true, 2000)]
    [BindColumn("StarterScope", "可发起范围", "")]
    public String? StarterScope { get => _StarterScope; set { if (OnPropertyChanging("StarterScope", value)) { _StarterScope = value; OnPropertyChanged("StarterScope"); } } }

    private String? _AdminUserIds;
    /// <summary>流程管理员</summary>
    [DisplayName("流程管理员")]
    [Description("流程管理员")]
    [DataObjectField(false, false, true, 500)]
    [BindColumn("AdminUserIds", "流程管理员", "")]
    public String? AdminUserIds { get => _AdminUserIds; set { if (OnPropertyChanging("AdminUserIds", value)) { _AdminUserIds = value; OnPropertyChanged("AdminUserIds"); } } }

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
    /// <summary>说明</summary>
    [DisplayName("说明")]
    [Description("说明")]
    [DataObjectField(false, false, true, 500)]
    [BindColumn("Remark", "说明", "")]
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
            "Code" => _Code,
            "Name" => _Name,
            "CategoryId" => _CategoryId,
            "FormId" => _FormId,
            "Icon" => _Icon,
            "Sort" => _Sort,
            "Enable" => _Enable,
            "PublishedVersionId" => _PublishedVersionId,
            "PublishedVersion" => _PublishedVersion,
            "StarterScope" => _StarterScope,
            "AdminUserIds" => _AdminUserIds,
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
                case "Code": _Code = Convert.ToString(value); break;
                case "Name": _Name = Convert.ToString(value); break;
                case "CategoryId": _CategoryId = value.ToInt(); break;
                case "FormId": _FormId = value.ToInt(); break;
                case "Icon": _Icon = Convert.ToString(value); break;
                case "Sort": _Sort = value.ToInt(); break;
                case "Enable": _Enable = value.ToBoolean(); break;
                case "PublishedVersionId": _PublishedVersionId = value.ToInt(); break;
                case "PublishedVersion": _PublishedVersion = value.ToInt(); break;
                case "StarterScope": _StarterScope = Convert.ToString(value); break;
                case "AdminUserIds": _AdminUserIds = Convert.ToString(value); break;
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
    public static ApprovalProcess? FindById(Int32 id)
    {
        if (id < 0) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.Id == id);

        // 单对象缓存
        return Meta.SingleCache[id];

        //return Find(_.Id == id);
    }

    /// <summary>根据编码查找</summary>
    /// <param name="code">编码</param>
    /// <returns>实体对象</returns>
    public static ApprovalProcess? FindByCode(String code)
    {
        if (code.IsNullOrEmpty()) return null;

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.Find(e => e.Code.EqualIgnoreCase(code));

        return Find(_.Code == code);
    }

    /// <summary>根据分类、排序查找</summary>
    /// <param name="categoryId">分类</param>
    /// <param name="sort">排序</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalProcess> FindAllByCategoryIdAndSort(Int32 categoryId, Int32 sort)
    {
        if (categoryId < 0) return [];
        if (sort < 0) return [];

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.FindAll(e => e.CategoryId == categoryId && e.Sort == sort);

        return FindAll(_.CategoryId == categoryId & _.Sort == sort);
    }

    /// <summary>根据表单查找</summary>
    /// <param name="formId">表单</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalProcess> FindAllByFormId(Int32 formId)
    {
        if (formId < 0) return [];

        // 实体缓存
        if (Meta.Session.Count < 1000) return Meta.Cache.FindAll(e => e.FormId == formId);

        return FindAll(_.FormId == formId);
    }
    #endregion

    #region 高级查询
    /// <summary>高级查询</summary>
    /// <param name="code">编码</param>
    /// <param name="categoryId">分类</param>
    /// <param name="formId">表单</param>
    /// <param name="sort">排序</param>
    /// <param name="enable">启用</param>
    /// <param name="start">更新时间开始</param>
    /// <param name="end">更新时间结束</param>
    /// <param name="key">关键字</param>
    /// <param name="page">分页参数信息。可携带统计和数据权限扩展查询等信息</param>
    /// <returns>实体列表</returns>
    public static IList<ApprovalProcess> Search(String code, Int32 categoryId, Int32 formId, Int32 sort, Boolean? enable, DateTime start, DateTime end, String key, PageParameter page)
    {
        var exp = new WhereExpression();

        if (!code.IsNullOrEmpty()) exp &= _.Code == code;
        if (categoryId >= 0) exp &= _.CategoryId == categoryId;
        if (formId >= 0) exp &= _.FormId == formId;
        if (sort >= 0) exp &= _.Sort == sort;
        if (enable != null) exp &= _.Enable == enable;
        exp &= _.UpdateTime.Between(start, end);
        if (!key.IsNullOrEmpty()) exp &= SearchWhereByKeys(key);

        return FindAll(exp, page);
    }
    #endregion

    #region 字段名
    /// <summary>取得流程定义字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>编码</summary>
        public static readonly Field Code = FindByName("Code");

        /// <summary>名称</summary>
        public static readonly Field Name = FindByName("Name");

        /// <summary>分类</summary>
        public static readonly Field CategoryId = FindByName("CategoryId");

        /// <summary>表单</summary>
        public static readonly Field FormId = FindByName("FormId");

        /// <summary>图标</summary>
        public static readonly Field Icon = FindByName("Icon");

        /// <summary>排序</summary>
        public static readonly Field Sort = FindByName("Sort");

        /// <summary>启用</summary>
        public static readonly Field Enable = FindByName("Enable");

        /// <summary>已发布版本</summary>
        public static readonly Field PublishedVersionId = FindByName("PublishedVersionId");

        /// <summary>已发布版本号</summary>
        public static readonly Field PublishedVersion = FindByName("PublishedVersion");

        /// <summary>可发起范围</summary>
        public static readonly Field StarterScope = FindByName("StarterScope");

        /// <summary>流程管理员</summary>
        public static readonly Field AdminUserIds = FindByName("AdminUserIds");

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

        /// <summary>说明</summary>
        public static readonly Field Remark = FindByName("Remark");

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得流程定义字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号</summary>
        public const String Id = "Id";

        /// <summary>编码</summary>
        public const String Code = "Code";

        /// <summary>名称</summary>
        public const String Name = "Name";

        /// <summary>分类</summary>
        public const String CategoryId = "CategoryId";

        /// <summary>表单</summary>
        public const String FormId = "FormId";

        /// <summary>图标</summary>
        public const String Icon = "Icon";

        /// <summary>排序</summary>
        public const String Sort = "Sort";

        /// <summary>启用</summary>
        public const String Enable = "Enable";

        /// <summary>已发布版本</summary>
        public const String PublishedVersionId = "PublishedVersionId";

        /// <summary>已发布版本号</summary>
        public const String PublishedVersion = "PublishedVersion";

        /// <summary>可发起范围</summary>
        public const String StarterScope = "StarterScope";

        /// <summary>流程管理员</summary>
        public const String AdminUserIds = "AdminUserIds";

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

        /// <summary>说明</summary>
        public const String Remark = "Remark";
    }
    #endregion
}
