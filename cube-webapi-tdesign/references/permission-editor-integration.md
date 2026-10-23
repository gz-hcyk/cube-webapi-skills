# 角色权限设置（RoleMenuEditor）接入指南

> 配套资产：`assets/core/components/cube/RoleMenuEditor.vue`（SKILL §4.12.1；`references/scaffold/src/` 内有同步副本）。
> 目标：把后台「系统管理 → Role」编辑弹窗里那个 `Permission` 明文输入框，换成**四列授权表格**
> （名称 / 显示名 / 授权 / 操作权限），形态对齐 Cube MVC 版 `Role/SetPermission`。
> 本文是从脚手架到验收的完整改动，新项目照抄即可。

---

## 0. 形态与语义（先理解再抄）

| 列 | 内容 | 说明 |
| :-- | :-- | :-- |
| 名称 | 菜单 `name`（英文代码名，如 `Iam` / `NasClient`） | 带层级缩进 + 折叠箭头，父级加粗 |
| 显示名 | 菜单 `displayName`（中文） | 纯展示 |
| 授权 | **仅父级行**有勾选框 | 该菜单块是否对本角色开放；勾上 → 自身+全部子孙补权限段，取消 → 整支删段 |
| 操作权限 | 父级：`只读` / `全部` 两档；叶子：逐位勾选 | 具体可执行动作 |

三条容易踩错的语义：

1. **「授权」与「操作权限」不是一回事**：授权决定菜单**可不可见**，操作权限决定**进去能干什么**。
   `Role.Permission` 里「有段 = 已授权」，掩码才是能力。
2. **子级行没有授权框**，授权由操作位隐含（勾任一位即开放）。这不是省略，是刻意的——
   见下一节的 0 掩码约束，子级独立授权框会落进「存不住」的区间。
3. **父级「只读 / 全部」两档互斥**，且状态**由数据反解**、不存额外状态：
   - 全部 = 自身 + 全部子孙掩码均为 `-1`；
   - 只读 = 非全部态，且自身 + 全部子孙掩码恰为 `1`。
   ⚠ 不能用「是否含查看位」判只读，否则「全部」态下只读也会亮。

## 1. 契约与硬约束（勿改）

- **串格式**：逗号分隔 `菜单ID#权限位掩码`，位 `1查看 / 2添加 / 4修改 / 8删除`（组合=按位或），`-1`=全动作。
  自定义业务位 16/32/64/128… 同串参与，权限项名 = 后端 Action `[DisplayName]`。
- **★ 0 掩码段不落库**：XCode 的 Role 保存/加载会**丢弃** `菜单ID#0` 段
  （实测 PUT `permission="19#0"` 读回 `""`；`"1#1,19#0"` 读回 `"1#1"`）。
  ⇒ **「菜单可见但无任何操作权限」无法表达**，开放的最小粒度只能是查看（1）。
  ⇒ 组件里所有「取消到 0」的地方都必须**删段**，不能写 0；`parse()` 也要忽略 0 段（防历史脏值）。
  ⇒ 凡写 Permission 串的逻辑，写完必须读回校验——0 段是**静默消失**，不报错。
- **数据源**：`GET /api/Admin/Index/GetMenuTree`（`getRaw`，baseURL=`SERVER_BASE` **不含** `/api`，故调用点写全 `/api/...`）。
  返回**嵌套树**（`children`），节点字段 `id / name / displayName / parentId / children / permissions`。
  - `permissions` 是权限位字典 `{"1":"查看","2":"添加","16":"入库"}`——**位列表的唯一权威源**；
  - 空字典/缺字段时回退内置四位；
  - ★ 必须**递归摊平**成数组再建索引，否则只有顶层节点能渲染（历史 bug：只渲染 9 个分组、子级全丢）。
  - 不要用 `GET /api/Admin/Menu` 扁平表替代——它**不带 `permissions` 字典**，自定义位全丢。
- 组件依赖：`@/api/http`（`getRaw`）、`tdesign-vue-next`（t-checkbox / t-tag / t-button / t-loading）。后端零改动。

## 2. 拷贝资产

```bash
cp -r <skill>/cube-webapi-tdesign/assets/core/. <工程>/src/     # 全量覆盖，RoleMenuEditor 已含在内
# 或单取：
cp <skill>/cube-webapi-tdesign/assets/core/components/cube/RoleMenuEditor.vue <工程>/src/components/cube/
```

## 3. 四处接线（缺一不可）

### 3.1 类型：`FieldControl` 补 'role-permission'

`src/api/fieldRender.ts` 的 `FieldControl` 联合类型末尾追加：

```ts
  | 'role-permission'; // Role.Permission 串：角色授权表格（§4.12.1）
```

### 3.2 FormDialog：把 permission 项改写成独立页签的整块控件

```ts
import RoleMenuEditor from './RoleMenuEditor.vue'   // 或 defineAsyncComponent 懒加载

// 角色页（Admin/Role）：Permission 是 `菜单ID#权限位掩码` 串——特判为 role-permission 控件，
// 归入独立「权限设置」页签、label 置空（页签名即标题）、清除必填/长度校验
const isRolePage = computed(() => props.area === 'Admin' && props.controller === 'Role')
const items = computed(() => {
  const base = buildFormItems(fields.value, props.lookups, props.lovOptions)
  if (!isRolePage.value) return base
  return base.map((it) =>
    // ⚠ fieldRender 产出的 name 是 camelCase（permission），必须不区分大小写匹配
    String(it.name).toLowerCase() === 'permission'
      ? { ...it, control: 'role-permission' as const, label: '', category: '权限设置', full: true }
      : it,
  )
})
const rules = computed(() => {
  const r = buildFormRules(fields.value) as Record<string, any>
  if (isRolePage.value) delete r.permission       // 授权串不做表单校验
  return r
})
// 含权限矩阵时加宽弹窗（四列表格要宽屏，6 个权限位才能基本一行）
const dialogWidth = computed(() =>
  items.value.some((it) => it.control === 'role-permission') ? '1160px' : '760px',
)
```

模板：`role-permission` 作为 **v-if 链第一支**插入（不是独立 v-if！见坑表），label 壳用 CSS 隐藏：

```vue
<t-form-item
  v-for="item in g.items"
  :key="item.name"
  :label="item.label"
  :name="item.name"
  :class="{ 'grid-full': item.full, 'form-item--rme': item.control === 'role-permission' }"
>
  <RoleMenuEditor
    v-if="item.control === 'role-permission'"
    v-model="formData[item.name]"
  />
  <t-tree-select v-else-if="item.control === 'tree-select'" … />
  …
</t-form-item>
```

```css
/* 页签即标题，隐藏空标签壳，避免留白 */
.form-item--rme :deep(.t-form__label) { display: none; }
.form-item--rme :deep(.t-form__controls) { padding-left: 0; }
```

### 3.3 ListPage / DetailDrawer：过滤授权串明文

```ts
// ListPage：Role 页列表不出 Permission 列（授权只在编辑弹窗维护）
listFields = listFields.filter((f) => String(f.name).toLowerCase() !== 'permission')

// DetailDrawer：Role 详情同理
const fields = computed(() =>
  (props.schema?.detail ?? []).filter(
    (f) => !(props.area === 'Admin' && props.controller === 'Role'
             && String(f.name).toLowerCase() === 'permission'),
  ),
)
```

### 3.4 组件本体

直接用资产，**不要改数据源**。资产内已处理：嵌套树摊平、位字典驱动、父子位级联动、
只读/全部两档与反解、-1 全动作展开、0 段删除、全展开/折叠、授权数统计。

## 4. 验收清单（CDP / 手测）

- [ ] 角色「编辑」→ 出现「权限设置」页签；页签内**无** `.t-form__label` 残留、无**第二个明文输入框**（有 = v-if 链踩坑，见 §5）
- [ ] 四列齐全：名称（英文）+ 显示名（中文）+ 授权 + 操作权限
- [ ] 授权框**只在父级行**出现；子级行为空但操作位可点
- [ ] 勾父级「授权」→ 该块全部子孙出现权限段（原无位的落到 `1`）；取消 → 整支删段
- [ ] 勾父级「只读」→ 子孙仅「查看」亮，其它位（含 16/32 自定义位）全灭
- [ ] 勾父级「全部」→ 子孙全部位亮，且 PUT body 为 `菜单ID#-1`（不是具体掩码）
- [ ] 叶子行勾自定义位（如 `16`）→ 该菜单段含该位（`id#16` 或 `id#17`）
- [ ] 保存 → 重开回填一致（只读仍亮只读、全部仍亮全部）；`Detail` 回读串一致
- [ ] 列表与详情抽屉无 `1#1,6#1…` 明文
- [ ] **PUT body 是最终判据**（`request.postData()` 解码后看），不要只看 UI

## 5. 坑速查

| 现象 | 根因 / 修法 |
|---|---|
| 矩阵只渲染出几个顶层分组，子级全没 | `GetMenuTree` 是**嵌套树**，组件必须递归摊平 `children` 再建 `byParent` 索引 |
| 自定义权限位（16/32…）不出现 | 数据源用了 `/api/Admin/Menu` 扁平表（不带 `permissions` 字典）；换 `GetMenuTree`，位列表按节点字典渲染 |
| 矩阵旁多出一个 `1#1,6#1…` 明文框 | v-if 链踩坑：`t-tree-select` 写成了独立 `v-if`，Vue 视其为新链起点，链尾 `t-input v-else` 兜底命中 → **同一字段渲染两个控件**。改 `v-else-if` 接回同链（SKILL §4.12.1 铁律：一条控件链只允许链首一个 `v-if`） |
| 保存后「只勾了授权」的菜单整块消失 | 落了 `id#0`，后端丢弃该段。开放必须落 ≥1 的掩码 |
| 只读/全部状态错乱、全勾时只读也亮 | 只读判定写成了「含查看位」；正确判据 = 非全部态 && 全支掩码恰为 `1` |
| 取消「全部」后菜单还在、只是没权限 | 取消写成了置 0；应**删段**（置 0 会被后端丢掉，但语义上也不该保留「开放」） |
| 页签没出现 / 矩阵贴边 | item 缺 `category:'权限设置'` 或 `full:true`；label 壳未隐藏 |
| 弹窗太窄、权限位换行严重 | `dialogWidth` 未加宽（1160px）+ 操作权限列 `flex: 0 0 400px` |
| `permission` 仍渲染成文本框 | 特判 key 用了 `'Permission'`（大写）；实际是 camelCase `permission`，用 `toLowerCase()` 比 |
| 自动化连点丢位 | 受控 checkbox 同帧竞态；验收脚本逐项间隔 ~300ms 点击 |

## 6. 附：原版形态怎么取证（不用外网）

Cube MVC 的 `Role/SetPermission.cshtml` 被 Razor **编译进 DLL**，本地 NuGet 缓存里就能取原文：

```python
# <user>/.nuget/packages/newlife.cube.core/<ver>/lib/net8.0/NewLife.Cube.dll
data = open(dll, 'rb').read()
txt  = data.decode('utf-16-le', errors='ignore')   # Razor 视图以 UTF-16LE 字面量存放
i = txt.find('操作权限')                            # 定位 SetPermission 表格
print(txt[max(0, i-3000):i+3000])
```

取到的四列定义（`名称 / 显示名 / 授权 / 操作权限`）与联动 class（`authorize` / `auth_child` / `pro_detail` / `pro_all`）
就是本文 §0 的语义来源。**遇到「魔方原版长什么样」类问题优先用这招**，比翻官网/源码仓库快且离线可用。
