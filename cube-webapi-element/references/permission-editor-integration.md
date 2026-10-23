# 角色权限设置（RoleMenuEditor）接入指南 · Element Plus 版

> 配套资产：`assets/core/components/cube/RoleMenuEditor.vue`。
> 目标：把「系统管理 → Role」编辑弹窗里那个 `Permission` 明文输入框，换成**四列授权表格**
> （名称 / 显示名 / 授权 / 操作权限），形态对齐 Cube MVC 版 `Role/SetPermission`。
> 语义与 TDesign 版完全一致（见 `cube-webapi-tdesign/references/permission-editor-integration.md` §0-§1），
> 本文只写 Element Plus 的落地差异。

---

## 0. 语义速览（详细版见 TDesign 同文档）

| 列 | 内容 |
| :-- | :-- |
| 名称 | 菜单 `name`（英文代码名），层级缩进 + 折叠箭头，父级加粗 |
| 显示名 | 菜单 `displayName`（中文） |
| 授权 | **仅父级行**有勾选框：勾上 → 自身+全部子孙补权限段；取消 → 整支删段 |
| 操作权限 | 父级 `只读` / `全部` 两档；叶子逐位勾选（含 16/32/64/128 自定义位） |

三条硬约束：

1. **0 掩码段不落库**（XCode Role 保存/加载丢弃 `id#0`）⇒ 开放的最小粒度 = 查看（1）；
   「取消到 0」必须**删段**，序列化只输出 `>0` 或 `-1`。
2. **数据源必须 `GET /api/Admin/Index/GetMenuTree`**（走 `getRaw`，调用点写全 `/api`），
   返回嵌套树需**递归摊平**；`permissions` 字典是权限位列表的**唯一权威源**（空则回退 1/2/4/8）。
   不要用 `/api/Admin/Menu` 扁平表——不带字典，自定义位全丢。
3. **只读/全部状态由数据反解**（全部 = 全支 `-1`；只读 = 非全部且全支恰为 `1`），不存额外状态。

## 1. 拷贝资产

```bash
cp -r <skill>/cube-webapi-element/assets/core/. <工程>/src/     # 全量覆盖，RoleMenuEditor 已含在内
# 或单取：
cp <skill>/cube-webapi-element/assets/core/components/cube/RoleMenuEditor.vue <工程>/src/components/cube/
```

资产内 `components/cube/*.vue` 由 7 个变为 **8 个**（新增 `RoleMenuEditor.vue`），属「零引用配方件」：
不接线不报错、接线才生效。

## 2. 三处接线

### 2.1 类型：`FieldControl` 补 'role-permission'

`src/api/fieldRender.ts`：

```ts
  | 'role-permission'; // Admin/Role 的 permission 字段：角色权限勾选矩阵（RoleMenuEditor）
```

### 2.2 FormDialog：permission → 独立页签的整块控件

```ts
import RoleMenuEditor from './RoleMenuEditor.vue'   // 或 defineAsyncComponent 懒加载

const isRolePage = computed(() => props.area === 'Admin' && props.controller === 'Role')
const items = computed(() => {
  const base = buildFormItems(fields.value, props.lookups, props.lovOptions)
  if (!isRolePage.value) return base
  return base.map((it) =>
    String(it.name).toLowerCase() === 'permission'   // ⚠ camelCase，别写 'Permission'
      ? { ...it, control: 'role-permission' as const, label: '', category: '权限设置', full: true }
      : it,
  )
})
const rules = computed(() => {
  const r = buildFormRules(fields.value) as Record<string, any>
  if (isRolePage.value) delete r.permission
  return r
})
const dialogWidth = computed(() =>
  items.value.some((it) => it.control === 'role-permission') ? '1160px' : '760px',
)
```

模板：`role-permission` 作为 **v-if 链第一支**（不是独立 `v-if`！）：

```vue
<el-form-item
  v-for="item in g.items"
  :key="item.name"
  :label="item.label"
  :prop="item.name"
  :class="{ 'grid-full': item.full, 'form-item--rme': item.control === 'role-permission' }"
>
  <RoleMenuEditor v-if="item.control === 'role-permission'" v-model="formData[item.name]" />
  <el-tree-select v-else-if="item.control === 'tree-select'" … />
  <el-select v-else-if="item.control === 'multi-select'" … />
  …
</el-form-item>
```

```css
/* 页签即标题，隐藏空标签壳，避免留白 */
.form-item--rme :deep(.el-form-item__label) { display: none; }
.form-item--rme { margin-bottom: 0; }
```

> **若 FormDialog 里同时存在「单分组扁平块」与「分组页签块」两个渲染区**，两处都要加这个分支。
> Role 页因多出「权限设置」分组必然走页签块，但漏改另一块会在 `groups.length <= 1` 的场景退化成文本框。
> 本项目实测形态是**只保留页签块**（`el-tabs v-if="groups.length"` 单一渲染区），改一处即可。

### 2.3 ListPage / DetailDrawer：过滤授权串明文

```ts
// ListPage.columns：Role 页不出 Permission 列
let listFields = res.schema.value?.list ?? []
if (props.area === 'Admin' && props.controller === 'Role') {
  listFields = listFields.filter((f) => String(f.name).toLowerCase() !== 'permission')
}

// DetailDrawer.fields：Role 详情同理
const fields = computed<DataField[]>(() =>
  (props.schema?.detail ?? [])
    .filter((f) => !f.primaryKey)
    .filter((f) => !(props.area === 'Admin' && props.controller === 'Role'
                     && String(f.name).toLowerCase() === 'permission')),
)
```

## 3. 验收清单

- [ ] 角色「编辑」→ 出现「权限设置」页签；页签内无 `el-form-item__label` 残留、**无第二个明文输入框**
- [ ] 四列齐全；授权框仅父级行；子级行留空但操作位可点
- [ ] 勾父级授权 → 全块补段（无位的落到 `1`）；取消 → 整支删段
- [ ] 父级「只读」→ 子孙仅查看亮；「全部」→ 子孙全亮且 PUT 为 `id#-1`；两档互斥
- [ ] 叶子勾自定义位（16/32…）→ 段内含该位
- [ ] 保存重开回填一致；`Detail` 回读串一致；列表/详情无授权串明文
- [ ] **PUT body 为最终判据**（`request.postData()`），UI 只作辅助

## 4. 坑速查（Element Plus 特有）

| 现象 | 根因 / 修法 |
|---|---|
| 弹窗里 permission 同时出现「矩阵 + 明文框」 | `el-tree-select` 曾用独立 `v-if`，链尾 `el-input v-else` 兜底命中。新分支必须接 `v-else-if`，一条链只允许链首一个 `v-if` |
| `el-select multiple` 首帧崩（`object null is not iterable`） | 编辑回填 `Object.assign(formData, row)` 把 `null` 写进多选字段，`await getById()` 间隙已渲染一帧。修法：多值归一化（`deserializeMultiValue`）在**每次 assign 之后同步执行**，不能等 await 之后 |
| 页签宽度不够、权限位竖排 | 弹窗 1160px + 操作权限列 `flex: 0 0 400px` |
| 矩阵只出顶层、子级全丢 | `GetMenuTree` 嵌套树未摊平（同 TDesign） |
| 自定义位不显示 | 数据源用了 `/api/Admin/Menu`（无 `permissions` 字典） |
| 保存后「只勾授权」的块整体消失 | 落了 `id#0`，后端丢弃。开放要落 ≥1 |
| 只读态在「全部」时也亮 | 只读判据用了「含查看位」，改为「非全部 && 全支恰为 1」 |
