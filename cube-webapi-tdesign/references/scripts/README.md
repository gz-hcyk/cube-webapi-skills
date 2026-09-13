# 资产体检脚本

三个零依赖脚本，用于定期给技能资产做「死文件 / 悬空引用 / 副本漂移 / **CLI 产物形态**」体检。

```bash
node references/scripts/scan-assets-dead.mjs      # 零引用源码文件（含入口白名单判断提示）
node references/scripts/scan-assets-refs.mjs      # ① 文档悬空引用 ② assets ↔ scaffold 副本一致性
node references/scripts/check-starter-align.mjs   # 铁律 C1：工程是否仍是 tdesign-starter CLI 产物形态
# 换技能目录：SKILL_DIR=/path/to/skill node ...
```

## `check-starter-align.mjs` 用法（铁律 C1 的机检入口）

```bash
node check-starter-align.mjs                       # 默认检查 references/scaffold
node check-starter-align.mjs <工程目录>             # 检查任意工程（含真实业务工程）
node check-starter-align.mjs <工程目录> --json      # JSON 输出（CI 用）
node check-starter-align.mjs --manifest            # 打印 CLI 基线清单（13 项产物 / 必须保留 / 可删 / 必须删 / 必须补）
```

**退出码 0 = 无 FAIL，1 = 有 FAIL** —— 可直接进 CI / 收尾自检。

**三层判据**（不是一票否决，分级才有用）：

| 级别 | 含义 | 典型项 |
|---|---|---|
| **FAIL** | 工程骨架 / 构建契约被破坏，**必修** | 缺 CLI 骨架 8 件（`index.html` `package.json` `tsconfig.json` `tsconfig.node.json` `vite.config.ts` `public/favicon.ico` `src/main.ts` `src/vite-env.d.ts`）、`build` 无 `vue-tsc`、存在 `scripts.prepare`、缺 `vue-router`/`pinia`/`axios`、缺 `@` 别名、`tsconfig` 缺 `paths`/`references`、`index.html` 缺挂载点或 favicon、`main.ts` 缺外壳 |
| **WARN** | 「工程选择」级偏离：**允许，但须在工程 README 显式声明** | `tsconfig` / `tsconfig.node.json` 的编译策略（`target`/`moduleResolution`/`strict`/`lib`/额外键/`include`） |
| **INFO** | CLI 演示件去留，**不扣分** | `.npmignore` / `README.md` / `tdesign-logo.svg` / `vite-logo.svg` / `App.vue` |

**基线**：`td-starter init <名> -type vue3 -bt vite -temp lite`（tdesign-starter-cli v0.5.3，2026-09-13 实测）。
两条踩过的硬坑已写进脚本：① `-temp all` 是**交互式**多选，非 TTY 下必崩（`ERR_USE_AFTER_CLOSE`），不可脚本化；② CLI 的 `scripts.prepare` 调 `is-ci`/`husky`（**不在 dependencies**），实测 `npm run prepare` → exit=1 ⇒ **`npm install` 必然失败**，故「有 `prepare`」判 FAIL。

**当前结果（2026-09-13）**：

| 目标 | FAIL | WARN | 说明 |
|---|---|---|---|
| `references/scaffold` | **0** | 0 | 完整对齐；tsconfig 与 CLI 基线逐字一致 |
| `references/demo` | **0** | 1 | WARN = tsconfig 编译策略偏离，已在 `demo/README.md` §「已声明偏差」声明 |
| `(真实工程) cube-webapi-frontend` | **0** | 2 | 已补 `public/favicon.ico` / `index.html` favicon / `build` 加 `vue-tsc` / 补 `vue-tsc` devDep |

## 读结果的三个坑（重要）

1. **「零引用」≠「无用」**。入口文件天然零引用：`main.ts` / `App.vue` / `router/index.ts` /
   `vite.config.ts` / `*.d.ts` / `backend/server.mjs` / 验收脚本自身。删它们等于删工程。
   真正该处理的是「**非入口**且零引用、且文档无承诺」的文件。
2. **正则必须允许扩展名**：路径常写成 `'@/layouts/BasicLayout.vue'`，若模式写成
   `from ['"][^'"]*BasicLayout['"]`（不许 `.vue`）会**全部漏匹配**，把活文件误报成死文件。
   本脚本已按 `stem(\.(vue|ts|mjs|js))?` 处理。
3. **资产拷贝模板的"零引用"是常态**：`assets/optional/*` 是给使用者按需拷的，
   不被 scaffold 引用很正常。判定要看**文档是否承诺该能力**。

## 本次体检结论（2026-09-10）

- 删运行产物 23 个（17 张 CDP 截图 + 3 log + 3 result.json，约 900KB），体积 2.3M → 1.4M；
  已加根 `.gitignore` 防再次入库。
- 悬空引用 2 处已修：`assets/LoginView.vue` → `assets/core/pages/LoginView.vue`；
  `assets/api.ts`（已删除的反面教材）改叙述避免误报。
- 死引用 1 处已修：SKILL.md 仍把已下线的 `ListNavbar/ListSearchBar/ListToolbar/ListFooter`
  列为「基类组件」。
- 新增标注：`references/demo/` **未装依赖、未编译**（源码级参考）；`assets/optional/` 的
  `IconPicker.vue` 在 scaffold 无副本 → 未经 `vue-tsc`，已标「取用前须验证」。
- **后续：用户确认删除 `CodeEditor.vue`**（`assets/optional/` 一份）。
  关键判据：主链路 `fieldRender.controlOf` **不产出** `code-editor`、`FormDialog` **无该分支**
  → 它从未真正接线，属「规划中资产」。相关文档（SKILL.md 资产表、`assets/README.md`、
  `field-renderers.md` §7/§9、`scaffold/README.md`）已同步为「已删除 / 未实现，按多行文本渲染」。

## 后续清理（2026-09-13）

- **删除 `assets/archive/`**（`api/menuTree.ts`、`api/permissions.ts`）：主链路零引用的历史残留，
  其职责已分别由 `MenuSidebar`+`BasicLayout` 的内联归一化、`DashboardView` 的内联权限位判定取代。
- 白名单随之收敛：`scan-assets-dead.mjs` 移除 `assets/archive/` 前缀豁免。
  `permissions.ts`（basename）与 `references/demo/backend/`（前缀）两项**保留**——
  `references/demo/` 是源码级演示工程（未删），其 `src/api/permissions.ts` 零 import 属正常。
