using XCode;
using XCode.Membership;

namespace Approval.Data.Entities;

public partial class ApprovalInstance : Entity<ApprovalInstance>
{
    static ApprovalInstance()
    {
        // 实例会在无登录上下文的驱动里写入，用户和 IP 允许为空；有登录时拦截器仍会填充。
        Meta.Interceptors.Add(new UserInterceptor { AllowEmpty = true });
        Meta.Interceptors.Add<TimeInterceptor>();
        Meta.Interceptors.Add(new IPInterceptor { AllowEmpty = true });
    }

    /// <summary>发起参数。</summary>
    public sealed class StartArgs
    {
        /// <summary>流程定义。</summary>
        public Int32 ProcessId { get; set; }

        /// <summary>当前登录用户。</summary>
        public Int32 OperatorUserId { get; set; }

        /// <summary>是否代发起。false 表示本人发起。</summary>
        public Boolean Proxy { get; set; }

        /// <summary>业务主体。代发起时必填，本人发起时忽略。</summary>
        public Int32 SubjectUserId { get; set; }

        /// <summary>表单 JSON。</summary>
        public String? Data { get; set; }

        /// <summary>幂等请求号。</summary>
        public String? RequestId { get; set; }

        /// <summary>客户端地址。</summary>
        public String? ClientIp { get; set; }
    }
}
