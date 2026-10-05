<template>
  <t-card title="流程设计" :bordered="false">
    <p class="hint">可增删和调整节点、连线、排他条件、办理人规则和字段权限。保存草稿和发布都走服务端校验，错误显示在编辑区。</p>
    <t-table row-key="id" :data="processes" :columns="columns" :loading="loading" hover>
      <template #op="{ row }">
        <t-link theme="primary" @click="open(row)">设计</t-link>
      </template>
    </t-table>

    <t-drawer v-model:visible="openEditor" :header="currentName" size="1100px" :close-btn="true">
      <t-alert v-if="errorText" theme="error" class="gap" :close="true" @close="errorText = ''">{{ errorText }}</t-alert>
      <p class="hint">流程图只展示结构。点节点打开属性，点连线改条件。用工具栏增删后图会立刻刷新。不能在图上拖拽。</p>
      <div class="toolbar">
        <t-button size="small" variant="outline" @click="addNode('approve')">添加审批</t-button>
        <t-button size="small" variant="outline" @click="addNode('cc')">添加抄送</t-button>
        <t-button size="small" variant="outline" @click="addExclusive">添加排他网关</t-button>
        <t-button size="small" variant="outline" @click="addParallel">添加成对并行</t-button>
        <t-button size="small" variant="outline" @click="addNode('end')">添加结束</t-button>
        <t-button size="small" variant="outline" @click="addNode('start')">添加开始</t-button>
        <t-button size="small" variant="outline" @click="addEdge">添加连线</t-button>
      </div>
      <flow-chart
        :nodes="chartNodes"
        :edges="chartEdges"
        :selected="selectedKey"
        :selected-edge="edgeKey"
        zoomable
        canvas-max-height="560px"
        @select="select"
        @select-edge="openEdge"
      />
      <div class="compact">
        <t-select v-model="selectedKey" :options="nodeKeyOptions" placeholder="编辑节点" clearable @change="onPickNode" />
        <t-select v-model="edgeKey" :options="edgeKeyOptions" placeholder="编辑连线" clearable @change="onPickEdge" />
      </div>
      <template #footer>
        <div class="actions">
          <t-button theme="primary" :loading="saving" @click="save">保存草稿</t-button>
          <t-button theme="success" :loading="saving" @click="publish">发布</t-button>
        </div>
      </template>
    </t-drawer>

    <t-drawer v-model:visible="nodeEditorOpen" :header="selected ? `节点 ${selected.name}` : '节点'" size="480px" :footer="false" :close-btn="true">
      <template v-if="selected">
        <t-form label-width="108px">
          <t-form-item label="名称"><t-input v-model="selected.name" /></t-form-item>
          <t-form-item label="类型">
            <t-select v-model="selected.type" :options="typeOptions" />
          </t-form-item>
          <t-form-item v-if="selected.type === 'approve'" label="处理方式">
            <t-radio-group v-model="selected.mode">
              <t-radio value="any">或签</t-radio>
              <t-radio value="all">会签</t-radio>
              <t-radio value="sequential">依次审批</t-radio>
            </t-radio-group>
          </t-form-item>
          <template v-if="selected.type === 'approve' || selected.type === 'cc'">
            <t-form-item label="办理人规则">
              <t-select v-model="selected.assignee.type" :options="assigneeOptions" />
            </t-form-item>
            <t-form-item v-if="selected.assignee.type === 'user'" label="指定成员">
              <t-select v-model="selected.assignee.userIds" multiple :options="userOptions" placeholder="选择用户" />
            </t-form-item>
            <t-form-item v-if="selected.assignee.type === 'role' || selected.assignee.type === 'roleDept'" label="角色">
              <t-select v-model="selected.assignee.roleIds" multiple :options="roleOptions" placeholder="选择角色" />
            </t-form-item>
            <t-form-item v-if="selected.assignee.type === 'deptManager'" label="上溯层级">
              <t-input v-model="selected.assignee.level" />
            </t-form-item>
            <t-form-item v-if="selected.assignee.type === 'deptMember' || selected.assignee.type === 'roleDept'" label="部门">
              <t-select v-model="selected.assignee.departmentId" :options="deptOptions" placeholder="选择部门" />
            </t-form-item>
            <t-form-item v-if="selected.assignee.type === 'formContact' || selected.assignee.type === 'subjectCounselor'" label="表单字段">
              <t-select v-model="selected.assignee.field" :options="fieldOptions" placeholder="联系人字段" />
            </t-form-item>
          </template>
        </t-form>
        <h4 class="block-title">字段权限</h4>
        <t-table row-key="key" :data="selected.fields" :columns="fieldColumns" size="small">
          <template #access="{ row }">
            <t-select v-model="row.access" :options="accessOptions" />
          </template>
        </t-table>
        <div class="row-actions">
          <button type="button" class="text-btn" :data-name="selected.name" data-action="up" @click="move(selected.key, -1)">上移</button>
          <button type="button" class="text-btn" :data-name="selected.name" data-action="down" @click="move(selected.key, 1)">下移</button>
          <button type="button" class="text-btn danger" :data-name="selected.name" data-action="remove" @click="removeNode(selected.key)">移除</button>
        </div>
      </template>
    </t-drawer>

    <t-dialog v-model:visible="edgeEditorOpen" header="连线" :footer="false" width="560px">
      <template v-if="selectedEdge">
        <div data-edge-editor>
        <t-form label-width="96px">
          <t-form-item label="从"><t-select v-model="selectedEdge.from" :options="nodeKeyOptions" /></t-form-item>
          <t-form-item label="到"><t-select v-model="selectedEdge.to" :options="nodeKeyOptions" /></t-form-item>
          <template v-if="edgeFromExclusive">
            <t-form-item label="默认出线"><t-checkbox v-model="selectedEdge.isDefault">其他条件都不成立时走这条</t-checkbox></t-form-item>
            <template v-if="!selectedEdge.isDefault">
              <t-form-item label="表单字段">
                <t-select v-model="selectedEdge.field" :options="fieldOptions" placeholder="选择流程表单字段" />
              </t-form-item>
              <t-form-item label="比较"><t-select v-model="selectedEdge.op" :options="opOptions" /></t-form-item>
              <t-form-item label="比较值">
                <t-input v-model="selectedEdge.value" :placeholder="selectedEdge.op === 'in' ? '多个值用逗号分隔' : '例如 3 或 病假'" />
              </t-form-item>
              <t-form-item label="优先级"><t-input v-model="selectedEdge.priority" /></t-form-item>
            </template>
            <p class="hint" data-edge-label>连线上显示：{{ edgePreview || '（未写条件）' }}</p>
          </template>
          <p v-else class="hint">条件只写在排他网关的出线上。先把起点改成排他网关，再选表单字段。</p>
        </t-form>
        <div class="actions">
          <t-button theme="primary" @click="edgeEditorOpen = false">完成</t-button>
          <t-button theme="danger" variant="outline" @click="removeEdge(selectedEdge.key)">移除</t-button>
        </div>
        </div>
      </template>
    </t-dialog>
  </t-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getApi, postApi, type ApiEnvelope } from '@/api/http';
import FlowChart from './FlowChart.vue';
import { edgeCaption, type ChartEdge, type ChartNode } from './flowChart';

defineProps<{ area?: string; controller?: string; title?: string }>();

interface ProcessRow { id: number; code: string; name: string; publishedVersion?: number; categoryName?: string }
interface Named { id: number; name: string }
interface FormField { key: string; label: string }
interface FieldRule { key: string; access: string }
interface AssigneeRow { type: string; userIds: number[]; roleIds: number[]; level: string; departmentId?: number; field: string }
interface NodeRow { key: string; type: string; name: string; mode: string; assignee: AssigneeRow; fields: FieldRule[] }
interface EdgeRow { key: string; from: string; to: string; sort: number; isDefault: boolean; priority: string; field: string; op: string; value: string }
interface CategoryGroup { name: string; processes?: { code: string }[] }
interface RawNode {
  key: string; type: string; name: string; mode?: string;
  assignee?: { type?: string; userIds?: number[]; roleIds?: number[]; level?: number; departmentId?: number; field?: string };
  fields?: { key: string; access: string }[];
}
interface RawEdge {
  key?: string; from: string; to: string; sort?: number; default?: boolean; priority?: number;
  condition?: { field?: string; op?: string; value?: string | number };
}
interface DesignBody {
  id: number; name: string; definition?: string; publishedVersion?: number;
  formFields?: FormField[]; users?: Named[]; roles?: Named[]; departments?: Named[];
}

const processes = ref<ProcessRow[]>([]);
const nodes = ref<NodeRow[]>([]);
const edges = ref<EdgeRow[]>([]);
const formFields = ref<FormField[]>([]);
const users = ref<Named[]>([]);
const roles = ref<Named[]>([]);
const departments = ref<Named[]>([]);
const currentId = ref(0);
const currentName = ref('流程');
const selectedKey = ref('');
const edgeKey = ref('');
const nodeEditorOpen = ref(false);
const edgeEditorOpen = ref(false);
const loading = ref(false);
const saving = ref(false);
const openEditor = ref(false);
const errorText = ref('');

const columns = [
  { colKey: 'categoryName', title: '分类' },
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '编码' },
  { colKey: 'publishedVersion', title: '已发布版本' },
  { colKey: 'op', title: '操作', cell: 'op' },
];
const fieldColumns = [
  { colKey: 'key', title: '字段' },
  { colKey: 'access', title: '权限', cell: 'access' },
];
const typeOptions = [
  { label: '开始', value: 'start' },
  { label: '审批', value: 'approve' },
  { label: '抄送', value: 'cc' },
  { label: '排他网关', value: 'exclusive' },
  { label: '并行网关', value: 'parallel' },
  { label: '结束', value: 'end' },
];
const assigneeOptions = [
  { label: '指定成员', value: 'user' },
  { label: '指定角色', value: 'role' },
  { label: '部门负责人', value: 'deptManager' },
  { label: '相对申请人', value: 'applicant' },
  { label: '指定部门成员', value: 'deptMember' },
  { label: '该生辅导员', value: 'subjectCounselor' },
  { label: '发起人自选', value: 'starterPick' },
  { label: '表单内联系人', value: 'formContact' },
  { label: '角色与部门交集', value: 'roleDept' },
];
const accessOptions = [
  { label: '可编辑', value: 'editable' },
  { label: '只读', value: 'readonly' },
  { label: '隐藏', value: 'hidden' },
];
const opOptions = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'ne' },
  { label: '大于', value: 'gt' },
  { label: '大于等于', value: 'ge' },
  { label: '小于', value: 'lt' },
  { label: '小于等于', value: 'le' },
  { label: '属于', value: 'in' },
];

const selected = computed(() => nodes.value.find((node) => node.key === selectedKey.value));
const userOptions = computed(() => users.value.map((item) => ({ label: item.name, value: item.id })));
const roleOptions = computed(() => roles.value.map((item) => ({ label: item.name, value: item.id })));
const deptOptions = computed(() => departments.value.map((item) => ({ label: item.name, value: item.id })));
const fieldOptions = computed(() => formFields.value.map((item) => ({ label: item.label || item.key, value: item.key })));
const selectedEdge = computed(() => edges.value.find((edge) => edge.key === edgeKey.value));
const edgeFromExclusive = computed(() => nodes.value.find((node) => node.key === selectedEdge.value?.from)?.type === 'exclusive');
const edgePreview = computed(() => (selectedEdge.value ? edgeCaption(selectedEdge.value) : ''));
const nodeKeyOptions = computed(() => nodes.value.map((node) => ({ label: node.name || node.key, value: node.key })));
const edgeKeyOptions = computed(() => edges.value.map((edge) => ({
  label: `${nodeName(edge.from)} → ${nodeName(edge.to)}${edgeCaption(edge) ? `（${edgeCaption(edge)}）` : ''}`,
  value: edge.key,
})));
const chartNodes = computed<ChartNode[]>(() => nodes.value.map((node) => ({ key: node.key, type: node.type, name: node.name || node.key })));
const chartEdges = computed<ChartEdge[]>(() => edges.value.map((edge) => ({
  key: edge.key,
  from: edge.from,
  to: edge.to,
  label: edgeCaption(edge),
})));

function nodeName(key: string) {
  return nodes.value.find((node) => node.key === key)?.name || key;
}
function blankAssignee(): AssigneeRow {
  return { type: 'applicant', userIds: [], roleIds: [], level: '1', departmentId: undefined, field: '' };
}
function withFields(existing?: { key: string; access: string }[]): FieldRule[] {
  return formFields.value.map((field) => ({
    key: field.key,
    access: existing?.find((item) => item.key === field.key)?.access || 'editable',
  }));
}
function nextKey(prefix: string) {
  let n = nodes.value.length + edges.value.length + 1;
  let key = prefix + n;
  const used = new Set([...nodes.value.map((node) => node.key), ...edges.value.map((edge) => edge.key)]);
  while (used.has(key)) {
    n += 1;
    key = prefix + n;
  }
  return key;
}
function makeNode(type: string, name: string): NodeRow {
  return { key: nextKey(type === 'start' ? 's' : 'n'), type, name, mode: 'any', assignee: blankAssignee(), fields: withFields() };
}

async function unwrap<T>(pending: Promise<ApiEnvelope<T>>) {
  const body = await pending;
  if (body.code !== 0) throw new Error(body.message || '请求失败');
  return body.data;
}
function fail(error: unknown) {
  errorText.value = error instanceof Error ? error.message : '请求失败';
  MessagePlugin.error(errorText.value);
}
async function load() {
  loading.value = true;
  try {
    const data = await unwrap(getApi<ProcessRow[]>('/ApprovalAdmin/Process', { pageIndex: 1, pageSize: 50 }));
    const grouped = (await unwrap(getApi<CategoryGroup[]>('/ApprovalAdmin/FormDefinition/ByCategory'))) || [];
    const names = new Map<string, string>();
    grouped.forEach((group) => (group.processes || []).forEach((process) => names.set(process.code, group.name)));
    processes.value = (data || []).map((process) => ({ ...process, categoryName: names.get(process.code) || '' }));
  } catch (error) {
    fail(error);
  } finally {
    loading.value = false;
  }
}
function loadGraph(definition: string) {
  const parsed = JSON.parse(definition || '{}') as { nodes?: RawNode[]; edges?: RawEdge[] };
  nodes.value = (parsed.nodes || []).map((node) => ({
    key: node.key,
    type: node.type,
    name: node.name,
    mode: node.mode || 'any',
    assignee: {
      type: node.assignee?.type || 'applicant',
      userIds: node.assignee?.userIds || [],
      roleIds: node.assignee?.roleIds || [],
      level: String(node.assignee?.level || 1),
      departmentId: node.assignee?.departmentId || undefined,
      field: node.assignee?.field || '',
    },
    fields: withFields(node.fields),
  }));
  edges.value = (parsed.edges || []).map((edge, index) => ({
    key: edge.key || `e${index + 1}`,
    from: edge.from,
    to: edge.to,
    sort: edge.sort || index + 1,
    isDefault: !!edge.default,
    priority: String(edge.priority || 0),
    field: edge.condition?.field || '',
    op: normalizeOp(edge.condition?.op),
    value: storedValue(edge.condition?.value),
  }));
  selectedKey.value = '';
  edgeKey.value = '';
  nodeEditorOpen.value = false;
  edgeEditorOpen.value = false;
}
async function open(row: ProcessRow) {
  errorText.value = '';
  try {
    const design = await unwrap(getApi<DesignBody>('/ApprovalAdmin/Process/Design', { id: row.id }));
    currentId.value = design.id;
    currentName.value = design.name || row.name;
    formFields.value = design.formFields || [];
    users.value = design.users || [];
    roles.value = design.roles || [];
    departments.value = design.departments || [];
    loadGraph(design.definition || '{"nodes":[],"edges":[]}');
    openEditor.value = true;
  } catch (error) {
    fail(error);
  }
}
function select(key: string) {
  if (!key) return;
  selectedKey.value = key;
  nodeEditorOpen.value = true;
  edgeEditorOpen.value = false;
}
function onPickNode(value: unknown) {
  const key = String(value || '');
  if (!key) {
    selectedKey.value = '';
    nodeEditorOpen.value = false;
    return;
  }
  select(key);
}
function openEdge(key: string) {
  if (!key) return;
  edgeKey.value = key;
  edgeEditorOpen.value = true;
  nodeEditorOpen.value = false;
}
function onPickEdge(value: unknown) {
  const key = String(value || '');
  if (!key) {
    edgeKey.value = '';
    edgeEditorOpen.value = false;
    return;
  }
  openEdge(key);
}
function addNode(type: string) {
  if (type === 'start' && nodes.value.some((node) => node.type === 'start')) {
    errorText.value = '流程只能有一个开始节点';
    return;
  }
  const names: Record<string, string> = { start: '开始', approve: '审批', cc: '抄送', end: '结束' };
  const node = makeNode(type, names[type] || type);
  if (type === 'cc') node.assignee.type = 'user';
  nodes.value.push(node);
  select(node.key);
}
function addExclusive() {
  const node = makeNode('exclusive', '排他');
  const end = nodes.value.find((item) => item.type === 'end');
  nodes.value.push(node);
  const target = end?.key || node.key;
  edges.value.push({ key: nextKey('e'), from: node.key, to: target, sort: 1, isDefault: false, priority: '1', field: 'days', op: 'ge', value: '3' });
  edges.value.push({ key: nextKey('e'), from: node.key, to: target, sort: 2, isDefault: true, priority: '9', field: '', op: 'eq', value: '' });
  select(node.key);
}
function addParallel() {
  const split = makeNode('parallel', '并行分支');
  const join = makeNode('parallel', '并行汇聚');
  nodes.value.push(split, join);
  edges.value.push({ key: nextKey('e'), from: split.key, to: join.key, sort: 1, isDefault: false, priority: '0', field: '', op: 'eq', value: '' });
  edges.value.push({ key: nextKey('e'), from: split.key, to: join.key, sort: 2, isDefault: false, priority: '0', field: '', op: 'eq', value: '' });
  select(split.key);
}
function move(key: string, step: number) {
  const index = nodes.value.findIndex((node) => node.key === key);
  const next = index + step;
  if (index < 0 || next < 0 || next >= nodes.value.length) return;
  const copy = nodes.value.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  nodes.value = copy;
}
function removeNode(key: string) {
  nodes.value = nodes.value.filter((node) => node.key !== key);
  edges.value = edges.value.filter((edge) => edge.from !== key && edge.to !== key);
  if (selectedKey.value === key) {
    selectedKey.value = '';
    nodeEditorOpen.value = false;
  }
}
function addEdge() {
  const from = nodes.value[0]?.key || '';
  const to = nodes.value[1]?.key || from;
  const edge = { key: nextKey('e'), from, to, sort: edges.value.length + 1, isDefault: false, priority: '0', field: '', op: 'eq', value: '' };
  edges.value.push(edge);
  openEdge(edge.key);
}
function removeEdge(key: string) {
  edges.value = edges.value.filter((edge) => edge.key !== key);
  if (edgeKey.value === key) {
    edgeKey.value = '';
    edgeEditorOpen.value = false;
  }
}
function normalizeOp(op?: string) {
  if (op === 'gte') return 'ge';
  if (op === 'lte') return 'le';
  return op || 'eq';
}
function storedValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => (item == null ? '' : String(item))).join(',');
  return value == null ? '' : String(value);
}
function conditionValue(edge: EdgeRow) {
  const text = edge.value.trim();
  if (edge.op === 'in') {
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* 按逗号拆 */
      }
    }
    return text.split(/[,，]/).map((part) => part.trim()).filter(Boolean).map((part) => {
      const number = Number(part);
      return !Number.isNaN(number) && String(number) === part ? number : part;
    });
  }
  if (text === '') return '';
  const number = Number(text);
  return !Number.isNaN(number) && String(number) === text ? number : text;
}
function payload() {
  return JSON.stringify({
    nodes: nodes.value.map((node) => ({
      key: node.key,
      type: node.type,
      name: node.name || node.key,
      mode: node.type === 'approve' ? node.mode || 'any' : undefined,
      assignee: node.type === 'approve' || node.type === 'cc' ? {
        type: node.assignee.type,
        userIds: node.assignee.userIds,
        roleIds: node.assignee.roleIds,
        level: Number(node.assignee.level || 1),
        departmentId: node.assignee.departmentId || 0,
        field: node.assignee.field || undefined,
      } : undefined,
      fields: node.fields.filter((field) => field.key),
    })),
    edges: edges.value.map((edge, index) => ({
      key: edge.key,
      from: edge.from,
      to: edge.to,
      sort: Number(edge.sort || index + 1),
      default: edge.isDefault,
      priority: Number(edge.priority || 0),
      condition: !edge.isDefault && edge.field ? { field: edge.field, op: edge.op || 'eq', value: conditionValue(edge) } : undefined,
    })),
  });
}
async function save() {
  errorText.value = '';
  saving.value = true;
  try {
    await unwrap(postApi('/ApprovalAdmin/Process/SaveDesign', { id: currentId.value, content: payload() }));
    MessagePlugin.success('草稿已保存');
    await load();
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
}
async function publish() {
  errorText.value = '';
  saving.value = true;
  try {
    await unwrap(postApi('/ApprovalAdmin/Process/SaveDesign', { id: currentId.value, content: payload() }));
    await unwrap(postApi('/ApprovalAdmin/Process/Publish', { id: currentId.value }));
    MessagePlugin.success('已发布');
    await load();
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
}

load();
</script>

<style scoped>
.hint { margin: 0 0 12px; color: var(--td-text-color-secondary); }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.compact { display: flex; gap: 8px; margin-top: 12px; max-width: 640px; }
.block-title { margin: 16px 0 8px; }
.actions { display: flex; gap: 8px; }
.row-actions { display: flex; gap: 8px; margin-top: 16px; }
.gap { margin-bottom: 12px; }
.text-btn { border: 0; background: transparent; color: var(--td-brand-color); cursor: pointer; padding: 0 4px; }
.text-btn.danger { color: var(--td-error-color); }
</style>
