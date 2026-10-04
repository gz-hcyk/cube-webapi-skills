using System.ComponentModel;
using NewLife.Cube;

namespace Approval.Web.Areas.ApprovalAdmin;

/// <summary>审批管理。</summary>
[DisplayName("审批管理")]
[Menu(0, true, LastUpdate = "2026-10-04")]
public class ApprovalAdminArea : AreaBase
{
    /// <summary>区域名 ApprovalAdmin。</summary>
    public ApprovalAdminArea() : base("ApprovalAdmin") { }
}
