# 页面组装：组件化 + 模板继承怎么落地

> 一句话：**新增实体不写页面，改元数据即可**；确实要定制时，只写"薄页面"（≤10 行），
> 不复制 `ListPage` 再改。复制是设计债的起点。

## 1. 三层结构

| 层 | 文件 | 职责 | 谁改 |
|---|---|---|---|
| 布局层 | `layouts/BasicLayout.vue` | 侧栏 / 顶栏 / 内容区 / 外观入口 | 项目初始化时改一次 |
| 基类组件 | `components/cube/*` | 列表 / 表单 / 详情 / 字段控件 / 认证壳 | 全项目共用，改一处全体生效 |
| 业务页 | `views/*` 或路由参数 | 只传 `area` + `controller` + 标题 | 每个实体 ≤10 行 |

对应魔方 MVC：

| MVC | 本技能 |
|---|---|
| `_Layout.cshtml` | `BasicLayout.vue` |
| `List.cshtml` | `ListPage.vue`（唯一列表骨架） |
| `_List_Data.cshtml` 字段循环 | `buildColumns()` + `v-for` 列 |
| `_Form_*.cshtml` 按类型选分部 | `selectFormControl()` + `FieldControl.vue` |
| `ListTree.cshtml` | `isTreeSchema()` + `el-table` 树形 |
| `Detail.cshtml` | `DetailDrawer.vue` |

## 2. 三种落地方式

### 2.1 纯元数据实体（默认，0 个新文件）

后端 `GetMenuTree` 里有节点 `/Lab/LabAsset` → 路由 `/:area/:controller` 直接接住 →

```
/Lab/LabAsset → EntityView → ListPage(area="Lab", controller="LabAsset")
```

菜单名自动成为页面标题（`EntityView` 从菜单里反查 `displayName`）。**这是绝大多数情况。**

### 2.2 需要定制标题 / 参数（薄页面，5 行）

```vue
<!-- src/views/lab/LabAssetView.vue -->
<template>
  <ListPage area="Lab" controller="LabAsset" title="资产管理" description="设备台账与状态跟踪" />
</template>

<script setup lang="ts">
import ListPage from '@/components/cube/ListPage.vue';
</script>
```

路由里加静态规则（放在动态路由**之前**，静态优先匹配）：

```ts
{ path: 'Lab/LabAsset', name: 'lab-asset', component: () => import('@/views/lab/LabAssetView.vue') }
```

### 2.3 特殊控制器（无 GetPage）

`ConfigController<T>`（单对象配置）、自定义报表、数据库浏览等，没有标准 CRUD schema，写独立视图，
但**仍然复用** `PageHeader` 样式类、`FieldControl`、`SettingPanel`、鉴权与请求层。

注册表模式（避免在路由里写一堆 if）：

```ts
// src/config/special.ts
export const SPECIAL_VIEWS: Record<string, () => Promise<any>> = {
  'Admin/Config': () => import('@/views/special/ConfigView.vue'),
  'Admin/Db': () => import('@/views/special/DbView.vue'),
};
```

`EntityView` 命中 `area/controller` 时渲染专属组件，否则退回 `ListPage`。

## 3. ListPage 接口

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `area` | string | 必填 | 区域名 |
| `controller` | string | 必填 | 控制器名 |
| `title` | string | 控制器名 | 页面标题 |
| `description` | string | 自动 | 页头说明；缺省显示"共 N 条记录" |
| `pageSize` | number | 20 | 平铺表分页大小 |
| `searchParamMap` | `Record<string,string>` | `{}` | 虚拟字段 → 真实查询字段 |
| `uploadPath` | string | `{base}/UploadFile` | 附件上传接口 |

内部已经处理：schema 加载、列生成、搜索折叠、排序、分页、权限、树形、空/错/加载态、增删改查、导出。

## 4. 表单：分组与整行

`FormDialog` 自动按 `category` 分组：

- 1 组 → 两列网格；
- ≥2 组 → `el-tabs`；
- 整行控件：`textarea` / `rich-text` / `upload` / `daterange`。

需要"某字段必须整行"但类型不是上述几种时，在 `FormItemSpec` 上加标记，别在页面里写 `:class`。

## 5. 详情：先结论后细节

`DetailDrawer` 的顺序固定：

1. 概要头：`name/title/code` 中第一个非空 + 最近更新时间 + 启用状态标签；
2. 按 `category` 分区，`el-descriptions` 单列（抽屉窄，两列会挤）；
3. 长文本 `white-space: pre-wrap`，多值拆 tag，空值显示 `—` 且置灰。

## 6. 父子表（只展现父表）

存在 `Parent` + `ParentLine`（`ParentID` 外键）时：

1. **菜单只保留父表**，子表节点即使后端下发了也不显示；
2. 父表列表不铺子表行（行数不定，会把主表撑乱）；
3. 父表详情内嵌只读子表 `el-table`；
4. 父表表单里用 tab 或分区录入子表行，随父表一次提交（`lines` 集合）；
5. 子表**没有独立权限位**，按钮显隐跟随父表权限。

子表区域的最小骨架：

```vue
<!-- 父表详情抽屉内 -->
<section class="cube-detail__section">
  <h3 class="cube-detail__section-title">明细</h3>
  <el-table :data="record.lines ?? []" size="small" border>
    <el-table-column prop="productName" label="物料" min-width="140" />
    <el-table-column prop="quantity" label="数量" width="90" align="right" />
    <el-table-column prop="amount" label="金额" width="110" align="right" />
  </el-table>
</section>
```

## 7. 扩展一个控件（唯一正确姿势）

1. 在 `fieldRender.ts` 的 `FieldControl` 联合类型加一个值；
2. `selectFormControl()` 加命中条件；
3. `FieldControl.vue` 加一个 `v-else-if` 分支；
4. 需要默认值时补 `FormDialog.emptyValue()`。

**不要**在业务页写 `<el-input v-if="field.name==='xxx'">` —— 那是把继承改成了特例。

## 8. 页面状态清单（自检）

每个新页面交付前过一遍：

- [ ] 首次加载有 loading，不是白屏；
- [ ] 无数据有 `el-empty` + 可行动文案；
- [ ] 接口失败有 `el-alert` + 重试；
- [ ] 无新增权限时按钮消失（不是禁用）；
- [ ] 删除有二次确认，文案写明不可恢复；
- [ ] 窄屏（900 / 560）下不横向溢出；
- [ ] 键盘 Tab 能走完表单，焦点环可见。
