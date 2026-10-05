using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Xunit;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Approval.Data.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using XCode.Membership;

namespace Approval.Tests;

/// <summary>同一条已发布请假流程上检查本人发起、代发起、同意、驳回，以及辅导员按业务主体解析。</summary>
[Collection("approval")]
public class HttpRuntimeTests
{
    private const String Schema = """{"fields":[{"key":"studentUserId"},{"key":"counselorUserId"},{"key":"reason"}]}""";

    private readonly ApprovalWorld _world;

    public HttpRuntimeTests(ApprovalWorld world) => _world = world;

    [Fact]
    public async Task Same_process_supports_self_and_proxy_over_http()
    {
        var mark = Guid.NewGuid().ToString("N")[..8];
        var sys = Role.Add("审批系统-" + mark, true, "HTTP 切片");
        var student = User.Add("http-stu-" + mark, "pass1234", sys.ID, "学生乙");
        var proxy = User.Add("http-proxy-" + mark, "pass1234", sys.ID, "辅导员丙");
        var counselor = User.Add("http-coa-" + mark, "pass1234", sys.ID, "该生辅导员");
        foreach (var user in new[] { student, proxy, counselor })
        {
            user.Enable = true;
            user.Update();
        }

        var process = Publish(mark);

        await using var factory = new ApprovalApiFactory(_world);
        // 关闭 Cookie，避免上一次登录的会话盖住后面的 Bearer。
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        // 先打一次登录，让 UseCube 扫完菜单，再把运行接口的权限位授给本角色。
        _ = await Login(client, student.Name, "pass1234");
        Grant(sys);

        var studentToken = await Login(client, student.Name, "pass1234");
        var wrong = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", studentToken, new
        {
            processId = process.Id,
            proxy = false,
            data = Form(proxy.ID, counselor.ID),
            requestId = "http-bad-" + mark,
        });
        Assert.Equal(4221, wrong["code"]!.GetValue<Int32>());

        var selfBody = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", studentToken, new
        {
            processId = process.Id,
            proxy = false,
            data = Form(student.ID, counselor.ID),
            requestId = "http-self-" + mark,
        });
        var self = Ok(selfBody);
        Assert.Equal("学生乙的请假", self["title"]!.GetValue<String>());
        Assert.Equal(student.ID, self["subjectUserId"]!.GetValue<Int32>());
        Assert.Equal(0, self["proxyUserId"]!.GetValue<Int32>());
        Assert.Equal(counselor.ID, self["counselorUserId"]!.GetValue<Int32>());
        var selfTask = Pending(self).Single();
        Assert.Equal(counselor.ID, selfTask["assigneeId"]!.GetValue<Int32>());
        Assert.Equal(self["title"]!.GetValue<String>(), selfTask["title"]!.GetValue<String>());

        var counselorToken = await Login(client, counselor.Name, "pass1234");
        var rejectedBody = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Reject", counselorToken, new
        {
            taskId = selfTask["id"]!.GetValue<String>(),
            comment = "材料不全",
            requestId = "http-rej-" + mark,
            instanceVersion = self["version"]!.GetValue<Int32>(),
        });
        var rejected = Ok(rejectedBody);
        Assert.Equal(3, rejected["status"]!.GetValue<Int32>());
        Assert.Contains(rejected["history"]!.AsArray(), h =>
            (h!["comment"]?.GetValue<String>() ?? "").Contains("已退回发起人：学生乙"));

        var proxyToken = await Login(client, proxy.Name, "pass1234");
        var proxyBody = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", proxyToken, new
        {
            processId = process.Id,
            proxy = true,
            subjectUserId = student.ID,
            data = Form(student.ID, counselor.ID),
            requestId = "http-proxy-" + mark,
        });
        var started = Ok(proxyBody);
        Assert.Equal("辅导员丙代学生乙发起的请假", started["title"]!.GetValue<String>());
        Assert.Equal(student.ID, started["subjectUserId"]!.GetValue<Int32>());
        Assert.Equal(proxy.ID, started["proxyUserId"]!.GetValue<Int32>());
        Assert.Equal(counselor.ID, started["counselorUserId"]!.GetValue<Int32>());
        Assert.NotEqual(proxy.ID, started["counselorUserId"]!.GetValue<Int32>());
        Assert.Contains(started["history"]!.AsArray(), h => h!["actionName"]!.GetValue<String>() == "代发起");
        var comment = started["history"]!.AsArray().First(h => h!["actionName"]!.GetValue<String>() == "代发起")!["comment"]!.GetValue<String>();
        Assert.Contains("代发起人：辅导员丙", comment);
        Assert.Contains("业务主体：学生乙", comment);
        var task = Pending(started).Single();
        Assert.Equal(counselor.ID, task["assigneeId"]!.GetValue<Int32>());
        Assert.NotEqual(proxy.ID, task["assigneeId"]!.GetValue<Int32>());
        Assert.Equal(started["title"]!.GetValue<String>(), task["title"]!.GetValue<String>());

        var agreedBody = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Agree", counselorToken, new
        {
            taskId = task["id"]!.GetValue<String>(),
            comment = "同意",
            requestId = "http-ag-" + mark,
            instanceVersion = started["version"]!.GetValue<Int32>(),
        });
        var agreed = Ok(agreedBody);
        Assert.Equal(2, agreed["status"]!.GetValue<Int32>());
    }

    [Fact]
    public async Task Ui_apis_cover_inbox_transfer_design_and_menu()
    {
        var mark = Guid.NewGuid().ToString("N")[..8];
        var role = Role.Add("审批页面-" + mark, false, "HTTP 页面");
        var student = User.Add("ui-stu-" + mark, "pass1234", role.ID, "学生乙");
        var proxy = User.Add("ui-proxy-" + mark, "pass1234", role.ID, "辅导员丙");
        var counselor = User.Add("ui-coa-" + mark, "pass1234", role.ID, "该生辅导员");
        var target = User.Add("ui-to-" + mark, "pass1234", role.ID, "接任人");
        foreach (var user in new[] { student, proxy, counselor, target })
        {
            user.Enable = true;
            user.Update();
        }

        var process = Publish(mark);
        await using var factory = new ApprovalApiFactory(_world);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        _ = await Login(client, student.Name, "pass1234");
        GrantFull(role);

        var studentToken = await Login(client, student.Name, "pass1234");
        var me = Ok(await Get(client, "/api/Approval/Runtime/Me", studentToken));
        Assert.Equal(student.ID, me["id"]!.GetValue<Int32>());
        var processes = Ok(await Get(client, "/api/Approval/Runtime/Processes", studentToken));
        Assert.Contains(processes.AsArray(), p => p!["id"]!.GetValue<Int32>() == process.Id);
        var people = Ok(await Get(client, "/api/Approval/Runtime/Candidates", studentToken));
        Assert.Contains(people.AsArray(), p => p!["id"]!.GetValue<Int32>() == student.ID);
        Assert.Contains(people.AsArray(), p => p!["displayName"]!.GetValue<String>() == "该生辅导员");

        var menu = Ok(await Get(client, "/api/Admin/Index/GetMenuTree", studentToken));
        Assert.Contains("Runtime", menu.ToJsonString());
        Assert.Contains("FormDefinition", menu.ToJsonString());
        Assert.Contains("Process", menu.ToJsonString());

        var wrong = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", studentToken, new
        {
            processId = process.Id,
            proxy = false,
            data = Form(proxy.ID, counselor.ID),
            requestId = "ui-bad-" + mark,
        });
        Assert.Equal(4221, wrong["code"]!.GetValue<Int32>());

        var started = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", studentToken, new
        {
            processId = process.Id,
            proxy = false,
            data = Form(student.ID, counselor.ID),
            requestId = "ui-self-" + mark,
        }));
        var task = Pending(started).Single();
        var counselorToken = await Login(client, counselor.Name, "pass1234");
        var inbox = Ok(await Get(client, "/api/Approval/Runtime/Inbox", counselorToken));
        Assert.Contains(inbox.AsArray(), t => t!["id"]!.GetValue<String>() == task["id"]!.GetValue<String>());
        var viewed = Ok(await Get(client, "/api/Approval/Runtime/View?instanceId=" + started["instanceId"]!.GetValue<String>(), counselorToken));
        Assert.Contains(viewed["history"]!.AsArray(), h => h!["action"]!.GetValue<String>() == "submit");

        var moved = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Transfer", counselorToken, new
        {
            taskId = task["id"]!.GetValue<String>(),
            targetUserId = target.ID,
            comment = "请你看",
            requestId = "ui-tr-" + mark,
            instanceVersion = started["version"]!.GetValue<Int32>(),
        }));
        Assert.Equal(1, moved["status"]!.GetValue<Int32>());
        var done = Ok(await Get(client, "/api/Approval/Runtime/Done", counselorToken));
        Assert.Contains(done.AsArray(), t => t!["id"]!.GetValue<String>() == task["id"]!.GetValue<String>() && t["status"]!.GetValue<Int32>() == 3);
        var targetToken = await Login(client, target.Name, "pass1234");
        var targetInbox = Ok(await Get(client, "/api/Approval/Runtime/Inbox", targetToken));
        var movedTask = targetInbox.AsArray().Single(t => t!["instanceId"]!.GetValue<String>() == started["instanceId"]!.GetValue<String>());
        var agreed = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Agree", targetToken, new
        {
            taskId = movedTask!["id"]!.GetValue<String>(),
            comment = "同意",
            requestId = "ui-ag-" + mark,
            instanceVersion = moved["version"]!.GetValue<Int32>(),
        }));
        Assert.Equal(2, agreed["status"]!.GetValue<Int32>());

        var proxyToken = await Login(client, proxy.Name, "pass1234");
        var proxyStarted = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", proxyToken, new
        {
            processId = process.Id,
            proxy = true,
            subjectUserId = student.ID,
            data = Form(student.ID, counselor.ID),
            requestId = "ui-proxy-" + mark,
        }));
        Assert.Equal("辅导员丙代学生乙发起的请假", proxyStarted["title"]!.GetValue<String>());
        Assert.Equal(student.ID, proxyStarted["subjectUserId"]!.GetValue<Int32>());
        Assert.Equal(counselor.ID, proxyStarted["counselorUserId"]!.GetValue<Int32>());
        Assert.NotEqual(proxy.ID, proxyStarted["counselorUserId"]!.GetValue<Int32>());

        var form = ApprovalFormDefinition.FindByCode(process.Code + "-form")!;
        var forms = await Get(client, "/api/ApprovalAdmin/FormDefinition?pageIndex=1&pageSize=20", studentToken);
        Assert.Equal(0, forms["code"]!.GetValue<Int32>());
        Assert.Contains(form.Code, forms.ToJsonString());
        var design = Ok(await Get(client, "/api/ApprovalAdmin/FormDefinition/Design?id=" + form.Id, studentToken));
        Assert.Contains("studentUserId", design["schema"]!.GetValue<String>());
        var saved = await Send(client, HttpMethod.Post, "/api/ApprovalAdmin/FormDefinition/SaveDesign", studentToken, new
        {
            id = form.Id,
            content = """{"fields":[{"key":"studentUserId","label":"学生"},{"key":"counselorUserId","label":"辅导员"},{"key":"reason","label":"事由"},{"key":"days","label":"天数"}]}""",
        });
        Assert.Equal(0, saved["code"]!.GetValue<Int32>());
        var edited = Ok(await Get(client, "/api/ApprovalAdmin/FormDefinition/Design?id=" + form.Id, studentToken));
        Assert.Contains("days", edited["schema"]!.GetValue<String>());

        var flow = Ok(await Get(client, "/api/ApprovalAdmin/Process/Design?id=" + process.Id, studentToken));
        Assert.False(flow["readOnly"]!.GetValue<Boolean>());
        Assert.Contains("subjectCounselor", flow["definition"]!.GetValue<String>());
        var nodes = flow["nodes"]!.AsArray();
        Assert.Contains(nodes, n => n!["typeLabel"]!.GetValue<String>() == "审批" && n["assigneeLabel"]!.GetValue<String>() == "该生辅导员");
        Assert.Contains(nodes, n => n!["modeLabel"]!.GetValue<String>() == "或签");
    }

    [Fact]
    public async Task Anonymous_and_stranger_cannot_read_another_instance()
    {
        var mark = Guid.NewGuid().ToString("N")[..8];
        var role = Role.Add("r8-http-" + mark, false, "限定查看");
        role.IsSystem = false;
        role.DataScope = DataScopes.本部门;
        role.Update();
        var owner = User.Add("r8h-owner-" + mark, "pass1234", role.ID, "学生甲");
        var approver = User.Add("r8h-appr-" + mark, "pass1234", role.ID, "审批人");
        var stranger = User.Add("r8h-str-" + mark, "pass1234", role.ID, "旁观者");
        foreach (var user in new[] { owner, approver, stranger })
        {
            user.Enable = true;
            user.Update();
        }

        var form = new ApprovalFormDefinition { Code = "r8h-" + mark, Name = "限定表单", Enable = true };
        form.Insert();
        form.SaveDraft("""{"fields":[{"key":"studentUserId"},{"key":"reason","search":true},{"key":"days"}]}""");
        form.Publish(0);
        var process = new ApprovalProcess { Code = "r8hp-" + mark, Name = "限定流程", FormId = form.Id, Enable = true };
        process.Insert();
        process.SaveDraft(
            "{\"nodes\":[" +
            "{\"key\":\"s\",\"type\":\"start\",\"name\":\"开始\",\"fields\":[{\"key\":\"days\",\"access\":\"hidden\"},{\"key\":\"reason\",\"access\":\"editable\"},{\"key\":\"studentUserId\",\"access\":\"readonly\"}]}," +
            "{\"key\":\"a\",\"type\":\"approve\",\"name\":\"审批\",\"mode\":\"any\",\"assignee\":{\"type\":\"user\",\"userIds\":[" + approver.ID + "]},\"fields\":[{\"key\":\"days\",\"access\":\"editable\"},{\"key\":\"reason\",\"access\":\"readonly\"},{\"key\":\"studentUserId\",\"access\":\"readonly\"}]}," +
            "{\"key\":\"e\",\"type\":\"end\",\"name\":\"结束\"}]," +
            "\"edges\":[{\"key\":\"e1\",\"from\":\"s\",\"to\":\"a\"},{\"key\":\"e2\",\"from\":\"a\",\"to\":\"e\"}]}");
        process.Publish(0);

        await using var factory = new ApprovalApiFactory(_world);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var anon = await client.GetAsync("/api/Approval/Runtime/View?instanceId=1");
        Assert.True((Int32)anon.StatusCode == 401 || (Int32)anon.StatusCode == 403, ((Int32)anon.StatusCode).ToString());

        _ = await Login(client, owner.Name, "pass1234");
        GrantBits(role, (PermissionFlags)(16 | 32 | 128 | 1024));
        var ownerToken = await Login(client, owner.Name, "pass1234");
        var approverToken = await Login(client, approver.Name, "pass1234");
        var strangerToken = await Login(client, stranger.Name, "pass1234");
        var reason = "r8h-" + mark;
        var started = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", ownerToken, new
        {
            processId = process.Id,
            proxy = false,
            data = "{\"studentUserId\":" + owner.ID + ",\"reason\":\"" + reason + "\"}",
            requestId = "r8h-start-" + mark,
        }));
        var instanceId = started["instanceId"]!.GetValue<String>();
        var task = Pending(started).Single();

        var stolen = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Agree", strangerToken, new
        {
            taskId = task["id"]!.GetValue<String>(),
            comment = "越权",
            requestId = "r8h-steal-" + mark,
            instanceVersion = started["version"]!.GetValue<Int32>(),
        });
        Assert.Equal(4031, stolen["code"]!.GetValue<Int32>());

        var denied = await Get(client, "/api/Approval/Runtime/View?instanceId=" + instanceId, strangerToken);
        Assert.Equal(4031, denied["code"]!.GetValue<Int32>());
        var searched = Ok(await Get(client, "/api/Approval/Runtime/Search?field=reason&keyword=" + reason, strangerToken));
        Assert.DoesNotContain(instanceId, searched.ToJsonString());

        var agreed = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Agree", approverToken, new
        {
            taskId = task["id"]!.GetValue<String>(),
            comment = "同意",
            data = "{\"days\":4}",
            requestId = "r8h-ok-" + mark,
            instanceVersion = started["version"]!.GetValue<Int32>(),
        }));
        Assert.Equal(2, agreed["status"]!.GetValue<Int32>());

        var ownerView = Ok(await Get(client, "/api/Approval/Runtime/View?instanceId=" + instanceId, ownerToken));
        Assert.DoesNotContain("days", ownerView["formData"]!.GetValue<String>());
        var approverView = Ok(await Get(client, "/api/Approval/Runtime/View?instanceId=" + instanceId, approverToken));
        Assert.Contains("days", approverView["formData"]!.GetValue<String>());
        var ownerSearch = Ok(await Get(client, "/api/Approval/Runtime/Search?field=reason&keyword=" + reason, ownerToken));
        Assert.Contains(instanceId, ownerSearch.ToJsonString());
    }

    [Fact]
    public async Task Resubmit_field_rules_and_category_over_http()
    {
        await using var factory = new ApprovalApiFactory(_world);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var token = await Login(client, "admin", "admin");
        var processes = Ok(await Get(client, "/api/Approval/Runtime/Processes", token)).AsArray();
        var leave = processes.First(p => p!["code"]!.GetValue<String>() == "leave");
        var processId = leave["id"]!.GetValue<Int32>();
        var startForm = Ok(await Get(client, "/api/Approval/Runtime/StartForm?processId=" + processId, token));
        Assert.Contains(startForm["fields"]!.AsArray(), f => f!["key"]!.GetValue<String>() == "days" && f["access"]!.GetValue<String>() == "hidden");

        var me = Ok(await Get(client, "/api/Approval/Runtime/Me", token));
        var people = Ok(await Get(client, "/api/Approval/Runtime/Candidates", token)).AsArray();
        var counselor = people.First(p => p!["name"]!.GetValue<String>() == "counselor");
        var hidden = await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", token, new
        {
            processId,
            proxy = false,
            data = "{\"studentUserId\":" + me["id"]!.GetValue<Int32>() + ",\"counselorUserId\":" + counselor["id"]!.GetValue<Int32>() + ",\"reason\":\"回家\",\"days\":1}",
            requestId = "http-r4-hidden",
        });
        Assert.Equal(4221, hidden["code"]!.GetValue<Int32>());

        var started = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Start", token, new
        {
            processId,
            proxy = false,
            data = "{\"studentUserId\":" + me["id"]!.GetValue<Int32>() + ",\"counselorUserId\":" + counselor["id"]!.GetValue<Int32>() + ",\"reason\":\"回家\"}",
            requestId = "http-r4-start",
        }));
        var versionId = started["processVersionId"]!.GetValue<Int32>();
        var withdrawn = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Withdraw", token, new
        {
            instanceId = started["instanceId"]!.GetValue<String>(),
            reason = "先撤",
            requestId = "http-r4-wd",
            instanceVersion = started["version"]!.GetValue<Int32>(),
        }));
        Assert.Equal(0, withdrawn["status"]!.GetValue<Int32>());
        var again = Ok(await Send(client, HttpMethod.Post, "/api/Approval/Runtime/Resubmit", token, new
        {
            instanceId = started["instanceId"]!.GetValue<String>(),
            data = "{\"reason\":\"改期\"}",
            requestId = "http-r4-again",
            instanceVersion = withdrawn["version"]!.GetValue<Int32>(),
        }));
        Assert.Equal(2, again["round"]!.GetValue<Int32>());
        Assert.Equal(versionId, again["processVersionId"]!.GetValue<Int32>());
        Assert.Contains(again["history"]!.AsArray(), h => h!["action"]!.GetValue<String>() == "resubmit");

        var grouped = Ok(await Get(client, "/api/ApprovalAdmin/FormDefinition/ByCategory", token)).AsArray();
        var affair = grouped.FirstOrDefault(c => c!["code"]!.GetValue<String>() == "student-affairs");
        Assert.True(affair != null, grouped.ToJsonString());
        Assert.Equal("学工", affair["name"]!.GetValue<String>());
        Assert.Contains(affair["forms"]!.AsArray(), f => f!["code"]!.GetValue<String>() == "leave");
        Assert.Contains(affair["processes"]!.AsArray(), f => f!["code"]!.GetValue<String>() == "leave");
    }

    private static void GrantBits(Role role, PermissionFlags flags)
    {
        var menus = Menu.FindAll();
        var hits = menus.Where(m =>
        {
            var text = (m.FullName ?? "") + " " + (m.Url ?? "") + " " + (m.Name ?? "");
            return text.Contains("Runtime", StringComparison.OrdinalIgnoreCase)
                || text.Contains("Approval", StringComparison.OrdinalIgnoreCase)
                || text.Contains("审批");
        }).ToList();
        if (hits.Count == 0) throw new InvalidOperationException("没有审批菜单");
        foreach (var menu in hits) role.Set(menu.ID, flags);
        role.Update();
        Role.Meta.Cache?.Clear("grant8", true);
        Role.Meta.SingleCache.Clear("grant8");
        User.Meta.Cache?.Clear("grant8", true);
        User.Meta.SingleCache.Clear("grant8");
    }

    private static void Grant(Role role)
    {
        var flags = PermissionFlags.All;
        var menus = Menu.FindAll();
        var hits = menus.Where(m =>
        {
            var text = (m.FullName ?? "") + " " + (m.Url ?? "") + " " + (m.Name ?? "");
            return text.Contains("Runtime", StringComparison.OrdinalIgnoreCase)
                || text.Contains("Approval", StringComparison.OrdinalIgnoreCase)
                || text.Contains("审批");
        }).ToList();
        if (hits.Count == 0)
        {
            var dump = String.Join("\n", menus.Select(m => m.ID + " | " + m.Name + " | " + m.FullName + " | " + m.Url + " | " + m.Permission));
            throw new InvalidOperationException("没有审批菜单\n" + dump);
        }

        foreach (var menu in hits)
            role.Set(menu.ID, flags);
        // Set 只改内存里的权限字典，要保存后鉴权重新加载才能看见。
        role.Update();
        Role.Meta.Cache?.Clear("grant", true);
        Role.Meta.SingleCache.Clear("grant");
        User.Meta.Cache?.Clear("grant", true);
        User.Meta.SingleCache.Clear("grant");
    }

    private static void GrantFull(Role role)
    {
        var menus = Menu.FindAll();
        var hits = menus.Where(m =>
        {
            var text = (m.FullName ?? "") + " " + (m.Url ?? "") + " " + (m.Name ?? "");
            return text.Contains("Runtime", StringComparison.OrdinalIgnoreCase)
                || text.Contains("Approval", StringComparison.OrdinalIgnoreCase)
                || text.Contains("审批");
        }).ToList();
        if (hits.Count == 0)
            throw new InvalidOperationException("没有审批菜单");
        foreach (var menu in hits)
        {
            var mask = 0;
            foreach (var part in (menu.Permission ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var head = part.Split('#')[0];
                if (Int32.TryParse(head, out var bit)) mask |= bit;
            }

            role.Set(menu.ID, (PermissionFlags)mask);
        }

        role.Update();
        Role.Meta.Cache?.Clear("grant", true);
        Role.Meta.SingleCache.Clear("grant");
        User.Meta.Cache?.Clear("grant", true);
        User.Meta.SingleCache.Clear("grant");
    }

    private static ApprovalProcess Publish(String mark)
    {
        var form = new ApprovalFormDefinition
        {
            Code = "http-" + mark + "-form",
            Name = "请假表单",
            Enable = true,
        };
        form.Insert();
        form.SaveDraft(Schema);
        form.Publish(0);

        var process = new ApprovalProcess
        {
            Code = "http-" + mark,
            Name = "请假",
            FormId = form.Id,
            Enable = true,
        };
        process.Insert();
        process.SaveDraft("""
        {"nodes":[{"key":"s","type":"start","name":"开始"},{"key":"c","type":"approve","name":"该生辅导员","mode":"any","assignee":{"type":"subjectCounselor","field":"counselorUserId"}},{"key":"e","type":"end","name":"结束"}],"edges":[{"key":"e1","from":"s","to":"c"},{"key":"e2","from":"c","to":"e"}]}
        """);
        process.Publish(0);
        return process;
    }

    private static String Form(Int32 studentId, Int32 counselorId) =>
        "{\"studentUserId\":" + studentId + ",\"counselorUserId\":" + counselorId + ",\"reason\":\"回家\"}";

    private static async Task<String> Login(HttpClient client, String username, String password)
    {
        var response = await client.PostAsJsonAsync("/Auth/Login", new { username, password });
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, (Int32)response.StatusCode + " " + body);
        var node = JsonNode.Parse(body)!;
        var data = node["data"];
        var token = data?["access_token"]?.GetValue<String>() ?? data?["accessToken"]?.GetValue<String>();
        Assert.False(String.IsNullOrEmpty(token), body);
        return token!;
    }

    private static async Task<JsonNode> Get(HttpClient client, String url, String token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, (Int32)response.StatusCode + " " + text);
        return JsonNode.Parse(text)!;
    }

    private static async Task<JsonNode> Send(HttpClient client, HttpMethod method, String url, String token, Object body)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(body);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, (Int32)response.StatusCode + " " + text);
        return JsonNode.Parse(text)!;
    }

    private static JsonNode Ok(JsonNode body)
    {
        Assert.True(body["code"]!.GetValue<Int32>() == 0, body.ToJsonString());
        return body["data"]!;
    }

    private static IEnumerable<JsonNode> Pending(JsonNode data) =>
        data["tasks"]!.AsArray().Where(t => t!["status"]!.GetValue<Int32>() == 0).Select(t => t!);

    private sealed class ApprovalApiFactory : WebApplicationFactory<Program>
    {
        private readonly ApprovalWorld _world;

        public ApprovalApiFactory(ApprovalWorld world) => _world = world;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<String, String?>
                {
                    ["ConnectionStrings:Membership"] = _world.Membership,
                    ["ConnectionStrings:Cube"] = _world.Cube,
                    ["ConnectionStrings:Log"] = _world.Log,
                    ["ConnectionStrings:Approval"] = _world.Approval,
                });
            });
        }
    }
}
