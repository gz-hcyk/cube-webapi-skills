/**
 * 菜单归一化（铁律 E4 的唯一实现处）
 * 落位：src/utils/menu.ts
 *
 * 后端 GET /api/Admin/Index/GetMenuTree 是菜单的唯一权威：
 *  - 前端不 push 菜单项、不硬编码业务入口；
 *  - 后端 url 可能是 /Admin/User、/Admin/User/Index、/api/Admin/User，统一归一成 /Admin/User；
 *  - 一级菜单若无 icon，按名称关键词补一个（视觉锚点不能空）。
 */
import * as ElIcons from '@element-plus/icons-vue';

export interface MenuNode {
  id: string | number;
  parentID?: string | number | null;
  parentId?: string | number | null;
  name?: string;
  displayName?: string;
  title?: string;
  url?: string;
  icon?: string | null;
  sort?: number;
  children?: MenuNode[];
  [key: string]: any;
}

function pickTitle(n: MenuNode): string {
  return String(n.displayName || n.title || n.name || '未命名');
}

function normalizeNode(n: MenuNode): MenuNode {
  const parentID = n.parentID ?? n.parentId ?? null;
  return {
    ...n,
    parentID,
    displayName: pickTitle(n),
    icon: n.icon ?? null,
    children: Array.isArray(n.children) ? n.children.map(normalizeNode) : [],
  };
}

/** 拉平：树 / 扁平行（按 parentID 组装）两种后端形态都能吃 */
export function normalizeMenus(input: MenuNode[] | null | undefined): MenuNode[] {
  const list = (input ?? []).filter(Boolean).map(normalizeNode);
  if (!list.length) return [];

  let tree: MenuNode[];
  const hasNested = list.some((n) => (n.children?.length ?? 0) > 0);

  if (hasNested) {
    tree = list;
  } else {
    const byId = new Map<string, MenuNode>();
    list.forEach((n) => byId.set(String(n.id), { ...n, children: [] }));
    tree = [];
    for (const node of byId.values()) {
      const pid = node.parentID;
      const parent = pid === null || pid === undefined || pid === '' ? null : byId.get(String(pid));
      if (parent && String(parent.id) !== String(node.id)) parent.children!.push(node);
      else tree.push(node);
    }
  }

  const sortTree = (nodes: MenuNode[]) => {
    nodes.sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || Number(a.id) - Number(b.id));
    nodes.forEach((n) => {
      if (n.children?.length) sortTree(n.children);
      else delete n.children; // 空 children 会让 el-sub-menu 显示一个可展开的空组
    });
  };
  sortTree(tree);
  return tree;
}

/** 后端 url → 前端路由（只做归一化，不产生新菜单） */
export function menuPath(node: MenuNode): string {
  let url = String(node.url || '').trim();
  if (!url) return '';
  url = url.replace(/^https?:\/\/[^/]+/i, '');
  url = url.replace(/^\/api\//i, '/');
  // noUncheckedIndexedAccess 下 split()[0] / parts[2] 可能是 undefined，先收窄再调用
  const query = url.split('?')[0] ?? '';
  const hashless = query.split('#')[0] ?? '';
  const clean = hashless.replace(/\/+$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length) return '';
  // /Admin/User/Index → /Admin/User（Index 是默认动作，不单独成页）
  const action = parts[2];
  if (action && ['index', 'list'].includes(action.toLowerCase())) {
    return '/' + parts.slice(0, 2).join('/');
  }
  return '/' + parts.join('/');
}

const ICON_RULES: [RegExp, string][] = [
  [/user|member|account|person|staff|用户|会员|员工|人员/i, 'User'],
  [/role|permission|auth|角色|权限|授权/i, 'Lock'],
  [/dept|department|org|group|部门|组织|机构/i, 'OfficeBuilding'],
  [/menu|nav|菜单|导航/i, 'Menu'],
  [/log|audit|日志|审计|记录/i, 'Document'],
  [/config|setting|param|设置|配置|参数/i, 'Setting'],
  [/dashboard|home|workbench|首页|工作台|概览/i, 'Odometer'],
  [/report|chart|stat|报表|统计|分析|图表/i, 'TrendCharts'],
  [/file|attach|doc|文件|附件|文档/i, 'Folder'],
  [/device|equipment|asset|设备|资产|终端/i, 'Monitor'],
  [/order|trade|bill|订单|交易|单据/i, 'Tickets'],
  [/msg|message|notice|消息|通知|公告/i, 'ChatDotRound'],
  [/area|region|校区|地区|区域/i, 'MapLocation'],
  [/data|db|数据|字典/i, 'Coin'],
  [/task|job|schedule|任务|调度|计划/i, 'AlarmClock'],
];

function toPascal(name: string): string {
  return name.replace(/[-_\s]/g, '').replace(/^./, (c) => c.toUpperCase());
}

/** 一级菜单必须有权重图标：后端没给就按语义推断，推不出用 Menu 兜底 */
export function resolveIcon(node: MenuNode): string {
  const raw = String(node.icon || '').trim();
  if (raw) {
    const candidate = toPascal(raw.replace(/^[a-z]+[-_]icon[-_]?/i, ''));
    if ((ElIcons as unknown as Record<string, unknown>)[candidate]) return candidate;
  }
  const text = `${node.name ?? ''} ${node.displayName ?? ''} ${node.url ?? ''}`;
  for (const [re, icon] of ICON_RULES) {
    if (re.test(text)) return icon;
  }
  return 'Menu';
}

/** 所有叶子节点（工作台快捷入口用） */
export function flattenLeaves(nodes: MenuNode[], out: MenuNode[] = []): MenuNode[] {
  for (const n of nodes) {
    if (n.children?.length) flattenLeaves(n.children, out);
    else out.push(n);
  }
  return out;
}

/** 深度查找节点（面包屑用） */
export function findTrail(nodes: MenuNode[], predicate: (n: MenuNode) => boolean, trail: MenuNode[] = []): MenuNode[] {
  for (const n of nodes) {
    const next = [...trail, n];
    if (predicate(n)) return next;
    if (n.children?.length) {
      const hit = findTrail(n.children, predicate, next);
      if (hit.length) return hit;
    }
  }
  return [];
}

export function countMenus(nodes: MenuNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + (n.children?.length ? countMenus(n.children) : 0), 0);
}
