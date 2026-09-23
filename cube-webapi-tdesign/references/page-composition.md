# 页面构成与覆盖机制（page-composition）

> 目标：把魔方 MVC 的**分部视图（partial view）模块化设计**平移到 Vue3 + TDesign：
> **公共块只写一份、页面按需组合、差异靠「覆盖点」而不是靠复制**。
>
> 本文回答两个问题：① 一个页面由哪些块构成？② 要改某个块，改哪里（且不改坏别人）？
> 全量页面清单见 `cube-page-catalog.md`。

---

## 一、总原则

1. **元数据驱动优先**：字段来自 `GetPage` / `GetFields`，控件选型来自 `fieldRender`。
   能由元数据表达的差异，**不写页面**（新增实体零新增页面）。
2. **公共块只有一份**：`ListPage` / `FormDialog` / `DetailDrawer` / `ConfigView` / `AuthShell`
   是**组合根**，禁止 fork 复制后再改（复制即产生第二份真相源，后续修复不会回流）。
3. **差异收敛到三级覆盖点**（L1 配置 → L2 插槽 → L3 整页）：**从最轻的一级开始试**，
   能用配置就不写插槽，能用插槽就不写整页。
4. **单页单职责**：`pages/*View.vue` 只做「参数装配 + 覆盖点填充」，不重复实现列表/表单逻辑。

---

## 二、MVC 分部视图 ↔ 前端模块 对应表

| 魔方 MVC（Razor 分部视图） | 前端模块 | 位置 |
|---|---|---|
| `List.cshtml`（列表页骨架） | `ListPage.vue` | `components/cube/ListPage.vue` |
| `_List_Navbar.cshtml`（标题 / 实体路径） | `ListPage` 内 `.cube-list-navbar` 块 + `#navbar-extra` | 同上 |
| `_List_Search.cshtml`（查询条件） | `ListPage` 内 `.cube-search-bar`（`setting.enableKey` 关键词 + `GetPage.search`）+ `#search-extra` | 同上 |
| `_List_Toolbar.cshtml`（新增 / 批量删除） | `ListPage` 内 `.cube-list-toolbar`（`setting.enableToolbar`）+ `#toolbar-extra` | 同上 |
| `_List_Table.cshtml`（表格 / 列定义） | `ListPage` 的 `t-table` / `t-enhanced-table`（树形自动切换） | 同上 |
| `_List_Footer.cshtml`（统计 / 记录数） | `ListPage` 内 `.cube-list-footer`（`setting.enableFooter`）+ `#footer-extra` | 同上 |
| 行内操作列 | `ListPage` 的 `#operation` 模板 + `#row-actions` | 同上 |
| `_Form_Body.cshtml` / `_Form_Item.cshtml` | `FormDialog.vue`（按 `category` 分 tab）+ `#form-extra` | `components/cube/FormDialog.vue` |
| `_Detail_*.cshtml`（详情） | `DetailDrawer.vue`（`t-descriptions`）+ `#detail-extra` | `components/cube/DetailDrawer.vue` |
| 字段级自定义视图（`DataField.GroupView = "_Form_Members"`） | `fieldRender.selectFormControl` 的控件分支 + 覆盖点 L2/L3 | `api/fieldRender.ts` |
| 认证页（Login / Register / Forgot） | `pages/LoginView.vue` / `RegisterView.vue` / `ForgotPasswordView.vue` + `AuthShell.vue` | `pages/`、`components/cube/` |
| 配置页（`Config<T>` 单对象） | `ConfigView.vue` | `components/cube/ConfigView.vue` |
| `_Layout` / 侧边栏 / 顶栏 | `BasicLayout.vue` + `MenuSidebar.vue`（`#logo` / `#operations`）+ `SettingPanel.vue` | `layouts/`、`components/cube/` |
| 工作台 / 首页 | `DashboardView.vue`、（专用）`ServerInfoView.vue`、`WidgetBoardView.vue` | `pages/`、`components/cube/` |

> **MVC 的覆盖顺序**（`~/Areas/{Area}/Views/{Controller}/` → `Views/Shared/` → 应用级）在
> 前端对应为：**L3 薄页面（`src/pages/{Area}/{Controller}.vue`）** → **专用页注册表
> （`src/specialControllers.ts`）** → **公共组件（`components/cube/`）**。
> 前者覆盖后者，层级语义一致：**越靠近业务的越优先**。

---

## 三、一个实体页面的装配图

```
                    ┌─────────────────────────────────────────┐
                    │ 路由 /entity/:area/:controller          │
                    │   （或薄页面 pages/{Area}/{X}.vue）      │
                    └───────────────────┬─────────────────────┘
                                        │ props: area/controller/title
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ EntityPage.vue —— 分发器                 │
                    │  SPECIAL_CONTROLLERS 命中？              │
                    │   ① config → ConfigView                  │
                    │   ② db/file/server/widget → 专用页        │
                    │   ③ 其它 view → 泛型渲染                  │
                    │ 未命中 → ListPage                        │
                    └───────────────────┬─────────────────────┘
                                        ▼
   ┌───────────────────────── ListPage ─────────────────────────┐
   │  useEntityResource ── GetPage(元数据) / 列表 / CRUD          │
   │  useLookups ── 外键字典（约定式 xxxID→控制器 Index）          │
   │  useLov ── LovController 值集（Enum 内联 / List 表格）        │
   │  fieldRender ── 字段 → 列 / 控件 / rules（单一真相源）        │
   ├────────────────────────────────────────────────────────────┤
   │  [Navbar] [Search] [Toolbar] [Table/TreeTable] [Footer]     │
   │      ▲        ▲         ▲           ▲            ▲          │
   │   #navbar  #search   #toolbar   #row-actions  #footer       │
   │   -extra   -extra    -extra                  -extra         │
   ├────────────────────────────────────────────────────────────┤
   │  FormDialog（#form-extra）   DetailDrawer（#detail-extra）   │
   └────────────────────────────────────────────────────────────┘
```

---

## 四、三级覆盖机制（**从轻到重，逐级尝试**）

### L1 · 配置（最轻，优先）

**改什么**：是否显示某块、字段显隐、控件选型、查询参数名映射、上传端点。

| 入口 | 控制什么 | 例子 |
|---|---|---|
| `GetPage.setting.*`（后端下发） | 页面块开关 | `enableNavbar` / `enableKey` / `enableToolbar` / `enableFooter` / `enableSelect` / `enableTableDoubleClick` |
| `ListPage` props | 装配参数 | `searchParamMap`（虚拟映射字段→真实查询字段，如 `RoleName→roleID`）、`showIdColumn`、`lookups`、`lookupOverrides`、`uploadUrl` |
| `ConfigView` props | 配置页装配 | `fieldsKind`、`loadUrl`、`saveUrl`、`saveMethod`、`defaultCategory`（无 category 字段的归属分组） |
| `FormDialog` / `DetailDrawer` props | 表单/详情装配 | `lookups`、`lovOptions`、`lovListConfig` |
| `fieldRender` | 字段→控件/列/rules | 枚举→下拉、`itemType=mail`→内置 email 校验 |

```vue
<!-- L1 示例：只改装配，不碰公共组件 -->
<ListPage area="Admin" controller="User" :search-param-map="{ roleID: 'roleID', roleIDs: 'roleIds' }" />
```

### L2 · 插槽（中等，做「加点东西」）

**改什么**：在既有块的固定位置**追加**内容，不动公共组件源码。

| 组件 | 插槽 | 授权变量 | 典型用途 |
|---|---|---|---|
| `ListPage` | `#navbar-extra` | — | 标题旁的说明 / 徽标 / 切换视图 |
| `ListPage` | `#search-extra` | `{ model }` | 自定义搜索项（后端 `GetPage.search` 表达不了的） |
| `ListPage` | `#toolbar-extra` | `{ selected, reload }` | 导入 / 导出 / 批量启用 / 立即执行 |
| `ListPage` | `#row-actions` | `{ row }` | 吊销令牌 / 强制下线 / 角色权限 / 查看指令 |
| `ListPage` | `#footer-extra` | — | 统计补充说明 / 合计行 |
| `FormDialog` | `#form-extra` | `{ row }` | 表单内嵌子表 / 关联项编辑（对标 `GroupView` 字段） |
| `DetailDrawer` | `#detail-extra` | — | 详情尾部关联列表（绑定、令牌、在线设备） |
| `MenuSidebar` | `#logo`、`#operations` | — | 侧栏品牌位 / 底部操作区 |
| `AuthShell` | 默认插槽 | `{ config }` | 认证页中段表单 |

```vue
<!-- L2 示例：实体页加一个「立即执行」行操作（薄页面，不改公共组件） -->
<ListPage area="Cube" controller="CronJob">
  <template #row-actions="{ row }">
    <t-link theme="primary" @click="runNow(row)">立即执行</t-link>
  </template>
</ListPage>
```

> **取 `reload` 的稳妥方式**：`ListPage` 已 `defineExpose({ res, columns, isTree, listComponent })`，
> 薄页面持 `ref` 后调 `listRef.value?.res.loadData()`；插槽给的 `reload` 亦可用于直接回填。

### L3 · 整页（最重，做「整块替换」）

**改什么**：页面形态与通用块差异过大时，**另写一个专属页**并登记到分发器。

三条路径，按「是否可被多页面复用」选择：

| 路径 | 何时用 | 做法 |
|---|---|---|
| **A. 薄页面** | 只是某实体要加覆盖点 | `src/pages/{Area}/{Controller}.vue` 组合 `ListPage` + L2 插槽 |
| **B. 专用页注册** | 非实体控制器（无 `GetPage`） | 写 `components/cube/XxxView.vue`，在 `src/specialControllers.ts` 加一条 `{ kind:'custom', view: XxxView }` |
| **C. 大改公共块** | **仅当** 90% 页面都需要该改动 | 改 `components/cube/*.vue` 后：**必须 `vue-tsc` 0 错误 + 同步回技能资产**（否则技能资产与工程分叉） |

> ⚠️ **C 是最后手段**。判断标准：*这个改动是为「一个页面」还是为「所有页面」？*
> 为一个页面 → 走 A/B。为所有页面 → 改公共块，且改完必须回同步技能资产（铁律：唯一真相源）。

---

## 五、新增一个页面的标准动作（决策流）

```
1. 探针：GET /api/{area}/{controller}/GetPage
   ├─ 200 → 【实体页】走泛型路由，零新增文件 ✅ 收工（差异用 L1）
   └─ 404 → 继续
2. 分类：是 ConfigController<T>（有 GetFields + 单对象 Get/Update）吗？
   ├─ 是 → 【配置页】specialControllers 登记 { kind:'config', view: ConfigView }
   └─ 否 → 继续
3. 形态：现有专用页（DbView/FileView/ServerInfoView/WidgetBoardView）覆盖吗？
   ├─ 覆盖 → 登记复用
   └─ 否 → 写新专用页（XxxView.vue）并登记；页面内放 DataProbe 便于确认契约
4. 补齐：该页是否还有「额外动作端点」（Kick / RevokeTokens / ExecuteNow / GetInfo…）？
   └─ 有 → 用 #row-actions 或页内按钮接线（配方见 cube-page-catalog.md §5.1）
5. 验收：vue-tsc --noEmit 0 错误；菜单树该节点可点到且非空白
```

---

## 六、纪律（违反会立刻产生技术债）

1. **禁止 fork 公共组件**做局部改动——新增第二份 `ListPage` 等于放弃后续所有修复。
2. **禁止在前端硬编码菜单**——菜单唯一权威是后端 `GetMenuTree`。
3. **禁止用「隐藏表 / EXCLUDED 名单」屏蔽页面**——页面能不能进菜单由后端权限决定。
4. **改公共块必须回同步技能资产**（`assets/core/` + `references/scaffold/src/`），
   并按「唯一真相源」规则先编译 0 错误再同步。
5. **未实测契约的页面必须挂 `DataProbe`**（DEV 可见），让结构偏差可见而不是静默空白。
