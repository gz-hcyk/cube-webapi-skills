import { ref } from 'vue'

/**
 * 菜单显示名注册表：`{area}/{controller}` → 后端 `GetMenuTree` 的 displayName。
 *
 * 铁律 M1：菜单与业务名称的**唯一权威**来自后端，前端不得硬编码。
 * 页面标题 / 面包屑一律查这张表，查不到才回落控制器名。
 */
const titles = ref<Record<string, string>>({})
const areaTitles = ref<Record<string, string>>({})

/** 后端 url 归一化为 `{area}/{controller}` 形态（绝对路径才可归一；`~/X` 无区名，跳过） */
function norm(url?: string): string {
  const u = String(url || '').trim()
  if (!u || u === '~' || u.startsWith('~/')) return ''
  return u.replace(/^\/+/, '').replace(/^api\//i, '').toLowerCase()
}

export function registerMenuTitles(roots: any[]): void {
  const m: Record<string, string> = { ...titles.value }
  const a: Record<string, string> = { ...areaTitles.value }
  for (const r of roots || []) {
    const ak = norm(r?.url).split('/')[0]
    if (ak) a[ak] = r.displayName || r.name || ak
    for (const c of r?.children || []) {
      const k = norm(c?.url)
      if (k) m[k] = c.displayName || c.name || k
    }
  }
  titles.value = m
  areaTitles.value = a
}

export function titleOf(area?: string, controller?: string): string {
  if (!area || !controller) return ''
  return titles.value[`${area}/${controller}`.toLowerCase()] || ''
}

export function areaTitleOf(area?: string): string {
  if (!area) return ''
  return areaTitles.value[String(area).toLowerCase()] || ''
}
