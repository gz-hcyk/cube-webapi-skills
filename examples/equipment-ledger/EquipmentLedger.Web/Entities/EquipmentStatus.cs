using System.ComponentModel;

namespace EquipmentLedger.Web.Entities;

/// <summary>设备状态。枚举项带 Description，供 Lov 值集显示中文。</summary>
public enum EquipmentStatus
{
    /// <summary>在库，尚未领用。</summary>
    [Description("在库")]
    InStock = 0,

    /// <summary>在用。</summary>
    [Description("在用")]
    InUse = 1,

    /// <summary>维修中。</summary>
    [Description("维修")]
    Repair = 2,

    /// <summary>已报废。</summary>
    [Description("报废")]
    Scrapped = 3,
}
