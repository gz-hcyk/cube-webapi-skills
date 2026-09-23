<script setup lang="ts">
/**
 * WidgetBoardView —— 工作台部件管理页（`NewLife.Cube.Areas.Cube.Controllers.WidgetController`）。
 *
 * 归属：Area 控制器 ⇒ **必须带 `/api`**（`/api/Cube/Widget/...`，见 api/http.ts 铁律 H2）。
 * WidgetController **不是实体控制器**（无 GetPage）⇒ 单列专用页。
 * 语义（官方文档）：列出所有注册部件；系统管理员可启用/禁用、调整分组与组内顺序
 *   （配置落在 Parameter 表 UserID=0，**全局**，不是用户级）。
 *
 * 端点（动作签名取自 NewLife.Cube 6.15.2026.901 官方 XML 文档）：
 *   GET  /api/Cube/Widget/Index                       部件列表（含启用状态、分组顺序、组内顺序）
 *   POST /api/Cube/Widget/Enable?name=&enabled=       启用 / 禁用（Parameter：分类 Widget.Enable）
 *   POST /api/Cube/Widget/SaveGroupOrder?order=       保存分组顺序（逗号分隔组名）
 *   POST /api/Cube/Widget/SaveGroupItemOrder?group=&order=  保存组内部件顺序（逗号分隔部件名）
 *
 * ⚠️ 契约边界：官方文档只给动作签名，不给响应结构，也不给 query 参数名。
 *    本页对此采取两条纪律（避免「猜错字段 ⇒ 静默空白」）：
 *      1) 列表**自适应**：部件名 / 显示名 / 分组 / 启用位 各兼容多种键名，全不命中则退化为原样表；
 *      2) 参数名以 XML 签名为准（`name`/`enabled`/`group`/`order`），首次对接用 `DataProbe`
 *         与 DEV 网络面板确认，如后端形参名不同，只需改本文件 PARAMS 常量一处。
 *
 * 模块化（对标 MVC 分部视图）：工具栏 / 分组卡 / 部件行 / 探针各自成块，可按需替换。
 */
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getApi } from '@/api/http';
import http from '@/api/http';
import DataProbe from './DataProbe.vue';

/** query 参数名常量（如某部署后端形参名不同，只改这里） */
const PARAMS = { name: 'name', enabled: 'enabled', group: 'group', order: 'order' };

const props = withDefaults(
  defineProps<{ area?: string; controller?: string; title?: string }>(),
  { area: 'Cube', controller: 'Widget', title: '' },
);

const area = computed(() => props.area);
const controller = computed(() => props.controller);
const title = computed(() => props.title || '工作台部件');
const base = computed(() => `/Cube/Widget`);

const loading = ref(false);
const busy = ref(false);
const payload = ref<any>(null);

interface WidgetItem {
  name: string;
  displayName: string;
  group: string;
  enabled: boolean;
  raw: any;
}

/** 多键兜底取值（后端键名因部署而异，未知则返回空串） */
function pick(o: any, ...keys: string[]): any {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
}

/** 从任意形态的响应里归一化出部件数组 */
const widgets = computed<WidgetItem[]>(() => {
  const p = payload.value;
  if (!p) return [];
  let arr: any[] = [];
  if (Array.isArray(p)) arr = p;
  else if (Array.isArray(p.items)) arr = p.items;
  else if (Array.isArray(p.widgets)) arr = p.widgets;
  else if (Array.isArray(p.list)) arr = p.list;
  else if (Array.isArray(p.Widgets)) arr = p.Widgets;
  else if (Array.isArray(p.rows)) arr = p.rows;
  return arr
    .map((r) => {
      const name = String(pick(r, 'name', 'Name', 'widget', 'Widget') ?? '');
      return {
        name,
        displayName: String(pick(r, 'displayName', 'DisplayName', 'title', 'Title') ?? name),
        group: String(pick(r, 'group', 'Group', 'category', 'Category') ?? '默认分组'),
        enabled: pick(r, 'enabled', 'Enabled', 'enable', 'Enable') !== false,
        raw: r,
      };
    })
    .filter((w) => w.name);
});

/** 分组顺序：优先用响应里的 groupOrder 字符串，否则按出现顺序 */
const groupOrder = ref<string[]>([]);
const groups = computed(() => {
  const seen = widgets.value.map((w) => w.group);
  const declared = groupOrder.value.filter((g) => seen.includes(g));
  const rest = seen.filter((g) => !declared.includes(g));
  return [...declared, ...Array.from(new Set(rest))];
});
const grouped = computed(() =>
  groups.value.map((g) => ({ group: g, items: widgets.value.filter((w) => w.group === g) })),
);

function readGroupOrder(p: any): string[] {
  const raw = pick(p, 'groupOrder', 'GroupOrder', 'groups', 'Groups');
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(raw)) return raw.map((s) => String(s));
  return [];
}

async function load() {
  loading.value = true;
  try {
    const env: any = await getApi<any>(base.value);
    const p = env && typeof env === 'object' && 'code' in env ? env.data : env;
    payload.value = p;
    groupOrder.value = readGroupOrder(p);
  } catch (e: any) {
    MessagePlugin.error(e?.message || '加载部件列表失败');
    payload.value = null;
  } finally {
    loading.value = false;
  }
}

/* ----------------------------- 启用 / 禁用 ----------------------------- */
async function toggle(item: WidgetItem, next: boolean) {
  busy.value = true;
  // 乐观更新：失败回滚（避免开关点了没反应、用户反复点）
  const prev = item.enabled;
  item.enabled = next;
  try {
    await http.post(`${base.value}/Enable`, null, { params: { [PARAMS.name]: item.name, [PARAMS.enabled]: next } });
    MessagePlugin.success(next ? `已启用「${item.displayName}」` : `已禁用「${item.displayName}」`);
  } catch (e: any) {
    item.enabled = prev;
    MessagePlugin.error(e?.message || '操作失败');
  } finally {
    busy.value = false;
  }
}

/* ----------------------------- 排序 ----------------------------- */
async function saveGroupOrder(list: string[]) {
  busy.value = true;
  try {
    await http.post(`${base.value}/SaveGroupOrder`, null, { params: { [PARAMS.order]: list.join(',') } });
    groupOrder.value = list;
    MessagePlugin.success('分组顺序已保存');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '保存分组顺序失败');
    await load();
  } finally {
    busy.value = false;
  }
}

async function moveGroup(index: number, delta: number) {
  const list = [...groups.value];
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  await saveGroupOrder(list);
}

async function moveItem(group: string, index: number, delta: number) {
  const list = grouped.value.find((g) => g.group === group)?.items.map((w) => w.name) ?? [];
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  busy.value = true;
  try {
    await http.post(`${base.value}/SaveGroupItemOrder`, null, {
      params: { [PARAMS.group]: group, [PARAMS.order]: list.join(',') },
    });
    // 本地重排（保持二次移动基于最新顺序）
    const flat = widgets.value;
    const reordered = list
      .map((n) => flat.find((w) => w.name === n))
      .filter((w): w is WidgetItem => !!w);
    const others = flat.filter((w) => w.group !== group);
    payload.value = { items: [...others, ...reordered] };
    MessagePlugin.success('部件顺序已保存');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '保存部件顺序失败');
    await load();
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="widget-view">
    <t-card :title="title" :bordered="false">
      <template #actions>
        <t-space>
          <t-button variant="outline" :loading="loading" @click="load">刷新</t-button>
        </t-space>
      </template>

      <t-alert
        theme="info"
        class="hint"
        message="此处配置为全局（对所有用户生效）：启用的部件会出现在工作台；顺序决定工作台卡片的排布。"
      />

      <t-loading :loading="loading">
        <t-empty v-if="!grouped.length" description="没有读取到部件，请用下方「响应结构」确认字段命名" />

        <div v-for="(g, gi) in grouped" :key="g.group" class="group">
          <div class="group-head">
            <span class="g-name">{{ g.group }}</span>
            <t-tag size="small" variant="light">{{ g.items.length }} 个部件</t-tag>
            <t-space size="small" class="g-ops">
              <t-button size="small" variant="text" :disabled="gi === 0 || busy" @click="moveGroup(gi, -1)">上移</t-button>
              <t-button size="small" variant="text" :disabled="gi === grouped.length - 1 || busy" @click="moveGroup(gi, 1)">下移</t-button>
            </t-space>
          </div>

          <div class="items">
            <div v-for="(w, wi) in g.items" :key="w.name" class="item" :class="{ off: !w.enabled }">
              <div class="it-main">
                <span class="it-name">{{ w.displayName }}</span>
                <span class="it-code">{{ w.name }}</span>
              </div>
              <t-space size="small" class="it-ops">
                <t-button size="small" variant="text" :disabled="wi === 0 || busy" @click="moveItem(g.group, wi, -1)">上移</t-button>
                <t-button size="small" variant="text" :disabled="wi === g.items.length - 1 || busy" @click="moveItem(g.group, wi, 1)">下移</t-button>
                <t-switch
                  :value="w.enabled"
                  :disabled="busy"
                  @change="(v: any) => toggle(w, !!v)"
                />
              </t-space>
            </div>
          </div>
        </div>
      </t-loading>

      <DataProbe :data="payload" label="Widget/Index 响应结构" />
    </t-card>
  </div>
</template>

<style scoped>
.hint { margin-bottom: 14px; }
.group { margin-bottom: 18px; }
.group-head { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--td-component-stroke); }
.g-name { font-weight: 600; font-size: 14px; }
.g-ops { margin-left: auto; }
.items { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 10px; }
.item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--td-component-stroke);
  border-radius: var(--cube-radius-md); background: var(--td-bg-color-container);
  transition: box-shadow 150ms ease, opacity 150ms ease;
}
.item:hover { box-shadow: var(--td-shadow-1); }
.item.off { opacity: 0.62; }
.it-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.it-name { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.it-code { font-size: 11.5px; color: var(--td-text-color-placeholder); font-family: 'JetBrains Mono', Consolas, monospace; }
.it-ops { flex: none; }
</style>
