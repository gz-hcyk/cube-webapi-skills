# assets —— 可复用资产（拷进工程即用）

本目录是**代码模板**，不是文档。所有文件按"目标路径 = 本目录相对路径"落位到 `assets/core/` 之下。

## 拷贝方式

```bash
# 1) 在 create-vue 生成的工程根目录执行
cp -r <skill>/assets/core/. ./src/
cp <skill>/assets/env.example ./.env.local     # 按项目改这三项
```

## 落位映射

| 资产 | 目标 | 说明 |
|---|---|---|
| `main.ts` | `src/main.ts` | 覆盖 create-vue 入口（图标注册 / 样式顺序 / setting.load） |
| `App.vue` | `src/App.vue` | 覆盖为空壳 router-view |
| `router/index.ts` | `src/router/index.ts` | 覆盖，只保留 `/login`、`/dashboard`、`/:area/:controller` |
| `api/token.ts` | `src/api/token.ts` | 令牌 / 租户 / UI 偏好唯一读写口 |
| `api/http.ts` | `src/api/http.ts` | 唯一 axios 层（`http` + `rawHttp` 双实例） |
| `api/fieldRender.ts` | `src/api/fieldRender.ts` | 字段 → 控件 / 列 / 选项 / 规则 |
| `api/useEntityResource.ts` | `src/api/useEntityResource.ts` | 实体页数据基类 |
| `components/cube/*.vue` | `src/components/cube/` | 八个通用组件：ListPage、FormDialog、DetailDrawer、FieldControl、MenuItems、AuthShell、SettingPanel、RoleMenuEditor（角色授权表格，接不接线见 §5.7.1） |
| `layouts/BasicLayout.vue` | `src/layouts/BasicLayout.vue` | 侧栏 + 顶栏 + 内容区 |
| `views/*.vue` | `src/views/` | 登录 / 工作台 / 泛型实体页 |
| `stores/auth.ts`、`stores/setting.ts` | `src/stores/` | 鉴权与外观 |
| `styles/tokens.css`、`theme-dark.css`、`page.css` | `src/styles/` | 设计令牌 / 暗色 / 页面骨架 |
| `utils/color.ts`、`utils/menu.ts` | `src/utils/` | 主色阶推导 / 菜单归一化 |
| `config/app.ts` | `src/config/app.ts` | **必须按项目改写**（E5-L1） |
| `types/env.d.ts` | `src/types/env.d.ts` | 环境变量类型 |

## 覆盖 create-vue 产物时注意

- `src/components/HelloWorld.vue`、`src/components/TheWelcome.vue`、`src/components/WelcomeItem.vue`、`src/components/icons/`、`src/views/HomeView.vue`、`src/views/AboutView.vue`、`src/assets/base.css`、`src/assets/main.css`、`src/assets/logo.svg`、`src/stores/counter.ts` **删掉**，否则是悬空文件。
- create-vue 3.24 的类型入口在仓库根 `env.d.ts`，不是 `src/vite-env.d.ts`。保留根上的那份。
- `src/main.ts` 里原来的 `import './assets/main.css'` 必须消失，否则会覆盖我们的令牌。覆盖成技能的 `main.ts` 后这条 import 已经不在。
- `src/router/index.ts` 会整文件覆盖；若覆盖前还留着 create-vue 的 `/about`，按 E4-M1 删掉。

## 验证

拷完资产后先在 `vite.config.ts` 写上 `/api`、`/Auth`、`/Cube` 代理（见 `SKILL.md` §5.0），再在工程根执行：

```bash
node <skill>/scripts/check-project.mjs .
```

只拷贝、不写代理时闸门会 FAIL。退出码 0 表示骨架、请求层、令牌、暗色、菜单、登录页六类硬性约束全部满足。依赖里还要有 `axios`（`npm i element-plus @element-plus/icons-vue axios`）。
