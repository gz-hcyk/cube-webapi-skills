using Approval.Data.Entities;
using NewLife.Cube;
using NewLife.Log;

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

/// <summary>供测试宿主引用入口。</summary>
public partial class Program
{
}
