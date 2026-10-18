<template>
  <!-- 单一控件渲染器：列表搜索栏 / 表单弹窗共用，保证"同一字段在任何页面长同一个样" -->
  <el-input
    v-if="control === 'input'"
    v-model="value"
    :disabled="disabled"
    :maxlength="item.maxlength"
    :placeholder="item.placeholder"
    :show-word-limit="!!item.maxlength && item.maxlength <= 200"
    clearable
  />

  <el-input
    v-else-if="control === 'password'"
    v-model="value"
    type="password"
    show-password
    autocomplete="new-password"
    :disabled="disabled"
    :maxlength="item.maxlength"
    :placeholder="item.placeholder"
  />

  <el-input
    v-else-if="control === 'textarea' || control === 'rich-text'"
    v-model="value"
    type="textarea"
    :rows="item.control === 'rich-text' ? 6 : 3"
    :disabled="disabled"
    :maxlength="item.maxlength"
    :placeholder="item.placeholder"
    :show-word-limit="!!item.maxlength"
  />

  <el-input-number
    v-else-if="control === 'number'"
    v-model="value"
    class="cube-field-number"
    :disabled="disabled"
    :precision="item.precision"
    :step="item.precision ? 0.01 : 1"
    :controls-position="'right'"
    :placeholder="item.placeholder"
  />

  <el-switch
    v-else-if="control === 'switch'"
    v-model="value"
    :disabled="disabled"
    :active-value="true"
    :inactive-value="false"
  />

  <el-select
    v-else-if="control === 'select'"
    v-model="value"
    :disabled="disabled"
    :placeholder="item.placeholder"
    filterable
    clearable
    class="cube-field-select"
  >
    <el-option v-for="opt in item.options" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
  </el-select>

  <el-select
    v-else-if="control === 'multi-select'"
    v-model="multiValue"
    :disabled="disabled"
    :placeholder="item.placeholder"
    multiple
    filterable
    clearable
    collapse-tags
    collapse-tags-tooltip
    class="cube-field-select"
  >
    <el-option v-for="opt in item.options" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
  </el-select>

  <el-tree-select
    v-else-if="control === 'tree-select'"
    v-model="value"
    :data="treeData"
    :props="treeProps"
    :disabled="disabled"
    :placeholder="item.placeholder"
    node-key="value"
    check-strictly
    default-expand-all
    filterable
    clearable
    class="cube-field-select"
  />

  <el-date-picker
    v-else-if="control === 'date'"
    v-model="value"
    type="date"
    value-format="YYYY-MM-DD"
    :disabled="disabled"
    :placeholder="item.placeholder || '选择日期'"
    class="cube-field-date"
  />

  <el-date-picker
    v-else-if="control === 'datetime'"
    v-model="value"
    type="datetime"
    value-format="YYYY-MM-DD HH:mm:ss"
    :disabled="disabled"
    :placeholder="item.placeholder || '选择时间'"
    class="cube-field-date"
  />

  <el-time-picker
    v-else-if="control === 'time'"
    v-model="value"
    value-format="HH:mm:ss"
    :disabled="disabled"
    :placeholder="item.placeholder || '选择时间'"
    class="cube-field-date"
  />

  <el-date-picker
    v-else-if="control === 'daterange'"
    v-model="value"
    type="daterange"
    value-format="YYYY-MM-DD"
    start-placeholder="开始日期"
    end-placeholder="结束日期"
    unlink-panels
    :disabled="disabled"
  />

  <el-upload
    v-else-if="control === 'upload'"
    class="cube-field-upload"
    :disabled="disabled"
    :show-file-list="false"
    :http-request="doUpload"
  >
    <div class="cube-upload-trigger">
      <el-icon><Upload /></el-icon>
      <span>{{ value ? '重新上传' : '上传文件' }}</span>
    </div>
    <template v-if="value" #tip>
      <a :href="String(value)" target="_blank" rel="noopener" class="cube-upload-link">{{ value }}</a>
    </template>
  </el-upload>

  <!-- 兜底：未知类型一律给文本输入，绝不渲染空白 -->
  <el-input v-else v-model="value" :disabled="disabled" :placeholder="item.placeholder" clearable />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Upload } from '@element-plus/icons-vue';
import type { UploadRequestOptions } from 'element-plus';
import { http } from '@/api/http';
import type { FormItemSpec } from '@/api/fieldRender';

/**
 * 字段控件（模板继承的最小单元）
 * - FormDialog / ListPage 的搜索栏 / ConfigView 都用它，新增控件只改这里一处
 * - 只负责"值 ↔ 控件"，校验交给 el-form，布局交给父级
 */
const props = withDefaults(
  defineProps<{
    item: FormItemSpec;
    modelValue?: any;
    disabled?: boolean;
    /** tree-select 的数据源（父级由页面提供，避免组件自己发请求） */
    treeData?: any[];
    /** 上传接口完整路径，如 /api/Admin/File/UploadFile */
    uploadPath?: string;
  }>(),
  { modelValue: undefined, disabled: false, treeData: () => [], uploadPath: '' },
);

const emit = defineEmits<{ 'update:modelValue': [value: any] }>();

const control = computed(() => props.item.control);

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

/** 多选永远给数组：el-select multiple 拿到 null 会直接崩 */
const multiValue = computed({
  get: () => {
    const v = props.modelValue;
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined || v === '') return [];
    return [v];
  },
  set: (v) => emit('update:modelValue', v),
});

const treeProps = { value: 'value', label: 'label', children: 'children' };

async function doUpload(options: UploadRequestOptions) {
  if (!props.uploadPath) {
    options.onError?.(new Error('未配置上传接口 uploadPath') as any);
    return;
  }
  const form = new FormData();
  form.append('file', options.file);
  const resp = await http.post(props.uploadPath, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data: any = resp.data?.data ?? {};
  const url = data.filePath || data.url || data.path || '';
  if (url) emit('update:modelValue', url);
  options.onSuccess?.(data);
}
</script>

<style scoped>
.cube-field-number,
.cube-field-select,
.cube-field-date {
  width: 100%;
}

.cube-upload-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: var(--cube-radius-control);
  color: var(--el-text-color-regular);
  font-size: 13px;
  transition: all var(--cube-duration) var(--cube-ease);
}

.cube-upload-trigger:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.cube-upload-link {
  font-size: 12px;
  word-break: break-all;
}
</style>
