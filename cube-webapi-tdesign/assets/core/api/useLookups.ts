import { ref } from 'vue'
import { getApi } from './http'
import { DataField, lookupBaseName, mapDictOf, isMappedField } from './fieldRender'

/**
 * 约定式外键字典：扫描「指向别的实体」的字段，拉取该实体的 Index 组装 {id: 名称}。
 *
 * 两类目标（都以 mapField/字段名推出的 base 为控制器名）：
 *   ① 虚拟显示字段 `XxxName`（mapField → `XxxID`）—— 列表列与表单选择器都用它；
 *   ② 真外键列 `XxxID` —— 未配虚拟列时的兜底。
 * 枚举字段（有 dataSource）不参与——它的选项由 dataSource 直接解析，无需网络。
 *
 * 契约（docs/16-前端接口契约实测报告.md）：
 *   - 实体接口只写 `/{area}/{ctrl}`（**不带 `/api`**）：`/api` 由 `http` 实例 baseURL 统一承载；
 *   - Assets 库无 Dept/User 实体，须回退 Cube 内置：`/Admin/Department`、`/Admin/User`（实测均 200）。
 */
export function useLookups() {
  const lookups = ref<Record<string, Record<string, string>>>({})

  async function load(area: string, fields: DataField[]) {
    const all = fields || []
    // base(小写) → 原始 base（保留大小写用于拼 URL）
    const wanted = new Map<string, string>()
    for (const f of all) {
      if (f.primaryKey) continue
      if (mapDictOf(f, all)) continue // 枚举：走 dataSource，无需网络
      const isVirtual = isMappedField(f, all)
      const isFk = !isVirtual && /IDs?$/i.test(f.name) && f.name.toLowerCase() !== 'id'
      if (!isVirtual && !isFk) continue
      const base = lookupBaseName(f, all)
      if (base && !/^(parent)$/i.test(base)) wanted.set(base.toLowerCase(), base)
    }
    for (const [, base] of wanted) {
      const key = base.toLowerCase()
      if (lookups.value[key]) continue
      const dict = await fetchDict(area, base)
      if (dict) lookups.value[key] = dict
    }
  }

  return { lookups, load }
}

/** Assets 库无对应实体时的回退目标（铁律 P1：复用框架内置，不自建） */
const ADMIN_ALIAS: Record<string, string> = {
  dept: 'Department',
  department: 'Department',
  user: 'User',
  createuser: 'User',
  updateuser: 'User',
  applicant: 'User',
  initiator: 'User',
  operator: 'User',
  role: 'Role',
  tenant: 'Tenant',
}

/** 字段名基与真实控制器名不一致时的别名（同一 area 内，实测 404 后确认的真实控制器） */
const AREA_ALIAS: Record<string, string> = {
  flow: 'FlowDefinition',
  batch: 'StockBatch',
  bill: 'StockBill',
  location: 'StorageLocation',
  defaultlocation: 'StorageLocation',
  category: 'AssetCategory',
  defaultwarehouse: 'Warehouse',
}

/**
 * 候选 URL 顺序 = 命中率优先，减少探路 404。
 * 已知 Assets 区不存在的基（Dept/User/…）直接先打 Admin 内置端点；
 * 字段基与控制器名不一致的先打同区别名，再打原样，最后才试 Admin。
 */
function candidates(area: string, base: string): string[] {
  const b = base.toLowerCase()
  const admin = ADMIN_ALIAS[b]
  const local = AREA_ALIAS[b]
  const localAliased = `/${area}/${local || base}`
  const localRaw = `/${area}/${base}`
  const list = admin
    ? [`/Admin/${admin}`, localAliased, localRaw]
    : [localAliased, localRaw, `/Admin/${base}`]
  return [...new Set(list)]
}

async function fetchDict(area: string, base: string): Promise<Record<string, string> | null> {
  for (const u of candidates(area, base)) {
    try {
      const env = await getApi(`${u}?pageIndex=1&pageSize=1000`)
      const rows = env?.data
      if (Array.isArray(rows)) return buildDict(rows, base)
    } catch {
      /* 该候选不可达（404/401），尝试下一个 */
    }
  }
  return null
}

function buildDict(rows: any[], base: string): Record<string, string> {
  const dict: Record<string, string> = {}
  for (const r of rows) {
    const id = r?.id ?? r?.ID ?? r?.Id
    if (id == null) continue
    dict[String(id)] = String(labelValue(r, base, id))
  }
  return dict
}

/** 名称列智能取值：优先 `{base}Name`（warehouseName），再常见名，再次任意 *Name，最后回落 id */
function labelValue(r: any, base: string, fallback: any): any {
  const keys = Object.keys(r || {})
  const want = base.toLowerCase() + 'name'
  const hit = keys.find((k) => k.toLowerCase() === want)
  if (hit && r[hit] != null && r[hit] !== '') return r[hit]
  for (const c of ['name', 'displayName', 'title', 'fullName', 'userName', 'realName', 'code']) {
    const k = keys.find((x) => x.toLowerCase() === c.toLowerCase())
    if (k && r[k] != null && r[k] !== '') return r[k]
  }
  const anyName = keys.find((k) => /name$/i.test(k) && !/^(create|update)/i.test(k))
  if (anyName && r[anyName] != null && r[anyName] !== '') return r[anyName]
  return fallback
}
