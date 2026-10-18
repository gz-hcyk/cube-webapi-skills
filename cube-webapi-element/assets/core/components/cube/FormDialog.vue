<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    :width="dialogWidth"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    class="cube-form-dialog"
    @closed="onClosed"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="104px"
      label-position="right"
      class="cube-form"
      @submit.prevent
    >
      <!-- 单组：直接铺两列；多组：按 category 分 tab（对应 MVC 的 _Form_* 分部） -->
      <div v-if="groups.length <= 1" class="cube-form-grid">
        <el-form-item
          v-for="it in flatItems"
          :key="it.prop"
          :label="it.label"
          :prop="it.prop"
          :class="{ 'cube-form-item--full': isFullWidth(it) }"
        >
          <FieldControl
            v-model="form[it.prop]"
            :item="it"
            :disabled="it.disabled || saving"
            :tree-data="treeData"
            :upload-path="uploadPath"
          />
          <div v-if="it.description" class="cube-form-tip">{{ it.description }}</div>
        </el-form-item>
      </div>

      <el-tabs v-else v-model="activeTab" class="cube-form-tabs">
        <el-tab-pane v-for="g in groups" :key="g.category" :label="g.category" :name="g.category">
          <div class="cube-form-grid">
            <el-form-item
              v-for="it in g.items"
              :key="it.prop"
              :label="it.label"
              :prop="it.prop"
              :class="{ 'cube-form-item--full': isFullWidth(it) }"
            >
              <FieldControl
                v-model="form[it.prop]"
                :item="it"
                :disabled="it.disabled || saving"
                :tree-data="treeData"
                :upload-path="uploadPath"
              />
              <div v-if="it.description" class="cube-form-tip">{{ it.description }}</div>
            </el-form-item>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-form>

    <template #footer>
      <div class="cube-dialog-footer">
        <el-button :disabled="saving" @click="close">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          {{ mode === 'create' ? '创建' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import FieldControl from './FieldControl.vue';
import {
  buildFormItems,
  buildFormRules,
  camel,
  deserializeMultiValue,
  groupFormItems,
  serializeMultiValue,
  toTreeSelectData,
  type DataField,
  type FormItemSpec,
} from '@/api/fieldRender';
import type { EntityResource } from '@/api/useEntityResource';

/**
 * 表单弹窗（模板继承的"新增/编辑"统一形态）
 *
 * 用法（实体页 1 行）：
 *   <FormDialog v-model="formVisible" :resource="resource" :mode="mode" :row="editing" @saved="reload" />
 *
 * 也可以脱离 resource 独立使用（如系统配置单表单）：
 *   <FormDialog v-model="visible" :fields="fields" title="系统配置" :submit="save" />
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    mode?: 'create' | 'edit';
    title?: string;
    /** 传入资源基类 → 自动取表单字段、自动提交 */
    resource?: EntityResource;
    /** 覆盖字段（不传则取 resource 的 addForm / editForm） */
    fields?: DataField[];
    /** 编辑行数据（列表行，至少含 id） */
    row?: Record<string, any> | null;
    /** 覆盖提交逻辑；不传则走 resource.create / resource.update */
    submit?: (payload: Record<string, any>) => Promise<void>;
    uploadPath?: string;
    width?: string;
  }>(),
  {
    mode: 'create',
    title: '',
    fields: undefined,
    row: null,
    submit: undefined,
    uploadPath: '',
    width: '',
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const formRef = ref();
const form = reactive<Record<string, any>>({});
const saving = ref(false);
const activeTab = ref('');

const sourceFields = computed<DataField[]>(() => {
  if (props.fields?.length) return props.fields;
  if (!props.resource) return [];
  return props.mode === 'create' ? props.resource.addFields.value : props.resource.editFields.value;
});

const items = computed<FormItemSpec[]>(() =>
  buildFormItems(sourceFields.value, {
    lookups: props.resource?.lookups.value,
    mode: props.mode,
  }),
);

const groups = computed(() => groupFormItems(items.value));
const flatItems = computed(() => items.value);
const rules = computed(() => buildFormRules(items.value, props.mode));

const treeData = computed(() => {
  if (!props.resource) return [];
  const nodes = props.resource.treeRows.value ?? [];
  return toTreeSelectData(nodes, props.row?.id);
});

const dialogTitle = computed(() => {
  if (props.title) return props.title;
  const base = props.resource ? `${props.resource.controller.value}` : '记录';
  return props.mode === 'create' ? `新增${base}` : `编辑${base}`;
});

const dialogWidth = computed(() => {
  if (props.width) return props.width;
  if (groups.value.length > 1) return '820px';
  return flatItems.value.some((it) => it.control === 'textarea' || it.control === 'rich-text') ? '720px' : '640px';
});

/** 后端字段名可能是显示列 CategoryName，表单 prop 却是 mapField categoryID。 */
function propForFieldError(field: string): string {
  const target = field.toLowerCase();
  const hit = items.value.find((it) => {
    const name = String(it.field.name ?? '').toLowerCase();
    const mapped = String(it.field.mapField ?? '').toLowerCase();
    return it.prop.toLowerCase() === target || name === target || mapped === target;
  });
  return hit?.prop ?? camel(field);
}

function isFullWidth(it: FormItemSpec): boolean {
  return it.control === 'textarea' || it.control === 'rich-text' || it.control === 'upload' || it.control === 'daterange';
}

/** 各控件的"空值"：多选必须 []，数字/下拉用 undefined 才能露出 placeholder */
function emptyValue(it: FormItemSpec): any {
  if (it.multiple) return [];
  if (it.control === 'switch') return false;
  if (['number', 'select', 'tree-select', 'date', 'datetime', 'time', 'daterange'].includes(it.control)) return undefined;
  return '';
}

function resetForm() {
  for (const key of Object.keys(form)) delete form[key];
  for (const it of items.value) form[it.prop] = emptyValue(it);
}

function fillForm(data: Record<string, any>) {
  for (const it of items.value) {
    const raw = data[it.prop] ?? data[camel(it.field.name)] ?? data[it.field.name];
    if (it.multiple) form[it.prop] = deserializeMultiValue(raw);
    else if (it.control === 'switch') form[it.prop] = raw === true || raw === 1 || raw === '1' || raw === 'true';
    else form[it.prop] = raw === null || raw === undefined || raw === '' ? emptyValue(it) : raw;
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    resetForm();
    activeTab.value = groups.value[0]?.category ?? '';
    if (props.mode === 'edit' && props.row) {
      fillForm(props.row);
      // 列表行可能缺少表单字段 → 用详情接口补全（失败不阻断，行数据已可用）
      if (props.resource && props.row.id !== undefined) {
        try {
          const full = await props.resource.fetchOne(props.row.id);
          fillForm({ ...props.row, ...full });
        } catch {
          /* 忽略：行内数据通常已够用 */
        }
      }
    }
    await nextTick();
    formRef.value?.clearValidate?.();
  },
);

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const payload: Record<string, any> = { ...form };
    for (const it of items.value) {
      if (it.multiple) payload[it.prop] = serializeMultiValue(payload[it.prop]);
    }
    if (props.mode === 'edit' && props.row?.id !== undefined) payload.id = props.row.id;

    if (props.submit) await props.submit(payload);
    else if (props.resource) {
      if (props.mode === 'create') await props.resource.create(payload);
      else await props.resource.update(payload);
    }

    ElMessage.success(props.mode === 'create' ? '创建成功' : '保存成功');
    visible.value = false;
    emit('saved');
  } catch (e: any) {
    // 后端字段级校验：直接标在对应输入框下，比顶部一条 toast 有用
    const fieldErrors = e?.fieldErrors as { field: string; message: string }[] | undefined;
    if (fieldErrors?.length) {
      formRef.value?.setFields?.(
        fieldErrors.map((f) => ({ prop: propForFieldError(f.field), message: f.message })),
      );
    }
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function close() {
  if (saving.value) return;
  visible.value = false;
}

function onClosed() {
  formRef.value?.resetFields?.();
  for (const key of Object.keys(form)) delete form[key];
}
</script>

<style scoped>
.cube-form-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.cube-form-tip {
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-placeholder);
}

.cube-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
