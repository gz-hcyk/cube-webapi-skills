<template>
  <t-card :title="title || '审批办理'" :bordered="false">
    <template #actions>
      <t-button theme="primary" @click="openStart">发起申请</t-button>
    </template>
    <t-tabs v-model="tab" @change="loadList">
      <t-tab-panel value="inbox" label="待办" />
      <t-tab-panel value="cc" label="抄送" />
      <t-tab-panel value="done" label="已办" />
      <t-tab-panel value="drafts" label="草稿" />
      <t-tab-panel value="search" label="检索" />
    </t-tabs>
    <div v-if="tab === 'search'" class="search-bar">
      <t-input v-model="keyword" placeholder="按事由检索，例如回家" />
      <t-button theme="primary" @click="runSearch">检索</t-button>
    </div>
    <t-table
      v-if="tab === 'search'"
      row-key="instanceId"
      :data="searchRows"
      :columns="searchColumns"
      :loading="loading"
      hover
      @row-click="onSearchRow"
    />
    <t-table
      v-else
      :row-key="tab === 'drafts' ? 'instanceId' : 'id'"
      :data="displayRows"
      :columns="tab === 'drafts' ? draftColumns : columns"
      :loading="loading"
      hover
      @row-click="onRow"
    />

    <t-drawer v-model:visible="detailOpen" :header="detail?.title || '审批详情'" size="720px" :footer="false" :close-btn="true">
      <template v-if="detail">
        <t-descriptions :column="2" item-layout="horizontal">
          <t-descriptions-item label="状态">{{ instanceStatus(detail.status) }}</t-descriptions-item>
          <t-descriptions-item label="轮次">{{ detail.round }}</t-descriptions-item>
          <t-descriptions-item label="发起人">{{ detail.userName }}</t-descriptions-item>
          <t-descriptions-item label="业务主体">{{ detail.subjectName }}</t-descriptions-item>
          <t-descriptions-item label="代发起人">{{ detail.proxyName || '无' }}</t-descriptions-item>
        </t-descriptions>
        <h4 class="block-title">表单</h4>
        <t-form label-width="96px">
          <t-form-item v-for="field in visibleHandleFields" :key="field.key" :label="field.label">
            <t-input v-if="field.access === 'editable'" v-model="editValues[field.key]" />
            <t-input v-else :value="shownValue(field.key)" disabled />
          </t-form-item>
        </t-form>
        <div class="actions">
          <t-button v-if="activeTask" theme="primary" @click="agree">同意</t-button>
          <t-button v-if="activeTask" theme="danger" variant="outline" @click="rejectOpen = true">驳回</t-button>
          <t-button v-if="activeTask" variant="outline" @click="transferOpen = true">转办</t-button>
          <t-button v-if="activeTask" variant="outline" @click="addSignOpen = true">加签</t-button>
          <t-button v-if="ccTask" theme="primary" @click="markRead">已阅</t-button>
          <t-button v-if="canWithdraw" variant="outline" @click="withdrawOpen = true">撤回</t-button>
          <t-button v-if="canResubmit" theme="primary" @click="openResubmit">重新提交</t-button>
        </div>
        <t-tabs v-model="detailTab" class="detail-tabs">
          <t-tab-panel value="timeline" label="办理过程">
            <ol v-if="timeline.length" class="timeline" data-timeline>
              <li v-for="item in timeline" :key="item.id" class="tl-item" :data-action="item.action">
                <div class="tl-time">{{ item.time || '时间未记录' }}</div>
                <div class="tl-title">{{ item.actor }} · {{ item.actionName }}</div>
                <div v-if="item.node" class="tl-node">{{ item.node }}</div>
                <div v-if="item.comment" class="tl-comment">{{ item.comment }}</div>
              </li>
            </ol>
            <p v-else class="hint">还没有办理记录</p>
          </t-tab-panel>
          <t-tab-panel value="flow" label="流程图">
            <flow-chart v-if="detailTab === 'flow'" :nodes="chart.nodes" :edges="chart.edges" :states="chart.states" legend zoomable />
          </t-tab-panel>
        </t-tabs>
      </template>
    </t-drawer>

    <t-dialog v-model:visible="startOpen" header="发起请假" :confirm-btn="{ loading: saving }" @confirm="submitStart">
      <t-form label-width="96px">
        <t-form-item label="流程">
          <t-select v-model="start.processId" :options="processOptions" placeholder="选择已发布流程" @change="onProcessChange" />
        </t-form-item>
        <t-form-item label="发起方式">
          <t-radio-group v-model="start.proxy">
            <t-radio :value="false">本人发起</t-radio>
            <t-radio :value="true">代发起</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="学生">
          <t-input v-if="!start.proxy" :value="meLabel" disabled />
          <t-select v-else v-model="start.subjectUserId" :options="studentOptions" placeholder="必须选择学生" />
        </t-form-item>
        <t-form-item v-if="counselorAccess !== 'hidden'" label="该生辅导员">
          <t-select v-model="start.counselorUserId" :options="userOptions" placeholder="按学生选择辅导员" :disabled="counselorAccess === 'readonly'" />
        </t-form-item>
        <t-form-item v-for="pick in picks" :key="pick.nodeKey" :label="pick.name || '发起人自选'">
          <t-select v-model="pickUsers[pick.nodeKey]" :options="userOptions" placeholder="选择办理人" />
        </t-form-item>
        <t-form-item v-for="field in visibleStartFields" :key="field.key" :label="field.label">
          <t-input v-model="fieldValues[field.key]" :disabled="field.access === 'readonly'" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="resubmitOpen" header="重新提交" :confirm-btn="{ loading: saving }" @confirm="submitResubmit">
      <t-form label-width="96px">
        <t-form-item v-for="field in visibleStartFields" :key="field.key" :label="field.label">
          <t-input v-model="fieldValues[field.key]" :disabled="field.access === 'readonly'" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="rejectOpen" header="驳回" @confirm="reject">
      <t-textarea v-model="rejectComment" placeholder="驳回意见必填" />
    </t-dialog>

    <t-dialog v-model:visible="transferOpen" header="转办" @confirm="transfer">
      <t-select v-model="transferUserId" :options="transferOptions" placeholder="选择另一名用户" />
      <t-textarea v-model="transferComment" class="gap" placeholder="转办说明" />
    </t-dialog>

    <t-dialog v-model:visible="addSignOpen" header="向后加签" @confirm="addSign">
      <t-select v-model="addSignUserId" :options="transferOptions" placeholder="选择加签人" />
      <t-textarea v-model="addSignComment" class="gap" placeholder="加签说明" />
    </t-dialog>

    <t-dialog v-model:visible="withdrawOpen" header="撤回申请" @confirm="withdraw">
      <p>撤回后本轮待办取消，单据回到草稿，可以修改后重新提交。</p>
    </t-dialog>
  </t-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin, type RowEventContext, type TableRowData } from 'tdesign-vue-next';
import { getApi, postApi, type ApiEnvelope } from '@/api/http';
import FlowChart from './FlowChart.vue';
import { edgeCaption, instanceMarks, type ChartEdge, type ChartNode, type NodeMark } from './flowChart';

defineProps<{ area?: string; controller?: string; title?: string }>();

interface TaskRow {
  id: string;
  instanceId: string;
  assigneeId: number;
  assigneeName: string;
  nodeName: string;
  nodeKey: string;
  status: number;
  title: string;
  kind: number;
  createTime?: string;
}
interface HistoryRow {
  action: string;
  actionName: string;
  comment?: string;
  operatorName?: string;
  nodeKey?: string;
  nodeName?: string;
  createTime?: string;
  round?: number;
}
interface FieldRule {
  key: string;
  label: string;
  access: string;
}
interface NodeFields {
  nodeKey: string;
  fields: FieldRule[];
}
interface InstanceView {
  instanceId: string;
  title: string;
  status: number;
  version: number;
  round: number;
  processId: number;
  userId: number;
  userName: string;
  subjectName: string;
  proxyName?: string;
  formData?: string;
  definition?: string;
  nodeFields?: NodeFields[];
  tasks: TaskRow[];
  history: HistoryRow[];
}
interface RawFlowNode { key: string; type: string; name: string }
interface RawFlowEdge {
  key?: string;
  from: string;
  to: string;
  default?: boolean;
  condition?: { field?: string; op?: string; value?: string | number };
}
interface DraftRow {
  instanceId: string;
  title: string;
  round: number;
  subjectName: string;
  version: number;
}
interface Person {
  id: number;
  name: string;
  displayName: string;
}
interface ProcessOption {
  id: number;
  name: string;
}
interface PickNode {
  nodeKey: string;
  name: string;
}
interface SearchHit {
  instanceId: string;
  field: string;
  value: string;
  title: string;
  status: number;
}

const tab = ref('inbox');
const rows = ref<TaskRow[]>([]);
const drafts = ref<DraftRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const detailOpen = ref(false);
const detailTab = ref('timeline');
const detail = ref<InstanceView | null>(null);
const openedTaskId = ref('');
const startOpen = ref(false);
const resubmitOpen = ref(false);
const startFields = ref<FieldRule[]>([]);
const picks = ref<PickNode[]>([]);
const pickUsers = ref<Record<string, number | undefined>>({});
const keyword = ref('');
const hits = ref<SearchHit[]>([]);
const fieldValues = ref<Record<string, string>>({});
const editValues = ref<Record<string, string>>({});
const rejectOpen = ref(false);
const transferOpen = ref(false);
const addSignOpen = ref(false);
const withdrawOpen = ref(false);
const rejectComment = ref('');
const transferComment = ref('');
const transferUserId = ref<number | undefined>();
const addSignUserId = ref<number | undefined>();
const addSignComment = ref('');
const me = ref<Person | null>(null);
const people = ref<Person[]>([]);
const processes = ref<ProcessOption[]>([]);
const start = ref({
  processId: undefined as number | undefined,
  proxy: false,
  subjectUserId: undefined as number | undefined,
  counselorUserId: undefined as number | undefined,
  reason: '',
});

const columns = [
  { colKey: 'title', title: '标题' },
  { colKey: 'nodeName', title: '节点' },
  { colKey: 'assigneeName', title: '办理人' },
  { colKey: 'statusText', title: '状态' },
];
const draftColumns = [
  { colKey: 'title', title: '标题' },
  { colKey: 'subjectName', title: '业务主体' },
  { colKey: 'round', title: '轮次' },
];
const searchColumns = [
  { colKey: 'title', title: '标题' },
  { colKey: 'value', title: '事由' },
  { colKey: 'statusText', title: '状态' },
];
const displayRows = computed(() => (tab.value === 'drafts'
  ? drafts.value
  : rows.value.map((row) => ({ ...row, statusText: taskStatus(row.status) }))));
const searchRows = computed(() => hits.value.map((hit) => ({ ...hit, statusText: instanceStatus(hit.status) })));
const meLabel = computed(() => me.value?.displayName || me.value?.name || '');
const userOptions = computed(() => people.value.map((p) => ({ label: p.displayName || p.name, value: p.id })));
const studentOptions = computed(() => userOptions.value.filter((p) => p.value !== me.value?.id));
const processOptions = computed(() => processes.value.map((p) => ({ label: p.name, value: p.id })));
const transferOptions = computed(() => userOptions.value.filter((p) => p.value !== activeTask.value?.assigneeId));
const openedPending = computed(() => detail.value?.tasks.find((t) => t.id === openedTaskId.value && t.status === 0));
const activeTask = computed(() => (openedPending.value?.kind === 1 ? openedPending.value : undefined));
const ccTask = computed(() => (openedPending.value?.kind === 2 ? openedPending.value : undefined));
const handleFields = computed(() => {
  const nodeKey = activeTask.value?.nodeName ? activeTask.value.nodeKey : '';
  const nodes = detail.value?.nodeFields || [];
  const node = nodes.find((item) => item.nodeKey === (activeTask.value?.nodeKey || nodeKey));
  return node?.fields || [];
});
const visibleHandleFields = computed(() => handleFields.value.filter((field) => field.access !== 'hidden'));
const visibleStartFields = computed(() => startFields.value.filter((field) => field.access !== 'hidden' && field.key !== 'studentUserId' && field.key !== 'counselorUserId'));
const counselorAccess = computed(() => startFields.value.find((field) => field.key === 'counselorUserId')?.access || 'editable');
const canWithdraw = computed(() => !!detail.value && detail.value.status === 1 && detail.value.userId === me.value?.id);
const canResubmit = computed(() => !!detail.value && detail.value.status === 0 && detail.value.userId === me.value?.id);
const chart = computed(() => {
  const empty = { nodes: [] as ChartNode[], edges: [] as ChartEdge[], states: {} as Record<string, NodeMark> };
  const view = detail.value;
  if (!view?.definition) return empty;
  try {
    const parsed = JSON.parse(view.definition) as { nodes?: RawFlowNode[]; edges?: RawFlowEdge[] };
    const nodes = (parsed.nodes || []).map((node) => ({ key: node.key, type: node.type, name: node.name || node.key }));
    const edges = (parsed.edges || []).map((edge, index) => ({
      key: edge.key || `e${index + 1}`,
      from: edge.from,
      to: edge.to,
      label: edgeCaption(edge),
    }));
    return {
      nodes,
      edges,
      states: instanceMarks({
        status: view.status,
        tasks: view.tasks || [],
        history: (view.history || []).map((item) => ({ action: item.action, nodeKey: item.nodeKey })),
      }, nodes, edges),
    };
  } catch {
    return empty;
  }
});
const timeline = computed(() => {
  const view = detail.value;
  if (!view) return [];
  const names = new Map(chart.value.nodes.map((node) => [node.key, node.name]));
  const items = (view.history || []).map((item, index) => {
    let comment = item.comment || '';
    if (item.action === 'choose' && comment) comment = `走向${names.get(comment) || comment}`;
    return {
      id: `h-${index}-${item.action}`,
      time: item.createTime || '',
      actor: item.operatorName || '系统',
      action: item.action,
      actionName: item.actionName || item.action,
      node: item.nodeName || names.get(item.nodeKey || '') || '',
      comment,
      order: index,
    };
  });
  (view.tasks || []).filter((task) => task.status === 0).forEach((task, index) => {
    items.push({
      id: `t-${task.id}`,
      time: task.createTime || '',
      actor: task.assigneeName || '待定',
      action: task.kind === 2 ? 'cc-pending' : 'pending',
      actionName: task.kind === 2 ? '待阅' : '待处理',
      node: task.nodeName || names.get(task.nodeKey) || '',
      comment: '',
      order: 1000 + index,
    });
  });
  return items.sort((left, right) => {
    if (left.time && right.time && left.time !== right.time) return left.time.localeCompare(right.time);
    if (left.time && !right.time) return -1;
    if (!left.time && right.time) return 1;
    return left.order - right.order;
  });
});

function instanceStatus(status: number) {
  return ['草稿', '审批中', '已通过', '已驳回', '已取消', '已终止'][status] || String(status);
}
function taskStatus(status: number) {
  return ['待处理', '已同意', '已驳回', '已转办', '已取消', '已阅'][status] || String(status);
}
function requestId() {
  return crypto.randomUUID();
}
async function unwrap<T>(pending: Promise<ApiEnvelope<T>>) {
  const body = await pending;
  if (body.code !== 0) throw new Error(body.message || '请求失败');
  return body.data;
}
function tell(error: unknown) {
  MessagePlugin.error(error instanceof Error ? error.message : '请求失败');
}

async function loadList() {
  if (tab.value === 'search') return;
  loading.value = true;
  try {
    if (!me.value) me.value = await unwrap(getApi<Person>('/Approval/Runtime/Me'));
    if (tab.value === 'drafts') {
      drafts.value = (await unwrap(getApi<DraftRow[]>('/Approval/Runtime/Drafts'))) || [];
    } else {
      const path = tab.value === 'done' ? '/Approval/Runtime/Done' : tab.value === 'cc' ? '/Approval/Runtime/Cc' : '/Approval/Runtime/Inbox';
      rows.value = (await unwrap(getApi<TaskRow[]>(path))) || [];
    }
  } catch (error) {
    tell(error);
  } finally {
    loading.value = false;
  }
}

function shownValue(key: string) {
  return editValues.value[key] || '';
}
function fillEdits(view: InstanceView) {
  const current: Record<string, string> = {};
  try {
    const parsed = JSON.parse(view.formData || '{}') as Record<string, unknown>;
    Object.keys(parsed).forEach((key) => {
      current[key] = parsed[key] == null ? '' : String(parsed[key]);
    });
  } catch {
    /* 表单值保持空白 */
  }
  editValues.value = current;
}
function openInstance(instanceId: string, taskId: string) {
  openedTaskId.value = taskId;
  detailTab.value = 'timeline';
  void unwrap(getApi<InstanceView>('/Approval/Runtime/View', { instanceId }))
    .then((view) => {
      detail.value = view;
      fillEdits(view);
      detailOpen.value = true;
    })
    .catch(tell);
}
function onRow(context: RowEventContext<TableRowData>) {
  const row = context.row as TaskRow;
  openInstance(row.instanceId, row.id || '');
}
function onSearchRow(context: RowEventContext<TableRowData>) {
  const row = context.row as SearchHit;
  openInstance(row.instanceId, '');
}
async function runSearch() {
  if (!keyword.value.trim()) {
    MessagePlugin.warning('请填写事由关键字');
    return;
  }
  loading.value = true;
  try {
    hits.value = (await unwrap(getApi<SearchHit[]>('/Approval/Runtime/Search', { field: 'reason', keyword: keyword.value.trim() }))) || [];
  } catch (error) {
    tell(error);
  } finally {
    loading.value = false;
  }
}
function editablePayload() {
  const data: Record<string, string> = {};
  visibleHandleFields.value.filter((field) => field.access === 'editable').forEach((field) => {
    data[field.key] = editValues.value[field.key] ?? '';
  });
  return JSON.stringify(data);
}

async function refreshDetail() {
  if (!detail.value) return;
  detail.value = await unwrap(getApi<InstanceView>('/Approval/Runtime/View', { instanceId: detail.value.instanceId }));
  fillEdits(detail.value);
  await loadList();
}
function onProcessChange() {
  void loadStartFields(start.value.processId).catch(tell);
}

async function agree() {
  if (!detail.value || !activeTask.value) return;
  try {
    await unwrap(postApi('/Approval/Runtime/Agree', {
      taskId: activeTask.value.id,
      comment: '同意',
      data: editablePayload(),
      requestId: requestId(),
      instanceVersion: detail.value.version,
    }));
    MessagePlugin.success('已同意');
    await refreshDetail();
  } catch (error) {
    tell(error);
  }
}

async function reject() {
  if (!detail.value || !activeTask.value) return;
  if (!rejectComment.value.trim()) {
    MessagePlugin.warning('驳回意见必填');
    return;
  }
  try {
    await unwrap(postApi('/Approval/Runtime/Reject', {
      taskId: activeTask.value.id,
      comment: rejectComment.value,
      data: editablePayload(),
      requestId: requestId(),
      instanceVersion: detail.value.version,
    }));
    rejectOpen.value = false;
    rejectComment.value = '';
    MessagePlugin.success('已驳回');
    await refreshDetail();
  } catch (error) {
    tell(error);
  }
}

async function transfer() {
  if (!detail.value || !activeTask.value || !transferUserId.value) {
    MessagePlugin.warning('请选择转办对象');
    return;
  }
  try {
    await unwrap(postApi('/Approval/Runtime/Transfer', {
      taskId: activeTask.value.id,
      targetUserId: transferUserId.value,
      comment: transferComment.value,
      requestId: requestId(),
      instanceVersion: detail.value.version,
    }));
    transferOpen.value = false;
    MessagePlugin.success('已转办');
    await refreshDetail();
  } catch (error) {
    tell(error);
  }
}

async function loadStartFields(processId?: number) {
  if (!processId) {
    startFields.value = [];
    return;
  }
  const form = await unwrap(getApi<{ fields: FieldRule[]; picks?: PickNode[] }>('/Approval/Runtime/StartForm', { processId }));
  startFields.value = form?.fields || [];
  picks.value = form?.picks || [];
  const nextPicks: Record<string, number | undefined> = {};
  picks.value.forEach((pick) => {
    nextPicks[pick.nodeKey] = pickUsers.value[pick.nodeKey];
  });
  pickUsers.value = nextPicks;
  const next: Record<string, string> = {};
  startFields.value.forEach((field) => {
    next[field.key] = fieldValues.value[field.key] || '';
  });
  fieldValues.value = next;
}
async function openStart() {
  try {
    me.value = await unwrap(getApi<Person>('/Approval/Runtime/Me'));
    people.value = (await unwrap(getApi<Person[]>('/Approval/Runtime/Candidates'))) || [];
    processes.value = (await unwrap(getApi<ProcessOption[]>('/Approval/Runtime/Processes'))) || [];
    start.value = {
      processId: processes.value[0]?.id,
      proxy: false,
      subjectUserId: undefined,
      counselorUserId: undefined,
      reason: '',
    };
    fieldValues.value = {};
    pickUsers.value = {};
    picks.value = [];
    await loadStartFields(start.value.processId);
    startOpen.value = true;
  } catch (error) {
    tell(error);
  }
}
function startPayload(studentId: number) {
  const data: Record<string, string | number> = { studentUserId: studentId };
  if (counselorAccess.value !== 'hidden' && start.value.counselorUserId) data.counselorUserId = start.value.counselorUserId;
  visibleStartFields.value.forEach((field) => {
    if (field.access === 'readonly') return;
    data[field.key] = fieldValues.value[field.key] ?? '';
  });
  return JSON.stringify(data);
}

async function submitStart() {
  const studentId = start.value.proxy ? start.value.subjectUserId : me.value?.id;
  const needCounselor = startFields.value.some((field) => field.key === 'counselorUserId' && field.access !== 'hidden');
  if (!start.value.processId || !studentId || (needCounselor && !start.value.counselorUserId)) {
    MessagePlugin.warning(start.value.proxy ? '代发起必须选择学生和该生辅导员' : '请选择该生辅导员');
    return;
  }
  const missingPick = picks.value.find((pick) => !pickUsers.value[pick.nodeKey]);
  if (missingPick) {
    MessagePlugin.warning(`请为「${missingPick.name || '发起人自选'}」选择办理人`);
    return;
  }
  if (start.value.proxy && studentId === me.value?.id) {
    MessagePlugin.warning('代发起不能选择自己');
    return;
  }
  saving.value = true;
  try {
    const assigneePicks = picks.value.length
      ? JSON.stringify(Object.fromEntries(picks.value.map((pick) => [pick.nodeKey, pickUsers.value[pick.nodeKey]])))
      : undefined;
    await unwrap(postApi('/Approval/Runtime/Start', {
      processId: start.value.processId,
      proxy: start.value.proxy,
      subjectUserId: start.value.proxy ? studentId : 0,
      data: startPayload(studentId),
      assigneePicks,
      requestId: requestId(),
    }));
    startOpen.value = false;
    MessagePlugin.success('已提交');
    tab.value = 'inbox';
    await loadList();
  } catch (error) {
    tell(error);
  } finally {
    saving.value = false;
  }
}

async function markRead() {
  if (!detail.value || !ccTask.value) return;
  try {
    await unwrap(postApi('/Approval/Runtime/Read', {
      taskId: ccTask.value.id,
      requestId: requestId(),
    }));
    MessagePlugin.success('已阅');
    await refreshDetail();
  } catch (error) {
    tell(error);
  }
}

async function addSign() {
  if (!detail.value || !activeTask.value || !addSignUserId.value) {
    MessagePlugin.warning('请选择加签人');
    return;
  }
  try {
    await unwrap(postApi('/Approval/Runtime/AddSign', {
      taskId: activeTask.value.id,
      targetUserId: addSignUserId.value,
      comment: addSignComment.value,
      requestId: requestId(),
      instanceVersion: detail.value.version,
    }));
    addSignOpen.value = false;
    MessagePlugin.success('已加签');
    await refreshDetail();
  } catch (error) {
    tell(error);
  }
}

async function withdraw() {
  if (!detail.value) return;
  try {
    await unwrap(postApi('/Approval/Runtime/Withdraw', {
      instanceId: detail.value.instanceId,
      reason: '撤回',
      requestId: requestId(),
      instanceVersion: detail.value.version,
    }));
    withdrawOpen.value = false;
    MessagePlugin.success('已撤回');
    detailOpen.value = false;
    tab.value = 'drafts';
    await loadList();
  } catch (error) {
    tell(error);
  }
}
async function openResubmit() {
  if (!detail.value) return;
  try {
    fieldValues.value = { ...editValues.value };
    await loadStartFields(detail.value.processId);
    visibleStartFields.value.forEach((field) => {
      if (editValues.value[field.key] != null) fieldValues.value[field.key] = editValues.value[field.key];
    });
    resubmitOpen.value = true;
  } catch (error) {
    tell(error);
  }
}
async function submitResubmit() {
  if (!detail.value) return;
  saving.value = true;
  try {
    const data: Record<string, string> = {};
    visibleStartFields.value.forEach((field) => {
      if (field.access === 'readonly') return;
      data[field.key] = fieldValues.value[field.key] ?? '';
    });
    await unwrap(postApi('/Approval/Runtime/Resubmit', {
      instanceId: detail.value.instanceId,
      data: JSON.stringify(data),
      requestId: requestId(),
      instanceVersion: detail.value.version,
    }));
    resubmitOpen.value = false;
    detailOpen.value = false;
    MessagePlugin.success('已重新提交');
    tab.value = 'inbox';
    await loadList();
  } catch (error) {
    tell(error);
  } finally {
    saving.value = false;
  }
}

onMounted(loadList);
</script>

<style scoped>
.block-title { margin: 16px 0 8px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.gap { margin-top: 12px; }
.search-bar { display: flex; gap: 8px; margin: 12px 0; max-width: 480px; }
.detail-tabs { margin-top: 16px; }
.hint { margin: 8px 0; color: var(--td-text-color-secondary); }
.timeline { list-style: none; margin: 8px 0 0; padding: 0 0 0 4px; }
.tl-item { position: relative; margin: 0; padding: 0 0 16px 18px; border-left: 2px solid #dcdcdc; }
.tl-item::before { content: ''; position: absolute; left: -5px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: #0052d9; }
.tl-time { color: #8a8a8a; font-size: 12px; }
.tl-title { font-weight: 600; margin-top: 2px; }
.tl-node, .tl-comment { color: #5e6670; margin-top: 2px; }
</style>
