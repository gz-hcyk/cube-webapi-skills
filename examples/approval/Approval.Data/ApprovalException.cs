namespace Approval.Data;

/// <summary>审批业务错误。Code 与设计说明中的信封错误码一致。</summary>
public class ApprovalException : Exception
{
    /// <summary>错误码。</summary>
    public Int32 Code { get; }

    /// <summary>构造业务错误。</summary>
    public ApprovalException(Int32 code, String message) : base(message)
    {
        Code = code;
    }
}
