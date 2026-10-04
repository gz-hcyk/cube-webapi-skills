using System.ComponentModel;
using NewLife.Cube;

namespace Approval.Web.Areas.Approval;

/// <summary>审批中心。</summary>
[DisplayName("审批中心")]
[Menu(0, true, LastUpdate = "2026-10-04")]
public class ApprovalArea : AreaBase
{
    /// <summary>区域名 Approval。</summary>
    public ApprovalArea() : base("Approval") { }
}
