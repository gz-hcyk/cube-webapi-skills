<template>
  <div class="flow-chart" data-flow-chart>
    <div v-if="placed.nodes.length" class="canvas">
      <svg
        :viewBox="`0 0 ${placed.width} ${placed.height}`"
        :width="placed.width"
        :height="placed.height"
        role="img"
        aria-label="流程图"
      >
        <defs>
          <marker :id="markerId" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#9aa0a6" />
          </marker>
        </defs>
        <g v-for="edge in placed.edges" :key="edge.key">
          <path :d="edge.d" fill="none" stroke="#c5c8ce" stroke-width="1.5" :marker-end="`url(#${markerId})`" />
          <g v-if="edge.label">
            <rect
              :x="edge.lx - labelWidth(edge.label) / 2"
              :y="edge.ly - 11"
              :width="labelWidth(edge.label)"
              height="16"
              rx="3"
              fill="#fff"
            />
            <text :x="edge.lx" :y="edge.ly" text-anchor="middle" class="edge-label">{{ edge.label }}</text>
          </g>
        </g>
        <g
          v-for="node in placed.nodes"
          :key="node.key"
          class="node"
          :data-node-key="node.key"
          :data-node-type="node.type"
          :data-node-state="node.state"
          @click="onSelect(node.key)"
        >
          <title>{{ node.name }}</title>
          <rect
            :x="node.x"
            :y="node.y"
            :width="boxW"
            :height="boxH"
            :rx="pill(node.type) ? 26 : 8"
            :class="['box', 'clickable', `type-${node.type}`, node.state, { selected: node.key === selected }]"
          />
          <text :x="node.x + boxW / 2" :y="node.y + 20" text-anchor="middle" :class="['type', node.state]">{{ typeLabel(node.type) }}</text>
          <text :x="node.x + boxW / 2" :y="node.y + 38" text-anchor="middle" :class="['name', node.state]">{{ shortName(node.name) }}</text>
        </g>
      </svg>
    </div>
    <p v-else class="empty">没有可绘制的节点</p>
    <div v-if="legend" class="legend">
      <span class="swatch current">当前</span>
      <span class="swatch done">已完成</span>
      <span class="swatch wait">未到</span>
      <span class="swatch rejected">已驳回</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { BOX_H, BOX_W, layoutGraph, shortName, typeLabel, type ChartEdge, type ChartNode, type NodeMark } from './flowChart';

const props = defineProps<{
  nodes: ChartNode[];
  edges: ChartEdge[];
  states?: Record<string, NodeMark>;
  selected?: string;
  legend?: boolean;
}>();

const emit = defineEmits<{ select: [key: string] }>();

const boxW = BOX_W;
const boxH = BOX_H;
const markerId = `flow-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
const placed = computed(() => layoutGraph(props.nodes || [], props.edges || [], props.states));

function pill(type: string) {
  return type === 'start' || type === 'end';
}
function labelWidth(label: string) {
  return Math.max(28, label.length * 12 + 10);
}
function onSelect(key: string) {
  emit('select', key);
}
</script>

<style scoped>
.flow-chart { margin: 8px 0 4px; }
.canvas { overflow-x: auto; padding-bottom: 4px; }
.empty { margin: 8px 0; color: var(--td-text-color-secondary); }
.edge-label { font-size: 11px; fill: #5e6670; }
.type { font-size: 11px; fill: #5e6670; }
.name { font-size: 13px; fill: #1f2329; font-weight: 600; }
.type.current, .name.current { fill: #fff; }
.box { stroke-width: 1.5; }
.box.clickable { cursor: pointer; }
.box.type-start { fill: #e8f8f2; stroke: #2ba471; }
.box.type-approve { fill: #f2f3ff; stroke: #0052d9; }
.box.type-cc { fill: #f6f0ff; stroke: #7b61ff; }
.box.type-exclusive { fill: #fff1e9; stroke: #e37318; }
.box.type-parallel { fill: #e8f7ff; stroke: #0594fa; }
.box.type-end { fill: #f3f3f3; stroke: #8b8b8b; }
.box.done { fill: #e8f8f2; stroke: #2ba471; }
.box.current { fill: #0052d9; stroke: #0034b5; }
.box.wait { fill: #fafafa; stroke: #dcdcdc; }
.box.rejected { fill: #fff0ed; stroke: #d54941; }
.box.selected { stroke: #0034b5; stroke-width: 3; }
.legend { display: flex; gap: 12px; margin-top: 8px; color: var(--td-text-color-secondary); font-size: 12px; }
.swatch::before { content: ''; display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; vertical-align: -1px; }
.swatch.current::before { background: #0052d9; }
.swatch.done::before { background: #2ba471; }
.swatch.wait::before { background: #dcdcdc; }
.swatch.rejected::before { background: #d54941; }
</style>
