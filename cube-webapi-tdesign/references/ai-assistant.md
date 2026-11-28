# 框架 AI 助手接入（全局浮窗 · SSE · 浏览器工具）

> **实证基线**：NewLife.Cube **6.15.2026.901** + NewLife.AI **1.7.2026.1024**；在 ERP/`web-td` 上端到端落地（2026-11-28）。
> 换版本先按 §1 的取证路径复核，**不要假定契约不变**。

## 1 契约取证路径（先取证再写码）

| 途径 | 位置 | 能拿到什么 |
|---|---|---|
| XML 文档 | `~/.nuget/packages/newlife.cube/<ver>/lib/net8.0/NewLife.Cube.xml` | 类/成员摘要：`AiController` 注释写明了三条能力分级与路由约定；`CubeAiChatRequest` 逐字段语义 |
| DLL 字符串 | 同上 `NewLife.Cube.dll` | SSE 事件名、`run_js`、`AISwitch` 等标识符是否存在于该版本 |
| 事件模型 | `~/.nuget/packages/newlife.ai/<ver>/lib/net8.0/NewLife.AI.xml` | `ChatStreamEvent` 的属性说明（`thinkingTime`、`checkpointId` 等） |

```bash
# 字段语义最可靠的来源：XML 里 CubeAiChatRequest 的每个 P: 节点
grep -n -A3 "P:NewLife.Cube.AI.CubeAiChatRequest" NewLife.Cube.xml
# 事件名/关键字是否在该版本存在
grep -ao "run_js\|AISwitch\|content_delta" NewLife.Cube.dll | sort -u
```

## 2 三个端点（**根族路径，无 `/api` 前缀**）

| 端点 | 方法 | 用途 | 鉴权 |
|---|---|---|---|
| `/Cube/GetAiConfig` | GET | 总开关 + 浮窗配色 + mermaid 地址 | 登录态 |
| `/Ai/AiChat` | POST | SSE 流式对话 | `[EntityAuthorize(PermissionFlags.Detail)]` ⇒ **必须 `Authorization: Bearer`** |
| `/Ai/OperationResult` | POST | 浏览器工具执行结果回传 | 同上 |

> `GetAiConfig` 返回对象键名随序列化策略可能是 `aiSwitch` 或 `AISwitch`，**两种都认**，其余一律视为关闭（fail-closed）。

## 3 请求体：`CubeAiChatRequest`（**最容易写错的地方**）

继承 NAI 通用请求，附加魔方页面上下文：

| 字段 | 语义 | 常见错误 |
|---|---|---|
| `Message` / `SessionId` / `Think` / `Stream` | 通用对话字段 | — |
| `Page` | **页面类型：`list` / `form` / `detail`** | ❌ 把路由名（如 `SaleOrderList`）塞进来 |
| `Mode` | 表单模式：`add` / `edit`（仅 `page=form` 有意义） | 省略可接受 |
| `Id` | 记录编号（form / detail） | — |
| `Query` | 列表查询条件 **Base64**（`_query`），服务端 `DecodePager` 解码，**解码失败按 null 处理** | 传原始 query 串 |
| `Area` | 目标页面区域（如 `Scm`）；非区域页为空 | — |
| `Controller` | 目标页面控制器名（如 `SaleOrder`），**服务端据此解析目标控制器并注册工具** | 传前端的路由 name |
| `Url` | 目标页面路径（`location.pathname`），后端按「用户+页面」隔离会话 | 传 `fullPath`（带 query，会污染会话键） |

**判定 `Page` 的可靠写法**：按路径后缀，而非路由 meta 或 name。

```ts
if (/\/(form|edit|add|create)(\/|$)/.test(path)) 'form'
else if (/\/(detail|view)(\/|$)/.test(path)) 'detail'
else 'list'
```

**`Area`/`Controller` 的来源**：项目里以 `route.meta.menuUrl`（如 `/Scm/SaleOrder`）拆段最稳——它就是后端菜单 URL，天然对齐控制器路由。

## 4 服务端按目标控制器能力**分级注册工具**

| 目标控制器实现 | 注册的工具 | 提示词 |
|---|---|---|
| `IEntityAiContext`（实体控制器） | `get_data_context` / `get_form_schema` / `fill_form` | 实体定制提示词 |
| `IFormAiContext`（配置表单页，如魔方设置） | `get_form_schema` / `fill_form` | 表单提示词 |
| 其他（非实体页） | `get_system_info` / `get_page_context` / `run_js` | 通用提示词 |

- 目标控制器实现 `IPageDataContext` 时，`get_page_context` 优先走其服务端实现。
- **实体页对话额外校验 Detail 权限**（`CheckEntityPermission`）：无权限时降级处理，不报 403 中断对话。
- 结论：**`Area`/`Controller` 传错 = 工具全丢**，助手只会泛泛而谈，且不报错——这是「答非所问」的第一嫌疑。

## 5 SSE 协议

帧格式 `data: {json}\n\n`；序列化选项固定为 **camelCase + 忽略 null + 中文直出 + Int64 超 JS 安全整数转字符串**。

| 事件 `type` | 关键字段 | 前端处置 |
|---|---|---|
| `message_start` | `model` | 记录模型名 |
| `thinking_delta` | `content` | 累加到可折叠「思考过程」 |
| `thinking_done` | `thinkingTime`（毫秒） | 显示耗时 |
| `content_delta` | `content` | **打字机增量** |
| `message_done` | `finishReason` | 结束流式态 |
| `tool_call_start` / `_done` / `_error` | `toolCallId` / `name` / `arguments` / `result` / `error` | 工具轨迹行 |
| `run_js` | `checkpointId` / `script` | 浏览器工具（见 §7） |
| `knowledge_refs` | — | 知识引用（可忽略） |
| `error` | `message` / `code` | 红色错误行 |
| `heartbeat` | — | 忽略 |

**必须向前兼容**：未知 `type` 直接忽略，不得抛错——框架新增事件类型很常见。

## 6 前端四件套（分层职责，别揉成一个文件）

| 文件 | 职责 | 可测性要点 |
|---|---|---|
| `api/aiChat.ts` | 三端点 + 鉴权头 + SSE 读流 | 用 `vi.stubGlobal('fetch')` 造 `ReadableStream`，无需真网络 |
| `utils/sse.ts` | 帧解析（跨 chunk 半帧、单 chunk 多帧） | 纯函数，喂字符串断言帧数组 |
| `utils/typewriter.ts` | 增量 → 逐帧显示的缓冲 | 纯类，`tick()` 返回是否还有待显示 |
| `components/ai/AiAssistant.vue` | 浮窗 UI + 事件分派 + 生命周期 | `attachTo: document.body`（抽屉/Teleport 需真实 DOM） |

### 6.1 为什么必须 `fetch` + `ReadableStream`（对 H1 的显式例外）

三条硬约束叠加，`axios` 与 `EventSource` 都不可行：

1. 端点要求 `Authorization: Bearer` → **`EventSource` 不支持自定义请求头**；
2. 需要流式增量 → `axios` 在浏览器端不暴露流式 reader；
3. 需要 `AbortController` 支持「停止生成」。

**结论**：允许在 `api/` 层直接 `fetch`，但**鉴权头必须复用同一令牌来源**（`auth.token` / `X-Tenant-Id`），不得另建令牌副本。这是 H1「唯一 HTTP 层」的唯一豁免点，写在代码注释里，否则下次代码审查会被当违规改回去。

### 6.2 打字机参数（来自实测取舍，非拍脑袋）

- 服务端增量先入**缓冲**（放在响应式之外：`let typewriter`），每帧只回写一条字符串 → 避免整表深度追踪。
- 自适应步长：待显示量 `>240` 字按 **1/6 追赶**、`>60` 字每帧 **4 字**、其余 **2 字**。固定 1 字/帧在长回复下会「追不上流」，固定大步长会跳字。
- `message_done` 后**继续排空缓冲**再收尾，否则截断尾部。
- `requestAnimationFrame` 驱动，不以 `setInterval` 计（后台标签页会节流）。

### 6.3 开关门控（fail-closed）

- 挂载时取一次 `GetAiConfig`；`!= true` 或异常 → **整个组件不渲染**，不弹提示、不占位。
- 真源是后端配置库 `CubeSetting.AISwitch`（`bin/Data/dbConfig_Cube.json` 的 `Cube:AISwitch`），**前端不可覆写**；`AIProvider` / `AIEndpoint` / `AIApiKey` / `AIModel` 同处配置。
- 未开启时端到端对话**无法验证**，交付时必须显式声明该缺口，不能写「已联调通过」。

## 7 浏览器工具 `run_js`（安全边界）

- 收到 `{type:'run_js', checkpointId, script}` → 前端 `new Function(script)()` 在**当前页面**执行 → `POST /Ai/OperationResult { checkpointId, result }`。
- **不回传 = 服务端工具调用挂 30s 超时**，用户看到的是「转圈不动」，不是报错。
- 回传体约定 `{ok, value, error}`；DOM / 循环引用 / 函数必须序列化兜底（`WeakSet` 查环 + `[function]` 占位），否则 `JSON.stringify` 抛错导致回传失败。
- **风险**：等于把当前页 DOM 与 JS 执行权交给模型输出，提示注入可读取页面数据或触发页面操作。两种策略二选一，必须显式决策并写进 README：
  - **自动执行**（与框架官方前端一致，体验顺滑）；
  - **执行前弹确认框展示脚本**（改 `handleRunJs` 单函数即可）。
- 另有一类 `fill_form` 工具走「不写库、回填表单、用户确认后提交」的安全路径，与 `run_js` 不是一回事。

## 8 验收清单（可执行，别只看代码）

```bash
node references/scripts/check-starter-align.mjs <工程>   # 0 FAIL
npx vue-tsc --noEmit                                     # 0 错误
npx vitest run                                           # 全绿
curl -s --noproxy '*' http://127.0.0.1:5110/Cube/GetAiConfig -H "Authorization: Bearer $T"
```

单测必须覆盖的四条（缺任一条，回归时可能悄悄坏掉）：

1. 开关 `false` → 不渲染任何入口；
2. 开关 `true` → 渲染悬浮球；
3. `content_delta` 三段 → 气泡最终与完整回复一致**且过程中短于全长**（证明打字机在跑，不是一次性塞入）；
4. **请求体语义**：`page === 'list'`、`url` 为路径、`area`/`controller` 取自 `menuUrl`（防「路由名塞 page」回归）。

真机：开启开关 → 进实体列表页 → 问「这个列表有哪些字段/有哪些数据」→ 应答须引用真实字段名（说明 `get_form_schema`/`get_data_context` 生效，即 `Area/Controller` 传对了）。

## 9 反模式速查

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| `page` 传路由名 | 服务端当非法页面类型，实体会话降级通用流程 | 传 `list`/`form`/`detail` |
| `EventSource` | 无法带 `Bearer`，401 | `fetch` + `ReadableStream` |
| `url` 传 `fullPath` | 会话键被 query 污染，同页不同参各成一会话 | 传 `route.path` |
| vite 代理漏 `/Cube` | 请求落 SPA 兜底返回 `200 text/html`，**入口永不显示且无报错** | 代理白名单含 `/Cube`（铁律 H3） |
| `t-drawer :footer="false"` | 连 `#footer` 插槽一起禁用 → 输入区不渲染 | 用带 `#footer` 插槽的默认配置 |
| 每次 `new` 缓冲在响应式里 | 长回复掉帧 | 缓冲放响应式之外，每帧回写一条字符串 |
| 未兼容未知事件 | 框架加新事件即整条流中断 | `default: break` |
