/**
 * 实体页「额外行操作」声明式配置表 —— **新增动作只加配置，不改组件**。
 * 落地为 src/entityActions.ts。
 *
 * ## 为什么需要它
 * 魔方的一批实体控制器在标准 CRUD 之外还有动作端点，官方 MVC 版是在列表行上挂
 * 「自定义按钮」（如用户行的「吊销令牌 / 清空密码」、在线用户行的「强制下线」、
 * 定时任务行的「立即执行」）。这类按钮**不属于 GetPage 元数据**，前端无从自动生成。
 * 历史做法是每个实体写一个薄页面覆盖 `#row-actions` 插槽 —— 每加一个动作就多一份
 * 页面代码，既费 token，又容易漏接 `reload`、漏写二次确认。
 *
 * 本表把这些动作收敿成**纯数据**：`ListPage` 内置渲染，命中 `area/controller` 即生效，
 * 未命中则零渲染、零影响。新增动作 = 追加一条对象。
 *
 * ## 契约纪律
 * 1) **键 = `area/controller`**（与 `specialControllers.ts` 同口径，防跨区重名碰撞）；
 * 2) `url` 相对 `http` 实例（baseURL 已含 `/api`），故只写 `/{area}/{controller}/{action}`，
 *    **不要再写 `/api`**（双重前缀 404，见 `api/http.ts` 文件头）；
 * 3) 参数默认 `{ id: row.id }`；后端用别的键（如 CronJob 的 `name`）时在 `params` 里显式给出；
 * 4) 破坏性动作**必须**写 `confirm`（文案里可用 `{name}` 取行显示名），否则误点即生效；
 * 5) 本表只登记**已确认存在**的端点（来源：`references/cube-page-catalog.md` §4.3/§4.6）。
 *    未实测的自定义端点请先用 `DataProbe` 确认，再追加。
 *
 * ## 与权限的关系
 * 后端 `GetPage.setting` 下发的按钮开关（`isReadOnly` 等）只控制「新增/编辑/删除」，
 * 对自定义动作不表意。故这里的动作默认全部可见，需要按 setting 收敛时用 `hideWhen`。
 */
/** 列表行数据（GetPage 返回的行对象，键为后端原样命名，故用宽松类型） */
export type Row = Record<string, any>;

/** 单条行操作的声明 */
export interface EntityAction {
  /** 稳定标识（同实体内唯一，仅用于 v-for key 与排障） */
  key: string;
  /** 按钮文案 */
  text: string;
  /** 链接主题色；破坏性动作用 danger，状态推进用 warning，只读查看用 default */
  theme?: 'default' | 'primary' | 'danger' | 'warning' | 'success';
  /** 二次确认文案，`{name}` 会被行显示名替换；缺省表示不确认（仅限非破坏性动作） */
  confirm?: string;
  /** 请求方法，默认 POST */
  method?: 'GET' | 'POST';
  /**
   * 请求地址（相对 http 实例）。客户端动作（`client` 非空）可省略。
   */
  url?: string;
  /** 查询参数构造器，默认 `{ id: row.id }` */
  params?: (row: Row) => Record<string, unknown>;
  /** 请求体（POST 时使用），可为静态值或按行构造 */
  body?: unknown | ((row: Row) => unknown);
  /** 成功提示文案，默认「操作成功」 */
  success?: string;
  /** 行级显隐（如「只对未激活用户显示」），缺省恒显示 */
  visible?: (row: Row) => boolean;
  /** 按 GetPage.setting 收敛显隐，返回 true 表示隐藏 */
  hideWhen?: (setting: Record<string, any>) => boolean;
  /**
   * 客户端动作（不发请求，由 `EntityActions.vue` 打开内置面板）。
   * 目前支持 `lov-config`：值集配置抽屉（Admin/Lov 行「配置」）。
   */
  client?: 'lov-config';
}

export const ENTITY_ACTIONS: Record<string, EntityAction[]> = {
  /* ═══════════ 组织与权限（Admin/User，见 cube-page-catalog §4.3） ═══════════ */
  'Admin/User': [
    {
      key: 'revoke-tokens',
      text: '吊销令牌',
      theme: 'warning',
      url: '/Admin/User/RevokeTokens',
      // POST /api/Admin/User/RevokeTokens?id=  → 该用户全部访问令牌立即失效
      confirm: '确定吊销「{name}」的全部访问令牌？该用户将立即下线，需要重新登录。',
      success: '已吊销该用户的全部令牌',
      // 已禁用的用户无令牌可吊销，按需收敛（enable 字段为魔方用户启用标志）
      visible: (row) => (row as any)?.enable !== false,
    },
    {
      key: 'clear-password',
      text: '清空密码',
      theme: 'danger',
      url: '/Admin/User/ClearPassword',
      // POST /api/Admin/User/ClearPassword?id=  → 清空后该用户无法用密码登录
      confirm: '确定清空「{name}」的登录密码？清空后该用户将无法用密码登录，只能通过验证码或管理员重置。',
      success: '密码已清空',
    },
  ],

  /* ═══════════ 在线会话（Admin/UserOnline） ═══════════ */
  'Admin/UserOnline': [
    {
      key: 'kick',
      text: '强制下线',
      theme: 'danger',
      url: '/Admin/UserOnline/Kick',
      // ★ 实测（6.15.2026.901）：`GET UserOnline/Kick(Int32 id)` —— 是 **GET**，不是 POST。
      //   写成 POST 会 405（前端提示「请求失败」，容易被误判为权限问题）。
      method: 'GET',
      confirm: '确定强制「{name}」下线？该会话的令牌将立即失效。',
      success: '已强制下线',
    },
  ],

  /* ═══════════ 定时任务（Cube/CronJob） ═══════════ */
  'Cube/CronJob': [
    {
      key: 'execute-now',
      text: '立即执行',
      theme: 'primary',
      url: '/Cube/CronJob/ExecuteNow',
      // ★ 实测（6.15.2026.901）：`POST CronJob/ExecuteNow(String id)` —— 形参名是 **id**（String），
      //   不是 name。传 name 会绑不到（id=null）→ 后端静默什么都不做。
      confirm: '确定立即执行任务「{name}」？该操作会在后台真实运行一次任务逻辑。',
      success: '已提交执行',
    },
  ],

  /* ═══════════ 值集（Admin/Lov）——客户端动作：打开配置抽屉 ═══════════
   * 值集配置有 4 张子表（枚举值 / 列表配置 / 搜索字段 / 表格列），需要独立面板承载，
   * 故登记为客户端动作，由 EntityActions 渲染 LovConfigDrawer，不发请求。
   * 端点（见 cube-page-catalog §4.5）：GET GetConfig?id= / POST SaveConfig。
   */
  'Admin/Lov': [
    {
      key: 'lov-config',
      text: '配置',
      theme: 'primary',
      client: 'lov-config',
    },
  ],
};

/** 取某实体的额外动作（无配置返回空数组，模板可直接 v-for） */
export function actionsOf(area: string, controller: string): EntityAction[] {
  return ENTITY_ACTIONS[`${area}/${controller}`] ?? [];
}
