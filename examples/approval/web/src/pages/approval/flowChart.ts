/** 只读流程图：节点、连线和办理态。布局在前端完成，不改流程 JSON。 */

export interface ChartNode {
  key: string;
  type: string;
  name: string;
}

export interface ChartEdge {
  key: string;
  from: string;
  to: string;
  label?: string;
}

/** current 当前办理，done 已经走过，wait 还没到，rejected 本节点被驳回且之后没有同意。 */
export type NodeMark = 'current' | 'done' | 'wait' | 'rejected';

export interface FlowTask {
  nodeKey: string;
  status: number;
}

export interface FlowHistory {
  action: string;
  nodeKey?: string;
}

export interface FlowSnapshot {
  status: number;
  tasks: FlowTask[];
  history: FlowHistory[];
}

const TYPE_LABEL: Record<string, string> = {
  start: '开始',
  approve: '审批',
  cc: '抄送',
  exclusive: '排他',
  parallel: '并行',
  end: '结束',
};

const OP_SYMBOL: Record<string, string> = {
  eq: '=',
  ne: '≠',
  gt: '>',
  ge: '≥',
  gte: '≥',
  lt: '<',
  le: '≤',
  lte: '≤',
  in: '∈',
};

export const BOX_W = 136;
export const BOX_H = 52;

export function typeLabel(type: string) {
  return TYPE_LABEL[type] || type || '节点';
}

export function shortName(name: string) {
  const text = (name || '').trim();
  return text.length > 8 ? `${text.slice(0, 7)}…` : text || '未命名';
}

/** 排他默认出线显示「默认」，带条件的出线显示字段、比较符和值。 */
export function edgeCaption(edge: { isDefault?: boolean; default?: boolean; field?: string; op?: string; value?: string; condition?: { field?: string; op?: string; value?: unknown } }) {
  if (edge.isDefault || edge.default) return '默认';
  const field = edge.field || edge.condition?.field || '';
  if (!field) return '';
  const op = edge.op || edge.condition?.op || 'eq';
  const raw = edge.value != null && edge.value !== '' ? edge.value : edge.condition?.value;
  const value = Array.isArray(raw) ? raw.map((item) => (item == null ? '' : String(item))).join(',') : raw == null ? '' : String(raw);
  return `${field} ${OP_SYMBOL[op] || op} ${value}`.trim();
}

interface PlacedNode extends ChartNode {
  x: number;
  y: number;
  state: NodeMark | '';
}

interface PlacedEdge {
  key: string;
  d: string;
  label: string;
  lx: number;
  ly: number;
}

export interface PlacedGraph {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

/**
 * 按最长路径从左到右分层。有环或悬空的节点排在已分层节点之后。
 * 同一层按原数组顺序自上而下，列内垂直居中。
 */
export function layoutGraph(nodes: ChartNode[], edges: ChartEdge[], states?: Record<string, NodeMark>): PlacedGraph {
  const order = new Map(nodes.map((node, index) => [node.key, index]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  nodes.forEach((node) => {
    outgoing.set(node.key, []);
    indegree.set(node.key, 0);
  });
  edges.forEach((edge) => {
    if (!outgoing.has(edge.from) || !indegree.has(edge.to)) return;
    outgoing.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
  });

  const rank = new Map<string, number>();
  const pending = new Map(indegree);
  const queue = nodes.filter((node) => (indegree.get(node.key) || 0) === 0).map((node) => node.key);
  queue.forEach((key) => rank.set(key, 0));
  while (queue.length) {
    const key = queue.shift()!;
    const base = rank.get(key) || 0;
    (outgoing.get(key) || []).forEach((to) => {
      rank.set(to, Math.max(rank.get(to) || 0, base + 1));
      pending.set(to, (pending.get(to) || 1) - 1);
      if (pending.get(to) === 0) queue.push(to);
    });
  }
  let tail = Math.max(0, ...rank.values());
  nodes.forEach((node) => {
    if (rank.has(node.key)) return;
    tail += 1;
    rank.set(node.key, tail);
  });

  const columns = new Map<number, ChartNode[]>();
  nodes.forEach((node) => {
    const column = rank.get(node.key) || 0;
    const list = columns.get(column) || [];
    list.push(node);
    columns.set(column, list);
  });
  columns.forEach((list) => list.sort((a, b) => (order.get(a.key) || 0) - (order.get(b.key) || 0)));

  const gapX = 64;
  const gapY = 28;
  const pad = 20;
  const maxRank = Math.max(0, ...rank.values());
  let maxRows = 1;
  columns.forEach((list) => {
    if (list.length > maxRows) maxRows = list.length;
  });
  const width = pad * 2 + (maxRank + 1) * BOX_W + maxRank * gapX;
  const height = pad * 2 + maxRows * BOX_H + Math.max(0, maxRows - 1) * gapY;
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((list, column) => {
    const used = list.length * BOX_H + Math.max(0, list.length - 1) * gapY;
    const top = pad + (height - pad * 2 - used) / 2;
    list.forEach((node, index) => {
      pos.set(node.key, { x: pad + column * (BOX_W + gapX), y: top + index * (BOX_H + gapY) });
    });
  });

  const placedNodes: PlacedNode[] = nodes.map((node) => {
    const point = pos.get(node.key) || { x: pad, y: pad };
    return { ...node, ...point, state: states?.[node.key] || '' };
  });
  const byKey = new Map(placedNodes.map((node) => [node.key, node]));
  const pairCount = new Map<string, number>();
  const placedEdges: PlacedEdge[] = [];
  edges.forEach((edge, index) => {
    const from = byKey.get(edge.from);
    const to = byKey.get(edge.to);
    if (!from || !to) return;
    const pair = `${edge.from}>${edge.to}`;
    const slot = pairCount.get(pair) || 0;
    pairCount.set(pair, slot + 1);
    const shift = slot * 10;
    const x1 = from.x + BOX_W;
    const y1 = from.y + BOX_H / 2 + shift;
    const x2 = to.x;
    const y2 = to.y + BOX_H / 2 + shift;
    let d: string;
    let lx: number;
    let ly: number;
    if (to.x > from.x) {
      const mid = (x1 + x2) / 2;
      d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      lx = mid;
      ly = (y1 + y2) / 2 - 6;
    } else {
      const drop = Math.max(from.y, to.y) + BOX_H + 16 + shift;
      d = `M ${x1} ${y1} L ${x1 + 18} ${y1} L ${x1 + 18} ${drop} L ${x2 - 18} ${drop} L ${x2 - 18} ${y2} L ${x2} ${y2}`;
      lx = (x1 + x2) / 2;
      ly = drop - 6;
    }
    placedEdges.push({ key: edge.key || `e${index}`, d, label: edge.label || '', lx, ly });
  });

  const extra = placedEdges.reduce((max, edge) => Math.max(max, edge.ly + 16), height);
  return { width, height: Math.max(height, extra), nodes: placedNodes, edges: placedEdges };
}

/**
 * 用任务和实例状态给节点上色。网关通常没有任务，靠相邻节点和 choose 历史推断。
 * 规则写在 IMPLEMENTATION.md 第 9 轮。
 */
export function instanceMarks(snapshot: FlowSnapshot, nodes: ChartNode[], edges: ChartEdge[]): Record<string, NodeMark> {
  const marks: Record<string, NodeMark> = {};
  nodes.forEach((node) => {
    const tasks = snapshot.tasks.filter((task) => task.nodeKey === node.key);
    if (tasks.some((task) => task.status === 0)) marks[node.key] = 'current';
    else if (tasks.some((task) => task.status === 1 || task.status === 3 || task.status === 5)) marks[node.key] = 'done';
    else if (tasks.some((task) => task.status === 2)) marks[node.key] = 'rejected';
  });

  nodes.filter((node) => node.type === 'start' && !marks[node.key]).forEach((node) => {
    marks[node.key] = snapshot.status === 0 ? 'current' : 'done';
  });
  nodes.filter((node) => node.type === 'end' && !marks[node.key]).forEach((node) => {
    marks[node.key] = snapshot.status === 2 ? 'done' : 'wait';
  });

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  edges.forEach((edge) => {
    const outs = outgoing.get(edge.from) || [];
    outs.push(edge.to);
    outgoing.set(edge.from, outs);
    const ins = incoming.get(edge.to) || [];
    ins.push(edge.from);
    incoming.set(edge.to, ins);
  });
  const chosen = new Set(snapshot.history.filter((item) => item.action === 'choose' && item.nodeKey).map((item) => item.nodeKey as string));
  const gateways = nodes.filter((node) => node.type === 'exclusive' || node.type === 'parallel');
  for (let pass = 0; pass < nodes.length + 1; pass += 1) {
    let changed = false;
    gateways.forEach((node) => {
      if (marks[node.key] === 'current' || marks[node.key] === 'rejected') return;
      const outs = outgoing.get(node.key) || [];
      const passed = chosen.has(node.key) || outs.some((key) => {
        const mark = marks[key];
        return mark === 'current' || mark === 'done' || mark === 'rejected';
      });
      if (passed) {
        if (marks[node.key] !== 'done') {
          marks[node.key] = 'done';
          changed = true;
        }
        return;
      }
      const ins = incoming.get(node.key) || [];
      const ready = ins.length > 0 && ins.every((key) => marks[key] === 'done' || marks[key] === 'rejected') && snapshot.status === 1;
      if (ready && !marks[node.key]) {
        marks[node.key] = 'current';
        changed = true;
      }
    });
    if (!changed) break;
  }

  nodes.forEach((node) => {
    if (!marks[node.key]) marks[node.key] = 'wait';
  });
  return marks;
}
