/**
 * 动态菜单树（§4.12 GetMenuTree 契约的权威消费层）
 *
 * 后端 `GET /Admin/Index/GetMenuTree` 只返回当前用户有权限的节点，
 * 是框架自带模块清单的**唯一权威来源**（勿用固定候选清单探测，见技能 §七）。
 *
 * 真实 url 双格式：
 * - 业务区相对：`~/Sync`、`~/Class`（`~` = 区根，区名取自分组名 `.Areas.{Area}` 尾段）
 * - 系统区绝对：`/Admin/User`、`/Cube/App`
 * 归一化目标：全部映射为前端路由 `/entity/{area}/{controller}`，
 * 前端专属页面（/sync、/datasource 等）走 CUSTOM_PATHS 优先匹配。
 */
import {
  DashboardIcon,
  ServerIcon,
  SwapIcon,
  UsergroupIcon,
  UserIcon,
  ViewListIcon,
  ViewModuleIcon,
  SettingIcon,
  HistoryIcon,
  KeyIcon,
  ShopIcon,
  ControlPlatformIcon,
  MenuIcon,
  LockOnIcon,
  ChartIcon,
} from 'tdesign-icons-vue-next'
import type { Component } from 'vue'
import { getApi } from './http'

export interface MenuNode {
  /** 前端路由路径（t-menu-item 的 value） */
  path: string
  title: string
  icon: Component
  children?: MenuNode[]
}

interface RawMenuNode {
  id: number
  name: string
  displayName?: string
  url?: string
  icon?: string
  children?: RawMenuNode[]
}

/** 前端专属页面映射（后端是自定义 API 控制器，无 GetPage），优先于通用映射 */
const CUSTOM_PATHS: Record<string, string> = {
  '/Sync': '/sync',
  '/DataSourceConfig': '/datasource',
}

/**
 * 排除注册表（canonical `/Area/Ctrl`）：纯 WebApi 后端未实现的非实体控制器
 * （GetPage 404，属 MVC 版专属页面），隐藏菜单项并注明原因。
 * 若后端将来补齐 EntityController，从这里移除即可。
 * ⛔ 铁律 M1：禁止 FRONTEND_EXTRA 之类手工向菜单追加业务项——后端暂无节点的前端页，
 *    先补后端菜单节点再走归一化/CUSTOM_PATHS 映射，不在前端常量里造菜单。
 */
const EXCLUDED = new Set([
  '/WeCom/WeCom', // 区占位节点（无实体）
  '/WeCom/ExtAttr', // 非实体控制器（映射实体是 ExtAttrMapping）
  '/Admin/Cube', // 魔方设置聚合页（MVC）
  '/Admin/File', // 文件（MVC）
  '/Admin/Db', // 数据库（MVC）
  '/Admin/Core', // 基本设置聚合页（MVC）
  '/Admin/Index', // 后台首页（MVC）
  '/Admin/Sys', // 系统设置聚合页（MVC）
  '/Admin/XCode', // 数据中间件（MVC）
])

/** 后端 icon 名（Element 风格）→ TDesign 图标；未识别的用列表图标兜底 */
const ICON_MAP: Record<string, Component> = {
  User: UserIcon,
  UserFilled: UsergroupIcon,
  Avatar: UserIcon,
  Menu: MenuIcon,
  Timer: HistoryIcon,
  Clock: HistoryIcon,
  Tools: SettingIcon,
  Setting: SettingIcon,
  Operation: SettingIcon,
  DataBoard: ServerIcon,
  Monitor: ControlPlatformIcon,
  Odometer: ControlPlatformIcon,
  HomeFilled: DashboardIcon,
  Star: ShopIcon,
  Files: ViewModuleIcon,
  Document: ViewListIcon,
  DataLine: ChartIcon,
}

function iconOf(name?: string): Component {
  return (name && ICON_MAP[name]) || ViewListIcon
}

/** 从分组名 `WeComAddressBook.Areas.WeCom` 提取区名（尾段） */
function areaOfGroup(name: string): string {
  const seg = name.split('.')
  return seg[seg.length - 1] || name
}

/** url 归一化：返回前端路由；null = 分组节点/无 url/已排除。
 * 必须先判 `~` 前缀再剥：业务区 `~/Sync` 剥后是控制器名（相对），
 * 若误判为绝对路径会丢区名并导致排除表失配。 */
function normalizeUrl(url: string | undefined, defaultArea: string): string | null {
  if (!url) return null
  if (url === '~' || url === '~/') return null // 分组节点
  if (url.startsWith('~')) {
    const ctrl = url.slice(1) // '~/Sync' → '/Sync'
    if (CUSTOM_PATHS[ctrl]) return CUSTOM_PATHS[ctrl]
    const canonical = `/${defaultArea}${ctrl}` // → '/WeCom/Sync'
    if (EXCLUDED.has(canonical)) return null
    return `/entity${canonical}`
  }
  if (url.startsWith('/')) {
    if (EXCLUDED.has(url)) return null
    return `/entity${url}` // '/Admin/User' → '/entity/Admin/User'
  }
  return null
}

function mapChildren(nodes: RawMenuNode[], defaultArea: string): MenuNode[] {
  const out: MenuNode[] = []
  for (const n of nodes || []) {
    const path = normalizeUrl(n.url, defaultArea)
    if (!path) continue
    out.push({ path, title: n.displayName || n.name, icon: iconOf(n.icon) })
  }
  return out
}

/** 拉取并归一化菜单树；仪表盘置顶（铁律 M1：不追加任何前端手工业务项） */
export async function loadMenuTree(): Promise<MenuNode[]> {
  const env = await getApi('/Admin/Index/GetMenuTree')
  const roots: MenuNode[] = [{ path: '/dashboard', title: '系统仪表盘', icon: DashboardIcon }]
  for (const root of (env?.data as RawMenuNode[]) || []) {
    const area = areaOfGroup(root.name)
    const kids = mapChildren(root.children ?? [], area)
    if (kids.length === 1) {
      roots.push(kids[0]) // 单子项直接作为顶层菜单项
    } else if (kids.length > 1) {
      roots.push({ path: root.url || `/${root.name}`, title: root.displayName || root.name, icon: iconOf(root.icon), children: kids })
    }
  }
  return roots
}
