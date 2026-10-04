using EquipmentLedger.Web.Entities;
using NewLife.Cube;
using NewLife.Log;

var builder = WebApplication.CreateBuilder(args);

// 纯 WebApi 也必须 AddControllers：UseCube 内部 MapControllerRoute 依赖 MVC 控制器服务。
// Nullable enable 时，非可空 string 会被隐式 [Required]，插入报 The XX field is required。
builder.Services.AddControllers(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
});

// UseCube 的 InitAll 只扫描已加载程序集。业务实体与入口在同一程序集，这里显式触碰一次。
_ = typeof(Equipment).Assembly;

builder.Services.AddCube();
builder.Services.AddCubeLov(options => options.ScanNamespace(typeof(EquipmentStatus).Namespace!));

// AddCube 内部会注册返回 null 的 ITracer 工厂，必须在其后再注册，否则被覆盖。
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
