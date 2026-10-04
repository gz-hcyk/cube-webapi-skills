using System.ComponentModel;
using NewLife;
using NewLife.Cube;

namespace EquipmentLedger.Web.Areas.Ledger;

[DisplayName("设备台账")]
[Menu(0, true, LastUpdate = "2026-10-04")]
public class LedgerArea : AreaBase
{
    public LedgerArea() : base(nameof(LedgerArea).TrimEnd("Area")) { }
}