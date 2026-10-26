# cube-webapi-backend 依赖技能清单 + 核验矩阵

| 项 | 内容 |
|---|---|
| 审计对象 | `cube-webapi-backend`（本仓库 `cube-webapi-backend/`，经 junction 挂到 `~/.workbuddy/skills/cube-webapi-backend`） |
| 审计时间 | 2026-10-26（GMT+8） |
| 审计方式 | **只读核验**。未修改、未新建、未删除任何技能文件；未 `git pull`；未建 junction |
| 数据源 | ① 本地文件系统（`~/.workbuddy/skills/`、本仓库工作区）② 本仓库 git 对象库（`HEAD` / `origin/main`）③ GitHub API（`NewLifeX/NewLife.Skills`，默认分支 `master`） |
| 判定手段 | 文件尺寸 + **git blob SHA-1 字节级比对**（`git hash-object` 与 GitHub API 的 `sha` 同为 blob 哈希，可直接对撞） |

---

## 一、结论速览

**相关技能共 5 份**，按角色分三类：

- **上游依赖 3 份**（本技能要先读、缺失即停）：`project-architecture`、`xcode-data-modeling`、`cube-mvc-backend`
- **同仓下游交接 2 份**（本技能交付后交给对方）：`cube-webapi-tdesign`、`cube-webapi-element`
- **幽灵引用 1 处**：`xcode-handwritten-entity` —— 全链路（本地仓库、本地技能目录、上游 NewLife.Skills）均不存在，且上游历史提交中也从未出现过

**字节级核验判定**：完全一致 **1** / 本地落后 **2** / 本地分叉 **1** / 本地缺失 **1**。

**缺陷 3 条**：

| 编号 | 缺陷 | 位置 | 严重度 |
|---|---|---|---|
| D1 | 幽灵引用 `xcode-handwritten-entity 必做件 0`，指向的技能不存在 | `cube-webapi-backend/SKILL.md:967` | 高（误导性最强，且 `[BindTable]` 规则在**全部已装技能中零覆盖**） |
| D2 | 「本仓库只有两份技能」陈述已过期（实为三份） | `cube-webapi-backend/SKILL.md:32,34`（标题+正文） | 中 |
| D3 | 依赖表与元流程 ⑦ 均未登记 `cube-webapi-element`，学习路径不可达 | `cube-webapi-backend/SKILL.md:38,117` | 中 |

**仓库状态**：本地 `main`（`627db0f`，2026-10-15）落后 `origin/main`（`3ac938e`，2026-10-24）**20 个提交**、领先 0，工作区干净 ⇒ **纯快进可用**。20 条中触及 backend 4 条 / tdesign 8 条 / element 7 条 / docs·README·gitignore 5 条（存在重叠计数）。

> 重要：D1、D2 在 `origin/main` 上**依然存在**（行号相同），不是「落后导致的旧问题」，拉取更新不会自动修掉。

---

## 二、依赖清单

### 2.1 上游依赖（本技能消费，缺失即停）

| 技能 | 用途 | 权威来源 | 仓库内路径 | 本地安装 | 本技能何处引用 |
|---|---|---|---|---|---|
| `project-architecture` | 分层架构选型（两层起步、按需渐进三层） | `NewLifeX/NewLife.Skills` @ `master` | `.github/skills/project-architecture/` | ✅ `~/.workbuddy/skills/project-architecture` | 元流程 ①（L111）、技能衔接（L125）、依赖表（L40） |
| `xcode-data-modeling` | Model.xml 数据建模（表 / 字段 / 索引 / 外键 Map / ShowIn） | 同上 | `.github/skills/xcode-data-modeling/` | ✅ `~/.workbuddy/skills/xcode-data-modeling` | 元流程 ②（L112）、副作用说明（L126）、技能衔接（L125）、依赖表（L41） |
| `cube-mvc-backend` | 魔方 MVC 版后台（字段定制 ListField 扩展属性速查） | 同上 | `.github/skills/cube-mvc-backend/` | ✅ `~/.workbuddy/skills/cube-mvc-backend` | 文件头字段定制说明（L11）、依赖表（L39） |

### 2.2 同仓下游交接（本技能交付后交给对方）

| 技能 | 用途 | 权威来源 | 本地安装 | 本技能何处引用 | 对方何处依赖本技能 |
|---|---|---|---|---|---|
| `cube-webapi-tdesign` | TDesign Vue Next 前端生成（GetFields/GetPage 元数据驱动） | **本仓库** | ✅ junction → `cube-webapi-skills/cube-webapi-tdesign` | 元流程 ⑦（L117）、第九节 / 第十四节归边说明（L1324/L1363/L1395）、依赖表（L38） | `SKILL.md:31,33,39` 声明「后端契约权威在 `cube-webapi-backend`」 |
| `cube-webapi-element` | Vue 3 + Vite + Element Plus 前端生成（tdesign 的同职责第二变体） | **本仓库**（`origin/main`，由 `bc48f33` 引入） | ❌ **未安装**（仓库工作区无此目录，`~/.workbuddy/skills` 也无 junction） | **零引用**（见 D3） | `SKILL.md:26`（资源导航「后端契约权威」）、`§八 与 cube-webapi-backend 的分工` |

> 依赖方向说明：`cube-webapi-element` 与 `cube-webapi-tdesign` 都是**本技能的下游**（消费后端契约），不是本技能的上游依赖。之所以列入本文，是因为 backend 的依赖表与元流程 ⑦ 承担着「下游发现入口」职责，漏登记即等于该路径对读者不可达。

### 2.3 幽灵引用（不存在，须消解）

| 被引用名 | 本地仓库 | `~/.workbuddy/skills` | `NewLife.Skills` 现清单 | 历史 |
|---|---|---|---|---|
| `xcode-handwritten-entity` | ❌ 无 | ❌ 无 | ❌ 无（现列 10 份，不含它） | ❌ GitHub commits API 对该路径返回 `[]`，从未存在 |

另：其声称的锚点「必做件 0」在**全部已装技能**中同样零命中（`grep -rn "必做件 0\|必做件0" ~/.workbuddy/skills --include=*.md` 无输出）。

---

## 三、核验矩阵（字节级）

### 3.1 同仓技能：工作区 vs `origin/main`

| 技能 | 工作区 blob | `origin/main` blob | 尺寸（工作区 → 远端） | 判定 |
|---|---|---|---|---|
| `cube-webapi-backend/SKILL.md` | `e5ab5e8f…` | `09914da7…` | 124,215 → 131,052 B | **落后**（落后 20 提交，其中触及本技能 4 条） |
| `cube-webapi-tdesign/SKILL.md` | `67f01784…` | `f54dd4f4…` | 173,241 → 179,345 B | **落后**（触及 8 条） |
| `cube-webapi-element/SKILL.md` | （无） | `a1dbbb0c…` | — → 26,704 B | **缺失**（触及 7 条） |

### 3.2 上游技能：本地安装 vs `NewLifeX/NewLife.Skills@master`

| 技能 | 本地 blob | 上游 blob | 尺寸（本地 → 上游） | 本地 mtime | 判定 |
|---|---|---|---|---|---|
| `xcode-data-modeling` | `867366bc` | `867366bc` | 12,233 → 12,233 B | 2026-09-03 | ✅ **字节完全一致** |
| `project-architecture` | `1ddf70e8` | `1f55f54a` | 23,484 → **25,396 B** | 2026-09-03 | ⚠️ **本地落后**（上游最后提交 `0769690`，2026-09-25，含「简单优先（约 90% 覆盖）」等新增） |
| `cube-mvc-backend` | `ea324052` | `f00aa964` | 11,272 → **10,172 B** | 2026-09-17 | ⚠️ **本地分叉（本地更新）**：本地多出「关联列替换」段（`[Map(nameof(DeviceID)…)]`），上游最后提交 `8bf93b5`，2026-07-15 |

### 3.3 上游仓库现状

- `NewLifeX/NewLife.Skills` 默认分支 `master`，最后推送 2026-10-20。
- `.github/skills/` 现含 10 份：`benchmark-testing`、`cross-compatibility-testing`、`cube-mvc-backend`、`development-process`、`doc-writer`、`e2e-testing`、`project-architecture`、`testing-strategy`、`xcode-data-modeling`、`xml-comment-enrichment`。
- 本技能依赖表所引的 3 份**全部在列** ⇒ 上游侧无缺件，问题只在本地版本与技能内文案。

---

## 四、缺陷清单

### D1 幽灵引用 `xcode-handwritten-entity`（高）

**位置**：`cube-webapi-backend/SKILL.md:967`

**原文**：

```
- 另：手写实体**必须**带 `[BindTable]`，否则 `TableItem.Create` 直接抛 `ArgumentOutOfRangeException (Parameter 'type')`、
  表永远建不出来 —— 详见 skill `xcode-handwritten-entity` 必做件 0。
```

**证据**：见 §2.3。该技能在本地、本仓库、上游三处均不存在，上游历史亦无此路径 ⇒ 读者按图索骥必然扑空。

**影响**：句子的**前半段是正确的且关键**（`[BindTable]` 必写），后半段的失效引用会让人误以为「已经有权威文档兜底」，从而不再深究；而 `[BindTable]` 这条规则在其余所有已装技能中**零覆盖**（`grep -rln "BindTable" ~/.workbuddy/skills` 无命中），等于该知识点当前只有这一处孤证。

**修复建议**：见 §5.1。

---

### D2 「本仓库只有两份技能」已过期（中）

**位置**：`cube-webapi-backend/SKILL.md:32`（节标题）、`:34`（正文）

**原文**：

```
## 依赖的新生命团队技能（本仓库并不包含其中三份）
本仓库只有 `cube-webapi-backend` 与 `cube-webapi-tdesign`。下面三份**不在本仓库**，也不要把它们拷进本仓库冒充已内置：
```

**证据**：`origin/main` 的 `README.md`「包含的技能」已列 **3** 份（新增 `cube-webapi-element/`），并在「本地加载方式」给出 3 条 junction 映射；本地工作区因落后 20 提交仍显示 2 份。

**影响**：节标题的「其中三份」与正文字面互相打架；且「本仓库只有两份」会让读者（或加载技能后的 agent）根本不去找第三种前端变体。

**修复建议**：见 §5.2。

---

### D3 `cube-webapi-element` 未登记，学习路径不可达（中）

**位置**：`cube-webapi-backend/SKILL.md:38`（依赖表）、`:117`（元流程 ⑦）

**现状**：`git grep -n "cube-webapi-element" origin/main -- cube-webapi-backend cube-webapi-tdesign` **零命中** —— 即使在最新的 `origin/main` 上，两份前端技能与 backend 之间也**没有任何交叉引用**；`README.md` 是唯一提到它的地方。

**影响**：元流程 ⑦ 只写「使用 `cube-webapi-tdesign` 技能（TDesign Vue Next…）」，agent 按流程走会固定选 TDesign，即便用户项目本就用 Element Plus；两条并行路线互相不可见。

**修复建议**：见 §5.3。

---

### 附：本地环境缺口（非技能文案缺陷）

| 项 | 现状 | 说明 |
|---|---|---|
| `~/.workbuddy/skills/cube-webapi-element` junction | ❌ 不存在 | `origin/main` README 已声明该映射，但本机未建；且仓库工作区尚无该目录（落后），即便现在建 junction 也会指向空 |
| `~/.workbuddy/skills/cube-mvc-backend`、`project-architecture`、`xcode-data-modeling` | ✅ 均为普通目录（非 junction） | 来自 NewLife.Skills 的手工拷贝，**不受本仓库 git 管理** ⇒ 版本漂移不会被本仓库察觉（本轮即发现 1 落后 1 分叉） |

---

## 五、修复建议（2026-10-26 已执行；执行记录见 §八）

> 以下按优先级排列。所有改动都落在 `cube-webapi-backend/SKILL.md`，属文案修正，不动任何其他技能文件。

### 5.1 消解 D1（建议 P0，二选一）

- **方案 A（推荐，最小且自洽）**：改为内联规则 + 指向真实存在的近邻技能。
  `newlife-build-and-xcode-entity`（本地已装，52 KB）已覆盖 `BindIndex` / `Entity<T>` 基类 / `Item` 名冲突 / String 列必须声明 `Length` 四条硬规则，只是未含 `[BindTable]` 这一条，故把 `[BindTable]` 就地讲完、其余外链：

  > 表永远建不出来 —— 相关硬规则（`BindIndex`、`Entity<T>` 基类、`Item` 名冲突、String 列必须声明 `Length`）见本地技能 `newlife-build-and-xcode-entity`。

- **方案 B（最小改动）**：直接删除「—— 详见 skill `xcode-handwritten-entity` 必做件 0」半句，保留前半段结论。
- **方案 C（成本最高，不建议）**：在上游 `NewLife.Skills` 新建 `xcode-handwritten-entity` 技能。与已有 `xcode-data-modeling` 职责重叠，且会把「手写实体」这一本属反模式的内容固化成独立技能。

### 5.2 修正 D2（建议 P0）

- L32 节标题去掉括号补充或同步改数：「## 依赖的新生命团队技能」
- L34 改为：

  > 本仓库现有 `cube-webapi-backend`、`cube-webapi-tdesign`、`cube-webapi-element` 三份。下面三份**不在本仓库**，也不要把它们拷进本仓库冒充已内置：

- L36~41 表格「是否在本仓库」列在新增 element 行后需保证与正文一致（tdesign 行为「在」，新增行亦为「在」，另两列可加「（同仓另一前端变体）」备注）。

### 5.3 登记 D3（建议 P1）

- 依赖表新增一行（置于 tdesign 行之后）：

  > | `cube-webapi-element` | 前端 Element Plus 消费端（同 tdesign 职责的第二种变体，二者择一） | 元流程 ⑦（替代路径） | 在 |

- L117 元流程 ⑦ 改为在末尾追加括号说明：

  > ⑦ 创建前端项目 → 使用 `cube-webapi-tdesign` 技能（TDesign Vue Next，GetFields/GetPage 元数据驱动）；若目标项目栈为 Element Plus，改用同仓 `cube-webapi-element`

### 5.4 本地同步动作（建议 P1，需按序）

1. 先建 junction 再拉取是无效的（目录尚不存在）；正确顺序：本仓库 `git pull --ff-only`（20 提交纯快进）→ 再按 `origin/main` README 建 `cube-webapi-element` junction。
2. `project-architecture` 落后：从 `NewLifeX/NewLife.Skills@master` 取 `SKILL.md`（25,396 B）覆盖本地。
3. `cube-mvc-backend` 本地分叉：**不要**直接取上游覆盖（会丢本地新增的「关联列替换」段）；应先比对后把本地增补回灌上游，或在技能内标注本地偏差。
4. 拉取后须复查 D1/D2 是否仍存在 —— 本轮已确认它们在 `origin/main` 上同样存在，**拉取不会自动修掉**，仍需按 §5.1/§5.2 手改。

---

## 六、复核命令（可原样复现）

```bash
# 1) 仓库与本地上游技能的位置
cd /c/Users/admin/cube-webapi-skills
git status --short --branch && git rev-list --left-right --count origin/main...main

# 2) 同仓技能：工作区 vs origin/main（blob 比对）
git hash-object cube-webapi-backend/SKILL.md cube-webapi-tdesign/SKILL.md
git rev-parse origin/main:cube-webapi-backend/SKILL.md origin/main:cube-webapi-tdesign/SKILL.md origin/main:cube-webapi-element/SKILL.md

# 3) 上游技能：本地 vs GitHub（blob 比对）
cd /c/Users/admin/.workbuddy/skills
git hash-object cube-mvc-backend/SKILL.md project-architecture/SKILL.md xcode-data-modeling/SKILL.md
curl -s "https://api.github.com/repos/NewLifeX/NewLife.Skills/contents/.github/skills/project-architecture/SKILL.md" | grep '"sha"'

# 4) 幽灵引用与「必做件 0」零命中
grep -rn "xcode-handwritten-entity" /c/Users/admin/cube-webapi-skills/ /c/Users/admin/.workbuddy/skills/
grep -rn "必做件 0\|必做件0" /c/Users/admin/.workbuddy/skills/ --include=*.md

# 5) 上游技能全清单
curl -s "https://api.github.com/repos/NewLifeX/NewLife.Skills/contents/.github/skills" | grep '"name"'
```

---

## 七、审计边界（本轮明确未做）

- 未修改任何技能文件（`SKILL.md` / `references/` / `assets/` 均未触碰）。
- 未 `git pull`、未 `git add/commit/push`、未新建或删除 junction。
- 未对上游 `project-architecture` / `cube-mvc-backend` 做内容级 diff 分析（仅做尺寸 + blob 判定与最后提交时间核对）；如需逐段差异，应另开一轮「本地 vs 上游逐段比对」。
- 未评估 `cube-webapi-element` 作为新增上下游一体化方案的完备性（本轮只判定其**存在与登记状态**）。

---

## 八、执行记录（2026-10-26）

> 用户确认后按 §5 执行。SKILL.md 修复提交：`128a4e2`（已推送；`api.github.com` 与 `git ls-remote` 双重确认远端尖端一致）。本文档（含本节）为随后的提交。

### 8.1 本地同步（§5.4.1 前半）

`git fetch` 因本环境代理对 github.com 的 CONNECT 隧道一度 502 失败，改用本地对象库完成**等价 `pull --ff-only`**（未联网）：

- 先经 `api.github.com`（当时可达）核对远端 `main` 真实 HEAD = `3ac938e`，与本地 `origin/main` 快照一致 ⇒ 快照未过期、对象库完整；
- `git merge --ff-only origin/main`：`627db0f → 3ac938e`，20 提交快进，工作区保持干净。

### 8.2 SKILL.md 修复（§5.1–5.3）

共 7 行改动（+7 / −6），逐一 Grep 复核落盘。其中 §5 清单内 5 行、**同文件一致性连带 2 行**（理由：不修则与已改的依赖表 / 元流程 ⑦ 自相矛盾）：

| 序 | 位置 | 缺陷 | 处理 |
|---|---|---|---|
| 1 | 节标题 | D2 | 去掉「（本仓库并不包含其中三份）」过期括号补充 |
| 2 | 正文首句 | D2 | 「只有两份」→「现有 backend / tdesign / element 三份」 |
| 3 | 依赖表 | D3 | 新增 `cube-webapi-element` 行（引用处 = 元流程 ⑦ 替代路径） |
| 4 | 元流程 ⑦ | D3 | 追加「若目标项目栈为 Element Plus，改用本仓库的 cube-webapi-element」 |
| 5 | 资源导航行（L26） | D3 连带 | 「前端如何消费」指向两前端技能「按前端栈择一」（原仅 tdesign） |
| 6 | 技能衔接要点（L126） | D3 连带 | ⑦ 依赖改为 tdesign **或** element（前端栈二者择一） |
| 7 | 手写实体段 | D1 | 删 `xcode-handwritten-entity 必做件 0`；内联四条硬规则 + 外链 `newlife-build-and-xcode-entity` |

**未改**：第十四节「归边说明」（原引用 tdesign references 专属锚点 G1/G2/G6/G7，改动会破坏引用有效性；element 侧消费契约在其自身 references 内自成体系）。

### 8.3 本机 junction（§5.4.1 后半）

- 新建 `~/.workbuddy/skills/cube-webapi-element` **Junction** → `C:\Users\admin\cube-webapi-skills\cube-webapi-element`（pull 完成后才建，避免指向空目录）；
- 验证：经 junction 可读全量文件（SKILL.md / assets / references / scripts）；`git hash-object` 两侧一致（`a1dbbb0c`）；
- 现状：`cube-webapi-backend` / `tdesign` / `element` 三条 junction 全部就位。

### 8.4 复核结论

- `xcode-handwritten-entity` 与「必做件 0」：**全仓技能文件零残留**（仅本文档作为历史记录保留其名）；
- `cube-webapi-element` 在 backend / SKILL.md 共 5 个登记点（L26 / L34 / L39 / L118 / L126）；
- 提交推送链路：`GIT_TERMINAL_PROMPT=0 git push` 本次**成功**（历史 502 现象未复现）。

### 8.5 遗留项（本轮明确未动）

- `project-architecture` 落后上游、`cube-mvc-backend` 本地分叉：属上游手工拷贝技能的内容级漂移，按 §5.4.2 / §5.4.3 另行处理（涉及覆盖 / 回灌决策，需单独确认）；
- `cube-webapi-element` 的完备性评估（其与 backend 契约的一致性深审）不在本轮范围。

### 8.6 第二轮：依赖装用铁律（同日）

用户要求「依赖的安装与同步更新升格为技能铁律，本地缺依赖则提示用户安装」，并明确 tdesign 的依赖 `cube-webapi-backend` **来源是本仓库**（上游 `NewLifeX/NewLife.Skills` 并无 `cube-webapi-*` 系列，见 §3.3）。提交 `4d963af`（三份 SKILL.md，+105 / −13）：

| 文件 | 改动要点 |
|---|---|
| `cube-webapi-backend/SKILL.md` | 新增「铁律：依赖先装后用、用前同步」：装机核验（缺即提示用户安装）＋同步核验（落后先同步；分叉不覆盖）；元流程补 ⓪ 依赖体检；「技能衔接」要点同步更新 |
| `cube-webapi-tdesign/SKILL.md` | **依赖来源纠正**：原依赖段把 `cube-webapi-backend` 指向 `NewLifeX/NewLife.Skills`（错误来源，该指引作废），改为本仓库同仓来源＋同款铁律；二·前置条件挂体检入口 |
| `cube-webapi-element/SKILL.md` | 新增「依赖的新生命团队技能」段（同仓来源）＋同款铁律；二·前置条件补依赖体检项 |

自此依赖标准为「**先装后用、用前同步**」（装机核验＋同步核验两道），见三份 SKILL.md 的同名铁律；本节核验矩阵与 §六 复核命令为其执行底稿。

**连带修复**：`cube-webapi-tdesign` 原第 311 行**孤立围栏**（无语言标记的单独一行，2026-09-13 起即存在）——经围栏配对状态机核验，其后 70+ 行正文（删除前为 312–387 行，含表格/清单）会被渲染为代码块；删除后该文件围栏 24 条全部配对（backend 80 条 / element 30 条同法复检正常，无同类缺陷）。

**复核**：三份改动后围栏配平；`NewLifeX/NewLife.Skills` 在 tdesign / element 中的残留仅存于「不要到上游找它」的澄清语境（backend 中为上游三分技能的正规来源指引）；提交标题经 od 复核无 BOM。
