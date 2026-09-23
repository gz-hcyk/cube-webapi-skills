<script setup lang="ts">
/**
 * DataProbe —— 响应结构探针（未知/未实测契约页面的排障抓手）。
 *
 * 用途：魔方框架里有一批「自定义端点」控制器（File / Widget / Index 监控…），
 * 官方 XML 文档只给出**动作签名**、不给出**响应结构**；首次对接时最难的是
 * 「猜错了字段名却静默空白」。本组件把真实返回原样摊出来，配合 DEV 开关使用，
 * 使契约偏差**一眼可见**，而不是靠翻 Network 面板逐层点。
 *
 * 约定：
 *  - 仅 DEV（`import.meta.env.DEV`）或显式 `force` 时渲染，生产不暴露内部结构；
 *  - 折叠态只显示一行提示，不影响页面美观。
 *
 * 覆盖点 L2 的配套件（见 references/page-composition.md）。
 */
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 任意待观察的载荷（对象 / 数组 / 信封） */
    data?: unknown;
    /** 标题，默认「响应结构」 */
    label?: string;
    /** 生产也强制显示（默认仅 DEV） */
    force?: boolean;
  }>(),
  { data: undefined, label: '响应结构', force: false },
);

const open = ref(false);

/** 生产默认不渲染；DEV 或 force 才渲染 */
const visible = computed(() => props.force || import.meta.env.DEV);

const text = computed(() => {
  try {
    const d = props.data;
    if (d === undefined) return '（尚未加载）';
    // 对象浅层摘要：先给键名，便于快速比对字段命名（camelCase / PascalCase）
    if (Array.isArray(d)) {
      const first = d[0];
      return JSON.stringify(
        { __type: 'array', length: d.length, firstKeys: first && typeof first === 'object' ? Object.keys(first) : null, sample: first },
        null,
        2,
      );
    }
    if (d && typeof d === 'object') {
      return JSON.stringify({ keys: Object.keys(d as object), sample: d }, null, 2);
    }
    return String(d);
  } catch {
    return '（无法序列化）';
  }
});
</script>

<template>
  <div v-if="visible" class="data-probe">
    <div class="dp-bar" @click="open = !open">
      <t-icon :name="open ? 'chevron-down' : 'chevron-right'" />
      <span>{{ label }}</span>
      <t-tag size="small" variant="light" theme="warning">DEV</t-tag>
    </div>
    <pre v-if="open" class="dp-body">{{ text }}</pre>
  </div>
</template>

<style scoped>
.data-probe {
  margin-top: 12px;
  border: 1px dashed var(--td-warning-color-3, #e8b339);
  border-radius: var(--cube-radius-md);
  background: var(--td-warning-color-1, #fff8e8);
  font-size: 12px;
}
.dp-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; cursor: pointer;
  color: var(--td-text-color-secondary);
}
.dp-body {
  margin: 0; padding: 10px;
  max-height: 260px; overflow: auto;
  border-top: 1px dashed var(--td-warning-color-3, #e8b339);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
}
</style>
