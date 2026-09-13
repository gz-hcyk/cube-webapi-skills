# 角色权限设置（RoleMenuEditor）接入指南

> 配套资产：`assets/core/components/cube/RoleMenuEditor.vue`（技能 §4.12.1）。目标：让后台「系统管理 → Role」编辑弹窗里的
> `Permission`（`菜单ID#权限位掩码` 串，如 `16#1`）以**行内勾选权限矩阵**呈现，而非无意义的文本框。
> 本文档给出从脚手架到验收的完整改动，任何基于本技能的新项目可直接照抄。

---

## 0. 依赖与契约（勿改）

- 后端无需改动：`Role` 实体由 `AddCube()` 自动暴露 `Admin/Role` CRUD；`Permission` 字段契约固定——
  逗号分隔 `菜单ID#权限位掩码`，位：1查看 / 2新增 / 4修改 / 8删除（组合=或），`-1`=全动作。
- 组件依赖：`@/api/http`（`getApi`）、`tdesign-vue-next`（t-checkbox/t-tag/t-button/t-loading）。
- 菜单数据源：`GET /api/Admin/Menu?page=1&pageSize=1000`（Index 端点，返回扁平 `{id,name,displayName,parentId}`，
  vite 代理 `/api` 可达）。**不要用无 `/api` 前缀的 `/Admin/Menu`**（会打到 SPA 回退）。

## 1. 拷贝资产

```bash
cp -r <skill>/cube-webapi-tdesign/assets/core/. <工程>/src/    # 一次拷全 31 件，RoleMenuEditor 已含在内
# 或单独取：cp <skill>/cube-webapi-tdesign/assets/core/components/cube/RoleMenuEditor.vue <工程>/src/components/cube/
```

## 2. ListPage：Role 页把 permission 表单项改造成「权限设置」独立页签

在 `ListPage.vue` 的 script 段加入（组件内已存在 `formItems` computed 时，套用其外层）：

```ts
/** 角色页（Admin/Role）：Permission 是 `菜单ID#权限位掩码` 串——特判为 role-permission 控件（§4.12.1） */
const isRolePage = computed(() => props.area === 'Admin' && props.controller === 'Role')
// formItems computed（add/edit 共用）末尾追加：
if (!isRolePage.value) return items
return items.map((it) =>
  // ⚠️ FormItem.key 是 camelCase（permission），必须不区分大小写匹配
  String(it.key).toLowerCase() === 'permission'
    ? { ...it, control: 'role-permission', category: '权限设置', full: true, rules: [] }
    : it,
)
```

要点：
- 改写后的 item 由 `groupByCategory` 自动归入独立「权限设置」页签（category 其余字段为空串 → 「基础设置」）。
- `rules` 清空，避免把串当必填/长度校验。

## 3. FormDialog：role-permission 以「整块」渲染（不套带 label 的表单字段）

```ts
// script：懒加载 + 含该控件时加宽
const RoleMenuEditor = defineAsyncComponent(() => import('./RoleMenuEditor.vue'))
const dialogWidth = computed(() => {
  const cs = formItems.value.map((it) => it.control)
  if (cs.includes('role-permission')) return '1000px'   // 行内矩阵宽屏体验
  if (cs.includes('rich')) return '940px'
  return '680px'
})
```

```vue
<!-- template：v-for 分流 —— role-permission 全宽整块；其余走原 t-form-item -->
<template v-for="it in g.items" :key="it.key">
  <div v-if="it.control === 'role-permission'" class="fd-rme">
    <RoleMenuEditor v-model="model[it.key]" />
  </div>
  <t-form-item v-else :label="it.label" :name="it.key">
    <!-- …其余控件分支原样… -->
  </t-form-item>
</template>
```

要点：页签「权限设置」即标题，不要再用带 `label="权限矩阵"` 的 `t-form-item` 包裹（会残留表单标签栏与字段感）。

## 4. 验证清单（CDP / 手测）

- [ ] 打开任意角色「编辑」→ 出现「基础设置 / 权限设置 / 扩展」页签；「权限设置」页签内无 `.t-form__label`、无 `t-form-item` 外壳，矩阵全宽
- [ ] 菜单树 56 行左右平铺、父节点行加粗浅底；工具栏「全展开/全折叠」+ 授权数 Tag 正确（订阅会员 `16#1` → 「1 个菜单已授权」）
- [ ] 勾选父节点某动作位 → 子孙全部授予该位；取消 → 子孙同步收回（PUT body 为最终判据，如父勾「查看」→ `Permission:"1#1,...,56#1"` 17 段级联）
- [ ] 保存 → 重开编辑回填勾选一致；后端 `Detail` 回读 Permission 串一致
- [ ] 详情抽屉不再出现 `16#1` 明文（Role 页 `detailFields` 过滤 `permission`）

## 5. 坑速查

| 现象 | 根因/修复 |
|---|---|
| vite dev 下矩阵空、请求打到 index.html | 组件数据源经 `http` 实例取 `getApi('/Admin/Menu')`（**调用点只写 `/Admin/Menu`，不带 `/api`**——`http` baseURL 已含，写了反而双前缀 404） |
| permission 仍渲染成文本框 | ListPage 特判 key 用 `toLowerCase()==='permission'`（camelCase），按 `'Permission'` 判失效 |
| 页签没出现/矩阵贴行 | item 需 `category:'权限设置'`；组件以全宽 div 渲染，勿套 label form-item |
| 自动化同帧连点丢位 | 受控 checkbox-group 竞态；本组件已用独立 t-checkbox 规避，验收脚本仍建议逐项间隔点击 |
| Role 详情/列表显示 `16#1` 明文 | Role 页 `listFields/detailFields` 过滤 `permission` 字段（授权在编辑弹窗维护） |
