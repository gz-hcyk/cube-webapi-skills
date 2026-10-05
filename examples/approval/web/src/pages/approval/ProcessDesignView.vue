<template>
  <t-card title="流程设计" :bordered="false">
    <p class="hint">这里只查看已发布流程的节点和办理人规则，不提供连线编辑。</p>
    <t-table row-key="id" :data="processes" :columns="columns" :loading="loading" hover>
      <template #op="{ row }">
        <t-link theme="primary" @click="open(row)">查看节点</t-link>
      </template>
    </t-table>

    <t-drawer v-model:visible="openView" :header="currentName" size="720px" :footer="false">
      <t-table row-key="key" :data="nodes" :columns="nodeColumns" size="small" />
    </t-drawer>
  </t-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getApi, type ApiEnvelope } from '@/api/http';

defineProps<{ area?: string; controller?: string; title?: string }>();

interface ProcessRow {
  id: number;
  code: string;
  name: string;
  publishedVersion?: number;
}
interface FlowNodeRow {
  key: string;
  name: string;
  typeLabel: string;
  modeLabel: string;
  assigneeLabel: string;
}
interface DesignBody {
  name: string;
  readOnly: boolean;
  nodes: FlowNodeRow[];
}

const processes = ref<ProcessRow[]>([]);
const nodes = ref<FlowNodeRow[]>([]);
const currentName = ref('流程节点');
const loading = ref(false);
const openView = ref(false);

const columns = [
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '编码' },
  { colKey: 'publishedVersion', title: '已发布版本' },
  { colKey: 'op', title: '操作', cell: 'op' },
];
const nodeColumns = [
  { colKey: 'name', title: '节点' },
  { colKey: 'typeLabel', title: '类型' },
  { colKey: 'modeLabel', title: '处理方式' },
  { colKey: 'assigneeLabel', title: '办理人规则' },
];

async function unwrap<T>(pending: Promise<ApiEnvelope<T>>) {
  const body = await pending;
  if (body.code !== 0) throw new Error(body.message || '请求失败');
  return body.data;
}
function tell(error: unknown) {
  MessagePlugin.error(error instanceof Error ? error.message : '请求失败');
}

async function load() {
  loading.value = true;
  try {
    const data = await unwrap(getApi<ProcessRow[]>('/ApprovalAdmin/Process', { pageIndex: 1, pageSize: 50 }));
    processes.value = data || [];
  } catch (error) {
    tell(error);
  } finally {
    loading.value = false;
  }
}

async function open(row: ProcessRow) {
  try {
    const design = await unwrap(getApi<DesignBody>('/ApprovalAdmin/Process/Design', { id: row.id }));
    currentName.value = (design.name || row.name) + (design.readOnly ? '（只读）' : '');
    nodes.value = design.nodes || [];
    openView.value = true;
  } catch (error) {
    tell(error);
  }
}

onMounted(load);
</script>

<style scoped>
.hint { margin: 0 0 12px; color: var(--td-text-color-secondary); }
</style>
