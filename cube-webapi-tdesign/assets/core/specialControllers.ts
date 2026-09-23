/**
 * 非实体（专用）控制器注册表 —— 页面分发的单一依据。
 *
 * ## 为什么需要它
 * NewLife.Cube 的控制器分三类，**只有实体控制器有 `GetPage`**（才能驱动通用 `ListPage`）：
 *   1) 实体控制器 `EntityController<T>` / `ReadOnlyEntityController<T>` / `EntityTreeController<T>`
 *      → 有 `GetPage` → 走 `ListPage`（通用列表 / 表单 / 详情），**无需登记**；
 *   2) 配置控制器 `ConfigController<T>` → **无 `GetPage`**，只有 `Get` 单对象 + `Update`
 *      → 走 `ConfigView`（单表单页）；
 *   3) 工具型控制器（`ControllerBaseX` 派生或自定义端点，如 Db / File / Index / Widget）
 *      → **无 `GetPage`** → 各自专属页。
 *
 * 第 2、3 类若误进 `ListPage`，会因拉不到 schema 而**空白或只剩操作列**（静默失败），
 * 故必须在此**显式策划**。
 *
 * ## 关键约定
 * 1) **键 = `area/controller`**（不是裸 controller 名）——避免跨区重名碰撞。
 * 2) **命名不可靠，禁止启发式**：`*Config` / `Parameter` 多为实体控制器（有 GetPage，走 ListPage），
 *    真正的 `Config<T>` 反而不带 Config 名（Cube / Sys / Core / XCode）。故本表只能显式列。
 * 3) 未在此表且 `GetPage` 可用的，一律走 `ListPage`（新增实体零登记）。
 * 4) 新增专用页：加一条映射即可——**无需改路由、无需改 EntityPage**
 *    （`EntityPage` 对非 config/db 的 kind 统一走 `<Component :is="view">` 泛型分支）。
 *
 * ## 覆盖机制（按需自定义，对标 MVC 分部视图覆盖）
 * 三级，越靠后越强（详见 references/page-composition.md）：
 *   L1 配置：`setting.*`（后端 GetPage.setting 下发）+ 组件 props；
 *   L2 插槽：`ListPage` 的 `#navbar-extra` / `#search-extra` / `#toolbar-extra` / `#row-actions` /
 *            `#footer-extra`，`FormDialog` 的 `#form-extra`，`DetailDrawer` 的 `#detail-extra`；
 *   L3 整页：本表登记专用组件，或写 `src/pages/{Area}/{Controller}.vue` 薄页面直接组合各块。
 *
 * 权威接口清单以运行时 `GET /Cube/Apis` 为准（见 SKILL.md §4.12.2）；
 * 全量页面目录见 references/cube-page-catalog.md。
 */
import type { Component } from 'vue';
import ConfigView from '@/components/cube/ConfigView.vue';
import DbView from '@/components/cube/DbView.vue';
import FileView from '@/components/cube/FileView.vue';
import ServerInfoView from '@/components/cube/ServerInfoView.vue';
import WidgetBoardView from '@/components/cube/WidgetBoardView.vue';

export type SpecialKind = 'config' | 'db' | 'file' | 'server' | 'widget' | 'custom';

export interface SpecialDescriptor {
  /** 语义类型（用于选择内置分支；'custom' 时走泛型 view 分支） */
  kind: SpecialKind;
  /** 渲染组件 */
  view: Component;
  /** 说明：对应哪个框架控制器、为何单列（供排障与交接阅读，运行时不用） */
  note?: string;
  /** 可选：ConfigView 取元数据的 kind（默认 EditForm） */
  fieldsKind?: 'List' | 'Detail' | 'AddForm' | 'EditForm' | 'Search';
  /** 可选：覆盖加载端点（默认 /{area}/{controller}） */
  loadUrl?: string;
  /** 可选：覆盖保存端点（默认同 loadUrl） */
  saveUrl?: string;
  saveMethod?: 'POST' | 'PUT';
}

export const SPECIAL_CONTROLLERS: Record<string, SpecialDescriptor> = {
  /* ═══════════ ① ConfigController<T>：GetFields 元数据驱动单表单页（无 GetPage） ═══════════
   * 判据：框架里真正继承 ConfigController<T> 的**都不带 Config 后缀**
   * （Admin/Cube 系统设置、Admin/Sys 系统信息、Admin/Core 核心设置、Admin/XCode 数据层设置）。
   * ⚠️ 不要凭 `*Config` 命名把 MailConfig / SmsConfig / OAuthConfig 加到这里——
   *    它们是**实体控制器**（有 GetPage），走 ListPage 才对。
   */
  'Admin/Cube': { kind: 'config', view: ConfigView, note: 'Cube/系统设置（CubeSetting 单对象）' },
  'Admin/Sys': { kind: 'config', view: ConfigView, note: 'Sys 系统设置（SysSetting 单对象）' },
  'Admin/Core': { kind: 'config', view: ConfigView, note: 'Core 核心设置' },
  'Admin/XCode': { kind: 'config', view: ConfigView, note: 'XCode 数据层设置' },

  /* ═══════════ ② 工具型控制器：自定义端点，各自专属页 ═══════════ */
  'Admin/Db': {
    kind: 'db',
    view: DbView,
    note: 'DbController：GET /api/Admin/Db 返回连接列表（data 直接是数组）；Backup / Download 为动作端点',
  },
  'Admin/File': {
    kind: 'file',
    view: FileView,
    note: 'FileController：Index?path= 目录列表；Upload / Download / Delete / Compress / Decompress',
  },
  'Admin/Index': {
    kind: 'server',
    view: ServerInfoView,
    note: 'IndexController：Main 服务器信息 / MonitorData 监控轮询 / AssemblyList / ProcessList / ServerVarList / MemoryFree / Restart',
  },
  'Cube/Widget': {
    kind: 'widget',
    view: WidgetBoardView,
    note: 'WidgetController：Index 部件列表 + Enable + SaveGroupOrder / SaveGroupItemOrder（Parameter 全局配置）',
  },

  /* ═══════════ ③ 待核实候选（**不要凭命名直接启用**） ═══════════
   * 下列控制器已在官方 XML 文档中出现，但「是实体控制器还是 ConfigController」需以
   * 真实后端的 `GET /api/{area}/{controller}/GetPage` 是否 200 为准（判据见 SKILL.md §4.17）：
   *   · Admin/Star            星尘设置控制器 —— 疑为 Config<T>（若 GetPage 404 则启用下一行）
   *   · Admin/SmsConfig       短信配置       —— 疑为实体控制器（默认走 ListPage）
   *   · Admin/MailConfig      邮件配置       —— 疑为实体控制器（默认走 ListPage）
   *   · Admin/OAuthConfig     OAuth 配置     —— 疑为实体控制器（默认走 ListPage）
   *   · Cube/OrderManager     订单管理       —— 有 GetInfo 自定义端点，列表仍可能走 ListPage
   * 核实方法：对每个候选调用一次 GetPage，404 ⇒ 在该控制器段加 `{ kind:'config', view: ConfigView }`。
   *
   * 'Admin/Star': { kind: 'config', view: ConfigView, note: '待核实：GetPage 404 才启用' },
   */
};
