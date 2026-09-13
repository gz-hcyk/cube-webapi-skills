# 资产体检脚本

五个零依赖脚本（Node ≥ 18，无 npm 依赖）：

```bash
# ── 技能自身维护（改 assets/ 或 references/scaffold/ 之后跑）──
node references/scripts/scan-assets-dead.mjs      # 零引用源码文件（含入口白名单判断提示）
node references/scripts/scan-assets-refs.mjs      # ① 文档悬空引用 ② assets ↔ scaffold 副本一致性
node references/scripts/tri-diff.mjs <工程目录>     # 三根 md5 对照，判「谁该向谁对齐」（方向判定）

# ── 目标工程验收（「三条主线」的机器出口）──
node references/scripts/check-starter-align.mjs   # 第①步出口：工程是否仍是 tdesign-starter CLI 产物形态
node references/scripts/check-assets-copied.mjs   # 第②步出口：assets/ 是否确实并入工程 src/ 且未漂移

# 换技能目录：SKILL_DIR=/path/to/skill node ... ；两个 check-* 均支持 --out <file> 落盘
```

## `scan-assets-refs.mjs` 判据（2026-09-13 修订）

两件事：① 文档里写到的资产路径**是否真实存在**（悬空引用）；② `assets/core/**` 与
`references/scaffold/src/**` 同名文件**是否内容一致**（副本漂移）。

```bash
node scan-assets-refs.mjs [--json] [--out r.txt]
```

退出码：0 = 都干净；1 = 有悬空引用或副本漂移；2 = 用法错误。

| 判据 | 阈值 | 说明 |
|---|---|---|
| ① 悬空引用 | 必须 **0** | 例外：`references/scripts/README.md` 被整体跳过——它刻意记录「已修复/已删除」的历史路径 |
| ② `core → scaffold` 漂移 | 必须 **0** | `core` 有而 `scaffold` 缺同样计入（唯一真相源是 scaffold，缺件即错） |
| ② `scaffold → core` 独有 | 允许 **5** | 工程外壳 4 件 + DEV 验证页 `LovDemoView.vue`，**恒不在 `core` 内**；≠5 会提示用 `tri-diff.mjs` 复查 |
| ③ 比对口径 | **文本等价** | CRLF/CR → LF 后再 md5；二进制扩展名仍按字节 |

> ⚠️ **已修的假阳性（2026-09-13）**：② 原先按**原始字节**比对，把
> `assets/core/api/useEntityResource.ts`（LF）与 `references/scaffold/src/api/useEntityResource.ts`（CRLF）
> 误报成漂移。实测二者 **455 行逐行全等**、CRLF 归一后 md5 完全相同。
> 同坑此前已在 `check-assets-copied.mjs` 修过一次——**两个脚本的比对口径必须一致**。
>
> 另：旧的「`assets/optional/` ↔ scaffold 同名比对」分支已随 optional 层取消而删除（2026-09-13）。

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

## `check-assets-copied.mjs` 用法（「三条主线」第②步的机检入口）

第①步（CLI 骨架）有条铁律 C1 和 `check-starter-align.mjs`；第②步（拷 `assets/` 进工程 `src/`）此前**是全流程唯一无机检的环节**，于是真实工程里真的漂移过：被引用着的早期组件还在，而文档同时白纸黑字写着「已下线，勿找」。本脚本补上这一环。

```bash
node check-assets-copied.mjs <工程目录>            # 检查任意工程
node check-assets-copied.mjs <工程目录> --json     # JSON 输出（CI 用）
node check-assets-copied.mjs <工程目录> --strict   # WARN 也判失败（严格模式）
node check-assets-copied.mjs <工程目录> --out r.txt # 报告落盘（Windows 终端可能吞 stdout，CI 里可当 artifact）
node check-assets-copied.mjs --manifest            # 打印映射表与黑名单
```

**退出码**：0 = 无 FAIL（`--strict` 下无 WARN）；1 = 有 FAIL（或严格模式有 WARN）；2 = 用法错误。

**唯一映射规则**：`assets/core/<X>` → `<工程>/src/<X>`（剥掉 `core/` 前缀）。整目录拷贝即 `cp -r assets/core/. <工程>/src/`。

**三层判据**：

| 级别 | 含义 | 典型项 |
|---|---|---|
| **FAIL** | 资产缺失，**必修**——`core` 之间是**静态 import** 关系（`specialControllers.ts` → `ConfigView.vue`/`DbView.vue`，`FormDialog.vue` → `LovListField.vue`），缺一个即构建失败 | `api/http.ts` `api/token.ts` `api/menuTitles.ts` `utils/camel.ts` `stores/auth.ts` `LovListField.vue` `DashboardView.vue` |
| **WARN** | ① **内容漂移**：同名文件存在但 MD5 不一致（工程是前代产物，或本地改过未回灌）；② **残留已下线资产**：命中黑名单。命中即「拷了旧版资产」，比缺失更危险（静默错版） | 漂移看体积对比「工程 B vs 技能 B」；残留见下 |
| **INFO** | 不扣分 | 工程外壳 4 件（`main.ts`/`App.vue`/`router/index.ts`/`vite-env.d.ts`）——它们由 CLI 生成，不归本脚本判。（原「`assets/optional/` 已拷几个」的 INFO 项随 optional 层取消而**失效**，2026-09-13） |

**已下线黑名单（10 条，命中即 WARN）**：`components/cube/` 下 `ListNavbar` `ListSearchBar` `ListToolbar` `ListFooter` `DetailContent.vue` `CodeEditor.vue`；`api/api.ts`（第二套 axios，违 H1）；`api/permissions.ts`；`api/menuTree.ts`；`tdesign-icons.d.ts`（遮蔽包内真实类型的声明）。每条带 `why`，输出里直接说明「能力已并入谁」。

**当前结果（2026-09-13 复测）**：

| 目标 | PASS | FAIL | WARN | 说明 |
|---|---|---|---|---|
| `references/scaffold` | 31 | **0** | 0 | 与 `assets/core` 逐文件一致（`assets/` 就是 `scaffold/src` 的镜像） |
| `(真实工程) cube-webapi-frontend` | 31 | **0** | **0** | **已归零**：先按 `tri-diff.mjs` 判明 10 条 `ENG-DRIFT`，再按 **§11.1「以技能版覆盖工程」**整目录备份后覆盖（备份留 `backup-eng-*/`），`npm run build` 复验 `EXIT=0`（`vue-tsc --noEmit` 无类型错误） |

> **修复前**的工程侧快照（留作对照）：21 PASS / **7 WARN**，7 条全为**内容漂移**且**方向一致——工程侧是前代产物**
> （缺 `menuTitles` 面包屑取名、缺 `SettingPanel` 挂载说明、缺 `$patch` 类型安全改写、品牌色仍是 TDesign 默认 `#0052D9`）
> ⇒ 按 **§11.1 以技能版为准覆盖**处理，**不是**从工程回灌。

> 判方向的方法：`references/scripts/tri-diff.mjs` 做 `scaffold / assets/core / 工程 src` 三方 md5（CRLF 归一）对照，
> 输出 `ALL-SAME` / `ENG-ONLY`（工程独有，如业务新增页）/ `ENG-DRIFT`（core==scaffold，工程分叉或缺件）/
> `CORE-DRIFT`（scaffold==工程，core 是异类）/ `SCAFFOLD-DRIFT`（scaffold 独有）/ `ALL-DIFF`（工程外壳，不归本脚本判）。
> **`ENG-DRIFT` 与 `CORE-DRIFT` 的修复方向相反**，勿一律 `cp`。用法与 flag 全表见本文档下方专节。

> `references/scaffold` 恒为 PASS 是设计使然（唯一真相源 = `references/scaffold/src/`，`assets/` 是它的镜像拷贝源），真正有价值的是对**目标工程**跑。

## `tri-diff.mjs` 用法（判「谁该向谁对齐」）

`check-assets-copied.mjs` 只回答「工程与 `assets/core` 是否一致」，**不回答方向**。本脚本补方向判定：

```bash
node tri-diff.mjs <工程目录>               # 对照 <skill>/references/scaffold/src 与 <skill>/assets/core
node tri-diff.mjs <工程目录> --json        # JSON 输出
node tri-diff.mjs <工程目录> --out r.txt   # 落盘（Windows 终端可能吞 stdout）
node tri-diff.mjs <工程目录> --core <dir> --scaffold <dir>   # 覆盖默认对照根
```

| flag | 含义 | 修复方向 |
|---|---|---|
| `ALL-SAME` | 三根一致 | 无需动作 |
| `ENG-ONLY` | 技能两侧都没有，**仅工程有** | **工程独有**（业务新增页 `pages/admin/*Page.vue`、本地专有适配），无需动作 |
| `ENG-DRIFT` | `scaffold == core`，**工程分叉或缺件** | **以技能版覆盖工程**（§11.1）；**不是**从工程回灌 |
| `CORE-DRIFT` | `scaffold == 工程`，`core` 是异类 | **以 scaffold/工程覆盖 `core`** |
| `SCAFFOLD-DRIFT` | `scaffold` 独有（`core`/工程均缺） | 属预期：DEV 验证页 `pages/LovDemoView.vue` |
| `ALL-DIFF` | 三者互不相同 | 工程外壳 4 件（`App.vue`/`main.ts`/`router/index.ts`/`vite-env.d.ts`），不归本脚本判 |

> ★ **存在性优先于 md5**：缺失文件的 md5 是占位串 `----------`。若不先判存在性，
> 「技能两侧都缺、仅工程有」的业务页会被 `ha === hb`（两个占位串相等）误判成 `ENG-DRIFT`，
> 照提示「以技能版覆盖工程」就会**删掉业务页**。脚本已按「存在性 → md5」次序判定并单列 `ENG-ONLY`。

**退出码**：0 = 无 `ENG-DRIFT` / `CORE-DRIFT`；1 = 存在需修分叉；2 = 用法错误。

⇒ 健康态 = `ENG-DRIFT=0  CORE-DRIFT=0`，只剩 1 条 `SCAFFOLD-DRIFT` + 4 条 `ALL-DIFF`（+ N 条 `ENG-ONLY`）。
md5 比对前统一 CRLF→LF（技能仓库 `core.autocrlf=true`，纯换行差异不算漂移）。

## 读结果的三个坑（重要）

1. **「零引用」≠「无用」**。入口文件天然零引用：`main.ts` / `App.vue` / `router/index.ts` /
   `vite.config.ts` / `*.d.ts` / `backend/server.mjs` / 验收脚本自身。删它们等于删工程。
   真正该处理的是「**非入口**且零引用、且文档无承诺」的文件。
2. **正则必须允许扩展名**：路径常写成 `'@/layouts/BasicLayout.vue'`，若模式写成
   `from ['"][^'"]*BasicLayout['"]`（不许 `.vue`）会**全部漏匹配**，把活文件误报成死文件。
   本脚本已按 `stem(\.(vue|ts|mjs|js))?` 处理。
3. **资产拷贝模板的"零引用"是常态**：`assets/core/` 内的**配方件**（`RoleMenuEditor.vue` /
   `PriceYuanInput.vue` / `ThemeShowcase.vue`）不被业务 `src/` 引用属正常（`ThemeShowcase` 仅 DEV 路由用）。
   判定要看**文档是否承诺该能力**，不能只看 import 数。
   > 2026-09-13 起可选项层已取消，`assets/` 仅剩 `core/` 一层（31 件全拷）。

## 本次体检结论（2026-09-10）

- 删运行产物 23 个（17 张 CDP 截图 + 3 log + 3 result.json，约 900KB），体积 2.3M → 1.4M；
  已加根 `.gitignore` 防再次入库。
- 悬空引用 2 处已修：`assets/LoginView.vue` → `assets/core/pages/LoginView.vue`；
  `assets/api.ts`（已删除的反面教材）改叙述避免误报。
- 死引用 1 处已修：SKILL.md 仍把已下线的 `ListNavbar/ListSearchBar/ListToolbar/ListFooter`
  列为「基类组件」。
- 新增标注：`references/demo/` **未装依赖、未编译**（源码级参考）。
- **`IconPicker.vue` 已从 `assets/optional/` 提升为 `assets/core/`（2026-09）**，**其后 `optional/` 整层被取消**（2026-09-13，3 件配方件一并入 `core`）——
  `core/components/cube/FormDialog.vue` 有**静态** `import IconPicker from './IconPicker.vue'`
  （`control === 'icon'` 分支），只拷 core 而漏它即 `vue-tsc` 报 `Cannot find module`。
  `scan-assets-dead.mjs` 的白名单随之删除该条（它不再是「零引用可选件」）。
> ⚠️ 旧文曾记「`IconPicker.vue` 在 scaffold 无副本 → 未经 `vue-tsc`，取用前须验证」——**已过时**：
> scaffold 现自带该文件并随 28 件 core 资产一并校验。
- **后续：用户确认删除 `CodeEditor.vue`**（当时位于已取消的可选项层，该层 2026-09-13 并入 `core/`）。
  关键判据：主链路 `fieldRender.controlOf` **不产出** `code-editor`、`FormDialog` **无该分支**
  → 它从未真正接线，属「规划中资产」。相关文档（SKILL.md 资产表、`assets/README.md`、
  `field-renderers.md` §7/§9、`scaffold/README.md`）已同步为「已删除 / 未实现，按多行文本渲染」。

## 后续清理（2026-09-13）

- **删除 `assets/archive/`**（`api/menuTree.ts`、`api/permissions.ts`）：主链路零引用的历史残留，
  其职责已分别由 `MenuSidebar`+`BasicLayout` 的内联归一化、`DashboardView` 的内联权限位判定取代。
- 白名单随之收敛：`scan-assets-dead.mjs` 移除 `assets/archive/` 前缀豁免。
  `permissions.ts`（basename）与 `references/demo/backend/`（前缀）两项**保留**——
  `references/demo/` 是源码级演示工程（未删），其 `src/api/permissions.ts` 零 import 属正常。
