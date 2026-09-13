# LovListField 组件（TDesign 版）行为说明

LIST 型值集（列表型值集 `lovCode = List.{Area}.{Ctrl}`）的**表格选择弹窗**：搜索 + 表格 + 单选/多选 + 分页 + 「已选 N 项」+ 取消/确定 + `refLovCode` 列字典翻译。被 `FormDialog` 的 `lov-list` 分支内嵌，也可独立使用。

> 遵循技能 `vue-component-visual-loop` §七 的 README 模板：**Part A 为开发前必填**，Part B 为开发中/后沉淀。
> 移植自 NewLife.Cube 官方 Element Plus 实现 `LovSelectTable.vue`（461 行，含 BUG C2/C3 修复结论），按 TDesign Vue Next 惯例重写。
> 资产：`assets/core/components/cube/LovListField.vue`（真相源 `references/scaffold/src/components/cube/LovListField.vue`）；配套 `assets/core/api/useLov.ts`（二者被 core 的 `FormDialog.vue` 静态 import，故归 core）。

---

## Part A：开发前必填

### 1. 功能需求（Functional Requirements）

- **FR1（弹窗表格渲染）**：作为使用者，我希望打开弹窗看到值集表格（按 `tableColumns` 渲染），以便浏览与选择。验收：弹窗出现表格行与列头。
- **FR2（选择列 · 单选/多选）**：作为使用者，我希望多选用复选框、单选用 radio 一眼区分，以便明确交互模式。验收：多选出现复选框列、单选出现 radio 列（互斥渲染）。
- **FR3（搜索栏）**：作为使用者，我希望按 `searchFields` 搜索（input/select/lov/datepicker），以便过滤。验收：搜索栏按 `componentType` 渲染对应控件，提交后列表被过滤（字符串走 `Q` 关键词）。
- **FR4（分页）**：作为使用者，我希望大数据分页浏览，以便翻页。验收：`listConfig.pageable` 为真时表格底部出现分页器，翻页重新取数。
- **FR5（已选统计，跨页不裁剪）**：作为使用者，我希望底部「已选 N 项」跨页累计、**不被当前页裁剪**，以便知道到底选了多少。验收：翻页后统计数不变；翻回原页原勾选项仍回显勾选态。
- **FR6（确定/取消）**：作为使用者，我希望取消关闭、多选「确定」批量提交，以便结束选择。验收：取消关闭弹窗且不改值；多选「确定」`emit('confirm', {values,rows,display})` 并关闭。
- **FR7（回显）**：作为使用者，我希望通过 `modelValue` 传入已选值时，弹窗打开即恢复勾选/高亮（含跨页），以便编辑态还原。验收：传入 `modelValue` 后对应行勾选（多）/高亮（单）。
- **FR8（`refLovCode` 列翻译）**：作为使用者，我希望 `refLovCode` 列显示中文标签而非原始 0/1/2，以便可读。验收：该列经 `inlineEnums` 字典命中显示中文。
- **FR9（取数双通道）**：作为开发者，我希望按 `listConfig` 自动选择「前端直连」或「服务端代理」，以便适配不同后端。验收：`requestUrl` 以 `/` 开头 → 直连 `getApi`；否则按 `proxyRequest` 决定是否走 `POST /api/Admin/Lov/ListData`。
- **FR10（表单集成）**：作为开发者，我希望 `FormDialog` 能把 `lov-list` 字段渲染成「只读展示输入 + 弹窗」，选中后回填，以便零业务代码接入。验收：表单出现只读输入，点击打开弹窗，单选回填单值、多选回填逗号串。
- **FR11（可测试/可替换取数）**：作为开发者，我希望可注入 `fetcher` 接管取数，以便单测/无后端演示。验收：传 `fetcher` 后不再走 `listConfig`。
- **FR12（id→名称展示，显示与提交分离）**：作为使用者，我希望表单只读框显示的是**名称**（而非原始 id / 逗号串），但提交给后端的仍是 **id**，以便既可读又不破坏数据。验收：① 新增选行后只读框显示名称；② 编辑态打开即回显名称（含多选顿号连接）；③ 保存后后端存的是 id。组件侧：`select`/`confirm` 负载带 `display`（按 `meta.labelField` 解析）与 `rows`；宿主侧：`model[key]` 存 id、`lovDisplay[key]` 存名称。

### 2. 设计（Design）

- **UI 薄壳 + 元数据驱动**：模板消费传入的 `lovMeta` 渲染搜索栏/表格/分页，**自身不 fetch 元数据**（调用方须先 `useLov().load()` 拿到 `LovListMeta` 再传入 —— 独立使用时注意此契约）。
- **选择列用 TDesign 内置 `row-select`**：多选 `type:'multiple'`（复选框，`reserveSelectedRowOnPaginate` 跨页保留）、单选 `type:'single'`（radio）；受控 `:selected-row-keys` + `@select-change`。
- **唯一真相源**：`selectedKeys` 是唯一权威集合，只由两条路径写入——① 打开时按 `modelValue` 回填；② 用户点选后 `@select-change` / `select(row)`。**任何路径都不用"当前页子集"裁剪它**。
- **分页**：用 `t-table` 内置 `:pagination` + `@page-change`，`pagination` 是**稳定 reactive 对象**（每次 render 新建字面量会导致翻页回弹）。
- **footer**：左「已选 N 项」，右 取消 / 确定（仅多选显示「确定」）。

### 3. 流程（Flow）

- **多选**：打开 → 取数 → 勾选（可跨页）→ 「已选 N 项」→（可选搜索/翻页）→ 确定 emit `{values,rows,display}` 并关闭；取消直接关闭。
- **单选**：打开 → 取数 → 点行（或 radio）→ 立即 `emit('select', {row, display})` 并关闭。
- **回显（弹窗内）**：`modelValue` →（多）按 `selectedKeys` 派生勾选态 /（单）高亮首项 → 翻页 `reserveSelectedRowOnPaginate` 保留。
- **展示名解析（FR12）**：`loadRows` 每次把行写入 `rowPool`（key→row）；`labelOne(key)` 从 `rowPool` 取 `labelField`；`buildDisplay(keys)` 顿号连接 → 随 emit 下发。跨页已选项因 `rowPool` 命中而能译名。
- **状态机**：`closed → (dialogVisible=true) loading → data-ready → selecting → { multi: confirmed | single: auto-select } → closed`。
- **关键数据流**：`lovMeta`+`modelValue`(props) → `selectedKeys`(权威) →（多）`@select-change` /（单）`row-click` → `confirm`/`select` emit（带 display/rows）；搜索/翻页 → `loadRows()` → `rowPool` 写入 + 表格刷新。

### 4. 功能验证列表（Verification Checklist）

> 源于 §1，是「开发完成」验收清单。自动化载体：CDP 脚本 `references/scripts/lov/`（随技能分发）——`lov_cdp.mjs`（组件，27 项）+ `lov_form_cdp.mjs`（表单集成，15 项）+ `lov_display_cdp.mjs`（id→名称回显，11 项）；运行方式与两个必知陷阱见该目录 `README.md`。

| # | 验证项（源于 FR） | 操作步骤 | 期望结果 | 状态 |
|---|---|---|---|---|
| V1 | 弹窗表格渲染（FR1） | 打开 lov-demo → 单选「选择角色」 | 弹窗出现表格行/列头 | ✅ |
| V2 | 单选 radio / 多选复选（FR2） | 分别打开单选/多选弹窗 | 单选 radio 列、多选复选框列（互斥） | ✅ |
| V3 | 搜索过滤（FR3） | 多选弹窗输入「审计」→ 搜索 | 命中 1 行；重置恢复 20 行 | ✅ |
| V4 | 分页（FR4） | 查看多选弹窗（24 行） | 出现第 2 页，第 2 页渲染 4 行 | ✅ |
| V5 | 跨页已选不被裁剪（FR5） | 第1页勾 2 → 翻第2页勾 2 → 翻回第1页 | 「已选 4 项」始终不变；第1页原勾选回显 2 个勾选态 | ✅ |
| V6 | 单选回填并关闭（FR6/FR7） | 单选弹窗点第 3 行 | 弹窗关闭、宿主值 = 3 | ✅ |
| V7 | 多选确定回填（FR6） | 多选弹窗勾 4 行 → 确定 | 弹窗关闭、宿主值 = 4 个 id | ✅ |
| V8 | `refLovCode` 列翻译（FR8） | 查看「来源」列 | 显示「内置/自定义」而非 1/2 | ✅ |
| V9 | 表单集成回填（FR10） | `/entity/Admin/User` → 新增 → 点 lov-list 字段 → 选行/勾选 → 确定 | 只读输入显示**名称**（`审计员` / `管理员、普通用户`），id 进 model | ✅ |
| V10 | 编辑态 id→名称回显（FR12） | 编辑 zhangsan（roleLovID=3, roleIds='1,2'） | 只读框打开即显示「审计员」/「管理员、普通用户」，非原始 id | ✅ |
| V11 | 显示与提交分离（FR12） | 编辑态换选 → 保存 → 直读后端 | 后端存的是 **id=5**（非名称串）；未改动多选仍为 `1,2` | ✅ |

### 5. 数据契约（Data Contract）

- **不 fetch 元数据**：调用方先 `useLov().load(fields)` 取 `lovListConfig[lovCode]`，再传 `lovMeta`。
- **props**：`dialogVisible`（受控）· `lovCode` · `lovMeta?` · `inlineEnums?` · `multiple?` · `modelValue?` · `fetcher?`（逃生舱）。
- **emits**：`update:dialogVisible` · `select(payload)`（单选）· `confirm(payload)`（多选）。两处 **payload 都是对象、形状一致**：`{ value: string|string[], display: string, rows: Record<string,any>[] }`——`value` 单选为单值、多选为 `string[]`；`display` 是按 `meta.labelField`（缺省 `name`）拼出的名称串（`', '` 连接）；`rows` 是已选行对象。宿主约定 **`value` 进模型、`display` 进只读框**（显示与提交分离，FR12）。
- **列表数据**：`dialogVisible=true` 时 `watch` 触发 `loadRows()`；按下表分流。

  | 条件 | 通道 |
  |---|---|
  | 传了 `fetcher` | 完全接管（不走 `listConfig`） |
  | `requestUrl` 以 `/` 开头 | 前端**直连** `getApi(requestUrl, params)` |
  | 否则 `proxyRequest=true` | **服务端代理** `POST /api/Admin/Lov/ListData` |
  | 否则 | 直连 `requestUrl` |

- **搜索参数**：字符串（input/textarea）并入 **`Q` 关键词**，数值/枚举/日期走**字段参数**（与 `fieldRender.buildSearchParams` 同源）。
- **字典翻译（FR8）**：`refLovCode` 列查 `inlineEnums[refLovCode]`；`inlineEnums` 来自 `useLov().lovOptions`（ENUM 型值集）。
- **行 key**：`modelValue` 与行统一 `String(...)` 比对（`valueField` 默认 `id`）。

### 6. 边界与异常（Edge cases）

- 空数据 → 表格显示「暂无数据」；取数失败 → 显示错误文本 + `MessagePlugin.error`，静默降级不崩页。
- `lovMeta` 为 `null`（元数据未到时）→ 渲染空表，不报错。
- 分页边界：仅一页 / 末页不满 / 超长 total。
- 超长文本：单元格 `ellipsis`。
- 连续快速翻页/搜索：以最后一次请求为准（`loadRows` 覆盖写）。
- 回显项跨多页并重开弹窗：`modelValue` 含未加载页的行，重开须恢复全部勾选且不丢跨页选择。
- 单选重复触发：`picked` 守卫保证一次打开只认第一次选中（行点击与 radio 变更双路）。
- 同页多实例同 LovCode：两个弹窗标题相同，**DOM 判定须叠加尺寸过滤**（见 §11）。

### 7. 待确认项（Open Questions）

- [ ] 显示名回显：当前只读输入展示**原始值**（id / 逗号串），未做 id→名称的标签缓存（需再查一次值集）。如需展示名称，可加 `labelCache` + 批量翻译。
- [ ] 超大列表虚拟滚动：当前未做，超大数据需评估。

---

## Part B：开发中 / 后沉淀

### 8. 功能清单 与 功能 ↔ 验证 对应

| # | 功能 | 说明 | 验证 |
|---|---|---|---|
| F1 | 弹窗表格渲染 | 按 `tableColumns` 渲染 | V1 |
| F2 | 选择列 | 多选复选框（跨页保留）/ 单选 radio | V2 |
| F3 | 搜索栏 | `searchFields`：input/select/lov/datepicker；字符串走 `Q` | V3 |
| F4 | 分页 | `listConfig.pageable` → `t-table` 内建分页 | V4 |
| F5 | 已选统计 | 「已选 N 项」，跨页不裁剪 | V5 |
| F6 | 确定/取消 | 取消关闭；多选确定 `confirm({values,rows,display})` | V6/V7 |
| F7 | 回显 | 按 `modelValue` 恢复勾选/高亮 | V5/V6 |
| F8 | `refLovCode` 翻译 | 查 `inlineEnums` 显示中文 | V8 |
| F9 | 取数双通道 | 直连 / 服务端代理 / `fetcher` | V1/V5 |
| F10 | 表单集成 | `FormDialog` 只读展示 + 弹窗回填 | V9 |
| F11 | **id→名称展示** | payload 带 `display`/`rows`；`rowPool` 缓存跨页行；只读框显示名称、模型存 id | V10/V11 |

### 9. 与官方 Element Plus 版差异（★ 刻意，勿"照抄"回去）

1. **无需 `restoringSelection` 守卫**：EP 版的坑是 `restoreSelection` 用 `toggleRowSelection()` 重放时，`el-table` 的 `@selection-change` **只回传本次重放的当前页行**，把权威集合（含跨页/未加载项）裁掉。TDesign 选择列是**受控**的，勾选视图完全由 `:selected-row-keys` 派生，`@select-change` 只在真实用户操作时触发 → 该 bug 类结构上不存在，**不要照抄守卫**（会变成空转死代码）。
2. **单选用内置 `type:'single'`**，不手写 radio 列。
3. **分页用 `t-table` 内建 `:pagination`**，不另起 `t-pagination`；`pagination` 必须稳定 reactive。
4. **行点击是单 context 对象** `{ row, index, e }`，**不是** `(e, ctx)` 双参（写错则点行永远选不中）。
5. **字符串搜索走 `Q` 关键词**（EP 版把搜索项一律当字段参数）。
6. **选中即自关闭**：单选 `pickRow`、多选 `onConfirm` 均在 emit 后 `close()`；EP 版只 emit、关闭交父组件。如需恢复该契约，删掉对应 `close()`。

### 10. 运行验证（CDP headless Chrome）

```bash
# 前置：Mock 后端 + Vite dev（scaffold 目录）
npm run mock                                   # 或 node backend/server.mjs → :3001
VITE_API_TARGET=http://127.0.0.1:3001 npx vite --port 5183

# 两套 CDP 验收（scripts 见技能外部工作区 lov_verify/）：
node lov_cdp.mjs        # 组件本体 27 项：A1-A3 / B1-B8 / C1-C14 / D1-D2
node lov_form_cdp.mjs   # 表单集成 15 项：A1-A3 / B1-B3 / C1-C4 / D1-D5
```

**结果**：`lov_cdp` **27/27**、`lov_form_cdp` **15/15**（`vue-tsc --noEmit` + `vite build` 0 错误）。

### 11. 问题可能原因分析（本组件踩过 / 易误判）

- **★（已闭环）历史缺陷：`InlineEnums` 的"键"曾被全局 camelize 破坏 → `refLovCode` 列翻译恒失效**（V8）。旧版 `http` 层 camelize 只把首字母小写：字典键 `Enum.Admin.RoleKind` → `enum.Admin.RoleKind`，而字段 `RefLovCode` 的**值**保持不变 → 查不到。**2026-09 全局 camelize 已移除，根因消除**；`useLov` 另按请求 code 复原键作兜底（**不在本组件**）。症状若仍出现：该列显示原始 `1/2`。
- **★ TDesign dialog 隐藏后仍在 DOM 且无 `t-dialog--hidden` 类**（V6/V7 的 CDP 判定）。可见与隐藏弹窗 className 相同，唯一差别是 `getBoundingClientRect()`（隐藏 = `0×0`）。**"点确定后弹窗关闭"必须用尺寸判定**；同页若有**标题相同的多个弹窗**（两个 lov-list 字段同 LovCode），靠 header 无法区分，必须叠加尺寸过滤——否则误判"未关闭"。
- **行点击签名**（F2）：TDesign `row-click` 回调是**单对象** `{row,index,e}`；写成 `(e, ctx)` 会 `ctx===undefined`，点行永不选中。
- **分页引用不稳**（F4）：`pagination` 每次 render 新建字面量 → 表格内部重算当前页 → 翻页回弹；必须 `reactive` 一次。
- **死代码**（F10）：`FormDialog` **只 import 不挂 `v-else-if` 分支** → `vue-tsc` 不报错但永不渲染。
- **搜索栏**（F3）：LIST 型是动态数据、无静态候选 → `buildSearchItems` 把 `lov-list` **降级为文本输入**（否则出现选不出东西的空下拉）。

### 12. 变更记录（Changelog）

| 日期 | 变更 | 关联 |
|---|---|---|
| 2026-09-10 | 首版：Element Plus `LovSelectTable.vue`(461 行) → TDesign 重写；6 条刻意差异；CDP 27/27 | FR1–FR9 / V1–V8 |
| 2026-09-10 | `FormDialog` 挂 `lov-list` 分支 + `fieldRender.isListLov/controlOf` + 搜索降级；CDP 15/15 | FR10/FR11 / V9 |
