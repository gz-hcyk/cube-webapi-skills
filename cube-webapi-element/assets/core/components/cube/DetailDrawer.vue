<template>
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    size="520px"
    :destroy-on-close="false"
    class="cube-detail-drawer"
  >
    <div v-loading="loading" class="cube-detail">
      <el-empty v-if="!loading && !record" description="未找到记录" />

      <template v-else-if="record">
        <!-- 概要头：一条记录最重要的三件事（标题/状态/时间），先给结论再给细节 -->
        <div class="cube-detail__hero">
          <div class="cube-detail__hero-main">
            <div class="cube-detail__title">{{ heroTitle }}</div>
            <div v-if="heroSubtitle" class="cube-detail__subtitle">{{ heroSubtitle }}</div>
          </div>
          <el-tag v-if="heroTag" :type="heroTag.type" effect="light" round size="small">{{ heroTag.text }}</el-tag>
        </div>

        <section v-for="g in groups" :key="g.category" class="cube-detail__section">
          <h3 class="cube-detail__section-title">{{ g.category }}</h3>
          <el-descriptions :column="1" border size="small" class="cube-detail__desc">
            <el-descriptions-item v-for="f in g.fields" :key="f.name" :label="f.displayName || f.name">
              <el-tag
                v-if="isBool(f)"
                :type="record[camel(f.name)] ? 'success' : 'info'"
                effect="light"
                size="small"
                round
              >
                {{ record[camel(f.name)] ? '是' : '否' }}
              </el-tag>

              <span v-else-if="isMulti(f)" class="cube-cell__tags">
                <el-tag
                  v-for="(t, i) in multiLabels(f, record[camel(f.name)], lookups)"
                  :key="i"
                  size="small"
                  effect="plain"
                  round
                >
                  {{ t }}
                </el-tag>
                <span v-if="!multiLabels(f, record[camel(f.name)], lookups).length" class="cube-cell--muted">—</span>
              </span>

              <a
                v-else-if="isUpload(f) && record[camel(f.name)]"
                :href="serverUrl(record[camel(f.name)])"
                target="_blank"
                rel="noopener"
              >
                {{ record[camel(f.name)] }}
              </a>

              <div v-else-if="isLongText(f)" class="cube-detail__longtext">
                {{ text(f, record[camel(f.name)]) || '—' }}
              </div>

              <span v-else :class="{ 'cube-cell--muted': isEmpty(f, record[camel(f.name)]) }">
                {{ text(f, record[camel(f.name)]) || '—' }}
              </span>

              <div v-if="hint(f)" class="cube-detail__hint">{{ hint(f) }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </section>
      </template>
    </div>

    <template #footer>
      <div class="cube-detail__footer">
        <el-button @click="visible = false">关闭</el-button>
        <el-button v-if="canEdit && record" type="primary" @click="emit('edit', record)">编辑</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { serverUrl } from '@/api/http';
import {
  camel,
  fieldHint,
  groupByCategory,
  isBooleanField,
  isDateField,
  isDayField,
  isMultiValue,
  isUnsetValue,
  labelOf,
  multiLabels,
  omitShadowAuditIds,
  selectFormControl,
  type DataField,
  type LookupMap,
} from '@/api/fieldRender';
import type { EntityResource } from '@/api/useEntityResource';

/**
 * 详情抽屉（模板继承的"查看"统一形态）
 * 只读呈现，不做编辑；父表详情里嵌入子表时，用 #extra 插槽塞表格。
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    resource?: EntityResource;
    fields?: DataField[];
    row?: Record<string, any> | null;
    title?: string;
    lookups?: LookupMap;
    canEdit?: boolean;
  }>(),
  { resource: undefined, fields: undefined, row: null, title: '', lookups: undefined, canEdit: true },
);

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; edit: [row: Record<string, any>] }>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const loading = ref(false);
const record = ref<Record<string, any> | null>(null);

const fields = computed<DataField[]>(() => {
  const raw = props.fields?.length ? props.fields : (props.resource?.detailFields.value ?? []);
  return omitShadowAuditIds(raw);
});

const groups = computed(() => groupByCategory(fields.value));

const drawerTitle = computed(() => props.title || '详情');

/** 概要标题：优先 name/title/displayName，其次第一列文本 */
const heroTitle = computed(() => {
  const r = record.value;
  if (!r) return '';
  for (const key of ['name', 'title', 'displayName', 'code', 'userName']) {
    if (r[key]) return String(r[key]);
  }
  const first = fields.value.find((f) => selectFormControl(f) === 'input');
  return first ? String(r[camel(first.name)] ?? `#${r.id}`) : `#${r.id}`;
});

const heroSubtitle = computed(() => {
  const r = record.value;
  if (!r) return '';
  const time = r.updateTime ?? r.createTime;
  return time ? `最近更新 ${String(time).replace('T', ' ').slice(0, 16)}` : '';
});

const heroTag = computed(() => {
  const r = record.value;
  if (!r) return null;
  const f = fields.value.find((x) => isBooleanField(x) && ['enable', 'enabled', 'active', 'isActive'].includes(camel(x.name)));
  if (!f) return null;
  const on = !!r[camel(f.name)];
  return { text: on ? '启用' : '停用', type: on ? ('success' as const) : ('info' as const) };
});

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    record.value = props.row ? { ...props.row } : null;
    if (!props.resource || props.row?.id === undefined) return;
    loading.value = true;
    try {
      const full = await props.resource.fetchOne(props.row.id);
      record.value = { ...props.row, ...full };
    } catch {
      /* 详情接口失败时保留列表行数据，不把页面搞成空白 */
    } finally {
      loading.value = false;
    }
  },
);

function isBool(f: DataField) {
  return selectFormControl(f) === 'switch';
}
function isMulti(f: DataField) {
  return isMultiValue(f);
}
function isLongText(f: DataField) {
  const c = selectFormControl(f);
  return c === 'textarea' || c === 'rich-text';
}
function isUpload(f: DataField) {
  return selectFormControl(f) === 'upload';
}
function isEmpty(_f: DataField, v: unknown) {
  return isUnsetValue(v);
}
function hint(f: DataField) {
  return fieldHint(f);
}
function text(f: DataField, v: unknown) {
  if (isEmpty(f, v)) return '';
  if (isDateField(f) || isDayField(f)) return String(v).replace('T', ' ').replace(/\.\d+$/, '');
  return labelOf(f, v, props.lookups);
}
</script>

<style scoped>
.cube-detail {
  min-height: 120px;
}

.cube-detail__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  margin-bottom: 20px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--cube-radius-card);
}

.cube-detail__title {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.cube-detail__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cube-detail__section + .cube-detail__section {
  margin-top: 20px;
}

.cube-detail__section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.cube-detail__desc :deep(.el-descriptions__label) {
  width: 112px;
  color: var(--el-text-color-secondary);
  font-weight: 400;
  background: var(--el-fill-color-lighter);
}

.cube-detail__desc :deep(.el-descriptions__content) {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.cube-detail__longtext {
  white-space: pre-wrap;
  line-height: 20px;
}

.cube-detail__hint {
  margin-top: 2px;
  font-size: 12px;
  line-height: 16px;
  color: var(--el-text-color-placeholder);
}

.cube-detail__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
