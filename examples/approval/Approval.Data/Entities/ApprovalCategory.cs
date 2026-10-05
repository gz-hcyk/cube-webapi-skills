using System.ComponentModel;
using System.Runtime.Serialization;
using NewLife;
using XCode;
using XCode.DataAccessLayer;
using XCode.Membership;

namespace Approval.Data.Entities;

/// <summary>审批分类。表单和流程通过 CategoryId 挂在这里。</summary>
[Serializable]
[DataObject]
[Description("审批分类")]
[BindIndex("IU_ApprovalCategory_Code", true, "Code")]
[BindTable("ApprovalCategory", Description = "审批分类。表单和流程挂在分类下", ConnName = "Approval", DbType = DatabaseType.None)]
public class ApprovalCategory : Entity<ApprovalCategory>
{
    static ApprovalCategory()
    {
        Meta.Interceptors.Add(new UserInterceptor { AllowEmpty = true });
        Meta.Interceptors.Add<TimeInterceptor>();
        Meta.Interceptors.Add(new IPInterceptor { AllowEmpty = true });
    }

    private Int32 _Id;
    /// <summary>编号</summary>
    [DisplayName("编号")]
    [DataObjectField(true, true, false, 0)]
    [BindColumn("Id", "编号", "")]
    public Int32 Id { get => _Id; set { if (OnPropertyChanging(nameof(Id), value)) { _Id = value; OnPropertyChanged(nameof(Id)); } } }

    private String _Code = null!;
    /// <summary>编码</summary>
    [DisplayName("编码")]
    [DataObjectField(false, false, false, 50)]
    [BindColumn("Code", "编码", "")]
    public String Code { get => _Code; set { if (OnPropertyChanging(nameof(Code), value)) { _Code = value; OnPropertyChanged(nameof(Code)); } } }

    private String _Name = null!;
    /// <summary>名称</summary>
    [DisplayName("名称")]
    [DataObjectField(false, false, false, 100)]
    [BindColumn("Name", "名称", "", Master = true)]
    public String Name { get => _Name; set { if (OnPropertyChanging(nameof(Name), value)) { _Name = value; OnPropertyChanged(nameof(Name)); } } }

    private Int32 _Sort;
    /// <summary>排序</summary>
    [DisplayName("排序")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Sort", "排序", "")]
    public Int32 Sort { get => _Sort; set { if (OnPropertyChanging(nameof(Sort), value)) { _Sort = value; OnPropertyChanged(nameof(Sort)); } } }

    private Boolean _Enable;
    /// <summary>启用</summary>
    [DisplayName("启用")]
    [DataObjectField(false, false, false, 0)]
    [BindColumn("Enable", "启用", "")]
    public Boolean Enable { get => _Enable; set { if (OnPropertyChanging(nameof(Enable), value)) { _Enable = value; OnPropertyChanged(nameof(Enable)); } } }

    private String? _Remark;
    /// <summary>备注</summary>
    [DisplayName("备注")]
    [DataObjectField(false, false, true, 500)]
    [BindColumn("Remark", "备注", "")]
    public String? Remark { get => _Remark; set { if (OnPropertyChanging(nameof(Remark), value)) { _Remark = value; OnPropertyChanged(nameof(Remark)); } } }

    /// <summary>获取或设置字段值。插入和更新都走这里。</summary>
    public override Object? this[String name]
    {
        get => name switch
        {
            "Id" => _Id,
            "Code" => _Code,
            "Name" => _Name,
            "Sort" => _Sort,
            "Enable" => _Enable,
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
                case "Sort": _Sort = value.ToInt(); break;
                case "Enable": _Enable = value.ToBoolean(); break;
                case "Remark": _Remark = Convert.ToString(value); break;
                default: base[name] = value; break;
            }
        }
    }

    /// <summary>按编码查找。分类很少，查询前丢掉全表缓存，避免插入后仍读到空列表。</summary>
    public static ApprovalCategory? FindByCode(String code)
    {
        if (code.IsNullOrEmpty()) return null;
        Meta.Cache?.Clear("find", true);
        return FindAll().FirstOrDefault(e => e.Code == code);
    }

    /// <summary>按编号查找。</summary>
    public static ApprovalCategory? FindById(Int32 id)
    {
        if (id <= 0) return null;
        Meta.Cache?.Clear("find", true);
        return FindAll().FirstOrDefault(e => e.Id == id);
    }
}
