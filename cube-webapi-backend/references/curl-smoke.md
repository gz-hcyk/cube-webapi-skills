---
name: curl-smoke
description: cube-webapi-backend 标准冒烟探针脚本（bash curl：登录→带 token 列表→401→匿名门户→Detail?id=）。后端联调/部署后验证用（部署 Playbook §15.7 也引用本脚本）。
---

# 标准冒烟探针脚本（curl，登录→token→401/200 验证）

> 原 SKILL.md §14.7（**保真**）。复制到 bash 直接跑（Windows Git Bash / WSL 均可）。`BASE` 填后端地址；前端走代理时填前端地址（如 `http://127.0.0.1:5173`）亦可，代理会转发到后端。

### 14.7 标准冒烟探针脚本（curl，登录→token→401/200 验证）

> 复制到 bash 直接跑（Windows Git Bash / WSL 均可）。`BASE` 填后端地址；前端走代理时填前端地址（如 `http://127.0.0.1:5173`）亦可，代理会转发到后端。

```bash
BASE="http://127.0.0.1:5000"          # 或前端代理地址 http://127.0.0.1:5173
USER="admin"; PASS="admin"

echo "=== 1) 登录拿 token（实测键名 data.access_token，snake_case）==="
RESP=$(curl -s -m 8 -X POST "$BASE/Auth/Login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\",\"category\":0}")
echo "$RESP" | head -c 200; echo
TOKEN=$(echo "$RESP" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
echo "token_len=${#TOKEN}"
[ -z "$TOKEN" ] && { echo "❌ 登录失败，未拿到 token"; exit 1; }

echo "=== 2) 带 token 访问管理列表（应 200 + data）==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/Blog/Article?pageSize=10" | head -c 200; echo

echo "=== 3) 不带 token 访问（应 401，确认鉴权链路通）==="
curl -s -m 8 -o /dev/null -w "no-token HTTP %{http_code}\n" \
  "$BASE/api/Blog/Article?pageSize=10"

echo "=== 4) 匿名门户（应 200 + code:0，无需 token）==="
curl -s -m 8 "$BASE/api/Blog/Portal/Categories" | head -c 200; echo

echo "=== 5) 详情 id 走查询参数（应返回数据，非空）==="
curl -s -m 8 "$BASE/api/Blog/Portal/Detail?id=1" | head -c 200; echo
```

**判定标准**：
- 步骤 1 `token_len > 0` → 登录契约正确（若拿到的是 `accessToken` 说明版本差异，改 sed 正则即可）
- 步骤 2 返回 `code:0` + `data` 数组 → CRUD 列表通
- 步骤 3 `HTTP 401` → `[AllowAnonymous]` 缺失的接口被正确拦截，鉴权生效
- 步骤 4 `code:0` → 匿名门户通
- 步骤 5 返回 `Content` 等字段 → `Detail?id=` 查询参数写法正确（若用 `/Detail/1` 路径则返回空，印证 14.3 结论）

> Windows PowerShell 里 `sed` 不可用，改用：`($RESP | Select-String '"access_token":"([^"]*)"').Matches.Groups[1].Value` 取 token；或装 Git Bash。

