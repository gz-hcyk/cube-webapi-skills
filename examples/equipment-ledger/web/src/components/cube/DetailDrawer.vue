<template>
  <t-drawer :visible="visible" :header="title || '详情'" size="480px" @close="$emit('close')">
    <!-- 多分组（category 命中）：分 tab 组织详情字段 -->
    <t-tabs v-if="useTabs" v-model="activeTab" theme="card" class="cube-category-tabs">
      <t-tab-panel v-for="g in groups" :key="g.category" :value="g.category" :label="g.category">
        <t-descriptions :column="1" bordered>
          <template v-for="c in g.cells" :key="c.name">
            <t-descriptions-item :label="c.label">
              <!-- 字段回显分支链（内联自原 DetailContent 组件）：图像 / 颜色 / 文件 / 图标 /
                   多值标签 / 映射名称 / 布尔 / 兜底文本；映射字段一律回显名称，绝不显示原始 ID。 -->
              <t-image
                v-if="c.kind === 'image'"
                :src="c.text"
                fit="contain"
                class="dc-image"
                @click="openImage(c.f)"
              />
              <span v-else-if="c.kind === 'color'" class="color-swatch">
                <i class="swatch" :style="{ background: c.text || 'transparent' }"></i>
                {{ c.text || '-' }}
              </span>
              <t-link v-else-if="c.kind === 'file'" :href="c.text || undefined" target="_blank" hover="color">
                {{ c.text ? '下载/查看' : '-' }}
              </t-link>
              <span v-else-if="c.kind === 'icon'">
                <t-icon v-if="c.text" :name="c.text" class="dc-icon" />
                <span v-else>-</span>
              </span>
              <span v-else-if="c.kind === 'tags'" class="tag-group">
                <t-tag v-for="(lb, i) in c.list" :key="i" theme="primary" variant="light">{{ lb }}</t-tag>
              </span>
              <span v-else-if="c.kind === 'mapped'">{{ c.text }}</span>
              <t-tag v-else-if="c.kind === 'bool'" :theme="c.text === '是' ? 'success' : 'default'">{{ c.text }}</t-tag>
              <span v-else>{{ c.text }}</span>
            </t-descriptions-item>
          </template>
        </t-descriptions>
      </t-tab-panel>
    </t-tabs>
    <!-- 单分组 / 无 category：扁平描述列表 -->
    <t-descriptions v-else :column="1" bordered>
      <template v-for="c in flatCells" :key="c.name">
        <t-descriptions-item :label="c.label">
          <t-image
            v-if="c.kind === 'image'"
            :src="c.text"
            fit="contain"
            class="dc-image"
            @click="openImage(c.f)"
          />
          <span v-else-if="c.kind === 'color'" class="color-swatch">
            <i class="swatch" :style="{ background: c.text || 'transparent' }"></i>
            {{ c.text || '-' }}
          </span>
          <t-link v-else-if="c.kind === 'file'" :href="c.text || undefined" target="_blank" hover="color">
            {{ c.text ? '下载/查看' : '-' }}
          </t-link>
          <span v-else-if="c.kind === 'icon'">
            <t-icon v-if="c.text" :name="c.text" class="dc-icon" />
            <span v-else>-</span>
          </span>
          <span v-else-if="c.kind === 'tags'" class="tag-group">
            <t-tag v-for="(lb, i) in c.list" :key="i" theme="primary" variant="light">{{ lb }}</t-tag>
          </span>
          <span v-else-if="c.kind === 'mapped'">{{ c.text }}</span>
          <t-tag v-else-if="c.kind === 'bool'" :theme="c.text === '是' ? 'success' : 'default'">{{ c.text }}</t-tag>
          <span v-else>{{ c.text }}</span>
        </t-descriptions-item>
      </template>
    </t-descriptions>

    <!-- ▼ 覆盖点 L2（对标 MVC 分部视图覆盖）：详情尾部追加自定义区块
         （如用户绑定列表、令牌列表、在线设备、关联子表） -->
    <slot name="detail-extra" />
  </t-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  DEFAULT_CATEGORY,
  groupDataFieldsByCategory,
  isEnumType,
  isForeignRef,
  isMappedField,
  isMultiValue,
  labelOf,
  selectFormControl,
  type LookupMap,
} from '../../api/fieldRender';
import { camel, useEntityResource, type DataField, type PageSchema } from '../../api/useEntityResource';

const props = defineProps<{
  area: string;
  controller: string;
  schema: PageSchema | null;
  id: string | number | null;
  /** 列表已返回的行数据：作为接口返回前的即时展示 / 接口不可用时的兜底（详情以接口数据为准） */
  row?: Record<string, any> | null;
  visible: boolean;
  title?: string;
  /** 外键关联源字典：{ Category: { "1": "类别A" } }，用于 xxxID 字段回显名称 */
  lookups?: LookupMap;
  /** LovController 枚举值集（lovCode=Enum.* 权威选项），用于枚举字段回显名称 */
  lovOptions?: Record<string, { value: string | number; label: string }[]>;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const res = useEntityResource(props.area, props.controller);
const data = ref<Record<string, any>>({});
// 详情字段遍历原始 DataField[]（而非 buildFormItems 输出），确保 labelOf 能读到 map/dataSource/primaryKey
const fields = computed<DataField[]>(() => (props.schema?.detail ?? []).filter((f) => !f.primaryKey));

/** 详情单元格渲染方式（分支链由 cellOf 决策，模板按 kind 选控件） */
type CellKind = 'image' | 'color' | 'file' | 'icon' | 'tags' | 'mapped' | 'bool' | 'text';
interface DetailCell {
  /** 字段名（与原始 DataField.name 一致，作 v-for key） */
  name: string;
  /** 显示标签 */
  label: string;
  /** 原始字段元数据（图像点击放大等回调需要） */
  f: DataField;
  kind: CellKind;
  /** 单值文本：image=src / color=色值 / file=URL / icon=图标名 / mapped=映射名 / bool=是|否 / text=原文 */
  text: string;
  /** kind=tags 时的映射后标签列表 */
  list: string[];
}

/**
 * 单字段 → 单元格视图模型。判定顺序与渲染分支链严格一致：
 * itemType(image/color/file/icon) → 多值标签 → 映射字段（外键 / 枚举 / map / dataSource） → 布尔 → 兜底文本。
 * 映射字段一律经 labelOf 回显名称，绝不显示原始 ID。
 */
function cellOf(f: DataField): DetailCell {
  const raw = data.value?.[camel(f.name)];
  const itemType = (f.itemType ?? '').toString().trim().toLowerCase();
  const cell: DetailCell = {
    name: f.name,
    label: f.displayName ?? f.name,
    f,
    kind: 'text',
    text: raw == null ? '-' : String(raw),
    list: [],
  };
  if (itemType === 'image') return { ...cell, kind: 'image', text: String(raw ?? '') };
  if (itemType === 'color') return { ...cell, kind: 'color', text: String(raw ?? '') };
  if (itemType === 'file') return { ...cell, kind: 'file', text: String(raw ?? '') };
  if (itemType === 'icon') return { ...cell, kind: 'icon', text: String(raw ?? '') };
  // 多值外键（xxxIDs / 映射自 RoleIds，值形如 "1,3,5"）→ 拆成标签逐个回显名称
  if (isMultiValue(f)) {
    if (raw == null || raw === '') return cell;
    const parts = String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      return {
        ...cell,
        kind: 'tags',
        list: parts.map((p) => String(labelOf(f, p, props.lookups, props.lovOptions))),
      };
    }
  }
  // 映射字段：mapField / map / dataSource / 外键 / 枚举类型名 → 回显映射名称
  if (isMappedField(f) || !!f.map || !!f.dataSource || isForeignRef(f) || isEnumType(f)) {
    return { ...cell, kind: 'mapped', text: String(labelOf(f, raw, props.lookups, props.lovOptions) ?? '-') };
  }
  if (selectFormControl(f) === 'switch') return { ...cell, kind: 'bool', text: raw ? '是' : '否' };
  return cell;
}

// 按 category 分组成 tab（空 category → DEFAULT_CATEGORY「基础设置」组，排在最前），每组预计算单元格
const groups = computed(() =>
  groupDataFieldsByCategory(fields.value, DEFAULT_CATEGORY).map((g) => ({
    category: g.category,
    cells: g.items.map(cellOf),
  })),
);
// 仅 1 个分组（无有效 category）时退化为扁平描述列表，不显示 tab 头
const useTabs = computed(() => groups.value.length > 1);
// 扁平场景的单元格（fields 非空时 groups 恒有 1 组）
const flatCells = computed<DetailCell[]>(() => groups.value[0]?.cells ?? []);

const activeTab = ref<string>(DEFAULT_CATEGORY);
watch(
  groups,
  (g) => {
    if (g.length && !g.some((x) => x.category === activeTab.value)) {
      activeTab.value = g[0].category;
    }
  },
  { immediate: true },
);

/**
 * 点击图片新窗口打开大图（image 字段回显由上方分支链负责；此回调供其调用）
 */
function openImage(f: DataField) {
  const v = data.value[camel(f.name)];
  if (v) window.open(String(v), '_blank');
}

watch(
  () => [props.visible, props.id, props.row],
  async ([v, id, row]) => {
    if (!v) return;
    // 先用列表行即时展示（接口返回前抽屉不空白）
    if (row && typeof row === 'object' && Object.keys(row).length > 0) {
      data.value = row;
    }
    // **接口优先（数据一致性）**：列表行可能陈旧（他人已改过），
    // 详情一律用 `res.getById(id)` 拉最新单条（真实后端 `/Detail?id=` 实测可用），
    // 接口失败/返回空时保留列表行兜底展示。
    if (id != null) {
      try {
        const entity = await res.getById(id as string | number);
        if (entity && Object.keys(entity).length) data.value = entity;
      } catch {
        /* 静默：接口不可用则用列表行 */
      }
    }
  },
  { immediate: true },
);
</script>

<style scoped>
/* 详情分类 tab 容器与表单/配置页统一（.cube-category-tabs 在 tokens.css 全局定义） */
/* 图像字段：缩略图展示，点击新窗口打开大图 */
.dc-image {
  max-width: 200px;
  max-height: 160px;
  border-radius: 4px;
  cursor: zoom-in;
  display: block;
}
/* 图标字段：放大到 20px 便于辨认 */
.dc-icon {
  font-size: 20px;
}
/* 多值外键（RoleIds 等）在详情里以标签组回显 */
.tag-group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
/* 颜色字段：色块 + 色值 */
.color-swatch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.color-swatch .swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--td-component-border);
}
</style>
