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
        using var client = factory.CreateClient();

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
