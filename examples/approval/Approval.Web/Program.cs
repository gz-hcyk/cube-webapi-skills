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
SeedLeaveSample();

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

/// <summary>
/// 写入请假样例：已发布表单、只读流程能看到的节点，以及代发起要用的学生和辅导员。
/// 已有同名编码或用户时跳过。辅导员账号挂在管理员角色上，只为示例里能登录办理。
/// </summary>
static void SeedLeaveSample()
{
    try
    {
        var admin = User.FindByName("admin");
        var roleId = admin?.RoleID ?? 0;
        EnsureSampleUser("student", "pass1234", roleId, "学生乙");
        EnsureSampleUser("counselor", "pass1234", roleId, "该生辅导员");

        var category = ApprovalCategory.FindByCode("student-affairs");
        if (category == null)
        {
            category = new ApprovalCategory
            {
                Code = "student-affairs",
                Name = "学工",
                Sort = 10,
                Enable = true,
            };
            category.Insert();
        }

        const String schema = """{"fields":[{"key":"studentUserId","label":"学生"},{"key":"counselorUserId","label":"该生辅导员"},{"key":"reason","label":"事由","search":true},{"key":"days","label":"天数"}]}""";
        const String graph = """
        {"nodes":[{"key":"s","type":"start","name":"开始","fields":[{"key":"studentUserId","access":"readonly"},{"key":"counselorUserId","access":"editable"},{"key":"reason","access":"editable"},{"key":"days","access":"hidden"}]},{"key":"c","type":"approve","name":"该生辅导员","mode":"any","assignee":{"type":"subjectCounselor","field":"counselorUserId"},"fields":[{"key":"studentUserId","access":"readonly"},{"key":"counselorUserId","access":"readonly"},{"key":"reason","access":"readonly"},{"key":"days","access":"editable"}]},{"key":"e","type":"end","name":"结束"}],"edges":[{"key":"e1","from":"s","to":"c"},{"key":"e2","from":"c","to":"e"}]}
        """;

        var form = ApprovalFormDefinition.FindByCode("leave");
        if (form == null)
        {
            form = new ApprovalFormDefinition
            {
                Code = "leave",
                Name = "请假表单",
                Enable = true,
                CategoryId = category.Id,
            };
            form.Insert();
        }
        else if (form.CategoryId != category.Id)
        {
            form.CategoryId = category.Id;
            form.Update();
        }

        var publishedForm = form.PublishedVersionId > 0 ? ApprovalFormVersion.FindById(form.PublishedVersionId) : null;
        if (publishedForm == null || string.IsNullOrEmpty(publishedForm.Schema) || !publishedForm.Schema.Contains("\"days\"", StringComparison.Ordinal))
        {
            form.SaveDraft(schema);
            form.Publish(admin?.ID ?? 0);
        }

        var process = ApprovalProcess.FindByCode("leave");
        if (process == null)
        {
            process = new ApprovalProcess
            {
                Code = "leave",
                Name = "请假",
                FormId = form.Id,
                Enable = true,
                CategoryId = category.Id,
            };
            process.Insert();
        }
        else if (process.CategoryId != category.Id)
        {
            process.CategoryId = category.Id;
            process.Update();
        }

        var publishedProcess = process.PublishedVersionId > 0 ? ApprovalProcessVersion.FindById(process.PublishedVersionId) : null;
        var stale = publishedProcess == null
            || string.IsNullOrEmpty(publishedProcess.Definition)
            || !publishedProcess.Definition.Contains("\"access\"", StringComparison.Ordinal)
            || publishedProcess.FormVersionId != form.PublishedVersionId;
        if (stale)
        {
            process.SaveDraft(graph);
            process.Publish(admin?.ID ?? 0);
        }
    }
    catch (Exception ex)
    {
        XTrace.WriteException(ex);
    }
}

static void EnsureSampleUser(String name, String password, Int32 roleId, String displayName)
{
    if (User.FindByName(name) != null) return;
    var user = User.Add(name, password, roleId, displayName);
    user.Enable = true;
    user.Update();
}

/// <summary>供测试宿主引用入口。</summary>
public partial class Program
{
}
