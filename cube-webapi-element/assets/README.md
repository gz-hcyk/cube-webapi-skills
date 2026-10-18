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
| `components/cube/*.vue` | `src/components/cube/` | 六个通用组件 |
| `layouts/BasicLayout.vue` | `src/layouts/BasicLayout.vue` | 侧栏 + 顶栏 + 内容区 |
| `views/*.vue` | `src/views/` | 登录 / 工作台 / 泛型实体页 |
| `stores/auth.ts`、`stores/setting.ts` | `src/stores/` | 鉴权与外观 |
| `styles/tokens.css`、`theme-dark.css`、`page.css` | `src/styles/` | 设计令牌 / 暗色 / 页面骨架 |
| `utils/color.ts`、`utils/menu.ts` | `src/utils/` | 主色阶推导 / 菜单归一化 |
| `config/app.ts` | `src/config/app.ts` | **必须按项目改写**（E5-L1） |
| `types/env.d.ts` | `src/types/env.d.ts` | 环境变量类型 |

## 覆盖 create-vue 产物时注意

- `src/components/HelloWorld.vue`、`src/views/HomeView.vue`、`src/views/AboutView.vue`、`src/assets/base.css`、`src/assets/main.css`、`src/stores/counter.ts` **删掉**，否则是悬空文件。
- `src/main.ts` 里原来的 `import './assets/main.css'` 必须消失，否则会覆盖我们的令牌。
- `src/router/index.ts` 里若保留 create-vue 的示例路由（`/about`），页面能开但菜单里没有入口——按 E4-M1 删掉。

## 验证

拷完后在工程根执行：

```bash
node <skill>/scripts/check-project.mjs .
```

退出码 0 表示骨架、请求层、令牌、暗色、菜单、登录页六类硬性约束全部满足。
