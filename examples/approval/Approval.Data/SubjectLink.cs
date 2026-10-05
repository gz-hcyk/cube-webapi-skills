using Approval.Data.Entities;

namespace Approval.Data;

/// <summary>
/// 业务主体只记魔方用户编号，不建学生信息表。
/// 宿主要对接学籍时，用 <see cref="UserId"/> 去自己的学生记录里查。
/// </summary>
public static class SubjectLink
{
    /// <summary>实例上的业务主体用户编号。</summary>
    public static Int32 UserId(ApprovalInstance instance) => instance.SubjectUserId;
}
