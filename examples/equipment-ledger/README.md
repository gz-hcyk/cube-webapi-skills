# 设备台账示例

内部设备台账的最小前后端。后端是 NewLife.Cube WebApi，前端是 TDesign Vue Next，页面由 `GetPage` 元数据驱动。用来核对仓库里的两份技能能否被按原文做出来。

本示例跟随的技能提交：

| 技能 | 提交 |
|---|---|
| `cube-webapi-backend` | `756c85af1467af8432b8bce6dd16e2115add3be4` |
| `cube-webapi-tdesign` | `756c85af1467af8432b8bce6dd16e2115add3be4` |

两份技能在该提交上同时存在。对照过程与偏差见仓库 `docs/SKILL-VALIDATION.md`。

## 范围

- 登录后维护设备：名称、编码、存放位置、状态、购置日期，以及所属分类。
- 分类是独立实体，列表页通过外键显示分类名称，表单里选分类。
- 状态是带中文说明的枚举，控制器用 `SetLov` 下发值集编码。
- 不做审批流、导入导出定制、多租户业务隔离、生产部署包。

## 演示账号与数据

账号只写在这里，登录页不预填。

| 项 | 值 |
|---|---|
| 用户名 | `admin` |
| 密码 | `admin` |

这是魔方首次建库时的种子管理员。本机实测 `POST /Auth/Login` 返回 `code: 0` 与 `access_token`。

空库第一次访问业务表时写入两行分类、两行设备：

| 编码 | 名称 | 分类 | 位置 | 状态 |
|---|---|---|---|---|
| OSC-001 | 数字示波器 | 计量仪器 | 实验室A | 在用 |
| PRT-014 | 激光打印机 | 办公设备 | 综合办公区 | 在库 |

种子数据在进程启动、尚无登录用户时写入，审计字段 `createUser` 会是操作系统账户（本机是 `ubuntu`），`createUserID` 为 0。登录后手工新增的行会记成「管理员」。

## 运行后端

需要 .NET 8 SDK。包版本写在 `EquipmentLedger.Web.csproj`：`NewLife.Cube` 6.15.2026.901、`Swashbuckle.AspNetCore` 6.9.0。

```bash
cd examples/equipment-ledger
dotnet build EquipmentLedger.Web/EquipmentLedger.Web.csproj
cd EquipmentLedger.Web
ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://127.0.0.1:5052
```

- 监听 `http://127.0.0.1:5052`，与前端脚手架默认代理目标一致。
- 开发环境才挂 Swagger：`http://127.0.0.1:5052/Swagger`。
- SQLite 文件出现在 `bin/Debug/net8.0/Data/`（`Membership.db`、`Cube.db`、`Log.db`、`Equipment.db`）。相对路径 `Data Source=Data/...` 相对的是程序输出目录，不是工程目录。
- 令牌密钥在 `Config/Cube.config` 的 `<JwtSecret>`，格式为 `HS256:` 加一段示例串，仅供本示例，不能用于生产。

## 运行前端

目录 `web/` 由 `tdesign-starter-cli@0.5.3`（`-type vue3 -temp all`）生成，再按技能并入 `assets/core` 与 `references/scaffold`。

```bash
cd examples/equipment-ledger/web
npm install --no-audit --no-fund
npm run dev:linux
```

浏览器打开 `http://127.0.0.1:3002`，用上面的账号登录。业务菜单来自 `GET /api/Admin/Index/GetMenuTree`，设备列表路由是 `/entity/Ledger/Equipment`，分类是 `/entity/Ledger/EquipmentCategory`。

生产构建：

```bash
npm run build
```

脚本是 `vue-tsc --noEmit && vite build --mode release`。

## 已声明的工程偏差

校验脚本 `check-starter-align.mjs` 对本目录给出 0 FAIL、2 WARN：缺少 `.husky/` 与 `.vscode/`。本次 `tdesign-starter-cli@0.5.3` 的产物里就没有这两个目录，没有手补，避免伪造官方骨架。`npm run lint` 与 husky 提交钩子因此不可用；要恢复需在 CLI 实际产出这两套文件后再装对应依赖。

`package.json` 的 `engines.node` 写的是 `>=22.12.0`，但 `lint-staged@17.0.8` 要求 Node `>=22.22.1`。Node 22.14 上 `npm install` 会以 `EBADENGINE` 失败。本机用 Node 22.22.2 安装成功（882 个包）。

未改 `tsconfig.json` 的编译策略，沿用 CLI 原文件（含 `@/*` 路径）。后端端口用前端脚手架默认的 `127.0.0.1:5052`，没有用后端技能正文里的 `5077`。

依赖安装走 `npm`。技能正文前半写 `pnpm install`，后半记录作者机器上 pnpm 会在链接阶段挂死，并改推 npm。
