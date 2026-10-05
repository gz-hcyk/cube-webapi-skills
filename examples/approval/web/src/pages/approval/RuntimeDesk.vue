<template>
  <t-card :title="title || '审批办理'" :bordered="false">
    <template #actions>
      <t-button theme="primary" @click="openStart">发起申请</t-button>
    </template>
    <t-tabs v-model="tab" @change="loadList">
      <t-tab-panel value="inbox" label="待办" />
      <t-tab-panel value="done" label="已办" />
      <t-tab-panel value="drafts" label="草稿" />
    </t-tabs>
    <t-table
      :row-key="tab === 'drafts' ? 'instanceId' : 'id'"
      :data="displayRows"
      :columns="tab === 'drafts' ? draftColumns : columns"
      :loading="loading"
      hover
      @row-click="onRow"
    />

    <t-drawer v-model:visible="detailOpen" :header="detail?.title || '审批详情'" size="640px" :footer="false">
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
        <h4 class="block-title">审批轨迹</h4>
        <t-table row-key="action" :data="detail.history" :columns="historyColumns" size="small" />
        <div class="actions">
          <t-button v-if="activeTask" theme="primary" @click="agree">同意</t-button>
          <t-button v-if="activeTask" theme="danger" variant="outline" @click="rejectOpen = true">驳回</t-button>
          <t-button v-if="activeTask" variant="outline" @click="transferOpen = true">转办</t-button>
          <t-button v-if="canWithdraw" variant="outline" @click="withdraw">撤回</t-button>
          <t-button v-if="canResubmit" theme="primary" @click="openResubmit">重新提交</t-button>
        </div>
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
  </t-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin, type RowEventContext, type TableRowData } from 'tdesign-vue-next';
import { getApi, postApi, type ApiEnvelope } from '@/api/http';

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
}
interface HistoryRow {
  action: string;
  actionName: string;
  comment?: string;
  operatorName?: string;
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
  nodeFields?: NodeFields[];
  tasks: TaskRow[];
  history: HistoryRow[];
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

const tab = ref('inbox');
const rows = ref<TaskRow[]>([]);
const drafts = ref<DraftRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const detailOpen = ref(false);
const detail = ref<InstanceView | null>(null);
const openedTaskId = ref('');
const startOpen = ref(false);
const resubmitOpen = ref(false);
const startFields = ref<FieldRule[]>([]);
const fieldValues = ref<Record<string, string>>({});
const editValues = ref<Record<string, string>>({});
const rejectOpen = ref(false);
const transferOpen = ref(false);
const rejectComment = ref('');
const transferComment = ref('');
const transferUserId = ref<number | undefined>();
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
const historyColumns = [
  { colKey: 'actionName', title: '动作' },
  { colKey: 'operatorName', title: '操作人' },
  { colKey: 'comment', title: '意见' },
];

const displayRows = computed(() => (tab.value === 'drafts'
  ? drafts.value
  : rows.value.map((row) => ({ ...row, statusText: taskStatus(row.status) }))));
const meLabel = computed(() => me.value?.displayName || me.value?.name || '');
const userOptions = computed(() => people.value.map((p) => ({ label: p.displayName || p.name, value: p.id })));
const studentOptions = computed(() => userOptions.value.filter((p) => p.value !== me.value?.id));
const processOptions = computed(() => processes.value.map((p) => ({ label: p.name, value: p.id })));
const transferOptions = computed(() => userOptions.value.filter((p) => p.value !== activeTask.value?.assigneeId));
const activeTask = computed(() => detail.value?.tasks.find((t) => t.id === openedTaskId.value && t.status === 0 && t.kind === 1));
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
  loading.value = true;
  try {
    if (!me.value) me.value = await unwrap(getApi<Person>('/Approval/Runtime/Me'));
    if (tab.value === 'drafts') {
      drafts.value = (await unwrap(getApi<DraftRow[]>('/Approval/Runtime/Drafts'))) || [];
    } else {
      const path = tab.value === 'done' ? '/Approval/Runtime/Done' : '/Approval/Runtime/Inbox';
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
function onRow(context: RowEventContext<TableRowData>) {
  const row = context.row as TaskRow;
  openedTaskId.value = row.id || '';
  void unwrap(getApi<InstanceView>('/Approval/Runtime/View', { instanceId: row.instanceId }))
    .then((view) => {
      detail.value = view;
      fillEdits(view);
      detailOpen.value = true;
    })
    .catch(tell);
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
  const form = await unwrap(getApi<{ fields: FieldRule[] }>('/Approval/Runtime/StartForm', { processId }));
  startFields.value = form?.fields || [];
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
  if (!start.value.processId || !studentId || !start.value.counselorUserId) {
    MessagePlugin.warning(start.value.proxy ? '代发起必须选择学生和该生辅导员' : '请选择该生辅导员');
    return;
  }
  if (start.value.proxy && studentId === me.value?.id) {
    MessagePlugin.warning('代发起不能选择自己');
    return;
  }
  saving.value = true;
  try {
    await unwrap(postApi('/Approval/Runtime/Start', {
      processId: start.value.processId,
      proxy: start.value.proxy,
      subjectUserId: start.value.proxy ? studentId : 0,
      data: startPayload(studentId),
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

async function withdraw() {
  if (!detail.value) return;
  try {
    await unwrap(postApi('/Approval/Runtime/Withdraw', {
      instanceId: detail.value.instanceId,
      reason: '撤回',
      requestId: requestId(),
      instanceVersion: detail.value.version,
    }));
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
.actions { display: flex; gap: 8px; margin-top: 16px; }
.gap { margin-top: 12px; }
</style>
