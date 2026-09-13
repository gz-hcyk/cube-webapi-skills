<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getApi } from '@/api/http'
import { MessagePlugin } from 'tdesign-vue-next'

/**
 * 角色菜单权限勾选（NewLife.Cube 魔方 MVC 版权限界面的 WebApi 化，技能 §4.12.1）。
 *
 * 界面形态：菜单树按层级平铺为行，行内直接勾选权限位（查看/新增/修改/删除）。
 * **父子联动（MVC 语义）**：父节点（有子级）勾选某权限位 → 全部子孙同步授予该位；
 * 取消 → 子孙同步收回该位（不误伤其它位）。工具栏含全展开/全折叠与授权统计。
 *
 * 契约（NewLife.Cube 标准）：角色菜单权限存于 Role.Permission，格式为逗号分隔的
 * `菜单ID#权限位掩码`，例如 `1#3,2#7`（3=查看+新增；7=查看+新增+修改；-1=全动作）。
 * 权限位：1=查看 / 2=新增 / 4=修改 / 8=删除（位掩码组合）。菜单源 `GET /api/Admin/Menu`
 * （Index 端点，1000 条扁平行 {id,name,displayName,parentId}；`http` 层已无全局 camelize，
 *  行数据由消费端 `camelize`/`normalizeRows` 归一）。
 */
const props = defineProps<{
  modelValue?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const PERM_BITS = [
  { bit: 1, label: '查看' },
  { bit: 2, label: '新增' },
  { bit: 4, label: '修改' },
  { bit: 8, label: '删除' },
]

const loading = ref(false)
const menus = ref<any[]>([])
/** 菜单ID → 权限位掩码（0 或缺失=未授权） */
const permMap = ref<Record<string, number>>({})
/** 已折叠的父节点 id 集合（默认空 = 全展开） */
const collapsed = ref<Set<number>>(new Set())

interface MenuRow {
  id: number
  label: string
  level: number
  hasChildren: boolean
}

/** 解析 Permission 字符串 → permMap（兼容 -1 全动作；0 忽略） */
function parse(str?: string): Record<string, number> {
  const map: Record<string, number> = {}
  for (const seg of (str || '').split(',')) {
    const s = seg.trim()
    if (!s) continue
    const [idp, permp] = s.split('#')
    const id = String(Number(idp) || idp.trim())
    if (!id) continue
    const v = Number(permp)
    if (Number.isFinite(v) && v !== 0) map[id] = v < 0 ? -1 : v
  }
  return map
}

function serialize(): string {
  const parts: string[] = []
  for (const [id, perm] of Object.entries(permMap.value)) {
    if (perm > 0 || perm === -1) parts.push(`${id}#${perm}`)
  }
  return parts.join(',')
}

function sync() {
  const next = serialize()
  if (next === props.modelValue) return
  emit('update:modelValue', next)
}

function toggleCollapse(id: number) {
  const s = new Set(collapsed.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  collapsed.value = s
}
function expandAll() {
  collapsed.value = new Set()
}
function collapseAll() {
  collapsed.value = new Set(flatRows.value.filter((r) => r.hasChildren).map((r) => r.id))
}

/** 父 → 子 映射 */
const byParent = computed(() => {
  const m = new Map<number, any[]>()
  for (const x of menus.value) {
    const pid = Number(x.parentId ?? x.parentID ?? 0)
    if (!m.has(pid)) m.set(pid, [])
    m.get(pid)!.push(x)
  }
  return m
})

function collectDescendantIds(id: number, acc: number[] = []): number[] {
  for (const c of byParent.value.get(id) || []) {
    const cid = Number(c.id)
    acc.push(cid)
    collectDescendantIds(cid, acc)
  }
  return acc
}

/** 切换某菜单的某权限位；父节点连同全部子孙一起授予/收回该位（MVC 联动） */
function toggleBit(id: number, bit: number, on: boolean) {
  const map = { ...permMap.value }
  const set = (tid: number) => {
    const k = String(tid)
    const cur = map[k] === -1 ? 15 : Number(map[k] || 0)
    map[k] = on ? cur | bit : cur & ~bit
    if (map[k] === 0) delete map[k]
  }
  set(id)
  for (const d of collectDescendantIds(id)) set(d)
  permMap.value = map
  sync()
}

function maskOf(id: number): number {
  const v = Number(permMap.value[String(id)] || 0)
  return v === -1 ? 15 : v
}

/** 已授权菜单数（含 -1 全动作） */
const grantedCount = computed(
  () => Object.values(permMap.value).filter((v) => v === -1 || v > 0).length,
)

/** DFS 平铺（跳过已折叠分支） */
const flatRows = computed<MenuRow[]>(() => {
  const out: MenuRow[] = []
  const walk = (pid: number, level: number) => {
    for (const m of byParent.value.get(pid) || []) {
      const row: MenuRow = {
        id: Number(m.id),
        label: m.displayName || m.name || `菜单${m.id}`,
        level,
        hasChildren: (byParent.value.get(Number(m.id)) || []).length > 0,
      }
      out.push(row)
      if (!collapsed.value.has(row.id)) walk(row.id, level + 1)
    }
  }
  walk(0, 0)
  return out
})

watch(
  () => props.modelValue,
  (v) => {
    permMap.value = parse(v)
  },
)

onMounted(async () => {
  loading.value = true
  try {
    const env: any = await getApi('/Admin/Menu', { page: 1, pageSize: 1000 })
    menus.value = env?.data ?? []
    permMap.value = parse(props.modelValue)
  } catch (e: any) {
    MessagePlugin.error(e?.message || '加载菜单树失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="role-menu-editor">
    <!-- 工具栏：说明 + 授权统计 + 展开/折叠 -->
    <div class="rme-toolbar">
      <div class="rme-legend">
        <t-tag size="small" theme="success" variant="light" class="rme-count">
          {{ grantedCount }} 个菜单已授权
        </t-tag>
        <span class="rme-hint">父节点勾选会联动其全部子菜单</span>
      </div>
      <div class="rme-tools">
        <t-button size="small" theme="default" variant="outline" :disabled="disabled" @click="expandAll">
          全展开
        </t-button>
        <t-button size="small" theme="default" variant="outline" :disabled="disabled" @click="collapseAll">
          全折叠
        </t-button>
      </div>
    </div>

    <t-loading :loading="loading" show-overlay>
      <div class="rme-body">
        <!-- 列头：与行内权限位对齐 -->
        <div class="rme-head-row">
          <span class="rme-hc-menu">菜单</span>
          <span class="rme-hc-bits">权限位</span>
        </div>
        <div class="rme-scroll">
          <template v-if="flatRows.length">
            <div
              v-for="row in flatRows"
              :key="row.id"
              class="rme-row"
              :class="{ 'rme-row--parent': row.hasChildren }"
              :style="{ paddingLeft: 10 + row.level * 20 + 'px' }"
            >
              <span
                v-if="row.hasChildren"
                class="rme-caret"
                :title="collapsed.has(row.id) ? '展开子级' : '折叠子级'"
                @click="toggleCollapse(row.id)"
              >{{ collapsed.has(row.id) ? '▸' : '▾' }}</span>
              <span v-else class="rme-caret rme-caret--leaf" />
              <span class="rme-name" :title="row.label">{{ row.label }}</span>
              <span class="rme-bits">
                <t-checkbox
                  v-for="b in PERM_BITS"
                  :key="b.bit"
                  class="rme-bit"
                  :checked="(maskOf(row.id) & b.bit) !== 0"
                  :disabled="disabled"
                  @change="(v: any) => toggleBit(row.id, b.bit, !!v)"
                >{{ b.label }}</t-checkbox>
              </span>
            </div>
          </template>
          <div v-else class="rme-empty">暂无菜单数据</div>
        </div>
      </div>
    </t-loading>
  </div>
</template>

<style scoped>
.role-menu-editor {
  width: 100%;
}

/* ---- 工具栏 ---- */
.rme-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.rme-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rme-count {
  flex: none;
}
.rme-hint {
  font-size: 12px;
  color: var(--td-text-color-secondary, #8a94a6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rme-tools {
  flex: none;
  display: flex;
  gap: 6px;
}

/* ---- 卡片容器 ---- */
.rme-body {
  border: 1px solid var(--td-component-border, #e7e7e7);
  border-radius: 8px;
  overflow: hidden;
}

/* ---- 列头 ---- */
.rme-head-row {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--td-bg-color-secondarycontainer, #f3f5f8);
  border-bottom: 1px solid var(--td-component-border, #e7e7e7);
  font-size: 12px;
  color: var(--td-text-color-placeholder, #8a94a6);
}
.rme-hc-menu {
  flex: 1 1 auto;
  min-width: 0;
}
.rme-hc-bits {
  flex: none;
  width: 236px;
  text-align: center;
}

/* ---- 行列表 ---- */
.rme-scroll {
  max-height: 396px;
  overflow-y: auto;
}
.rme-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 12px;
  min-height: 36px;
  font-size: 13px;
  transition: background 0.15s;
}
.rme-row + .rme-row {
  border-top: 1px solid var(--td-component-stroke, #f2f3f5);
}
.rme-row:hover {
  background: var(--td-bg-color-container-hover, #f5f5f5);
}
.rme-row--parent {
  font-weight: 600;
  background: var(--td-bg-color-secondarycontainer, #fafafa);
}
.rme-row--parent:hover {
  background: var(--td-bg-color-container-hover, #f0f1f4);
}

/* 层级连接视觉：缩进 + 细竖线 */
.rme-row {
  position: relative;
}
.rme-row:not(:first-child)::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: transparent;
}

.rme-caret {
  flex: none;
  width: 14px;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  text-align: center;
  color: var(--td-text-color-secondary, #8a94a6);
  transition: color 0.15s;
}
.rme-caret:hover {
  color: var(--td-brand-color, #0052d9);
}
.rme-caret--leaf {
  cursor: default;
  visibility: hidden;
}
.rme-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 权限位：固定四列等宽对齐 ---- */
.rme-bits {
  flex: none;
  width: 236px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  text-align: center;
}
.rme-bits :deep(.t-checkbox) {
  margin-right: 0;
  justify-content: center;
}
.rme-bits :deep(.t-checkbox__label) {
  font-size: 12px;
}

.rme-empty {
  color: var(--td-text-color-placeholder, #bbb);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}
</style>
