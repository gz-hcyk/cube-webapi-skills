# 资产体检脚本

五个零依赖脚本（Node ≥ 18，无 npm 依赖）：

```bash
# ── 技能自身维护（改 assets/ 或 references/scaffold/ 之后跑）──
node references/scripts/scan-assets-dead.mjs      # 零引用源码文件（含入口白名单判断提示）
node references/scripts/scan-assets-refs.mjs      # ① 文档悬空引用 ② assets ↔ scaffold 副本一致性
node references/scripts/tri-diff.mjs <工程目录>     # 四方 md5 对照，判「谁该向谁对齐」（方向判定）

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
| ② `scaffold → core` 独有 | 允许 **24** | 工程外壳 3 件 + DEV 验证页 `LovDemoView.vue` + `-temp all` 保留的上游基础设施 20 件，**恒不在 `core` 内**（清单见 `tri-diff.mjs` 的 `SCAFFOLD_ONLY_EXPECTED`）；≠24 会提示用 `tri-diff.mjs` 复查 |
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
node check-starter-align.mjs --manifest            # 打印**两套**基线清单（all / lite：产物 / 必须保留 / 工具链 / 可删 / 必须删 / 必须补）
```

**退出码 0 = 无 FAIL，1 = 有 FAIL** —— 可直接进 CI / 收尾自检。

**★ 双基线（2026-09-13 起）**：`all`（`-temp all`，193 件，**当前唯一受支持**）与 `lite`（13 件，**历史形态**，仅用于校验存量工程）。
脚本按 **`tsconfig.node.json` 是否存在自动判定血统**（存在 ⇒ `lite`；缺失 ⇒ `all`），再按对应基线校验；`--json` 输出的 `lineage` 字段含判据。

**三层判据**（不是一票否决，分级才有用）：

| 级别 | 含义 | 典型项 |
|---|---|---|
| **FAIL** | 工程骨架 / 构建契约被破坏，**必修** | 缺骨架（`all` 7 件：`index.html` `package.json` `tsconfig.json` `vite.config.ts` `public/favicon.ico` `src/main.ts` `src/types/env.d.ts`；`lite` 8 件：另含 `tsconfig.node.json` `src/vite-env.d.ts`）、`build` 无 `vue-tsc`、存在 `scripts.prepare`、缺必需依赖、缺 `@` 别名、血统自相矛盾（`all` 却写了 `references`） |
| **WARN** | 「工程选择」级偏离：**允许，但须在工程 README 显式声明** | `tsconfig` / `tsconfig.node.json` 的编译策略（`target`/`moduleResolution`/`strict`/`lib`/额外键/`include`）；`all` 工具链件缺失（`eslint.config.js`/`.husky/`/`.env*` 等）；`all` 上游演示业务代码残留；`all` 出现 `src/vite-env.d.ts`；对象式 `manualChunks` |
| **INFO** | CLI 演示件 / 上游文档件去留，**不扣分** | `all`：`README*.md` `LICENSE` `docs/` `.github/` `src/permission.ts` `mock/`；`lite`：`.npmignore` `tdesign-logo.svg` `vite-logo.svg` `App.vue` |

**基线**：
- `all` = `td-starter init <名> -type vue3 -temp all`（**用 `printf '\n' |` 非交互**，回车即选中默认项「全部」）；
- `lite` = `td-starter init <名> -type vue3 -bt vite -temp lite`（**已废除**，不再用于新建；`-bt` 只对 lite 生效）。

两条踩过的硬坑已写进脚本：① `scripts.prepare` 调 `is-ci`/`husky`（**不在 dependencies**），实测 `npm run prepare` → exit=1（lite 下 `npm install` **必然失败**，all 下恰好不阻断但仍属必删项），故「有 `prepare`」判 FAIL；② `rollupOptions.output.manualChunks` 写**对象**在 `vite@8`（rolldown）下已废弃（TS2322 + 运行时静默忽略），须改用 `rolldownOptions.output.codeSplitting.groups`。
> ⚠️ **旧断言已证伪**：早期文档称「`-temp all` 是交互式箭头多选，非 TTY 下必崩（`ERR_USE_AFTER_CLOSE`），不可脚本化」——2026-09-13 实测 `printf '\n' | npx --yes tdesign-starter-cli@0.5.3 init <名> -type vue3 -temp all` → **exit=0，193 件**。

**当前结果（2026-09-13，双基线版脚本）**：

| 目标 | 血统 | FAIL | WARN | 说明 |
|---|---|---|---|---|
| `references/scaffold` | `all` | **0** | 0 | 完整对齐；tsconfig 与 `all` 基线逐字一致；R4/R5 修复后 `vue-tsc` 0 错误 |
| `references/demo` | `lite` | **0** | 1 | WARN = tsconfig 编译策略偏离，已在 `demo/README.md` §「已声明偏差」声明 |
| `(真实工程) cube-webapi-frontend` | `lite` | **0** | 2 | 已补 `public/favicon.ico` / `index.html` favicon / `build` 加 `vue-tsc` / 补 `vue-tsc` devDep |

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
| **INFO** | 不扣分 | 工程外壳（`main.ts`/`App.vue`/`router/index.ts` + **`all` 用 `types/env.d.ts`、`lite` 用 `vite-env.d.ts`**）——它们由 CLI 生成，不归本脚本判（血统由 `check-starter-align.mjs` 的 `detectLineage()` 判定后取对应清单）。（原「`assets/optional/` 已拷几个」的 INFO 项随 optional 层取消而**失效**，2026-09-13） |

**已下线黑名单（10 条，命中即 WARN）**：`components/cube/` 下 `ListNavbar` `ListSearchBar` `ListToolbar` `ListFooter` `DetailContent.vue` `CodeEditor.vue`；`api/api.ts`（第二套 axios，违 H1）；`api/permissions.ts`；`api/menuTree.ts`；`tdesign-icons.d.ts`（遮蔽包内真实类型的声明）。每条带 `why`，输出里直接说明「能力已并入谁」。

**当前结果（2026-09-13 复测）**：

| 目标 | PASS | FAIL | WARN | 说明 |
|---|---|---|---|---|
| `references/scaffold` | 31 | **0** | 0 | 与 `assets/core` 逐文件一致（`assets/` 就是 `scaffold/src` 的镜像） |
| `(真实工程) cube-webapi-frontend` | 31 | **0** | **0** | **已归零**：先按 `tri-diff.mjs` 判明 10 条 `ENG-DRIFT`，再按 **§11.1「以技能版覆盖工程」**整目录备份后覆盖（备份留 `backup-eng-*/`），`npm run build` 复验 `EXIT=0`（`vue-tsc --noEmit` 无类型错误） |

> **修复前**的工程侧快照（留作对照）：21 PASS / **7 WARN**，7 条全为**内容漂移**且**方向一致——工程侧是前代产物**
> （缺 `menuTitles` 面包屑取名、缺 `SettingPanel` 挂载说明、缺 `$patch` 类型安全改写、品牌色仍是 TDesign 默认 `#0052D9`）
> ⇒ 按 **§11.1 以技能版为准覆盖**处理，**不是**从工程回灌。

> 判方向的方法：`references/scripts/tri-diff.mjs` 做 `scaffold / assets/core / demo / 工程 src` **四方** md5（CRLF 归一）对照，
> 输出 `ALL-SAME` / `ENG-ONLY`（工程独有，如业务新增页）/ `ENG-DRIFT`（core==scaffold，工程分叉或缺件）/
> `CORE-DRIFT`（scaffold==工程，core 是异类）/ `SCAFFOLD-DRIFT`（scaffold 独有）/ `ALL-DIFF`（工程外壳，不归本脚本判）/
> `DEMO-STALE`（demo **真陈旧副本**，须同步）/ `DEMO-DIVERGENT`（demo **精简变体**，已知层次差异，非漂移）/ `DEMO-ONLY`（仅 demo 有，注册/找回密码两页）。
> **`ENG-DRIFT` 与 `CORE-DRIFT` 的修复方向相反**，勿一律 `cp`。用法与 flag 全表见本文档下方专节。

> `references/scaffold` 恒为 PASS 是设计使然（唯一真相源 = `references/scaffold/src/`，`assets/` 是它的镜像拷贝源），真正有价值的是对**目标工程**跑。

## `tri-diff.mjs` 用法（判「谁该向谁对齐」）

`check-assets-copied.mjs` 只回答「工程与 `assets/core` 是否一致」，**不回答方向**。本脚本补方向判定。

### 四根（2026-09-13 由三根扩为四根；文件名保留「tri-」以免文档大面积改动）

| # | 根 | 角色 |
|---|---|---|
| ① | `references/scaffold/src/` | **主真相源**（生产级编排层，§11.1） |
| ② | `assets/core/` | ① 的**镜像拷贝源**（供 `cp -r` 并入业务工程） |
| ③ | `references/demo/src/` | **精简示例层**——技能侧样例（**同层，非下游**）。独占资产仅注册 `RegisterView.vue` / 找回密码 `ForgotPasswordView.vue` 两页 |
| ④ | `<工程>/src/` | **下游产物**（并入后的业务工程） |

> ★ ③ 与 ④ 角色不同：③ 是**技能侧样例**（同层），④ 是**下游**。
> 故 ③ 陈旧 = `DEMO-STALE`（须同步）；④ 陈旧 = `ENG-DRIFT`（以技能版覆盖工程）。
> ★ ③ **可缺席**：demo 是精简子集而非 scaffold 的完整拷贝，③ 缺某文件**不等于漂移**
> （当前 **14 件** core 资产 demo 未收录，由脚本单独打印该计数）；只有「③ 有且与 ①② 不同」才进下述二分。
>
> ★ **③ 的「不同」分两种（2026-09-13 双侧构建实证校准）**：
>   · `DEMO-DIVERGENT` = **精简变体**（白名单 **12 件**，层次差异）→ **非漂移，无需同步**，默认**不**计入失败退出码；
>   · `DEMO-STALE`    = **真陈旧副本**（白名单外）→ **须同步 demo**，`--strict` 起计入失败退出码（当前实测 **0 条**）。
> 判据见下节《③ 为何是「层次差异」而非「陈旧」》。

```bash
node tri-diff.mjs <工程目录>               # 四方对照（demo 存在则自动纳入）
node tri-diff.mjs <工程目录> --json        # JSON 输出
node tri-diff.mjs <工程目录> --out r.txt   # 落盘（Windows 终端可能吞 stdout）
node tri-diff.mjs <工程目录> --core <dir> --scaffold <dir> --demo <dir>   # 覆盖默认对照根
node tri-diff.mjs <工程目录> --no-demo     # 关闭第四根，退化为旧三根行为
node tri-diff.mjs <工程目录> --strict      # 令 DEMO-STALE 也计入失败退出码
node tri-diff.mjs <工程目录> --strict-demo # 连 DEMO-DIVERGENT（已知层次差异）也计入（隐含 --strict）
```

| flag | 含义 | 修复方向 |
|---|---|---|
| `ALL-SAME` | ①②④ 三根一致（③ 同或缺） | 无需动作 |
| `ENG-ONLY` | 技能侧都没有，**仅工程有** | **工程独有**（业务新增页 `pages/admin/*Page.vue`、本地专有适配），无需动作 |
| `ENG-DRIFT` | `scaffold == core`，**工程分叉或缺件** | **以技能版覆盖工程**（§11.1）；**不是**从工程回灌 |
| `CORE-DRIFT` | `scaffold == 工程`，`core` 是异类 | **以 scaffold/工程覆盖 `core`** |
| `SCAFFOLD-DRIFT` | `scaffold` 独有（`core`/工程均缺），或命中 `SCAFFOLD_ONLY_EXPECTED` 而 `core` 缺 | 属预期：**24 件** = 工程外壳 3（`App.vue`/`main.ts`/`router/index.ts`）+ DEV 验证页 `pages/LovDemoView.vue` + `-temp all` 保留的上游基础设施 20 |
| `ALL-DIFF` | ① 有 · ② 缺 · ③④ 各不同 | `lite` 血统旧工程的工程外壳（`App.vue`/`main.ts`/`router/index.ts`/`vite-env.d.ts`），不归本脚本判。`all` 血统下已归入 `SCAFFOLD-DRIFT`，故当前为 **0** |
| `DEMO-STALE` | `scaffold == core == 工程`，**唯 `demo` 不同**且**不在白名单** | **同步 `references/demo/src`**（真陈旧副本） |
| `DEMO-DIVERGENT` | 同上，但**命中白名单**（12 件） | 属预期：demo 精简变体（层次差异），**无需同步** |
| `DEMO-ONLY` | **仅 `demo` 有**（①② 均缺） | 属预期：注册 / 找回密码两页只此一份 |

> ★ **存在性优先于 md5**：缺失文件的 md5 是占位串 `----------`。若不先判存在性，
> 「技能两侧都缺、仅工程有」的业务页会被 `ha === hb`（两个占位串相等）误判成 `ENG-DRIFT`，
> 照提示「以技能版覆盖工程」就会**删掉业务页**。脚本已按「存在性 → md5」次序判定并单列 `ENG-ONLY`。

**退出码**：

| 调用 | 计入失败的条件 | 实测退出码 |
|---|---|---|
| 默认 | `ENG-DRIFT + CORE-DRIFT > 0` | **0** |
| `--strict` | 上式 **+ `DEMO-STALE`** | **0**（STALE=0） |
| `--strict-demo` | 上式 **+ `DEMO-DIVERGENT`**（隐含 `--strict`） | **1** |
| `--no-demo` | 退化为旧三根行为（`ENG-DRIFT + CORE-DRIFT`） | **0** |
| `--no-demo --strict` | 同 `--no-demo` | **0** |
| 无参数 | 用法错误 | **2** |

> ★ **白名单腐化 `DEMO-WL-STALE` / `SCAFFOLD-ONLY-WL-STALE`**：若某白名单条目**已不再分歧**
> （被同步 / 被删除 / 已改名），脚本会提示「应从 `DEMO_DIVERGENT` / `SCAFFOLD_ONLY_EXPECTED` 表中移除」
> ——**两项均永不影响退出码**，只作清理提示。`SCAFFOLD_ONLY_EXPECTED` 腐化尤其危险：留着会把真分叉
> （`CORE-DRIFT`）**静默吞掉**。
> 自测方法：`node tri-diff.mjs <工程> --demo <skill>/references/scaffold/src`（令 ④ 侧 demo 恒等于 ①，
> 12 条白名单全部「不再分歧」→ 应报 12 条 `DEMO-WL-STALE`，exit 仍为 **0**）。

⇒ 健康态（2026-09-13 scaffold 换代 `all` 后）= `ENG-DRIFT=0  CORE-DRIFT=0  DEMO-STALE=0  DEMO-WL-STALE=0  SCAFFOLD-ONLY-WL-STALE=0`，
只剩 **24 条 `SCAFFOLD-DRIFT`** + **0 条 `ALL-DIFF`** + **12 条 `DEMO-DIVERGENT`** + **7 条 `DEMO-ONLY`**（+ N 条 `ENG-ONLY`）。
md5 比对前统一 CRLF→LF（技能仓库 `core.autocrlf=true`，纯换行差异不算漂移）。

### ③ 为何是「层次差异」而非「陈旧」（2026-09-13 双侧构建实证）

原判定为「12 条 `DEMO-STALE` = demo 陈旧副本，须同步」，**已被实证推翻**。取证过程：

**（1）双侧各自可独立构建通过（各装一份依赖，`vue-tsc --noEmit && vite build`）**

| 侧 | `vue-tsc` | `vite build` | 模块数 | CSS | JS | 耗时 |
|---|---|---|---|---|---|---|
| `references/demo`（基线，未迁移） | exit=0 | **exit=0** | 3925 | 464.86 kB | **1,544.92 kB**（gzip 414） | 19.69s |
| `references/demo`（20 动作迁移后） | exit=0 | **exit=0** | 3931 | 473.32 kB | **8,844.10 kB**（gzip 969） | 40.70s |

⇒ demo **不是**「装不起来的死样板」，也不是「同一份东西的新旧版本」——两者各自是**完整可运行**的工程，
只是**层次不同**。这一条直接否掉了「陈旧副本」定性（陈旧副本的典型特征是编译不过或行为不一致）。

**（2）层次量化：demo 同名文件体积仅为 scaffold 的 1/3 ~ 1/8**

| 文件 | demo | scaffold（= core） | 倍率 |
|---|---|---|---|
| `components/cube/MenuSidebar.vue` | 1815 B | 15349 B | **8.5×** |
| `api/useLookups.ts` | 1810 B | 10704 B | **5.9×** |
| `components/cube/FormDialog.vue` | 6273 B | 32176 B | **5.1×** |
| `api/useEntityResource.ts` | 4602 B | 21193 B | **4.6×** |
| `components/cube/ListPage.vue` | 9205 B | 29645 B | **3.2×** |
| `api/fieldRender.ts` | 16057 B（406 行） | 51940 B（1077 行） | **3.2×** |
| `pages/LoginView.vue` | 2625 B（83 行） | 15512 B（342 行） | **5.9×** |
| `utils/camel.ts` | 879 B | 2306 B | 2.6× |
| `api/http.ts` | 9105 B | 14427 B | 1.6× |
| `theme/tokens.ts` | 结构相同，仅十六进制大小写 + demo 多 3 行注释 | — | ~1× |

**（3）认证架构是「上一代形态」（这才是「层」的实质）**

| 能力 | demo（上一代） | scaffold / core（现行） |
|---|---|---|
| auth store 位置 | 内联在 `api/auth.ts`（347 行） | 独立 `stores/auth.ts` |
| 令牌读写 | 混在 `api/auth.ts` | 独立 `api/token.ts` |
| 面包屑取名 | 无 | `api/menuTitles.ts`（`registerMenuTitles` 调用 3 处） |
| demo 是否有 `api/token.ts` | **无** | 有 |

**（4）登录页功能矩阵（推翻 SKILL.md L56 旧断言）**

| | `assets/core` = `scaffold` | `references/demo` |
|---|---|---|
| 行数 | 342 | **83** |
| MFA | ✓（5 处） | ✗ |
| Challenge | ✓ | ✓（**唯一实现的链路**） |
| OAuth | ✓（9 处） | ✗ |
| 图形码 captcha | ✓（28 处） | ✗ |
| 短信/邮件码 `sendCode` | ✓（4 处） | ✗ |
| AuthCategory 门控 | ✓（5 处） | ✗ |
| 注册 / 找回密码页 | **不提供**（仅入口） | ✓ `RegisterView.vue` / `ForgotPasswordView.vue` |

⇒ **scaffold/core 才是「完整版」**，demo 是「精简版」。旧文档写的「完整版见 demo」方向**完全反了**，已修正
（`SKILL.md` L23/L56/§八/§11.1 + `troubleshooting.md` 5 处）。

**（5）结论与裁决**

- 12 件 `DEMO-STALE` 重分类为 `DEMO-DIVERGENT`（**已知代际/层次差异白名单**），默认**不当缺陷报**。
- 用户裁决（2026-09-13）：**保留 demo 层次独立 + 修文档**——**不动 demo 源码**，靠文档与机检口径修正消除噪声。
- ⚠️ 但它们**并非「不可覆盖」**：实证表明 12 件**全量覆盖可行**，只是**不可单独覆盖**——否则断 3 处 import。
  配方见下节（**仅在确需把 demo 升级为与 scaffold 同构的运行实例时**才执行）。

### 配方向：把 demo 升级为「与 scaffold 同构」（20 动作，已实证）

> 前提：这**不是**默认维护动作，也**不是**修 bug。默认策略是「保留层次独立」。
> 仅在明确需要「demo 与 scaffold 行为完全一致」时才执行；代价是 demo 失去「源码级轻量可读」属性。

**动作清单（16 覆盖 + 3 新增 + 1 删除）**

| # | 动作 | 对象 |
|---|---|---|
| 1–12 | **覆盖** | `api/fieldRender.ts`、`api/http.ts`、`api/useEntityResource.ts`、`api/useLookups.ts`、`api/useLov.ts`、`components/cube/DetailDrawer.vue`、`components/cube/FormDialog.vue`、`components/cube/ListPage.vue`、`components/cube/MenuSidebar.vue`、`pages/LoginView.vue`、`theme/tokens.ts`、`utils/camel.ts`（← 均取 `assets/core/` 同名文件） |
| 13–15 | **新增** | `api/token.ts`、`api/menuTitles.ts`、`stores/auth.ts`（← `assets/core/`，demo 原本**没有**这三件） |
| 16 | **删除** | `api/auth.ts`（demo 的上一代内联 auth store，被 13/14/15 取代） |

**★ 4 处 import 改写（漏掉必然编译失败）**

| 文件 | 原 | 改为 |
|---|---|---|
| `pages/ForgotPasswordView.vue` | `'../api/auth'` | `'../stores/auth'` |
| `pages/MainView.vue` | `'../api/auth'` | `'../stores/auth'` |
| `pages/RegisterView.vue` | `'../api/auth'` | `'../stores/auth'` |
| `router/index.ts` | `'../api/auth'` | `'../stores/auth'` |

**三处断裂根因（覆盖后若不改 import / 不补新增件，必断）**

1. `api/http.ts` 新版 `import ... from './token'` → demo 无 `api/token.ts`；
2. `components/cube/MenuSidebar.vue` 新版 `import ... from '@/api/menuTitles'` → demo 无该文件；
3. `pages/LoginView.vue` 新版 `import ... from '@/stores/auth'` → demo 的 auth store 还在 `api/auth.ts`。

**验证**：迁移后 `vue-tsc --noEmit && vite build` **exit=0**（当时的 lite 血统 scaffold：3931 模块 / JS 8,844.10 kB）。
**代价**：JS 1.54 MB → 约 7~9 MB（**≈5×**），demo 不再是「源码级轻量可读」样例。
> ⚠️ 2026-09-13 scaffold 换代 `-temp all` 后，同构迁移的 JS 体积基准变为 **7,206.42 kB**（3953 模块）。

### 首次四方实测（2026-09-13，目标工程 `cube-webapi-frontend`，`tri-diff.mjs` 新口径）

> 该次实测发生在 **scaffold 换代前（`lite` 血统）**，故 `SCAFFOLD-DRIFT=1` / `ALL-DIFF=4`。
> 换代后的当前健康态见其下方小节。

```
共 49 文件（4 根并集）
ALL-SAME=19  ENG-ONLY=7  ENG-DRIFT=0  CORE-DRIFT=0  SCAFFOLD-DRIFT=1  ALL-DIFF=4  DEMO-STALE=0  DEMO-DIVERGENT=12  DEMO-ONLY=6
demo 未收录的 ①② 资产：14 件（③ 是精简子集，缺件≠漂移）
exit=0
```

- **12 条 `DEMO-DIVERGENT`**：`api/{fieldRender,http,useEntityResource,useLookups,useLov}.ts`、`components/cube/{DetailDrawer,FormDialog,ListPage,MenuSidebar}.vue`、`pages/LoginView.vue`、`theme/tokens.ts`、`utils/camel.ts` —— 全部命中白名单，**非漂移**。
- **6 条 `DEMO-ONLY`**：`api/auth.ts`、`api/permissions.ts`、`pages/{ForgotPasswordView,MainView,RegisterView,ThemeShowcase}.vue` —— 属预期；其中 `RegisterView`/`ForgotPasswordView` 是 demo 的**唯一独占价值**。
- **回归**：`--no-demo` 输出与扩展前三根结果**逐项一致**（`ALL-SAME=31  ENG-ONLY=10  SCAFFOLD-DRIFT=1  ALL-DIFF=4`），旧 flag 语义未变。

### 换代后健康态（2026-09-13，scaffold = `-temp all` 血统，目标 = `references/scaffold`）

```
共 62 文件（4 根并集）
ALL-SAME=19  ENG-ONLY=0  ENG-DRIFT=0  CORE-DRIFT=0  SCAFFOLD-DRIFT=24  ALL-DIFF=0  DEMO-STALE=0  DEMO-DIVERGENT=12  DEMO-ONLY=7
demo 未收录的 ①② 资产：34 件（③ 是精简子集，缺件≠漂移）
exit=0
```

- **24 条 `SCAFFOLD-DRIFT`**（全部命中新表 `SCAFFOLD_ONLY_EXPECTED`）：工程外壳 3 + DEV 验证页 1 + 上游基础设施 20。**这是换代带来的主要口径变化**（1 → 24）。
- **`ALL-DIFF` 归零**：`all` 血统的工程外壳缺 `src/vite-env.d.ts`，原先触发 `ALL-DIFF` 的路径改由 `SCAFFOLD_ONLY_EXPECTED` 接管。
- **`DEMO-ONLY` 6 → 7**：demo 的 `vite-env.d.ts`（`lite` 血统专属）计入。
- **回归**：换代后 `check-starter-align.mjs` = 0 FAIL / 0 WARN、`check-assets-copied.mjs` = 缺失 0 · 漂移 0、`scan-assets-refs.mjs` = 悬空 0 · 漂移 0。

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
- 新增标注：`references/demo/` **不随包携带依赖**（源码级参考）。★ 2026-09-13 双侧构建实证已补齐：
  装齐依赖后它**可独立构建通过**（`vue-tsc --noEmit && vite build` exit=0，3925 模块 / JS 1.54 MB），
  故「未编译」应理解为「本仓库不带依赖、CI 默认不编」，而**不是**「编译不过」。详见本文档
  《③ 为何是「层次差异」而非「陈旧」》。
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
  `references/demo/` 是**精简示例工程**（未删，层次独立），其 `src/api/permissions.ts` 零 import 属正常。
