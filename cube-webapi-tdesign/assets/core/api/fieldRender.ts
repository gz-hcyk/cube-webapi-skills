import { h } from 'vue'
import { Tag } from 'tdesign-vue-next'
import { camelFieldName } from '@/utils/camel'

/**
 * Cube 下发的 DataField（NewLife.Cube/ViewModels/DataField.cs）。
 *
 * ★★ 布尔键省略规则（本后端 Cube 6.15.2026.901 实测，极易踩坑）：
 *   Cube 序列化时**省略取值为 false 的布尔属性** —— 该键只在 true 时出现。
 *   实证：`StockFlow.ID` 序列化为 `{"name":"ID",…,"typeName":"Int64","primaryKey":true}`，
 *   完全没有 `nullable` / `readOnly` / `visible` / `required` 键。
 *   推论：**「键缺失」即 false**。因此绝不能写 `f.nullable === false`（永不成立）；
 *   推必填只能用 `f.nullable !== true`（键缺失 ⇒ 列 NOT NULL ⇒ 必填）。
 *   同理数值/字符串键也可能缺失（如 `length` 只在有长度限制时下发）。
 *
 * 字典源有三处，取值优先级见 mapDictOf：
 *   ① `dataSource` —— **本后端实测的枚举字典通道**：
 *      Cube 把枚举成员的 [Description] 中文装配在此（键为数值字符串），
 *      如 `Direction → {"1":"入库","-1":"出库"}`。26 实体 17 个枚举类型 105 处全覆盖。
 *   ② `map` —— 少数后端变体下发，保留兼容。
 *   ③ `mapField` 字典串 —— 仅当后端把 [Map("k=v")] 原样塞进 mapField 时成立（本后端不成立）。
 */
export interface DataField {
  name: string
  displayName: string
  description?: string | null
  category?: string
  typeName: string
  itemType?: string | null
  /** 仅有长度约束时下发 */
  length?: number
  precision?: number
  scale?: number
  /** 仅 true 时下发；键缺失 = 列 NOT NULL（不可空） */
  nullable?: boolean
  /** 仅 true 时下发 */
  primaryKey?: boolean
  /** 仅 true 时下发 */
  readOnly?: boolean
  /** 仅 true 时下发 */
  visible?: boolean
  /** 仅 true 时下发；本后端实测恒缺失（不提供独立的必填信号） */
  required?: boolean
  mapField?: string | null
  lovCode?: string | null
  textAlign?: number
  maxWidth?: number
  /** ★ 枚举字典（后端实测下发）：键为数值字符串，值通常为中文 Description（少数变体为 {label,value} 对象） */
  dataSource?: Record<string, any> | null
  /** 少数后端变体下发；本后端实测无此键，保留仅为兼容 */
  map?: Record<string, string> | null
  header?: string | null
  headerTitle?: string | null
  text?: string | null
  url?: string | null
  target?: string | null
}

export const DEFAULT_CATEGORY = '基础设置'

export function fieldKey(f: DataField): string {
  return camelFieldName(f.name)
}

/* ------------------------------------------------------------------ *
 * mapField 双语义判别（核心）
 *
 * GetPage 把 FieldItem.Map 的「源串」原样序列化进 mapField，于是同一个键承载两种语义：
 *   ① 虚拟映射字段：[Map(nameof(ClassID), typeof(Class), "ID")] → mapField="ClassID"（真实字段名）
 *   ② 枚举字典源：[Map("1=男,2=女")]                            → mapField="1=男,2=女"（k=v 字典串）
 * 判别法：mapField 能在字段集里命中同名字段 ⇒ ①；否则 ⇒ ②。
 * 无字段集可对照时退化为形状判别（纯标识符且不含 =/逗号 ⇒ ①）。
 * ------------------------------------------------------------------ */
export type MapFieldKind = 'none' | 'field' | 'dict'

const DICT_CACHE = new Map<string, Record<string, string> | null>()

function isIdentifier(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)
}

/** 解析 [Map] 字典源串："1=男,2=女" → { '1': '男', '2': '女' }（支持中文逗号，带缓存） */
export function parseMapSource(src: string): Record<string, string> | null {
  if (!src) return null
  const cached = DICT_CACHE.get(src)
  if (cached !== undefined) return cached
  if (!/[=,，]/.test(src)) {
    DICT_CACHE.set(src, null)
    return null
  }
  const dict: Record<string, string> = {}
  for (const part of src.split(/[,，]/)) {
    const p = part.trim()
    if (!p) continue
    const i = p.indexOf('=')
    if (i <= 0) continue
    const k = p.slice(0, i).trim()
    if (k) dict[k] = p.slice(i + 1).trim()
  }
  const result = Object.keys(dict).length ? dict : null
  DICT_CACHE.set(src, result)
  return result
}

export function mapFieldKind(f: DataField, fields?: DataField[]): MapFieldKind {
  const mf = (f.mapField ?? '').trim()
  if (!mf) return 'none'
  // 命中同名字段 ⇒ 虚拟映射字段
  if (fields && fields.length && fields.some((x) => x.name && x.name.toLowerCase() === mf.toLowerCase())) {
    return 'field'
  }
  // ⚠️ 关键：字典串必然含 `=`/`,`，纯标识符只能是字段名。
  // 不能因为「同组字段集里没有目标 ID 列」就判成 dict —— 实测 GetPage 的 addForm/list
  // 只给虚拟名称列（WarehouseName→WarehouseID），目标列不在同组，误判会让外键退化成文本框。
  return isIdentifier(mf) ? 'field' : 'dict'
}

/** mapField 指向另一个真实字段 ⇒ 该字段是「显示名」虚拟字段（如 ClassName→ClassID） */
export function isMappedField(f: DataField, fields?: DataField[]): boolean {
  return mapFieldKind(f, fields) === 'field'
}

export function mappedFieldName(f: DataField): string {
  return camelFieldName((f.mapField ?? f.name).trim())
}

/**
 * 字段自带的枚举字典。**取值优先级**：
 *   ① `dataSource`（本后端 Cube 6.15 实测通道，枚举中文 Description）
 *   ② `map`（少数变体）
 *   ③ `mapField` 字典串（后端把 [Map("k=v")] 原样下发时；本后端不成立）
 * 注意：虚拟映射字段（XxxName→XxxID）不算字典，其 mapField 是真实字段名。
 */
export function mapDictOf(f: DataField, fields?: DataField[]): Record<string, string> | null {
  const ds = f.dataSource
  if (ds && typeof ds === 'object') {
    const keys = Object.keys(ds)
    if (keys.length) {
      const d: Record<string, string> = {}
      for (const k of keys) {
        const v: any = ds[k]
        // 值为对象时取 label/text/value（不同 Cube 变体差异），否则直接字符串化
        d[k] = v != null && typeof v === 'object' ? String(v.label ?? v.text ?? v.value ?? k) : String(v)
      }
      return d
    }
  }
  if (f.map && Object.keys(f.map).length) return f.map
  if (mapFieldKind(f, fields) !== 'dict') return null
  return parseMapSource((f.mapField ?? '').trim())
}

export function lookupBaseName(f: DataField, fields?: DataField[]): string {
  const raw = isMappedField(f, fields) ? (f.mapField as string) : f.name
  return raw.replace(/IDs?$/i, '')
}

export function isMultiValue(f: DataField): boolean {
  return /IDs$/i.test(f.name)
}

export function isTreeSchema(fields: DataField[]): boolean {
  return fields.some(
    (f) => f.name.toLowerCase() === 'parentid' || (f.mapField && f.mapField.toLowerCase() === 'parentid'),
  )
}

function lookDict(lookups: any, base: string): Record<string, any> | undefined {
  if (!lookups) return undefined
  return lookups[base.toLowerCase()] || lookups[base]
}

function dictHit(dict: Record<string, any>, value: any): string | null {
  if (dict[value] != null) return String(dict[value])
  if (dict[String(value)] != null) return String(dict[String(value)])
  return null
}

/**
 * 取值 → 显示文本。优先字段自带 [Map] 字典，其次约定式外键字典（lookups），都没有则回落原值。
 * fields 传入才能判别 mapField 语义，务必从调用处透传。
 */
export function labelOf(f: DataField, value: any, lookups?: any, fields?: DataField[]): string {
  if (value == null || value === '') return ''
  const md = mapDictOf(f, fields)
  if (md) {
    const hit = dictHit(md, value)
    if (hit != null) return hit
  }
  const dict = lookDict(lookups, lookupBaseName(f, fields))
  if (dict) {
    if (isMultiValue(f)) {
      const parts = String(value)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length > 1) return parts.map((p) => dictHit(dict, p) ?? p).join('、')
    }
    const hit = dictHit(dict, value)
    if (hit != null) return hit
  }
  return String(value)
}

function optionValue(k: string): any {
  if (k === '') return k
  const n = Number(k)
  return isNaN(n) ? k : n
}

export function resolveOptions(f: DataField, lookups?: any, fields?: DataField[]): { label: string; value: any }[] {
  const opts: { label: string; value: any }[] = []
  const md = mapDictOf(f, fields)
  if (md) {
    for (const k of Object.keys(md)) opts.push({ label: String(md[k]), value: optionValue(k) })
  }
  const dict = lookDict(lookups, lookupBaseName(f, fields))
  if (dict) {
    for (const k of Object.keys(dict)) opts.push({ label: String(dict[k]), value: optionValue(k) })
  }
  return opts
}

/**
 * LIST 型值集字段（`lovCode` 形如 `List.{Area}.{Ctrl}`）→ 表单渲染为 `LovListField` 表格弹窗。
 * 与 ENUM 型（`Enum.*`，静态字典下拉）区分：LIST 是**动态数据**，须走弹窗取数。
 */
export function isListLov(f: DataField): boolean {
  return String(f.lovCode ?? '').trim().startsWith('List.')
}

/** 控件选型：映射字段/枚举字典 → select；按 typeName/itemType 细分其余 */
export function controlOf(f: DataField, fields?: DataField[]): string {
  // ⚠️ LIST 型值集必须**置于 isMappedField 之前**：List.* 字段往往同时被 map 判定命中，
  //    若排在后面会被误判成外键下拉，LovListField 永不渲染（技能 §4.20.2 步骤③）。
  if (isListLov(f)) return 'lov-list'
  if (isMappedField(f, fields)) {
    if (isMultiValue(f)) return 'multi-select'
    if (/^parentIDs?$/i.test((f.mapField ?? '').trim())) return 'tree-select'
    return 'select'
  }
  if (mapDictOf(f, fields)) return 'select'
  const tn = (f.typeName || '').toLowerCase()
  const it = (f.itemType || '').toLowerCase()
  if (it === 'mail') return 'email'
  if (it === 'mobile') return 'tel'
  if (it === 'image') return 'image'
  if (it === 'html') return 'textarea'
  if (tn === 'boolean') return 'switch'
  if (tn.includes('int') || tn === 'double' || tn === 'decimal' || tn === 'single') return 'number'
  if (tn.includes('date') || tn.includes('time')) return 'date'
  if (tn === 'string' && (f.length ?? 0) > 200) return 'textarea'
  if (/IDs?$/i.test(f.name) && f.primaryKey !== true) return 'select'
  return 'input'
}

function isBool(f: DataField): boolean {
  const tn = (f.typeName || '').toLowerCase()
  return tn === 'boolean' || tn === 'bool'
}

function colWidth(f: DataField): number {
  const tn = (f.typeName || '').toLowerCase()
  const it = (f.itemType || '').toLowerCase()
  if (isBool(f)) return 80
  if (it === 'image') return 90
  if (tn.includes('int') || tn === 'double' || tn === 'decimal' || tn === 'single') return 100
  if (tn.includes('time')) return 170
  if (tn.includes('date')) return 120
  const limit = (f.maxWidth ?? 0) > 0 ? (f.maxWidth as number) : (f.length ?? 0) > 0 ? (f.length as number) : 0
  return limit ? Math.min(260, Math.max(120, limit * 13)) : 150
}

/** GetPage.textAlign：0=左 1=中 2=右 */
const COL_ALIGNS: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right']

/** 列表列：枚举/映射/外键一律显名，布尔显「是/否」，其余按类型定宽对齐 */
export function buildColumns(fields: DataField[], getLookups?: () => any): any[] {
  return fields.map((f) => {
    const key = fieldKey(f)
    const hasDict = !!mapDictOf(f, fields) || isMappedField(f, fields) || /IDs?$/i.test(f.name)
    const col: any = {
      colKey: key,
      title: f.header || f.displayName || f.name,
      align: COL_ALIGNS[f.textAlign ?? 0],
      width: key === 'id' ? 80 : colWidth(f),
      ellipsis: true,
    }
    if (hasDict) {
      col.cell = (_h: any, params: any) => {
        const text = labelOf(f, params?.row?.[key], getLookups ? getLookups() : null, fields)
        return h(Tag, { theme: text ? 'primary' : 'default', variant: 'light' }, () => text || '-')
      }
    } else if (isBool(f)) {
      col.cell = (_h: any, params: any) =>
        h(Tag, { theme: params?.row?.[key] ? 'success' : 'default', variant: 'light' }, () =>
          params?.row?.[key] ? '是' : '否',
        )
    }
    return col
  })
}

export interface FormItem {
  /**
   * 表单 v-model 键（camelCase）。**映射字段取原始字段名的 camel**（ClassName→classID）——
   * 后端 POST/详情只认真实列，按自身名提交会被忽略导致外键存不进去。
   */
  key: string
  /** 回填兜底键：映射字段在行数据里以自身名存在（row.className），key 取不到时用它 */
  fallbackKey?: string
  /** 提交给后端的真实字段名（映射字段取 mapField，其余取 name） */
  paramName: string
  label: string
  control: string
  options?: { label: string; value: any }[]
  multiple?: boolean
  /** control==='lov-list' 时的值集编码（`List.{Area}.{Ctrl}`），供 LovListField 取元数据 */
  lovCode?: string
  /** 该控件绑定的是数值型列（Int/Decimal/Double/Single）——用于给出合法默认值，避免提交 null 被 NOT NULL 列拒绝 */
  numeric?: boolean
  required?: boolean
  readOnly?: boolean
  full?: boolean
  category: string
  maxlength?: number
  rules?: any[]
}

export const AUDIT_FIELDS = [
  'createuserid',
  'updateuserid',
  'createuser',
  'updateuser',
  'createip',
  'updateip',
  'createtime',
  'updatetime',
]

function isAudit(f: DataField): boolean {
  return AUDIT_FIELDS.includes(fieldKey(f).toLowerCase())
}

/**
 * 校验规则：一律复用 TDesign/async-validator 内置类型（email/url/number/required/max …），
 * 不手写正则。内置类型对空值自动跳过，故「必填」与「格式」是两条独立规则。
 */
export function rulesOf(f: DataField, fields?: DataField[]): any[] {
  const rules: any[] = []
  const label = f.displayName || f.name
  if (requiredOf(f, fields)) rules.push({ required: true, message: `请填写${label}`, type: 'error' })
  const tn = (f.typeName || '').toLowerCase()
  const it = (f.itemType || '').toLowerCase()
  const control = controlOf(f, fields)
  if (it === 'mail') rules.push({ type: 'email', message: `${label}格式不正确` })
  if (it === 'url') rules.push({ type: 'url', message: `${label}格式不正确` })
  if (control === 'number') rules.push({ type: 'number', message: `${label}必须是数字`, transform: Number })
  if ((f.length ?? 0) > 0 && (f.length ?? 0) <= 500 && (control === 'input' || control === 'email' || control === 'tel')) {
    rules.push({ max: f.length, message: `${label}不能超过 ${f.length} 个字符` })
  }
  // async-validator 无内置手机号类型，只能用 pattern（内置无同类能力时的自定义兜底）
  if (it === 'mobile') rules.push({ pattern: /^1[3-9]\d{9}$/, message: `${label}格式不正确` })
  void tn
  return rules
}

/**
 * 必填判定。
 *
 * ⚠️ 后端**不给**必填信号：`required` 键在 26 实体 1452 个字段描述符中出现 0 次。
 * 且 Cube 省略 false 布尔键，`nullable` 只在「可空」时为 true。
 * 故唯一可靠的判据是取反：**`nullable !== true` ⇒ 列 NOT NULL ⇒ 必填**。
 * 排除项：主键（自增）、服务端填充的审计字段（创建/更新人时间），
 * 否则新增表单会被系统字段卡住。
 */
function requiredOf(f: DataField, _fields?: DataField[]): boolean {
  if (f.required === true) return true
  if (f.primaryKey === true || f.readOnly === true || isAudit(f)) return false
  return f.nullable !== true
}

function toFormItem(f: DataField, lookups: any, fields: DataField[]): FormItem {
  const control = controlOf(f, fields)
  const isSelect = control === 'select' || control === 'multi-select' || control === 'tree-select'
  const mapped = isMappedField(f, fields)
  const tn = (f.typeName || '').toLowerCase()
  const numeric = tn.includes('int') || tn === 'double' || tn === 'decimal' || tn === 'single'
  return {
    key: mapped ? mappedFieldName(f) : fieldKey(f),
    fallbackKey: mapped ? fieldKey(f) : undefined,
    paramName: mapped ? (f.mapField as string).trim() : f.name,
    label: f.displayName || f.name,
    control,
    options: isSelect ? resolveOptions(f, lookups, fields) : undefined,
    // lov-list 的「多选」由字段名判定（`xxxIDs` ⇒ 多值），与 multi-select 共用 multiple 语义
    multiple: control === 'multi-select' || (control === 'lov-list' && isMultiValue(f)),
    lovCode: control === 'lov-list' ? String(f.lovCode ?? '').trim() : undefined,
    numeric,
    required: requiredOf(f, fields),
    readOnly: f.readOnly === true,
    full: control === 'textarea' || control === 'image',
    category: f.category || '',
    maxlength: (f.length ?? 0) > 0 && (f.length ?? 0) <= 200 ? f.length : undefined,
    rules: rulesOf(f, fields),
  }
}

/** 表单项：新增走 addForm、编辑走 editForm（后端 GetPage 已按场景裁剪好字段集） */
export function buildFormItems(fields: DataField[], lookups?: any): FormItem[] {
  const all = fields || []
  return all
    .filter((f) => !f.primaryKey && !f.readOnly && !isAudit(f))
    .map((f) => toFormItem(f, lookups, all))
}

/** 详情项：后端 detail 组，主键/审计字段已由后端裁剪，此处仅兜底 */
export function buildDetailItems(fields: DataField[], lookups?: any): FormItem[] {
  const all = fields || []
  return all.filter((f) => !f.primaryKey).map((f) => toFormItem(f, lookups, all))
}

/**
 * 搜索项：来自 GetPage.search（**真实查询参数名**，如 Student 的 ClassID——list 里只有虚拟字段 ClassName）。
 * 这正好替代「手工配置 searchParamMap」：后端自己声明了可查询列。
 */
export function buildSearchItems(fields: DataField[], lookups?: any): FormItem[] {
  const all = fields || []
  return all.map((f) => {
    const it: FormItem = { ...toFormItem(f, lookups, all), required: false, rules: [] }
    // 搜索栏降级：LIST 型值集是**动态数据**、无静态候选，弹窗选择不适合内联搜索栏 →
    // 降级为文本输入（提交走 `Q` 关键词），避免出现「空下拉选不出东西」。
    if (it.control === 'lov-list') it.control = 'input'
    return it
  })
}

/** Index 保留参数名：搜索条件与之冲突会被后端当成分页/排序参数（实测 ?sort=1 会让列表返回 0 行） */
export const RESERVED_PARAMS = new Set([
  'q', 'pageindex', 'pagesize', 'sort', 'orderby', 'desc', 'asc', 'format', 'token', 'fields',
])

/**
 * 搜索模型 → 查询参数。
 * 契约（curl 实测）：数值/枚举/布尔/日期走**字段参数**（大小写不敏感，但布尔值必须小写 true/false）；
 * 字符串并入 **Q 关键词**模糊搜索（字段参数在部分 Cube 变体上不生效）。
 */
export function buildSearchParams(items: FormItem[], model: Record<string, any>): Record<string, any> {
  const p: Record<string, any> = {}
  const keywords: string[] = []
  for (const it of items) {
    const v = model?.[it.key]
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue
    const lower = String(it.paramName).toLowerCase()
    if (RESERVED_PARAMS.has(lower)) continue
    const isText = ['input', 'textarea', 'email', 'tel'].includes(it.control)
    if (isText) {
      keywords.push(String(v).trim())
      continue
    }
    p[it.paramName] = typeof v === 'boolean' ? (v ? 'true' : 'false') : v
  }
  if (keywords.length) p.Q = keywords.join(' ')
  return p
}

export function groupByCategory<T extends { category: string }>(
  items: T[],
  defaultCategory = DEFAULT_CATEGORY,
): { category: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const cat = it.category && it.category.trim() ? it.category : defaultCategory
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(it)
  }
  const groups: { category: string; items: T[] }[] = []
  if (map.has(defaultCategory)) groups.push({ category: defaultCategory, items: map.get(defaultCategory)! })
  for (const [cat, arr] of map) {
    if (cat === defaultCategory) continue
    groups.push({ category: cat, items: arr })
  }
  return groups
}
