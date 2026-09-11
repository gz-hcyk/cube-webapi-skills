# archive/ —— 已归档资产（勿拷贝）

这里放的是**历史版本残留**：文件本身能编译（曾随 `vue-tsc` 全量验证），
但在 `references/scaffold/`（唯一真相源）的**主链路中零引用**，
且其职责已被主链路的其他实现**内联取代**——两套并存会互相打架。

> 归档 ≠ 删除：保留以便追溯设计演进，或在确需时按下方"复活"说明接回。
> 但**新工程默认不要拷贝本目录**（`assets/core/` + `assets/optional/` 才是模板集）。

## 判定依据（依赖分析，2026-09-10）

对 `references/scaffold/src` 全量统计「被 import 次数」（按无扩展名 basename 匹配，
排除自身），结果：

| 文件 | 被引用次数 | 结论 |
|---|---|---|
| `api/menuTree.ts` | **0** | 孤立文件，已被 MenuSidebar + BasicLayout 取代 |
| `api/permissions.ts` | **0** | 孤立文件，已被 DashboardView 内联取代 |
| `api/useLov.ts` | 0 | 孤立**但**是 §4.20 权威通道 → 归入 `optional/`（按需启用），不归档 |
| `components/cube/RoleMenuEditor.vue` | 0 | 孤立**但**是 §4.12.1 开箱配方 → 归入 `optional/` |
| `components/cube/PriceYuanInput.vue` | 0 | 孤立**但**是字段控件增强件 → 归入 `optional/` |
| `components/cube/ThemeShowcase.vue` | 0 | 孤立**但**是 §4.14 令牌可视化页 → 归入 `optional/` |

归档与"可选"的分界：**是否为技能正文明确承诺的能力**。
`menuTree.ts` / `permissions.ts` 都没有任何正文承诺，且存在功能重复的实现，故归档。

## 1. `api/menuTree.ts` —— 菜单树归一化工具（已被内联取代）

**它原本做什么**：`GET /Admin/Index/GetMenuTree` → `loadMenuTree()`，
把后端 `~/Ctrl` / `/Area/Ctrl` 双格式 url 归一成前端路由 `/entity/{area}/{ctrl}`，
并带 `CUSTOM_PATHS`（前端专属页）、`EXCLUDED`（非实体控制器）两张表 + Element 图标名 → TDesign 图标映射。

**为什么归档**（职责重叠）：
- 取数 + 字段兼容（`displayName`/`url`/`children` 大小写兜底）+ `registerMenuTitles` 登记，
  已由 `components/cube/MenuSidebar.vue` 的 `onMounted` **内联**完成；
- url → 路由的归一化，已由 `layouts/BasicLayout.vue` 的 `onNavigate()` **内联**完成
  （剥 `~` / 前导斜杠 / `api` 前缀 → `/entity/{area}/{controller}`）；
- 两套归一化规则并存时，谁生效取决于调用点，极易出现"菜单点了没反应/跳错页"的排查黑洞。

**若要复活（比如需要 `EXCLUDED` 那类"隐藏非实体菜单"的过滤）**：不要两个都留着——
把 `MenuSidebar` 的取数结果先过一遍 `menuTree.loadMenuTree()`，让
`MenuSidebar` 只负责渲染、归一化只此一处；并同步删除 `BasicLayout.onNavigate()` 里的重复剥离逻辑。

## 2. `api/permissions.ts` —— 权限位常量与判定（已被内联取代）

**它原本做什么**：导出 `PermissionFlags`（1=查看 / 2=新增 / 4=修改 / 8=删除 / 16/32=自定义）、
`hasFlag(bits, flag)`、`PermissionLabels`、`menuKey(area, controller)`。

**为什么归档**（职责重叠）：
- scaffold 里没有任何文件 import 它；
- `pages/DashboardView.vue` 的 `kindOf(node)` 已直接用
  `Object.keys(node.permissions).map(Number)` + 「含 2/4/8 ⇒ 实体控制器，否则动作控制器」
  的规则**内联**完成同类判定（§4.21 的实体/动作判别法）。

**若要复活（比如要给按钮做权限显隐）**：建议**先抽公共实现再统一调用**——
让 `DashboardView.kindOf()` 改为调用 `hasFlag()`，否则等于同一规则写两遍
（正是本次归档要消除的问题）。注意位语义必须以 `XCode.Membership.PermissionFlags` 为准。
