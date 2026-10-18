# 字段渲染器：DataField → Element Plus 控件

> 实现只有一处：`assets/core/api/fieldRender.ts` + `components/cube/FieldControl.vue`。
> 本文是**规则表**；改规则改代码，不要在每个页面打补丁。

## 1. 选型优先级（`selectFormControl`，命中即返回）

| 序 | 条件 | 控件 | 说明 |
|---|---|---|---|
| 1 | `itemType === 'html'` | `rich-text` | 未装富文本编辑器时降级为 6 行 textarea（`CONTROL_FALLBACK`） |
| 1 | `itemType === 'image' / 'file' / 'attach'` | `upload` | 走 `FieldControl` 的 `http-request`，路径由页面给 |
| 1 | `itemType === 'password'` | `password` | 只用于自建改密表单，实体表单极少出现 |
| 2 | `typeName === 'Boolean'` | `switch` | `active-value=true` / `inactive-value=false`，别用 1/0 |
| 3 | `mapField` 非空 | 见下 | **映射字段一律下拉，不允许裸文本框** |
| 3a | └ `mapField` 以 `IDs/Ids` 结尾 | `multi-select` | `RoleNames → RoleIds` |
| 3b | └ `mapField === 'ParentID'` | `tree-select` | `ParentName → ParentID` |
| 3c | └ 其它 | `select` | `TenantName → TenantId` |
| 4 | 字段名以 `IDs/Ids` 结尾 | `multi-select` | 逗号串存储的多值外键 |
| 5 | `typeName` 是枚举类型名 | `select` | 非基础类型即枚举：`SexKinds`、`MenuTypes`、`DataScopes` |
| 6 | 字段名以 `ID/Id` 结尾（非主键） | `select` | `ParentID` 例外 → `tree-select` |
| 7 | 有 `map` 或 `dataSource` | `select` | 字典字段 |
| 8 | `DateTime/DateTimeOffset` | `datetime` | `value-format="YYYY-MM-DD HH:mm:ss"` |
| 8 | `Date/DateOnly` | `date` | `value-format="YYYY-MM-DD"` |
| 8 | `TimeSpan/Time` | `time` | `value-format="HH:mm:ss"` |
| 8 | `Int*/Double/Decimal` | `number` | 浮点带 `precision`（默认 2） |
| 8 | `String` 且 `length > 200` | `textarea` | |
| 8 | 其它 / 类型缺失 | `input` | 兜底，绝不渲染空白 |

**判定枚举**：`typeName` 非空且不在基础类型集合内 → 枚举。`Sex` 字段的 `typeName` 是 `SexKinds`，不能按字段名猜。

## 2. 字段映射（E2，最容易被写成 bug 的一条）

### 2.1 什么是映射字段

- `mapField` 非空 → 该字段是**显示名字段**（`RoleName`），真实存储字段是 `mapField`（`RoleID`）。
- 字段名以 `ID/Id` 结尾且非主键 → 也是映射字段（`CategoryID`）。
- `IDs/Ids` 结尾 → 多值映射字段。

### 2.2 双模式

| 页面 | 行为 | 函数 |
|---|---|---|
| 列表 / 详情 | 显示映射后的**名称**，绝不显示原始 ID | `labelOf(field, value, lookups)` |
| 表单 | 渲染**映射源下拉**，值为原始 ID | `resolveOptions(field, lookups)` |

### 2.3 选项解析顺序

1. `field.map`（`Record<value,label>`）——Cube 的 `[Map]` 特性序列化结果，覆盖 90% 场景；
2. `field.dataSource`（`{text,value}[]` 或 `Record` 双形态）——`dictEntries()` 归一；
3. `lookups[lookupBaseName(field)]`——前端自己拉的 `id→name` 字典。

`lookupBaseName` 的取值：`RoleName/RoleNames/RoleIds → Role`、`DepartmentID → Department`。
所以同一实体的多个字段共用一个字典，不重复请求。

### 2.4 多值（`RoleIds = '1,3'`）

| 环节 | 处理 | 函数 |
|---|---|---|
| 表单回填 | 逗号串 → 数组 | `deserializeMultiValue`（**永远返回数组**） |
| 表单提交 | 数组 → 逗号串 | `serializeMultiValue` |
| 列表回显 | 逐个映射后用「、」拼接 | `labelOf` |
| 详情 | 拆成多个 `el-tag` | `multiLabels` |

> `el-select multiple` 收到 `null` 会直接抛 `Cannot read properties of null (reading 'Symbol(Symbol.iterator)')`。
> `FormDialog.resetForm()` 已把所有 `multiple` 字段初始化为 `[]`，自建表单也必须照做。

### 2.5 后端没给 map/dataSource 时

按 `lookupBaseName` 拉关联实体组装字典。基名不是控制器名：`CategoryID` 得到 `Category`，设备台账里的控制器是 `EquipmentCategory`。`useEntityResource` 用 `GetMenuTree` 在**同一区域**里做后缀匹配（多命中取最长），再请求 `GET /api/{area}/{controller}`。

表单控件的 `prop` 必须是 `mapField`（`categoryID`），不能是显示字段 `categoryName`。只提交显示字段时，外键列仍是 0，后端返回「分类不可以为空」。

`map` / `dataSource` / 外键字典的纯数字键要转成 number 再交给 `el-option`。枚举字段提交 `"0"` 时，Cube 的 JSON 转换会失败；提交 `0` 才成功。外键行值也是 number，选项若保持字符串，编辑弹窗会回显裸 ID。

## 3. 必填 / 只读 / 主键

判定（`resolveFieldBehavior`，以 Cube 6.15 设备台账实机为准）：

1. `required === true` → 必填；
2. `nullable === true` → 不必填；
3. **未下发 `nullable` → 非空，必填**。可空字段才会带 `nullable: true`（如存放位置）；名称、编码、分类都不带这个键，后端仍返回「不可以为空」。不要等 `nullable: false`，当前版本不会下发它。

同时排除 `primaryKey` / `isIdentity` / `readOnly` / 审计字段（`CreateTime`、`UpdateUserID`、`CreateIP`…）/ 布尔开关（`false` 是合法值）。

| 场景 | 处理 |
|---|---|
| 新增表单 | `primaryKey` / `isIdentity` 字段**不渲染** |
| 编辑表单 | 主键渲染但 `disabled` |
| 详情 | 全部只读 |
| 只读控制器（`setting.isReadOnly`） | 隐藏新增/编辑/删除按钮 |

> 主键和审计字段先被排除，所以「未下发即可空」不会把 `ID`、`CreateTime` 标成必填。
> 列表里若同时有 `UpdateUser` 和 `UpdateUserID`，只保留名称列。ID 列的值经常是 `0`，标题却也叫「更新者」。

## 4. 树形（自引用 ParentID）

### 4.1 判定

**必须五组字段聚合**：`list + addForm + editForm + detail + search` 中任一字段 `name === 'ParentID'` 或 `mapField === 'ParentID'`。

只看 `list` 组会漏判——Cube 常把 `ParentID` 从列表列隐藏，只留 `ParentName`（`mapField=ParentID`）。

### 4.2 列表

`el-table` 原生支持树形，不需要额外组件：

```vue
<el-table :data="treeRows" row-key="id" :tree-props="{ children: 'children' }" default-expand-all>
```

三个必做项：

1. `row-key="id"` —— 缺了就没有展开箭头；
2. 数据必须是 `buildTree(rows)` 组装后的树——扁平数组喂进去只会平铺；
3. `default-expand-all` —— 否则用户只看到根节点，以为功能没生效。

### 4.3 数据必须全量

分页只返回当前页，跨页父子会断链，树会塌成多棵孤树。`useEntityResource` 在 `isTree === true` 时一律走 `loadAll()`（`pageSize=10000`）并隐藏分页器。

### 4.4 表单里的父级

`ParentID` → `el-tree-select`，数据来自当前实体全量树，且**排除自身及子树**（`toTreeSelectData(nodes, editingId)`），否则可以把节点挂到自己下面，形成环。

## 5. 分类分组（category）

`DataField.category` 直接决定表单/详情的分区：

- 只有 1 组 → 平铺两列（信息密度更高）；
- ≥2 组 → `el-tabs`，顺序按后端返回顺序，空值归入「基础信息」。

对应魔方 MVC 的 `_Form_Group` 分部视图，不要在页面里手写 tab。

## 6. 上传字段

- 路径：`{area}/{controller}/UploadFile`，form-data 字段名 `file`；
- 返回 `{ attId, filePath, contentType }`，表单只存 `filePath`；
- 回显时必须 `serverUrl(filePath)`（独立域名部署时相对路径会 404）；
- `el-upload` 用 `:http-request` 走统一 axios 实例，**不要**用 `action`（那样带不上令牌头）。

## 7. 日期与数字的坑

| 坑 | 正确写法 |
|---|---|
| 日期绑定成 `Date` 对象，提交后后端解析失败 | `value-format="YYYY-MM-DD"` / `"YYYY-MM-DD HH:mm:ss"` |
| `Int64` 精度丢失 | 保持字符串，`el-input-number` 关闭时会转 number——ID 类字段不要用数字控件 |
| 小数位漂移 | `:precision="field.precision ?? 2"` |
| 时间范围查询 | 后端要 `start,end` 两参数时用 `daterange` + `serializeRangeValue` |
