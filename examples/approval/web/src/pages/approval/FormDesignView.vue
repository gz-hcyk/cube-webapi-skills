<template>
  <t-card :title="title || '表单设计'" :bordered="false">
    <t-table row-key="id" :data="forms" :columns="columns" :loading="loading" hover>
      <template #op="{ row }">
        <t-link theme="primary" @click="open(row)">设计</t-link>
      </template>
    </t-table>

    <t-dialog v-model:visible="openEditor" :header="current?.name || '表单字段'" width="720px" :footer="false">
      <p class="hint">字段会写入表单草稿。学生字段键是 studentUserId，辅导员字段键是 counselorUserId。</p>
      <t-table row-key="key" :data="fields" :columns="fieldColumns" size="small">
        <template #label="{ row }">
          <t-input v-model="row.label" />
        </template>
        <template #key="{ row }">
          <t-input v-model="row.key" />
        </template>
        <template #op="{ row }">
          <t-link theme="danger" @click="removeField(row.key)">移除</t-link>
        </template>
      </t-table>
      <div class="actions">
        <t-button variant="outline" @click="addField">添加字段</t-button>
        <t-button theme="primary" :loading="saving" @click="save">保存草稿</t-button>
        <t-button theme="success" :loading="saving" @click="publish">发布</t-button>
      </div>
    </t-dialog>
  </t-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getApi, postApi, type ApiEnvelope } from '@/api/http';

defineProps<{ area?: string; controller?: string; title?: string }>();

interface FormRow {
  id: number;
  code: string;
  name: string;
  publishedVersion?: number;
  categoryName?: string;
}
interface FieldRow {
  key: string;
  label: string;
  search?: boolean;
}
interface CategoryGroup {
  name: string;
  forms?: { id: number; code: string }[];
}
interface DesignBody {
  id: number;
  name: string;
  schema: string;
  publishedVersion: number;
}

const forms = ref<FormRow[]>([]);
const fields = ref<FieldRow[]>([]);
const current = ref<DesignBody | null>(null);
const loading = ref(false);
const saving = ref(false);
const openEditor = ref(false);

const columns = [
  { colKey: 'categoryName', title: '分类' },
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '编码' },
  { colKey: 'publishedVersion', title: '已发布版本' },
  { colKey: 'op', title: '操作', cell: 'op' },
];
const fieldColumns = [
  { colKey: 'key', title: '字段键', cell: 'key' },
  { colKey: 'label', title: '显示名', cell: 'label' },
  { colKey: 'op', title: '操作', cell: 'op' },
];

async function unwrap<T>(pending: Promise<ApiEnvelope<T>>) {
  const body = await pending;
  if (body.code !== 0) throw new Error(body.message || '请求失败');
  return body.data;
}
function tell(error: unknown) {
  MessagePlugin.error(error instanceof Error ? error.message : '请求失败');
}
function readFields(schema: string): FieldRow[] {
  try {
    const parsed = JSON.parse(schema) as { fields?: { key?: string; label?: string; search?: boolean }[] };
    return (parsed.fields || []).map((field) => ({ key: field.key || '', label: field.label || field.key || '', search: field.search }));
  } catch {
    return [];
  }
}

async function load() {
  loading.value = true;
  try {
    const data = await unwrap(getApi<FormRow[]>('/ApprovalAdmin/FormDefinition', { pageIndex: 1, pageSize: 50 }));
    const grouped = (await unwrap(getApi<CategoryGroup[]>('/ApprovalAdmin/FormDefinition/ByCategory'))) || [];
    const names = new Map<string, string>();
    grouped.forEach((group) => (group.forms || []).forEach((form) => names.set(form.code, group.name)));
    forms.value = (data || []).map((form) => ({ ...form, categoryName: names.get(form.code) || '' }));
  } catch (error) {
    tell(error);
  } finally {
    loading.value = false;
  }
}

async function open(row: FormRow) {
  try {
    current.value = await unwrap(getApi<DesignBody>('/ApprovalAdmin/FormDefinition/Design', { id: row.id }));
    fields.value = readFields(current.value.schema || '{"fields":[]}');
    openEditor.value = true;
  } catch (error) {
    tell(error);
  }
}

function addField() {
  fields.value = [...fields.value, { key: 'field' + (fields.value.length + 1), label: '新字段' }];
}
function removeField(key: string) {
  fields.value = fields.value.filter((field) => field.key !== key);
}
function schemaText() {
  return JSON.stringify({
    fields: fields.value
      .filter((field) => field.key.trim())
      .map((field) => ({ key: field.key.trim(), label: field.label.trim() || field.key.trim(), ...(field.search ? { search: true } : {}) })),
  });
}

async function save() {
  if (!current.value) return;
  saving.value = true;
  try {
    await unwrap(postApi('/ApprovalAdmin/FormDefinition/SaveDesign', { id: current.value.id, content: schemaText() }));
    MessagePlugin.success('草稿已保存');
    await load();
  } catch (error) {
    tell(error);
  } finally {
    saving.value = false;
  }
}

async function publish() {
  if (!current.value) return;
  saving.value = true;
  try {
    await unwrap(postApi('/ApprovalAdmin/FormDefinition/SaveDesign', { id: current.value.id, content: schemaText() }));
    await unwrap(postApi('/ApprovalAdmin/FormDefinition/Publish', { id: current.value.id }));
    MessagePlugin.success('已发布');
    openEditor.value = false;
    await load();
  } catch (error) {
    tell(error);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.hint { margin: 0 0 12px; color: var(--td-text-color-secondary); }
.actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
