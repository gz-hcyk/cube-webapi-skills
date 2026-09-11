---
name: deployment
description: cube-webapi-backend 生产部署 Playbook —— 后端 publish/Production 配置/Nginx/systemd/README 模板与坑。上线部署时读本文件（前端部署见 cube-webapi-tdesign §十）。
---

# 生成生产部署包（可复用 Playbook）

> 原 SKILL.md §十五（**保真**）。适用：把「魔方 WebApi 后端 + 独立 TDesign 前端」项目打包成可上线的 Linux 部署包（Nginx 反代 + Kestrel + SQLite）。前端构建与同步见 `cube-webapi-tdesign` §十。

## 十五、生成生产部署包（可复用 Playbook）

> **适用**：把「魔方 WebApi 后端 + 独立 TDesign 前端」项目打包成可上线的 Linux 部署包（Nginx 反代 + Kestrel + SQLite）。
> 实测来自 MyBlog 个人博客（NewLife.Cube 6.13 + XCode 12.1 + .NET 8 + Vue3/TDesign）。
> **形态**：Linux + .NET 8 框架依赖（`--no-self-contained`）+ Nginx 反向代理，根路径 `/` 访问（子路径 `/blog/` 见 tdesign §10.10）。
> **调用方式**：直接照 15.1→15.8 五步走，每步含可拷贝命令/模板；坑见 15.9。
> 前端构建与同步的专属坑（vite 后台 outDir 空写、base 路径）在 `cube-webapi-tdesign` §10.10，本 Playbook 只引用不重复。

### 15.1 目标产物结构

```
publish/
├── backend/                      # 后端 Release 产物（linux-x64 框架依赖）
│   ├── MyBlog.Web.dll            # 主程序
│   ├── appsettings.json          # 默认（AllowedHosts=*，开发/验证用）
│   ├── appsettings.Production.json  # 生产配置（部署前必改，§15.4）
│   └── Data/                     # 运行时自动建 SQLite 库（Membership/Cube/Log/MyBlog）
├── frontend/                     # 前端静态（vite build，见 tdesign §10.10）
├── nginx.<proj>.conf             # Nginx 反代配置（§15.5）
└── README.md                     # 上线说明（§15.8）
```

### 15.2 后端发布（Release，跨平台出 Linux 包）

```bash
# 本机 Windows / .NET 10 SDK 也能跨平台出 linux-x64 包（publish 不依赖目标 SDK）
# ⚠️ SDK 10 + 新增包时 dotnet restore 可能 NuGet 异常 → 用 --no-restore 复用已还原资产
dotnet publish MyBlog.Web/MyBlog.Web.csproj -c Release -r linux-x64 --no-self-contained -o publish/backend
```

- `--no-self-contained` = 框架依赖：目标服务器需**预装 .NET 8 Runtime**（`dotnet --version` 显示 8.x），否则起不来。
- `-r linux-x64`：跨平台出 Linux 包（本机 Win 也无妨）。产物 `publish/backend/MyBlog.Web.dll` 即主程序。
- 0 错误即成功；若报 `MSB3027/3021 文件被锁定` → `taskkill /F /IM dotnet.exe` 杀旧进程再 publish（代码本身 0 错误，勿误判）。

**连接串必须跨平台（§十二同源，部署前最后核对）**：`appsettings.json` 的 `ConnectionStrings` 用**正斜杠** + `Data Source=`（带空格）+ **删 `Provider=sqlite`** + `Busy Timeout=15000`：
```json
"MyBlog": "Data Source=Data/MyBlog.db;Busy Timeout=15000"
```
Windows 的 `Data\*.db`（反斜杠）/ `DataSource=`（无空格）/ `:memory:` 覆盖 / 启动并发写锁 busy timeout 不足，都会让 Linux 上建表错乱或接口 500，详见 §十二。

### 15.3 把 Production 配置并入包

复制 `appsettings.Production.json` 到 `publish/backend/`。模板（占位项部署前替换为真实值，见 §15.4）：

```json
{
  "Logging": { "LogLevel": { "Default": "Warning", "Microsoft.AspNetCore": "Warning" } },
  "AllowedHosts": "your-domain.com,www.your-domain.com",
  "ConnectionStrings": {
    "Membership": "Data Source=Data/Membership.db;Busy Timeout=15000",
    "Cube": "Data Source=Data/Cube.db;Busy Timeout=15000",
    "Log": "Data Source=Data/Log.db;Busy Timeout=15000",
    "MyBlog": "Data Source=Data/MyBlog.db;Busy Timeout=15000"
  },
  "Cube": {
    "JwtSecret": "CHANGE-ME-REPLACE-WITH-32-BYTE-RANDOM-SECRET",
    "TokenExpire": 86400,
    "CorsOrigins": "https://your-domain.com,https://www.your-domain.com",
    "WebRootPath": "wwwroot"
  }
}
```
`ASPNETCORE_ENVIRONMENT=Production` 时自动叠加覆盖 `appsettings.json` 同名项（JwtSecret/CorsOrigins/AllowedHosts/Logging）。

### 15.4 上线前必改项（生产安全红线）

1. `Cube.JwtSecret` → 强随机串 `openssl rand -hex 32`（占位串上线 = 令牌可伪造）。
2. `Cube.CorsOrigins` → 真实前端域名（否则跨域被拒）。
3. `AllowedHosts` → 真实域名（否则 400 Invalid Hostname）。
4. 默认管理员 `admin/admin` 上线后**立即改密**。
5. HTTPS：Nginx `listen 443 ssl` + certbot 证书，反向代理头已含 `X-Forwarded-Proto`（见 §15.5）。

### 15.5 Nginx 反向代理模板（根路径版）

`nginx.<proj>.conf`（根路径 `/` 部署；子路径见 tdesign §10.10）：
```nginx
server {
    listen 80;
    server_name your-domain.com;   # 改域名或 _（IP 测试）

    root /var/www/myblog/frontend;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$ {
        expires 30d; add_header Cache-Control "public, immutable"; try_files $uri =404;
    }
    # 后端 API 反代：必须包含这 5 条前缀
    location /api/     { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location /Auth/    { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location /Mfa/     { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location /cube/    { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location /Content/ { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    # SPA history 回退（仅非文件 GET）
    location / { try_files $uri $uri/ /index.html; }
    # 上传端点（产品视频/大文件）
    location /cube/image { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    client_max_body_size 220m;   # 对齐后端 Kestrel MaxRequestBodySize（视频/大文件上传）
}
```
部署：`sudo cp nginx.<proj>.conf /etc/nginx/sites-available/<proj> && sudo ln -s /etc/nginx/sites-available/<proj> /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`。
把 `server_name your-domain.com` 改成真实域名（或临时 `_` + 服务器 IP 测试）。上传上限已对齐后端 220m。

### 15.6 systemd 服务（开机自启）

`/etc/systemd/system/<proj>.service`：
```ini
[Unit]
Description=MyBlog Web
After=network.target

[Service]
WorkingDirectory=/var/www/myblog/backend
ExecStart=/usr/bin/dotnet /var/www/myblog/backend/MyBlog.Web.dll --urls http://127.0.0.1:5000
Restart=always
RestartSec=10
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
```
`WorkingDirectory` **必须**指向 backend 目录——SQLite 连接串 `Data/*.db` 相对 **进程 CWD**（见 §十二），非 ContentRoot，错了会建到别的目录/查不到库。

### 15.7 本地冒烟验证（本机 .NET 10 跑 net8 包）

> 本机默认 SDK 是 .NET 10（无 net8 SDK）也能跑 net8 应用：`DOTNET_ROLL_FORWARD=Major` 让 net8 应用滚动到 net10 运行时。
> ⚠️ **功能冒烟用 `ASPNETCORE_ENVIRONMENT=Development`**：Production 的 AllowedHosts 限域名，127.0.0.1 会被 400 Invalid Hostname 拦截，功能验证无意义；Development 下 `AllowedHosts=*` 放行。上线才切 Production + 真实 AllowedHosts。

```bash
# 隔离端口（避免 5010 等残留进程占用 → fuser -k 5010/tcp 清掉换 5021）
DOTNET_ROLL_FORWARD=Major ASPNETCORE_ENVIRONMENT=Development \
  dotnet publish/backend/MyBlog.Web.dll --urls http://127.0.0.1:5021 &
# 等启动后跑 §14.7 冒烟脚本（BASE=http://127.0.0.1:5021）：登录→带 token 列表→401→匿名门户
```
判定：启动日志无 `:memory:`、自动建 4 库（Cube/Log/Membership/MyBlog，`Data/*.db` 大小>0）、核心接口 200+code:0。**测试库务必清理**再打包（避免把开发数据带上线）。

### 15.8 README 模板（随包）

含：生成时间、功能清单、前置条件（.NET 8 Runtime / Nginx）、部署步骤（上传→改 Production 配置→配 Nginx→起 systemd→验证）、生产安全必做、数据备份与回滚。直接照 MyBlog `publish/README.md` 结构写。

### 15.9 部署 Playbook 常见坑

- **连接串反斜杠**（实测）：Windows 写 `Data\*.db` 在 Linux SQLite 路径解析错乱 → 一律正斜杠 `Data/*.db`。
- **Production 400 Invalid Hostname**：本地冒烟必须 Development 环境；上线才切 Production + 真实 AllowedHosts。
- **`--no-self-contained` 忘了装 .NET 8 Runtime**：服务器 `dotnet --version` 非 8.x 则起不来。
- **端口残留进程**：`fuser -k <port>/tcp` 清理后换端口再起。
- **SQLite 相对 CWD**：systemd `WorkingDirectory` 必须指向 backend 目录，否则库建错地方。
- **上传上限不一致**：Nginx `client_max_body_size` 与后端 `Kestrel MaxRequestBodySize` 须对齐（本项目 220m）。
- **测试库污染**：冒烟后清理 `Data/*.db` 再打包，部署即新建干净库。
- **前端同步坑（跨技能）**：`vite build --outDir` 在后台进程可能清空不写入 → 用默认 `dist` + Python `copytree`，见 tdesign §10.10。
- **ELF apphost 勿删**：`dotnet publish -r linux-x64` 会在输出目录生成 `MyBlog.Web`（ELF 原生入口，magic `7f45 4c46`），它是 Linux 上 `./MyBlog.Web` 直接运行的入口，**不是垃圾文件**，清理发布包时切勿删除（否则只能退回 `dotnet MyBlog.Web.dll`）。
- **MySQL 生产配置**：生产若用 MySQL，`ConnectionStrings` 用 `Server=.;Port=3306;Database=xxx;Uid=xxx;Pwd=xxx;provider=mysql`，`MyBlog/Log/Cube` 可 `MapTo=Membership` 共用连接。`MySql.Data` 为**托管**提供程序，无需 e_sqlite3 原生库；NewLife 启动时把提供程序 DLL 提取到 `Plugins/`（`Plugins/MySql.Data.dll` 等），**运行时自动重建，勿随包发布**（留着也不影响，首启自提取）。本地连不上生产 MySQL 时会报 `MySqlException: Unable to connect` —— 仅验证「提供程序已加载」即可，连库需在生产服务器。
- **`--no-restore` 缺 RID 原生库**：本机只对 win-x64 做过 restore 时，对 `linux-x64` 用 `--no-restore` 发布不会带 linux 原生资产（如 SQLite 的 `e_sqlite3.so`），导致 Linux 起不来。需先 `dotnet restore -r linux-x64` 拉齐目标 RID 资产再 publish（本项目生产用 MySQL，无此问题）。
- **发布前核对真实数据库目标**：`appsettings.json` 可能被改成生产目标（如本项目已切换为 MySQL@www.hcyk.net + 真实密码 + `AllowedHosts=www.hcyk.net`），**勿套用 Playbook 默认的 SQLite 假设**。发布前 `Read` 一下 `appsettings.json` 确认 `ConnectionStrings` 与 `AllowedHosts/CorsOrigins`；若 `appsettings.Production.json` 是占位模板（your-domain.com / CHANGE-ME），要同步成真实生产值消除环境切换冲突。
- **运行时产物勿随包**：`Plugins/`、`Data/`、`backendLog/`、`backend/Config`、`backend/Entities` 均为 NewLife 启动自动生成，打包前清理；冒烟验证后务必再清一次（冒烟会重新生成）。

---

