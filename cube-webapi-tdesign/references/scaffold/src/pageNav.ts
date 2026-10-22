/**
 * 内置功能页的「页内导航」声明 —— 对齐 MVC 版 `_User_Nav.cshtml` / `_Object_Nav.cshtml`。
 * 落地为 src/pageNav.ts，由 `components/cube/PageNav.vue` 渲染。
 *
 * ## 为什么是「导航」而不是「tab 面板」
 * MVC 版把用户中心的 4 个子功能做成**平级动作页**，靠 `_User_Nav` 在每页顶部串联
 * （详见 references/mvc-page-organization.md §一.1）。前端只有一个 `/account` 路由承载
 * 这些子功能，因此导航项的语义分两种：
 *   - `tab`  ：切换 `/account` 页内的内容分区（基础信息 / 修改密码 / 第三方授权 / 租户信息）；
 *   - `link` ：跳到对应的实体页（关联账号 / 令牌 / OAuth 日志 / 日志 / 通知记录）。
 * 二者在视觉上是同一条导航，用户感知与 MVC 版一致。
 *
 * ## 权限收敛（照抄 MVC 的口径）
 * `_User_Nav` 对非系统角色只允许看本人：`if (!user.Roles.Any(e => e.IsSystem)) userId = currentId;`
 * 这里用 `isSystem` 参数表达同一规则，避免经 `?userId=` 深链窥探他人。
 */

/** 导航项 */
export interface PageNavItem {
  /** 稳定标识（tab 项即分区 key；link 项可任意） */
  key: string;
  label: string;
  /** TDesign 图标名（如 'user'、'lock-on'、'link'） */
  icon?: string;
  /** 语义：切换页内分区 / 跳转路由 */
  kind?: 'tab' | 'link';
  /** kind='link' 时的目标路由（含 query） */
  to?: string;
  /** 子项（渲染为下拉，对齐 `_Object_Nav` 的「更多设置」） */
  children?: PageNavItem[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否为当前项（高亮）；不传则由组件按路由自动判定 */
  active?: boolean;
}

/** 用户中心页内导航的生成参数 */
export interface UserCenterNavOptions {
  /** 目标用户主键；缺省为当前登录用户 */
  userId?: number | string;
  /** 是否查看本人（决定「基础信息 / 修改密码 / 第三方授权 / 租户信息」四项是否出现） */
  isSelf?: boolean;
  /** 当前用户是否系统角色（非系统角色只能看本人，与 MVC 一致） */
  isSystem?: boolean;
}

/**
 * 用户中心导航（复刻 `_User_Nav.cshtml`）。
 * 顺序与 MVC 版一致：本人四项 → 用户详情 → 关联账号 → 令牌 → OAuth 日志 → 日志 → 通知记录。
 */
export function userCenterNav(opts: UserCenterNavOptions = {}): PageNavItem[] {
  const isSelf = opts.isSelf !== false;
  const userId = opts.userId ?? '';
  const q = userId === '' ? '' : `?userId=${encodeURIComponent(String(userId))}`;
  const items: PageNavItem[] = [];

  if (isSelf) {
    items.push(
      { key: 'basic', label: '基础信息', icon: 'user', kind: 'tab' },
      { key: 'password', label: '修改密码', icon: 'lock-on', kind: 'tab' },
      { key: 'binds', label: '第三方授权', icon: 'link', kind: 'tab' },
      { key: 'tenant', label: '租户信息', icon: 'building', kind: 'tab' },
    );
  }
  if (!isSelf) {
    items.push({ key: 'detail', label: '用户详情', icon: 'browse', kind: 'link', to: `/entity/Admin/User${q}` });
  }
  items.push(
    { key: 'connects', label: '关联账号', icon: 'link', kind: 'link', to: `/entity/Admin/UserConnect${q}` },
    { key: 'tokens', label: '令牌', icon: 'ticket', kind: 'link', to: `/entity/Admin/UserToken${q}` },
    { key: 'oauth-log', label: 'OAuth 日志', icon: 'history', kind: 'link', to: `/entity/Admin/OAuthLog${q}` },
    { key: 'logs', label: '日志', icon: 'list', kind: 'link', to: `/entity/Admin/Log${q}` },
  );
  return items;
}

/**
 * 系统设置导航（复刻 `_Object_Nav.cshtml`）。
 * 5 个配置控制器平铺；SmsConfig / MailConfig / OAuthConfig / AccessRule 收进「更多设置」下拉。
 * ⚠️ 键必须是 `area/controller`；这四个是**实体控制器**（GetPage 200），跳实体页而非配置页
 *    —— 见 references/cube-page-catalog.md §六的实测结论。
 */
export function settingsNav(currentPath = ''): PageNavItem[] {
  const hit = (to?: string) => !!to && !!currentPath && currentPath.toLowerCase() === to.toLowerCase();
  const items: PageNavItem[] = [
    { key: 'core', label: '基本设置', kind: 'link', to: '/entity/Admin/Core' },
    { key: 'sys', label: '系统设置', kind: 'link', to: '/entity/Admin/Sys' },
    { key: 'star', label: '星尘设置', kind: 'link', to: '/entity/Admin/Star' },
    { key: 'xcode', label: '数据中间件', kind: 'link', to: '/entity/Admin/XCode' },
    { key: 'cube', label: '魔方设置', kind: 'link', to: '/entity/Admin/Cube' },
    {
      key: 'more',
      label: '更多设置',
      children: [
        { key: 'sms', label: '短信设置', kind: 'link', to: '/entity/Admin/SmsConfig' },
        { key: 'mail', label: '邮件设置', kind: 'link', to: '/entity/Admin/MailConfig' },
        { key: 'oauth', label: 'OAuth 设置', kind: 'link', to: '/entity/Admin/OAuthConfig' },
        { key: 'access', label: '访问规则', kind: 'link', to: '/entity/Admin/AccessRule' },
      ],
    },
  ];
  for (const it of items) {
    it.active = hit(it.to);
    if (it.children) {
      for (const c of it.children) c.active = hit(c.to);
      // 任一子项命中 → 父项也高亮（对齐 MVC 版：下拉里当前项高亮，父项保持可读）
      if (it.children.some((c) => c.active)) it.active = true;
    }
  }
  return items;
}
