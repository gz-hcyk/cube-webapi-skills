<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
// 统一 HTTP 层：全部走 @/api/http（Bearer + assets_token），禁止再引入 api.ts
import { getApi, getRaw } from '@/api/http'

/**
 * 仪表盘：模块清单**全部来自后端菜单树**（铁律 M1，禁止前端硬编码业务模块）。
 * 记录数按区按需拉取：业务区（Asset）显示条数，系统区只作入口（避免首屏几十个请求）。
 */
const router = useRouter()

interface Card {
  area: string
  controller: string
  title: string
  /** entity=实体控制器（有 CRUD，可统计条数）；action=动作控制器（Mobile/Import/Report 等，无实体列表） */
  kind: 'entity' | 'action'
  count: number | null
  loading: boolean
}
interface Group {
  key: string
  title: string
  withCount: boolean
  cards: Card[]
}

const groups = ref<Group[]>([])
const recentLogs = ref<any[]>([])
const logsLoading = ref(false)

function parseUrl(url?: string): { area: string; controller: string } | null {
  const u = String(url || '').trim()
  if (!u || u === '~' || u.startsWith('~/')) return null // 认证区为框架内置，无实体列表
  const parts = u.replace(/^\/+/, '').replace(/^api\//i, '').split('/').filter(Boolean)
  if (parts.length < 2) return null
  return { area: parts[0], controller: parts[1] }
}

/**
 * 区分实体控制器与动作控制器（后端**不直接下发**该标志，由菜单节点权限位推断）。
 * 实体控制器带标准 CRUD 权限位 2=添加 / 4=修改 / 8=删除；
 * 动作控制器（Mobile 快捷发料、Import 确认导入、Report 报表）只有 1=查看 + 各自的业务位。
 * 实证：26 个 Asset 实体全部含 2/4/8；Mobile=[1,64]、Import=[1,16]、Report=[1] 均不含。
 * 依据此规则可避免对动作控制器发起必然 404 的 GetPage 请求。
 */
function kindOf(node: any): 'entity' | 'action' {
  const bits = new Set(Object.keys(node?.permissions || {}).map((k) => Number(k)))
  return bits.has(2) && bits.has(4) && bits.has(8) ? 'entity' : 'action'
}

async function loadMenu() {
  const env: any = await getRaw<any[]>('/api/Admin/Index/GetMenuTree')
  const roots = Array.isArray(env?.data) ? env.data : []
  const out: Group[] = []
  for (const r of roots) {
    const cards: Card[] = []
    for (const c of r.children || []) {
      const p = parseUrl(c.url)
      if (!p) continue
      cards.push({
        ...p,
        title: c.displayName || c.name || p.controller,
        kind: kindOf(c),
        count: null,
        loading: true,
      })
    }
    if (!cards.length) continue
    out.push({
      key: r.name || String(out.length),
      title: r.displayName || r.name || '',
      // 业务区显示记录数；系统区只作入口
      withCount: /^asset$/i.test(r.name || '') || /低值易耗/.test(r.displayName || ''),
      cards,
    })
  }
  groups.value = out
}

async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0
  const run = async () => {
    while (i < items.length) {
      const cur = items[i++]
      await fn(cur)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
}

async function loadCounts() {
  // 只对实体控制器取数：动作控制器无 Index 端点，请求必然 404（噪声）。
  const targets = groups.value
    .filter((g) => g.withCount)
    .flatMap((g) => g.cards)
    .filter((c) => c.kind === 'entity')
  // 动作控制器不取数，直接结束 loading
  for (const g of groups.value) {
    for (const c of g.cards) if (c.kind !== 'entity') c.loading = false
  }
  await pool(targets, 5, async (c) => {
    try {
      const env: any = await getApi(`/api/${c.area}/${c.controller}`, { pageIndex: 1, pageSize: 1 })
      c.count = Number(env?.page?.totalCount ?? 0)
    } catch {
      c.count = -1
    } finally {
      c.loading = false
    }
  })
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const env: any = await getApi('/api/Admin/Log', { pageIndex: 1, pageSize: 10 })
    recentLogs.value = Array.isArray(env?.data) ? env.data : []
  } catch {
    recentLogs.value = []
  } finally {
    logsLoading.value = false
  }
}

function go(area: string, controller: string) {
  router.push(`/entity/${area}/${controller}`)
}

const logColumns = [
  { colKey: 'category', title: '类别' },
  { colKey: 'action', title: '操作' },
  { colKey: 'userName', title: '用户' },
  { colKey: 'createTime', title: '时间' },
]
function cellOf(row: any, key: string): string {
  const v = row?.[key] ?? row?.[key.toLowerCase()]
  return v == null ? '-' : String(v)
}

onMounted(async () => {
  await loadMenu()
  loadCounts()
  loadLogs()
})
</script>

<template>
  <div class="dash">
    <div class="dash-head">
      <div>
        <h2 class="dash-title">系统仪表盘</h2>
        <p class="dash-sub">模块清单与名称均来自后端菜单树，前端不硬编码</p>
      </div>
    </div>

    <template v-for="g in groups" :key="g.key">
      <h3 class="dash-group">{{ g.title }}</h3>
      <div class="stat-grid">
        <div v-for="s in g.cards" :key="`${s.area}/${s.controller}`" class="stat-card" @click="go(s.area, s.controller)">
          <div class="stat-label">{{ s.title }}</div>
          <div class="stat-value">
            <template v-if="g.withCount && s.kind === 'entity'">
              <t-loading v-if="s.loading" size="small" />
              <span v-else-if="s.count == null || s.count < 0" class="stat-err">N/A</span>
              <span v-else>{{ s.count }}</span>
            </template>
            <span v-else class="stat-lite">进入 →</span>
          </div>
          <div class="stat-path">{{ s.area }}/{{ s.controller }}</div>
        </div>
      </div>
    </template>

    <h3 class="dash-group">近期审计日志</h3>
    <t-loading v-if="logsLoading" />
    <t-table v-else :data="recentLogs" :columns="logColumns" row-key="id" size="small">
      <template #category="{ row }"><span>{{ cellOf(row, 'category') }}</span></template>
      <template #action="{ row }"><span>{{ cellOf(row, 'action') }}</span></template>
      <template #userName="{ row }"><span>{{ cellOf(row, 'userName') }}</span></template>
      <template #createTime="{ row }"><span>{{ cellOf(row, 'createTime') }}</span></template>
      <template #empty>
        <span>暂无审计日志</span>
      </template>
    </t-table>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dash-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.dash-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.dash-sub {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}
.dash-group {
  margin: 18px 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
}
.stat-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  border-color: var(--td-brand-color, #2b6cff);
}
.stat-label {
  font-size: 13px;
  color: #6b7280;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin: 6px 0 4px;
  color: #111827;
  min-height: 32px;
  display: flex;
  align-items: center;
}
.stat-lite {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-brand-color, #2b6cff);
}
.stat-err {
  font-size: 16px;
  color: #9ca3af;
}
.stat-path {
  font-size: 11px;
  color: #9ca3af;
  font-family: monospace;
}
</style>
