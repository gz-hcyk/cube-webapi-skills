<script setup lang="ts">
/**
 * ServerInfoView —— 服务器信息 / 运行监控页（`NewLife.Cube.Areas.Admin.Controllers.IndexController`）。
 *
 * 归属：Area 控制器 ⇒ 请求**必须带 `/api`**（`/api/Admin/Index/...`，见 api/http.ts 铁律 H2 判据）。
 * IndexController **不是实体控制器**（无 GetPage），故走单列专用页，不能进 ListPage。
 *
 * 端点（动作签名取自 NewLife.Cube 6.15.2026.901 官方 XML 文档）：
 *   GET  /api/Admin/Index/Main           服务器信息（对象）
 *   GET  /api/Admin/Index/MonitorData    监控快照（CPU/内存…），工作台性能曲线轮询接口
 *   GET  /api/Admin/Index/AssemblyList   程序集列表（?name= 过滤）
 *   GET  /api/Admin/Index/ProcessList    进程模块列表（?name= 过滤）
 *   GET  /api/Admin/Index/ServerVarList  服务器变量列表
 *   GET  /api/Admin/Index/MemoryFree     释放内存
 *   GET  /api/Admin/Index/Restart        重启
 *
 * ⚠️ 契约边界（务必先读）：官方文档只给定**动作签名**，未给**响应结构**。
 *    本页采取「**自适应渲染**」策略——不硬编码字段名，而是把返回对象/数组按键自动成行，
 *    命中已知键（MachineName / OSName / StartTime …）时套用中文标签，未知键原样展示。
 *    这样即使字段命名与预期不同，页面也**照样可用、不空白**；契约偏差由 `DataProbe` 一眼看清。
 *    首次对接某具体部署时，先用 DEV 探针确认字段名，再按需把标签补进 LABELS。
 *
 * 模块化（对标 MVC 分部视图）：工具栏 / 概览 / 监控曲线 / 程序集 / 进程 / 服务器变量
 *   各自独立成块，可按需整块替换（覆盖点见 references/page-composition.md）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import * as echarts from 'echarts';
import { getApi } from '@/api/http';
import { extractEntity, extractListPayload, normalizeRows } from '@/api/useEntityResource';
import DataProbe from './DataProbe.vue';

const props = withDefaults(
  defineProps<{ area?: string; controller?: string; title?: string }>(),
  { area: 'Admin', controller: 'Index', title: '' },
);

const area = computed(() => props.area);
const controller = computed(() => props.controller);
const title = computed(() => props.title || '服务器信息');
const base = computed(() => `/${area.value}/${controller.value}`);

/* ----------------------------- 状态 ----------------------------- */
const activeTab = ref('overview');
const loading = ref(false);
const acting = ref(false);

const mainRaw = ref<any>(null);
const monitorRaw = ref<any>(null);
const assembliesRaw = ref<any>(null);
const processesRaw = ref<any>(null);
const varsRaw = ref<any>(null);

/** 已知键 → 中文标签（未命中的键原样展示，保证「未知结构也不空白」） */
const LABELS: Record<string, string> = {
  machineName: '机器名',
  osName: '操作系统',
  osVersion: '系统版本',
  version: '平台版本',
  framework: '运行框架',
  processorCount: 'CPU 核数',
  cpuUsage: 'CPU 使用率',
  physicalMemory: '物理内存',
  memory: '内存占用',
  startTime: '启动时间',
  runTime: '运行时长',
  uptime: '运行时长',
  time: '服务器时间',
  ip: '服务器 IP',
  ips: '服务器 IP',
  tempPath: '临时目录',
  baseDirectory: '程序目录',
  processId: '进程号',
  userName: '运行账户',
};

/** 把任意对象转成可展示的键值行（键名经 camel 归一，命中 LABELS 用中文） */
function toRows(obj: any): { label: string; key: string; value: any }[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.keys(obj).map((k) => {
    const ck = k.charAt(0).toLowerCase() + k.slice(1);
    return { label: LABELS[ck] || LABELS[k] || k, key: k, value: (obj as any)[k] };
  });
}

const mainRows = computed(() => toRows(mainRaw.value));
const monitorRows = computed(() => toRows(monitorRaw.value));

/** 数组类结果统一取行集（复用列表载荷提取，兼容 rows/page.rows/裸数组） */
function rowsOf(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return normalizeRows(raw);
  const { rows } = extractListPayload(raw);
  if (rows && rows.length) return normalizeRows(rows);
  // 退化为对象数组（部分实现返回 { list: [...] } / { items: [...] }）
  const cand = raw.list ?? raw.items ?? raw.Items ?? raw.List;
  return Array.isArray(cand) ? normalizeRows(cand) : [];
}
const assemblies = computed(() => rowsOf(assembliesRaw.value));
const processes = computed(() => rowsOf(processesRaw.value));
const vars = computed(() => rowsOf(varsRaw.value));

/** 数组列定义：按首行键自动生成（未知结构照样成表） */
function autoColumns(rows: any[]): { colKey: string; title: string; ellipsis?: boolean; minWidth?: number }[] {
  const first = rows[0];
  if (!first || typeof first !== 'object') return [];
  return Object.keys(first).map((k) => {
    const ck = k.charAt(0).toLowerCase() + k.slice(1);
    return { colKey: k, title: LABELS[ck] || k, ellipsis: true, minWidth: 140 };
  });
}
const assemblyColumns = computed(() => autoColumns(assemblies.value));
const processColumns = computed(() => autoColumns(processes.value));
const varColumns = computed(() => autoColumns(vars.value));

/* ----------------------------- 监控曲线 ----------------------------- */
/**
 * 从监控快照里挑出**数值型**键，累积成多条折线。
 * 不预设字段名（cpu/memory 等命名因部署而异），只按「值是数字」判定 ⇒ 自适应。
 */
const chartRef = ref<HTMLDivElement | null>(null);
// 用 ReturnType 取实例类型，避免绑定具体 echarts 版本的导出名（ECharts / EChartsType 各版本不一）
let chart: ReturnType<typeof echarts.init> | null = null;
const numericKeys = ref<string[]>([]);
const series = ref<Record<string, number[]>>({});
const MAX_POINTS = 60;

function pushMonitor(raw: any) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  const point: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) point[k] = v;
  }
  if (!Object.keys(point).length) return;
  for (const k of Object.keys(point)) {
    const arr = series.value[k] ?? (series.value[k] = []);
    arr.push(point[k]);
    if (arr.length > MAX_POINTS) arr.shift();
  }
  numericKeys.value = Object.keys(series.value);
  renderChart();
}

function renderChart() {
  if (!chartRef.value) return;
  if (!chart) chart = echarts.init(chartRef.value);
  const keys = numericKeys.value;
  chart.setOption(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: keys, top: 0 },
      grid: { left: 48, right: 20, top: 34, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: false, data: keys.length ? series.value[keys[0]].map((_, i) => String(i)) : [] },
      yAxis: { type: 'value' },
      series: keys.map((k) => ({
        name: k,
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.value[k],
      })),
    },
    true,
  );
}

let timer: number | undefined;
const polling = ref(false);
function startPolling() {
  if (timer) return;
  polling.value = true;
  loadMonitor();
  timer = window.setInterval(loadMonitor, 5000);
}
function stopPolling() {
  if (timer) window.clearInterval(timer);
  timer = undefined;
  polling.value = false;
}
function onTabChange(v: string | number) {
  if (v === 'monitor') {
    startPolling();
    // 图表容器在 tab 切换后才挂载，延一帧初始化
    window.setTimeout(renderChart, 0);
  } else {
    stopPolling();
  }
}

/* ----------------------------- 加载 ----------------------------- */
async function call<T>(action: string, params?: Record<string, unknown>): Promise<any> {
  const env = await getApi<T>(`${base.value}/${action}`, params);
  // 信封优先取 data；部分实现直接返回裸对象
  const anyEnv = env as any;
  if (anyEnv && typeof anyEnv === 'object' && 'code' in anyEnv) return anyEnv.data;
  return env;
}

async function loadMain() {
  try {
    mainRaw.value = extractEntity({ data: await call('Main') });
  } catch (e: any) {
    MessagePlugin.error(e?.message || '加载服务器信息失败');
  }
}

async function loadMonitor() {
  try {
    monitorRaw.value = await call('MonitorData');
    pushMonitor(monitorRaw.value);
  } catch {
    /* 监控轮询失败不弹错（避免每 5s 干扰一次），由探针与页面留白体现 */
  }
}

async function loadTabData(tab: string) {
  loading.value = true;
  try {
    if (tab === 'assembly') assembliesRaw.value = await call('AssemblyList');
    else if (tab === 'process') processesRaw.value = await call('ProcessList');
    else if (tab === 'vars') varsRaw.value = await call('ServerVarList');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onTabChangeAndLoad(v: string | number) {
  const key = String(v);
  activeTab.value = key;
  onTabChange(key);
  if (key !== 'overview' && key !== 'monitor') loadTabData(key);
}

/* ----------------------------- 运维动作（高风险操作，二次确认） ----------------------------- */
function confirmAct(label: string, action: string, tip: string) {
  const dlg = DialogPlugin.confirm({
    header: label,
    body: tip,
    theme: 'warning',
    onConfirm: async () => {
      dlg.hide();
      acting.value = true;
      try {
        await call(action);
        MessagePlugin.success(`${label}指令已下发`);
      } catch (e: any) {
        MessagePlugin.error(e?.message || `${label}失败`);
      } finally {
        acting.value = false;
      }
    },
  });
}

onMounted(loadMain);
onBeforeUnmount(() => {
  stopPolling();
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div class="server-info">
    <t-card :title="title" :bordered="false">
      <template #actions>
        <t-space>
          <t-button variant="outline" :loading="acting" @click="confirmAct('释放内存', 'MemoryFree', '将请求运行时回收内存，可能引起短暂卡顿。确认继续？')">
            释放内存
          </t-button>
          <t-button theme="danger" variant="outline" :loading="acting" @click="confirmAct('重启服务', 'Restart', '重启会中断当前所有连接，请确认已安排好维护窗口。确认继续？')">
            重启服务
          </t-button>
          <t-button theme="primary" variant="outline" @click="loadMain">刷新</t-button>
        </t-space>
      </template>

      <t-tabs :value="activeTab" @change="onTabChangeAndLoad">
        <!-- 概览：服务器信息键值 -->
        <t-tab-panel value="overview" label="服务器信息">
          <t-descriptions v-if="mainRows.length" :column="2" bordered size="medium">
            <t-descriptions-item v-for="r in mainRows" :key="r.key" :label="r.label">
              {{ r.value === null || r.value === undefined || r.value === '' ? '-' : r.value }}
            </t-descriptions-item>
          </t-descriptions>
          <t-empty v-else description="暂无服务器信息" />
          <DataProbe :data="mainRaw" label="Main 响应结构" />
        </t-tab-panel>

        <!-- 实时监控：自适应数值折线 + 当前快照 -->
        <t-tab-panel value="monitor" label="运行监控">
          <div class="mon-tip">
            <t-tag :theme="polling ? 'success' : 'default'" variant="light" size="small">
              {{ polling ? '每 5 秒自动刷新' : '已停止' }}
            </t-tag>
            <span class="mon-desc">仅采集返回中的数值型指标，字段命名随部署自适应</span>
          </div>
          <div ref="chartRef" class="mon-chart"></div>
          <t-descriptions v-if="monitorRows.length" :column="3" bordered size="small" class="mon-kv">
            <t-descriptions-item v-for="r in monitorRows" :key="r.key" :label="r.label">
              {{ r.value === null || r.value === undefined ? '-' : r.value }}
            </t-descriptions-item>
          </t-descriptions>
          <DataProbe :data="monitorRaw" label="MonitorData 响应结构" />
        </t-tab-panel>

        <!-- 程序集 -->
        <t-tab-panel value="assembly" label="程序集">
          <t-table
            v-if="assemblyColumns.length"
            row-key="name"
            size="small"
            stripe
            :data="assemblies"
            :columns="assemblyColumns"
            :loading="loading"
            max-height="520"
          />
          <t-empty v-else description="暂无程序集数据" />
          <DataProbe :data="assembliesRaw" label="AssemblyList 响应结构" />
        </t-tab-panel>

        <!-- 进程模块 -->
        <t-tab-panel value="process" label="进程模块">
          <t-table
            v-if="processColumns.length"
            row-key="name"
            size="small"
            stripe
            :data="processes"
            :columns="processColumns"
            :loading="loading"
            max-height="520"
          />
          <t-empty v-else description="暂无进程数据" />
          <DataProbe :data="processesRaw" label="ProcessList 响应结构" />
        </t-tab-panel>

        <!-- 服务器变量 -->
        <t-tab-panel value="vars" label="服务器变量">
          <t-table
            v-if="varColumns.length"
            row-key="name"
            size="small"
            stripe
            :data="vars"
            :columns="varColumns"
            :loading="loading"
            max-height="520"
          />
          <t-empty v-else description="暂无变量数据" />
          <DataProbe :data="varsRaw" label="ServerVarList 响应结构" />
        </t-tab-panel>
      </t-tabs>
    </t-card>
  </div>
</template>

<style scoped>
.mon-tip { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.mon-desc { font-size: 12px; color: var(--td-text-color-secondary); }
.mon-chart { width: 100%; height: 260px; }
.mon-kv { margin-top: 12px; }
</style>
