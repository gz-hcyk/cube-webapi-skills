using Approval.Data.Entities;
using NewLife.Cube;
using NewLife.Log;
using XCode;
using XCode.Membership;
using ILog = NewLife.Log.ILog;

var builder = WebApplication.CreateBuilder(args);

// Nullable enable 时，非可空 string 会被隐式当成必填。
builder.Services.AddControllers(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
});

// UseCube 的 InitAll 只扫描已加载程序集。实体在独立程序集里，这里显式触碰一次。
_ = typeof(ApprovalInstance).Assembly;

builder.Services.AddCube();
builder.Services.AddCubeLov(options => options.ScanNamespace(typeof(InstanceStatus).Namespace!));

// AddCube 内部会注册返回 null 的 ITracer 工厂，必须在其后再注册。
DefaultTracer.Instance ??= new DefaultTracer();
builder.Services.AddSingleton<ITracer>(_ => DefaultTracer.Instance!);
builder.Services.AddSingleton<ILog>(XTrace.Log);

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
}

var app = builder.Build();

// 不要手写 EntityFactory.InitAll / InitConnection，UseCube 已内置预热。
app.UseCube(app.Environment);
app.UseCubeLov();
GrantApprovalMenus();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.RoutePrefix = "Swagger";
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "NewLife.Cube API v1");
    });
}

app.Run();

/// <summary>
/// 把审批菜单上声明的权限位授给管理员角色。
/// 自定义位超出 PermissionFlags.All，系统角色不会自动带上，否则待办和转办会 403。
/// </summary>
static void GrantApprovalMenus()
{
    try
    {
        var admin = User.FindByName("admin");
        if (admin == null || admin.RoleID <= 0) return;
        var role = Role.FindByID(admin.RoleID);
        if (role == null) return;
        var changed = false;
        foreach (var menu in Menu.FindAll())
        {
            var url = (menu.Url ?? "") + (menu.FullName ?? "") + (menu.Name ?? "");
            if (url.IndexOf("Approval", StringComparison.OrdinalIgnoreCase) < 0) continue;
            var mask = 0;
            foreach (var part in (menu.Permission ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var head = part.Split('#')[0];
                if (Int32.TryParse(head, out var bit)) mask |= bit;
            }

            if (mask == 0) continue;
            role.Set(menu.ID, (PermissionFlags)mask);
            changed = true;
        }

        if (!changed) return;
        role.Update();
        Role.Meta.Cache?.Clear("grant", true);
        Role.Meta.SingleCache.Clear("grant");
        User.Meta.Cache?.Clear("grant", true);
        User.Meta.SingleCache.Clear("grant");
    }
    catch (Exception ex)
    {
        XTrace.WriteException(ex);
    }
}

/// <summary>供测试宿主引用入口。</summary>
public partial class Program
{
}
