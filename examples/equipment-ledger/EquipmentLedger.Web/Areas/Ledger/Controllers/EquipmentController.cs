using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using EquipmentLedger.Web.Entities;
using NewLife;
using NewLife.Cube;
using NewLife.Cube.Extensions;
using NewLife.Cube.ViewModels;
using NewLife.Log;
using NewLife.Web;
using XCode.Configuration;
using XCode.Membership;
using static EquipmentLedger.Web.Entities.Equipment;

namespace EquipmentLedger.Web.Areas.Ledger.Controllers;

/// <summary>设备。设备台账主数据</summary>
[DisplayName("设备")]
[Menu(30, true, Icon = "fa-table")]
[LedgerArea]
public class EquipmentController : EntityController<Equipment>
{
    static EquipmentController()
    {
        //LogOnChange = true;

        //ListFields.RemoveField("Id", "Creator");
        ListFields.RemoveCreateField().RemoveRemarkField();

        // 枚举走 LOV 值集。Cube 不会自动下发 lovCode，必须在静态构造里显式 SetLov。
        var lovCode = $"Enum.{typeof(EquipmentStatus).FullName}";
        SetLov(ListFields, _.Status, lovCode);
        SetLov(AddFormFields, _.Status, lovCode);
        SetLov(EditFormFields, _.Status, lovCode);
        SetLov(DetailFields, _.Status, lovCode);
        SetLov(SearchFields, _.Status, lovCode);

        //{
        //    var df = ListFields.GetField("Code") as ListField;
        //    df.Url = "?code={Code}";
        //    df.Target = "_blank";
        //}
        //{
        //    var df = ListFields.AddListField("devices", null, "Onlines");
        //    df.DisplayName = "查看设备";
        //    df.Url = "Device?groupId={Id}";
        //    df.DataVisible = e => (e as Equipment).Devices > 0;
        //    df.Target = "_frame";
        //}
        //{
        //    var df = ListFields.GetField("Kind") as ListField;
        //    df.GetValue = e => ((Int32)(e as Equipment).Kind).ToString("X4");
        //}
        //ListFields.TraceUrl("TraceId");
    }

    //private readonly ITracer _tracer;

    //public EquipmentController(ITracer tracer)
    //{
    //    _tracer = tracer;
    //}

    /// <summary>高级搜索。列表页查询、导出Excel、导出Json、分享页等使用</summary>
    /// <param name="p">分页器。包含分页排序参数，以及Http请求参数</param>
    /// <returns></returns>
    protected override IEnumerable<Equipment> Search(Pager p)
    {
        var code = p["code"];
        var categoryId = p["categoryId"].ToInt(-1);
        var status = (EquipmentLedger.Web.Entities.EquipmentStatus)p["status"].ToInt(-1);

        var start = p["dtStart"].ToDateTime();
        var end = p["dtEnd"].ToDateTime();

        return Equipment.Search(code, categoryId, status, start, end, p["Q"], p);
    }

    /// <summary>按 Model.xml 做必填与长度校验，失败时返回 FieldErrors。</summary>
    protected override Boolean EnableFieldValidation => true;

    static void SetLov(FieldCollection fields, Field field, String code)
    {
        var df = fields.GetField(field);
        if (df != null) df.LovCode = code;
    }
}