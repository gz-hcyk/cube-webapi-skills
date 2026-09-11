# LovListField CDP 验收脚本

用 Node 直驱 headless Chrome（CDP，仅用内置 `ws`，零第三方依赖）对 `LovListField`
做真实浏览器端到端验收。产物（截图 / 日志 / `*_result.json`）输出到**脚本同目录**。

## 前置

1. 起 Mock 后端（在 `references/scaffold/` 下，默认 `:3001`）：

   ```bash
   cd references/scaffold && node backend/server.mjs
   ```

2. 起前端 dev server（默认 `:5183`，已配置 vite proxy → `:3001`）：

   ```bash
   cd references/scaffold && npm run dev
   ```

3. 本机有 Chrome（脚本用 `C:/Program Files/Google/Chrome/Application/chrome.exe`，
   路径不同改脚本头部 `CHROME` 常量）。

> ⚠️ **必须 `export NO_PROXY='*'; export no_proxy='*'`**：本机 HTTP(S)_PROXY 会让
> 连 127.0.0.1 的请求走代理 502。脚本访问的是 `localhost`（不是 `127.0.0.1`），
> vite 绑定在 `::1`，`127.0.0.1` 不通。

## 运行

```bash
node references/scripts/lov/lov_cdp.mjs          # 组件层 27 项
node references/scripts/lov/lov_form_cdp.mjs     # 表单集成 15 项
node references/scripts/lov/lov_display_cdp.mjs  # id→名称回显 11 项
```

退出码 `0` = 全部通过；非 0 = 有失败项（失败项在 stdout 以 `✗` 标出）。

## 三套脚本分工

| 脚本 | 覆盖 | 断言数 |
|---|---|---|
| `lov_cdp.mjs` | DEV 页 `/lov-demo`：表格渲染 / 选择列 / 搜索 / 分页 / 跨页已选 / 单选关闭 / 多选确定 / `refLovCode` 列翻译 | 27 |
| `lov_form_cdp.mjs` | `/entity/Admin/User` 新增弹窗：`lov-list` 分支渲染 / 弹窗打开 / 单选·多选回填 | 15 |
| `lov_display_cdp.mjs` | 编辑态回显名称（非 id）→ 换选 → 保存后后端存的是 id（显示与提交分离） | 11 |

## 幂等性

`lov_display_cdp.mjs` 会改 mock 数据（保存后 `roleLovID` 由 3 变 5），因此**开头与结尾各复位一次**
（种子：`roleLovID=3, roleIds='1,2'`），可反复运行。

> ★ **复位必须用 Node 原生 `fetch`，不要 `execSync('curl ...')`**：Windows 下 `cmd` 不识别单引号，
> `-d '{"id":2}'` 会把单引号一起当 body 送出 → mock 收到非法 JSON 静默失败（`curl -s` 仍 exit 0），
> 表现为「上一轮跑完数据没复位 → 下一轮 A2/B2 假失败」。Node 的 fetch(undici) 不读系统代理，
> 无需额外绕 `NO_PROXY`。

## ★ 两个必知陷阱（写新断言时照抄）

1. **判 `t-dialog` 可见性必须用 `getBoundingClientRect().width > 0`**：
   TDesign 隐藏弹窗**仍在 DOM**，且**没有** `t-dialog--hidden` 类——可见与隐藏的
   `className` 完全相同，唯一差别是隐藏时尺寸为 `0×0`。
   旧写法 `!classList.contains('t-dialog--hidden')` **恒真** → 误判「弹窗没关」。
2. **同页多个 lov-list 字段可能有相同标题的弹窗**（两个字段同 `LovCode`）：
   按标题匹配弹窗时会命中另一个隐藏实例，必须**叠加尺寸过滤**后再取。

## 契约变更记录

- 2026-09：`select` / `confirm` 的载荷从裸值（`row` / `string[]`）改为
  对象 `{ value, display, rows }`。三套脚本已同步；`lov_display_cdp.mjs` 为验证
  「只读框显示名称、提交存 id」而新增。
