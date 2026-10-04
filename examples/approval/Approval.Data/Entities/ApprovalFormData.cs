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

/// <summary>表单值。与实例一对一，定义与值分开存放</summary>
[Serializable]
[DataObject]
[Description("表单值。与实例一对一，定义与值分开存放")]
[BindTable("ApprovalFormData", Description = "表单值。与实例一对一，定义与值分开存放", ConnName = "Approval", DbType = DatabaseType.None)]
public partial class ApprovalFormData
{
    #region 属性
    private Int64 _Id;
    /// <summary>编号。等于实例编号</summary>
    [DisplayName("编号")]
    [Description("编号。等于实例编号")]
    [DataObjectField(true, false, false, 0)]
    [BindColumn("Id", "编号。等于实例编号", "", DataScale = "time")]
    public Int64 Id { get => _Id; set { if (OnPropertyChanging("Id", value)) { _Id = value; OnPropertyChanged("Id"); } } }

    private Int32 _FormVersionId;
    /// <summary>表单版本</summary>
    [DisplayName("表单版本")]
    [Description("表单版本")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("FormVersionId", "表单版本", "")]
    public Int32 FormVersionId { get => _FormVersionId; set { if (OnPropertyChanging("FormVersionId", value)) { _FormVersionId = value; OnPropertyChanged("FormVersionId"); } } }

    private String _Data = null!;
    /// <summary>表单值</summary>
    [DisplayName("表单值")]
    [Description("表单值")]
    [DataObjectField(false, false, false, -1)]
    [BindColumn("Data", "表单值", "")]
    public String Data { get => _Data; set { if (OnPropertyChanging("Data", value)) { _Data = value; OnPropertyChanged("Data"); } } }

    private Int32 _DataSize;
    /// <summary>字节数</summary>
    [DisplayName("字节数")]
    [Description("字节数")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("DataSize", "字节数", "")]
    public Int32 DataSize { get => _DataSize; set { if (OnPropertyChanging("DataSize", value)) { _DataSize = value; OnPropertyChanged("DataSize"); } } }

    private String? _UpdateUser;
    /// <summary>最后修改人</summary>
    [DisplayName("最后修改人")]
    [Description("最后修改人")]
    [DataObjectField(false, false, true, 50)]
    [BindColumn("UpdateUser", "最后修改人", "")]
    public String? UpdateUser { get => _UpdateUser; set { if (OnPropertyChanging("UpdateUser", value)) { _UpdateUser = value; OnPropertyChanged("UpdateUser"); } } }

    private Int32 _UpdateUserID;
    /// <summary>最后修改人</summary>
    [DisplayName("最后修改人")]
    [Description("最后修改人")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("UpdateUserID", "最后修改人", "")]
    public Int32 UpdateUserID { get => _UpdateUserID; set { if (OnPropertyChanging("UpdateUserID", value)) { _UpdateUserID = value; OnPropertyChanged("UpdateUserID"); } } }

    private DateTime _UpdateTime;
    /// <summary>最后修改时间</summary>
    [DisplayName("最后修改时间")]
    [Description("最后修改时间")]
    [DataObjectField(false, false, true, 0)]
    [BindColumn("UpdateTime", "最后修改时间", "")]
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
            "FormVersionId" => _FormVersionId,
            "Data" => _Data,
            "DataSize" => _DataSize,
            "UpdateUser" => _UpdateUser,
            "UpdateUserID" => _UpdateUserID,
            "UpdateTime" => _UpdateTime,
            _ => base[name]
        };
        set
        {
            switch (name)
            {
                case "Id": _Id = value.ToLong(); break;
                case "FormVersionId": _FormVersionId = value.ToInt(); break;
                case "Data": _Data = Convert.ToString(value); break;
                case "DataSize": _DataSize = value.ToInt(); break;
                case "UpdateUser": _UpdateUser = Convert.ToString(value); break;
                case "UpdateUserID": _UpdateUserID = value.ToInt(); break;
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
    public static ApprovalFormData? FindById(Int64 id)
    {
        if (id < 0) return null;

        return Find(_.Id == id);
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
    /// <summary>取得表单值字段信息的快捷方式</summary>
    public partial class _
    {
        /// <summary>编号。等于实例编号</summary>
        public static readonly Field Id = FindByName("Id");

        /// <summary>表单版本</summary>
        public static readonly Field FormVersionId = FindByName("FormVersionId");

        /// <summary>表单值</summary>
        public static readonly Field Data = FindByName("Data");

        /// <summary>字节数</summary>
        public static readonly Field DataSize = FindByName("DataSize");

        /// <summary>最后修改人</summary>
        public static readonly Field UpdateUser = FindByName("UpdateUser");

        /// <summary>最后修改人</summary>
        public static readonly Field UpdateUserID = FindByName("UpdateUserID");

        /// <summary>最后修改时间</summary>
        public static readonly Field UpdateTime = FindByName("UpdateTime");

        static Field FindByName(String name) => Meta.Table.FindByName(name)!;
    }

    /// <summary>取得表单值字段名称的快捷方式</summary>
    public partial class __
    {
        /// <summary>编号。等于实例编号</summary>
        public const String Id = "Id";

        /// <summary>表单版本</summary>
        public const String FormVersionId = "FormVersionId";

        /// <summary>表单值</summary>
        public const String Data = "Data";

        /// <summary>字节数</summary>
        public const String DataSize = "DataSize";

        /// <summary>最后修改人</summary>
        public const String UpdateUser = "UpdateUser";

        /// <summary>最后修改人</summary>
        public const String UpdateUserID = "UpdateUserID";

        /// <summary>最后修改时间</summary>
        public const String UpdateTime = "UpdateTime";
    }
    #endregion
}
