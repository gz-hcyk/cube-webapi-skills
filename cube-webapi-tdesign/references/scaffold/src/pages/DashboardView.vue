<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
// 统一 HTTP 层：全部走 @/api/http（Bearer + assets_token），禁止再引入 api.ts
import { getApi, getRaw } from '@/api/http'
// 个性化 store：仅用于「主题模式 / 品牌主色」变化时重绘图表的配色。
// ⚠️ 图表颜色不硬编码，一律读 <html> 上实时的 --td-* 令牌（见 cssVar），
//    因此本页不改动任何令牌，切换品牌色 / 暗黑模式时图表自动跟随。
import { useSettingStore } from '@/stores/setting'
import * as echarts from 'echarts'

/**
 * 仪表盘：对齐 TDesign Starter `dashboard/base` 版式
 * ------------------------------------------------------------
 * 版式四段（与 Starter 官方组件一一对应）：
 *   TopPanel      → 顶部 4 张 KPI 卡（首张为品牌主色反色卡）
 *   MiddleChart   → 左「各模块记录数 TOP10」柱状图 + 右「记录数区域占比」环形图
 *   RankList      → 左「实体模块记录数排名」+ 右「动作入口」
 *   OutputOverview→ 左「近期审计日志」+ 右「模块构成」汇总卡
 *
 * 数据仍**全部来自后端菜单树**（铁律 M1，禁止前端硬编码业务模块）。
 * 记录数按区按需拉取：业务区显示条数，系统区只作入口（避免首屏几十个请求）。
 */
const router = useRouter()
const setting = useSettingStore()

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
/** 审计日志总条数（KPI 用；与列表的「最近 10 条」分开取，仅取分页总数开销极小） */
const logsTotal = ref(0)

function parseUrl(url?: string): { area: string; controller: string } | null {
  const u = String(url || '').trim()
  if (!u || u === '~' || u.startsWith('~/')) return null // 认证区为框架内置，无实体列表
  const parts = u.replace(/^\/+/, '').replace(/^api\//i, '').split('/').filter(Boolean)
  if (parts.length < 2) return null
  return { area: parts[0], controller: parts[1] }
}

/**
 * 框架自带区：只作入口卡片，**不取记录数**（避免首屏几十个请求；业务区才关心条数）。
 * ⚠️ 此处**不得**写具体业务区名（如 `asset`）—— 那是上一项目的残留，换项目即失效。
 */
const FRAMEWORK_AREAS = new Set(['admin', 'cube', 'sys', 'core', 'xcode', 'log'])

/**
 * 铁律：父子表「子表不进菜单」（SKILL.md「父子表（主从表）前端只展现父表」）。
 * 凡 `*Line` / `*Item` 从表（订单明细、资产配件）只从父表详情内嵌区进入，**不列独立卡片**。
 * 与 `MenuSidebar.vue` 同一套判据；技能约定 GetMenuTree 落地「只有两处、均组件内联」。
 */
const CHILD_TABLE_RE = /(Line|Item)$/i
function isChildTableNode(n: any): boolean {
  const u = String(n?.url || '').trim()
  const parts = u.replace(/^\/+/, '').replace(/^api\//i, '').split('/').filter(Boolean)
  const name = parts.length ? parts[parts.length - 1] : String(n?.name || '')
  return CHILD_TABLE_RE.test(name.replace(/[?#].*$/, ''))
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
    // 铁律：子表（*Line/*Item）不进导航，卡片区同样不列
    for (const c of (r.children || []).filter((x: any) => !isChildTableNode(x))) {
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
      // 业务区显示记录数；框架区（Admin/Cube/…）只作入口
      withCount: !FRAMEWORK_AREAS.has(String(r.name || '').toLowerCase()),
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
      const env: any = await getApi(`/${c.area}/${c.controller}`, { pageIndex: 1, pageSize: 1 })
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
    const env: any = await getApi('/Admin/Log', { pageIndex: 1, pageSize: 10 })
    recentLogs.value = Array.isArray(env?.data) ? env.data : []
    logsTotal.value = Number(env?.page?.totalCount ?? recentLogs.value.length)
  } catch {
    recentLogs.value = []
    logsTotal.value = 0
  } finally {
    logsLoading.value = false
  }
}

function go(area: string, controller: string) {
  // ⚠️ 路由表注册的是 entity/:area/:controller（带 entity 前缀，见 router/index.ts）。
  // 此处若漏 /entity/ 前缀会落到 catch-all 重定向回 /dashboard，观感＝「进入链接点了没反应」。
  // 与 BasicLayout.onNavigate 保持同一形态。
  router.push(`/entity/${area}/${controller}`)
}

/* ---------------- 派生统计（全部由后端菜单树 + 记录数推导） ---------------- */
const allCards = computed(() => groups.value.flatMap((g) => g.cards))

/** 有记录数的实体模块（count>=0；-1 表示取数失败，不计入统计） */
const ranked = computed(() =>
  allCards.value
    .filter((c) => c.kind === 'entity' && typeof c.count === 'number' && c.count >= 0)
    .map((c) => ({ title: c.title, area: c.area, controller: c.controller, count: Number(c.count) }))
    .sort((a, b) => b.count - a.count),
)
const topModules = computed(() => ranked.value.slice(0, 10))
const actionCards = computed(() => allCards.value.filter((c) => c.kind === 'action'))
const entityTotal = computed(() => allCards.value.filter((c) => c.kind === 'entity').length)
const totalRecords = computed(() => ranked.value.reduce((s, c) => s + c.count, 0))
const businessAreas = computed(() => groups.value.filter((g) => g.withCount).length)

/** 各业务区记录数（供环形图） */
const areaStats = computed(() => {
  const out: { name: string; value: number }[] = []
  for (const g of groups.value) {
    if (!g.withCount) continue
    let sum = 0
    for (const c of g.cards) {
      if (c.kind === 'entity' && typeof c.count === 'number' && c.count >= 0) sum += c.count
    }
    if (sum > 0) out.push({ name: g.title, value: sum })
  }
  return out
})

/** TopPanel 四张 KPI 卡：全部由后端数据推导，无硬编码业务 */
const panelList = computed(() => [
  { title: '模块总数', number: String(allCards.value.length), unit: '个', icon: 'dashboard', main: true },
  { title: '实体记录总数', number: String(totalRecords.value), unit: '条', icon: 'root-list', main: false },
  { title: '业务区', number: String(businessAreas.value), unit: '个', icon: 'apartment', main: false },
  { title: '审计日志', number: String(logsTotal.value), unit: '条', icon: 'file', main: false },
])

/* ---------------- 图表（echarts，配色读实时令牌） ---------------- */
const barRef = ref<HTMLDivElement | null>(null)
const pieRef = ref<HTMLDivElement | null>(null)
let barChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

/**
 * 读取 <html> 上实时的 CSS 变量。
 * ⚠️ 品牌主色由 utils/color.ts 的 getBrandPalette 以 inline style 注入，
 *    因此这里永远拿到用户当选择的品牌色（默认政务蓝 #0f4c9e）——「不改令牌」且图表随主题联动。
 */
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** 环形图配色：沿用品牌色阶 + IoT 青辅助色阶，全部取自令牌 */
function chartPalette(): string[] {
  return [
    cssVar('--td-brand-color', '#0f4c9e'),
    cssVar('--cube-accent-cyan', '#0090d4'),
    cssVar('--td-brand-color-3', '#7b9dca'),
    cssVar('--cube-accent-cyan-4', '#7ecfec'),
    cssVar('--td-brand-color-6', '#0d4186'),
    cssVar('--cube-accent-cyan-6', '#1f9fd6'),
    cssVar('--td-warning-color', '#e37318'),
    cssVar('--td-success-color', '#2ba471'),
  ]
}

function renderCharts() {
  const brand = cssVar('--td-brand-color', '#0f4c9e')
  const textColor = cssVar('--td-text-color-primary', 'rgba(0, 0, 0, 0.9)')
  const axisLine = cssVar('--td-component-border', '#dcdcdc')
  const splitLine = cssVar('--td-component-stroke', '#e7e7e7')

  // 柱状图：各模块记录数 TOP10
  if (barRef.value) {
    if (!barChart) barChart = echarts.init(barRef.value)
    const names = topModules.value.map((c) => c.title)
    const vals = topModules.value.map((c) => c.count)
    barChart.setOption(
      {
        color: [brand],
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        xAxis: {
          type: 'category',
          data: names,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: axisLine } },
          axisLabel: { color: textColor, interval: 0, rotate: names.length > 6 ? 30 : 0, fontSize: 12 },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: textColor, fontSize: 12 },
          splitLine: { lineStyle: { color: splitLine, type: 'dashed' } },
        },
        series: [{ type: 'bar', data: vals, barMaxWidth: 28, itemStyle: { color: brand, borderRadius: [4, 4, 0, 0] } }],
      },
      true,
    )
    barChart.resize()
  }

  // 环形图：记录数区域占比
  if (pieRef.value) {
    if (!pieChart) pieChart = echarts.init(pieRef.value)
    pieChart.setOption(
      {
        color: chartPalette(),
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: {
          bottom: 0,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: textColor, fontSize: 12 },
        },
        series: [
          {
            type: 'pie',
            radius: ['45%', '68%'],
            center: ['50%', '44%'],
            data: areaStats.value,
            label: { show: false },
            itemStyle: { borderColor: cssVar('--td-bg-color-container', '#ffffff'), borderWidth: 2 },
          },
        ],
      },
      true,
    )
    pieChart.resize()
  }
}

function onResize() {
  barChart?.resize()
  pieChart?.resize()
}

// 记录数是异步拉取的：数据到位后重绘（含首次为空时的占位）
watch([topModules, areaStats], () => nextTick(renderCharts), { deep: true })
// 主题模式 / 品牌主色变化 → 用新令牌色重绘（不 dispose，setOption 覆盖即可）
watch([() => setting.mode, () => setting.brandColor], () => nextTick(renderCharts))

const rankColumns = [
  { colKey: 'index', title: '排名', width: 64, align: 'center' as const },
  { colKey: 'title', title: '模块', minWidth: 120 },
  { colKey: 'area', title: '区域', width: 110 },
  { colKey: 'count', title: '记录数', width: 90, align: 'right' as const },
  { colKey: 'operation', title: '操作', width: 80, align: 'center' as const },
]
const actionColumns = [
  { colKey: 'title', title: '入口', minWidth: 140 },
  { colKey: 'area', title: '区域', width: 110 },
  { colKey: 'operation', title: '操作', width: 80, align: 'center' as const },
]
const logColumns = [
  { colKey: 'category', title: '类别', width: 110 },
  { colKey: 'action', title: '操作', minWidth: 120 },
  { colKey: 'userName', title: '用户', width: 110 },
  { colKey: 'createTime', title: '时间', width: 180 },
]

function rankClass(idx: number) {
  return ['dash-rank__cell', { 'dash-rank__cell--top': idx < 3 }]
}

function cellOf(row: any, key: string): string {
  const v = row?.[key] ?? row?.[key.toLowerCase()]
  return v == null ? '-' : String(v)
}

onMounted(async () => {
  window.addEventListener('resize', onResize, false)
  await loadMenu()
  await Promise.all([loadCounts(), loadLogs()])
  await nextTick()
  renderCharts()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize, false)
  barChart?.dispose()
  pieChart?.dispose()
  barChart = null
  pieChart = null
})
</script>

<template>
  <div class="dash">
    <!-- ===== TopPanel：顶部 KPI 卡（首张品牌反色） ===== -->
    <t-row :gutter="[16, 16]">
      <t-col v-for="(item, index) in panelList" :key="item.title" :xs="6" :xl="3">
        <t-card
          :bordered="false"
          :title="item.title"
          :class="{ 'dash-item': true, 'dash-item--main': index === 0 }"
          :style="{ height: '168px' }"
        >
          <div class="dash-item-top">
            <span>{{ item.number }}</span>
            <small>{{ item.unit }}</small>
          </div>
          <div class="dash-item-left">
            <span><t-icon :name="item.icon" /></span>
          </div>
          <template #footer>
            <div class="dash-item-bottom">
              <div class="dash-item-block">数据来源 · 后端菜单树</div>
              <t-icon name="chevron-right" />
            </div>
          </template>
        </t-card>
      </t-col>
    </t-row>

    <!-- ===== MiddleChart：柱状图 + 环形图 ===== -->
    <t-row :gutter="[16, 16]" class="row-container">
      <t-col :xs="12" :xl="9">
        <t-card title="各模块记录数 TOP10" :bordered="false" class="dash-chart-card">
          <div ref="barRef" class="dash-chart"></div>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="3">
        <t-card title="记录数区域占比" :bordered="false" class="dash-chart-card">
          <div ref="pieRef" class="dash-chart"></div>
        </t-card>
      </t-col>
    </t-row>

    <!-- ===== RankList：实体模块排名 + 动作入口 ===== -->
    <t-row :gutter="[16, 16]" class="row-container">
      <t-col :xs="12" :xl="6">
        <t-card title="实体模块记录数排名" :bordered="false" class="dash-rank-card">
          <t-table :data="topModules" :columns="rankColumns" row-key="title" size="small">
            <template #index="{ rowIndex }">
              <span :class="rankClass(rowIndex)">{{ rowIndex + 1 }}</span>
            </template>
            <template #count="{ row }"><b>{{ row.count }}</b></template>
            <template #operation="{ row }">
              <t-link theme="primary" hover="color" @click="go(row.area, row.controller)">进入</t-link>
            </template>
            <template #empty><span>暂无记录（菜单树未返回实体模块）</span></template>
          </t-table>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="6">
        <t-card title="动作入口" :bordered="false" class="dash-rank-card">
          <t-table :data="actionCards" :columns="actionColumns" row-key="title" size="small">
            <template #operation="{ row }">
              <t-link theme="primary" hover="color" @click="go(row.area, row.controller)">进入</t-link>
            </template>
            <template #empty><span>暂无动作入口</span></template>
          </t-table>
        </t-card>
      </t-col>
    </t-row>

    <!-- ===== OutputOverview：近期审计日志 + 模块构成 ===== -->
    <t-row :gutter="[16, 16]" class="row-container">
      <t-col :xs="12" :xl="9">
        <t-card title="近期审计日志" subtitle="(最近 10 条)" :bordered="false" class="dash-overview-card">
          <t-table :data="recentLogs" :columns="logColumns" row-key="id" size="small" :loading="logsLoading">
            <template #category="{ row }"><span>{{ cellOf(row, 'category') }}</span></template>
            <template #action="{ row }"><span>{{ cellOf(row, 'action') }}</span></template>
            <template #userName="{ row }"><span>{{ cellOf(row, 'userName') }}</span></template>
            <template #createTime="{ row }"><span>{{ cellOf(row, 'createTime') }}</span></template>
            <template #empty><span>暂无审计日志</span></template>
          </t-table>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="3">
        <t-card :bordered="false" class="dash-overview-card">
          <t-row>
            <t-col :xs="6" :xl="12">
              <t-card :bordered="false" subtitle="实体模块数（个）" class="inner-card">
                <div class="inner-card__content">
                  <div class="inner-card__content-title">{{ entityTotal }}</div>
                  <div class="inner-card__content-footer">后端菜单树实时统计</div>
                </div>
              </t-card>
            </t-col>
            <t-col :xs="6" :xl="12">
              <t-card :bordered="false" subtitle="动作入口数（个）" class="inner-card">
                <div class="inner-card__content">
                  <div class="inner-card__content-title">{{ actionCards.length }}</div>
                  <div class="inner-card__content-footer">后端菜单树实时统计</div>
                </div>
              </t-card>
            </t-col>
          </t-row>
        </t-card>
      </t-col>
    </t-row>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
}
.row-container {
  margin-top: 16px;
}

/* ===== TopPanel KPI 卡 ===== */
.dash-item {
  padding: 8px;
}
.dash-item :deep(.t-card__body) {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  position: relative;
}
.dash-item :deep(.t-card__title) {
  font-size: 14px;
  font-weight: 500;
}
.dash-item :deep(.t-card__footer) {
  padding-top: 0;
}
.dash-item-top {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 4px;
}
.dash-item-top > span {
  display: inline-block;
  color: var(--td-text-color-primary);
  font-size: 36px;
  line-height: 44px;
}
.dash-item-top > small {
  color: var(--td-text-color-placeholder);
  font-size: 13px;
}
.dash-item-left {
  position: absolute;
  top: 0;
  right: 24px;
}
.dash-item-left > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: var(--td-brand-color-1);
  border-radius: 50%;
}
.dash-item-left :deep(.t-icon) {
  font-size: 24px;
  color: var(--td-brand-color);
}
.dash-item-bottom {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
.dash-item-block {
  display: flex;
  align-items: center;
  line-height: 22px;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}
/* 首张卡：品牌主色反色（沿用品牌渐变令牌，不新增颜色） */
.dash-item--main {
  background: var(--cube-brand-gradient);
}
.dash-item--main :deep(.t-card__title),
.dash-item--main .dash-item-top > span,
.dash-item--main .dash-item-bottom {
  color: var(--td-text-color-anti);
}
.dash-item--main .dash-item-top > small,
.dash-item--main .dash-item-block {
  color: var(--td-text-color-anti);
  opacity: 0.6;
}
.dash-item--main .dash-item-left > span {
  background: rgba(255, 255, 255, 0.22);
}
.dash-item--main .dash-item-left :deep(.t-icon) {
  color: #fff;
}

/* ===== 图表卡 ===== */
.dash-chart-card {
  padding: 8px;
}
.dash-chart-card :deep(.t-card__title) {
  font-size: 20px;
  font-weight: 500;
}
.dash-chart {
  width: 100%;
  height: 326px;
}

/* ===== 排名卡 ===== */
.dash-rank-card {
  padding: 8px;
}
.dash-rank-card :deep(.t-card__title) {
  font-size: 20px;
  font-weight: 500;
}
.dash-rank__cell {
  display: inline-flex;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  background-color: var(--td-text-color-placeholder);
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.dash-rank__cell--top {
  background: var(--td-brand-color);
}

/* ===== 概览卡 ===== */
.dash-overview-card :deep(.t-card__title) {
  font-size: 20px;
  font-weight: 500;
}
.inner-card {
  padding: 24px 0;
}
.inner-card :deep(.t-card__header) {
  padding-bottom: 0;
}
.inner-card__content-title {
  font-size: 36px;
  line-height: 44px;
  color: var(--td-text-color-primary);
}
.inner-card__content-footer {
  display: flex;
  align-items: center;
  line-height: 22px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
</style>
