# ConfigController<T> 前端单列处理范式

> 配套：`assets/core/components/cube/ConfigView.vue`；后端契约见 `cube-webapi-backend` §9；技能总览见 SKILL.md §4.17。

## 1. 后端契约回顾（为什么特殊）

`ConfigController<T>`（如 `OrderSettingController : ConfigController<OrderSetting>`）是魔方为
`Config<T>` 配置类暴露查看/编辑接口的基础控制器。**它只自动提供两个动作**：

| 动作 | 行为 | 返回 |
|------|------|------|
| **Get** | 读取 `Config<T>.Current` | **单个配置对象**（属性即设置项） |
| **Update** | 线程安全 `Copy + Save` | 回存整对象 |

**它不暴露 `GetPage` 列表字段元数据接口，也没有 `Index` 列表接口**；但**提供 `GetFields` 字段元数据接口**
（`?kind=EditForm` 返回 `DataField[]`，足以驱动单表单页）。这与实体控制器
（`EntityController`/`ReadOnlyEntityController`，自动提供 GetPage + Index + CRUD）本质不同。

## 2. 为什么不能走 ListPage

本技能所有实体页的假设是「后端有 `GetPage` → `buildColumns` 列表列定义」。
`ConfigController<T>` 不满足该前提（它只有 `GetFields`、没有 `GetPage`）：

- `ListPage.loadSchema()` 调 `GET /{area}/{controller}/GetPage` → **404 / 无 `list` 字段**；
- `buildColumns` 拿不到 schema，列定义构建失败 → 表格只剩操作列或空白（现象同 SKILL.md §七 TDZ，
  但根因是「无 GetPage」而非「前向引用」）。

**结论：凡 `ConfigController<T>` 类控制器，必须单列处理，绝不进 `ListPage`。**
但它**有 `GetFields`**，故单表单页仍走「元数据驱动」（复用 `buildFormItems`/`buildFormRules`），而非硬编码。

## 3. 单列处理四步

1. **路由识别（注册表，显式策划，不可用命名启发式）**：在 `src/specialControllers.ts` 维护
   `SPECIAL_CONTROLLERS: Record<'{area}/{controller}', { kind; view }>` 注册表，命中即由 `EntityPage`
   渲染专属组件、跳过 `ListPage`。**【命名不可靠】**——`*Config`/`Parameter` 名字像配置，但
   `MailConfig`/`OAuthConfig`/`SmsConfig`/`Parameter` 实际都是 `EntityController<T>`（有 `GetPage`，
   能走 `ListPage`）；真正的 `ConfigController<T>` 反而不带 Config 名（`Cube`/`Sys`/`XCode`/`Core`）。
   故注册表**必须显式列出**，不能靠「名字含 Config 就当配置页」自动判定，否则 `MailConfig` 会被误判崩溃。
   新增配置控制器只需往注册表追加 `'Admin/OrderSetting': { kind:'config', view: ConfigView }`。
2. **数据获取（两层，优先元数据）**：
   - 先 `GET /api/{area}/{controller}/GetFields?kind=EditForm` 取 `DataField[]`（元数据）；
   - 再 `GET /api/{area}/{controller}` 拿回**单个配置对象**回填——注意它**不**走 `extractListPayload`
     （无 `rows`/`page` 包裹），`ConfigView` 内部按信封（有 `code` 取 `data`）或裸对象自动解包。
   `GetFields` 不可用（老部署）时退回静态 `fields` / JS 动态推断兜底。
3. **渲染（元数据驱动，标准落地）**：`ConfigView` 复用 `buildFormItems`/`buildFormRules`（与实体表单同源、
   组件选型/校验一致）。这是「元数据驱动、不硬编码」总原则的**正常落地**，不再是硬编码例外。
   字段 `fields` prop 仅作 `GetFields` 不可用时兜底（中文 label / 选项）。
4. **保存**：`POST /api/{area}/{controller}`（`Update`）回存整对象；成功提示后重新 `GET` 刷新。

## 4. 用法示例（以 OrderSetting 为例）

### 4.1 静态字段声明（前端已知 Config<T> 属性）

```ts
// src/configs/orderSetting.ts
import type { ConfigField } from '@/components/cube/ConfigView.vue';

export const orderSettingFields: ConfigField[] = [
  { name: 'AutoConfirm', label: '自动确认收货', type: 'switch' },
  { name: 'ExpireHours', label: '支付超时(小时)', type: 'number', min: 1, max: 168, required: true },
  { name: 'NotifyUrl', label: '回调通知地址', type: 'url', placeholder: 'https://' },
  { name: 'Remark', label: '备注', type: 'textarea' },
];
```

### 4.2 页面 / 路由

```vue
<!-- src/pages/OrderSettingView.vue -->
<script setup lang="ts">
import ConfigView from '@/components/cube/ConfigView.vue';
import { orderSettingFields } from '@/configs/orderSetting';
</script>

<template>
  <ConfigView area="School" controller="OrderSetting" title="订单设置" :fields="orderSettingFields" />
</template>
```

路由（若用 `:area/:controller` 兜底，必须靠 `src/specialControllers.ts` 注册表显式声明 `Admin/OrderSetting`，
**不要**对 `Setting`/`Config` 后缀做启发式特判——命名不可靠，见 §3.1）：

```ts
{
  path: '/admin/config/order-setting',
  name: 'OrderSetting',
  component: () => import('@/pages/OrderSettingView.vue'),
  meta: { title: '订单设置' },
}
```

### 4.3 HTTP 封装 / 解包注意

`ConfigView` 复用技能封装的 `@/api/http`（`getApi`/`postApi`/`putApi` + `Authorization: Bearer` 令牌拦截器；`http` 实例 `baseURL` 已含 `/api`，故路径**只写 `/{area}/{controller}`、不要自带 `/api`**，否则双前缀 404）。
内部 `unwrap()` 自动区分**信封**（有 `code` 字段取 `data`）与**裸对象**（直接当配置对象），两种后端返回
形态都兼容。若后端 `ConfigController<T>` 的 Update 用 `PUT` 而非 `POST`，把 `saveMethod="PUT"` 传入即可；
端点也可经 `loadUrl`/`saveUrl` 自定义。

## 5. 防坑清单

- **别塞进 ListPage**：否则 `buildColumns` 拿空 schema → 只剩操作列 / 空白表。
- **字段优先看 GetFields（不传 fields 时动态兜底）**：配置类有 `GetFields` 时应元数据驱动（增删字段后端改即可）。
  `GetFields` 不可用时才退回静态 `fields` 或 JS 动态推断（label 即字段名，仅兜底）；生产建议前端补 `fields`
  拿到中文 label 与正确控件/选项。
- **动态兜底不处理嵌套对象/数组**：若 `Config<T>` 含子对象或集合，`fields` 必须显式声明（动态推断只覆盖
  布尔/数字/字符串三类基本型），否则嵌套结构会退化成普通输入框。
- **GET 回来是单对象不是数组**：不要喂给 `extractListPayload`（`rows`/`page` 包裹不存在）。
- **`Config<T>.Current` 是进程级单例缓存**：`Copy + Save` 后下次 `Get` 即见新值（后端线程安全），
  前端保存后 `load()` 刷新即可，无需手动 merge。
- **权限**：`ConfigController<T>` 同样受 `[EntityAuthorize]` 动作级拦截；若用户无 Update 权限，
  `ConfigView` 保存会 403，需按业务隐藏保存按钮（权限位数据仍须后端在菜单树/扩展字段下发，见 SKILL.md §4.10）。

## 6. 字典字段（枚举 / 值集）：配置页最容易漏的一条链路

> 实测环境：Cube **6.13.2026.802**（2026-10-22）。跨版本请先按 §6.5 抓一次 `GetFields` 复核。

### 6.1 现象与根因（**两条叠加**，只修一条都不见效）

现象：配置页里「反向工程 / 日志等级 / Cookie 模式」这类字段，界面显示 `2`、`-1` 这样的裸数字。

| # | 根因 | 证据 |
|---|------|------|
| 1 | **后端不下发字典**：`ConfigController<T>.GetFields` 走 `ObjectController.GetMembers()` 反射属性，只填 `Name/DisplayName/Description/Type/Category`，**不设 `DataSource`，也不设 `LovCode`** | 实测 Admin/Cube 82 字段、Admin/Xcode 23、Admin/Core 15 —— **0 个**字段带 `dataSource`/`lovCode` |
| 2 | **前端不接字典通道**：`ConfigView.toOptions()` 只认 `dataSource` **数组** + `map` 对象，既不调 `useLookups` 也不调 `useLov`；而框架 `DataField` 的 `dataSource` 真实形态是 **`{值:标签}` 对象** | `selectFormControl` 判为 select 但选项为空 → `t-select` 露出裸数值；`Int32` 语义字段直接渲染 number 输入框 |

注意：实体页（GetPage 驱动）不受影响 —— 那条链路后端 `SetLov` 会下发 `lovCode`，前端 `useLov` 能消费。
**唯独 `ConfigController<T>` 这条支路没有任何字典出口**，因为它的字段来自反射而非 XCode 字段集合。

### 6.2 后端要补两件东西（详见 `cube-webapi-backend` §9.2）

1. **值集本身**：框架库枚举（`Migration`/`NameFormats`/`LogLevel`）无中文特性、不可改写，
   须在**项目自有命名空间**下定义同值同序的镜像枚举（成员用 `[Description("中文")]`）；
   由 `AddCubeLov(o => o.ScanNamespace("你的命名空间"))` 注册为 `Enum.{命名空间}.{枚举名}` 值集。
2. **字段 → lovCode 映射端点**：框架控制器不可继承改写，故项目侧加一个只读端点，约定
   `GET /api/Sys/ConfigDict/FieldLovs?area=&controller=` → `{ 字段名: lovCode }`。

### 6.3 前端四步（`assets` 模板已内置，无需重写）

```
loadMeta()        → GET /{area}/{controller}/GetFields?kind=EditForm
loadFieldLovs()   → GET /Sys/ConfigDict/FieldLovs?area=&controller=  → 给 metaFields 补 lovCode
loadLov(fields)   → GET /Admin/Lov/Meta?lovCode=...                 → 拿中文标签（useLov）
optionsOf(f)      → 内联 dataSource/map 优先，其次 lovCode；再 alignOptions 值域对齐
```

顺序不能颠倒：**补 lovCode 必须在 `loadLov` 之前**（`useLov.load` 只收集字段上已有的 `lovCode`）。

### 6.4 三个必踩的坑

1. **`selectFormControl` 不看 `lovCode`** —— 它的判定链只有 `itemType → Boolean → 映射字段 → xxxId → 枚举类型 → map/dataSource → 基础类型`。
   因此 `Int32` 语义字段（如 `SecurityMode`）即便补了 lovCode 仍被判成 `number`。
   **解法**：`renderFields` 里凡 `optionsOf(f)` 有选项就把控件提升为 `select`（`switch` 除外）。
2. **值域必须对齐，且枚举字段也要对齐** —— 值集 `value` 恒为**字符串**（`"0"`/`"255"`/`"-1"`），
   而配置对象里枚举与 `Int32` 属性反序列化后都是 **number**。`t-select` 按值严格匹配，类型不一致就选不中 → 仍显示数字。
   `alignOptions` 的判据要写成 **`数值型 typeName` ‖ `isEnumType(f)`**；只写前者时，枚举字段（`Migration`/`LogLevel`）会继续显示 `2`（实测踩过）。
3. **映射端点的字典键会被 camelCase 化** —— `System.Text.Json` 的命名策略作用于**字典键**（`SecurityMode` → `securityMode`）。
   前端必须**大小写不敏感**匹配字段名，否则恒取不到（`getApi` 的规范化也不救字典键）。

### 6.5 验收方法（两步，缺一不可）

```bash
# ① 后端：逐字段看有没有 dataSource/lovCode（先用 admin 登录拿 JWT）
curl -s "http://127.0.0.1:PORT/api/Admin/Xcode/GetFields?kind=EditForm" -H "Authorization: Bearer $T"
curl -s "http://127.0.0.1:PORT/api/Sys/ConfigDict/FieldLovs?area=Admin&controller=Xcode"
curl -s "http://127.0.0.1:PORT/api/Admin/Lov/Meta?lovCode=Enum.你的命名空间.Migration"
```

```js
// ② 浏览器：断言控件类型与显示文案（CDP，读 .t-form__item，别只看接口）
Array.from(document.querySelectorAll('.t-form__item')).map(it => ({
  lab: it.querySelector('label')?.innerText.trim(),
  isSelect: !!it.querySelector('.t-select'),
  val: it.querySelector('input')?.value,
})).filter(x => x.isSelect);
// 期望：{ lab:'反向工程', isSelect:true, val:'增量迁移' }
```

⚠️ 配置页常按 `category` 分组渲染 **tab**，未激活 tab 的字段不在 DOM 里 —— 断言前先点开对应 tab，否则会误判「该字段没有下拉」。
