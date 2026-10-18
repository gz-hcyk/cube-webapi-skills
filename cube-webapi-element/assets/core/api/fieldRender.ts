/**
 * 字段渲染器：DataField → Element Plus 控件（铁律 E1/E2 的唯一实现处）
 * 落位：src/api/fieldRender.ts
 *
 * 设计对应关系（魔方 MVC → Vue）：
 *   _List_Data.cshtml 按字段循环      → buildColumns()
 *   _Form_*.cshtml 按类型选分部视图   → selectFormControl() + FieldControl.vue
 *   ListTree.cshtml                   → isTreeSchema() + el-table 的树形模式
 * 因此：**新增实体不写渲染代码**，只改元数据。
 */
import type { Component } from 'vue';

/* ------------------------------ 契约类型 ------------------------------ */

export interface OptionItem {
  value: string | number;
  label: string;
}

export interface DataField {
  name: string;
  displayName?: string | null;
  description?: string | null;
  category?: string | null;
  typeName?: string | null;
  itemType?: string | null;
  length?: number | null;
  precision?: number | null;
  scale?: number | null;
  nullable?: boolean | null;
  primaryKey?: boolean | null;
  isIdentity?: boolean | null;
  readOnly?: boolean | null;
  visible?: boolean | null;
  required?: boolean | null;
  sortable?: boolean | null;
  mapField?: string | null;
  lovCode?: string | null;
  map?: Record<string, string> | null;
  dataSource?: unknown;
  authority?: string | null;
  [key: string]: unknown;
}

export interface PageSetting {
  navView?: number;
  enableNavbar?: boolean;
  enableToolbar?: boolean;
  enableAdd?: boolean;
  enableSelect?: boolean;
  enableFooter?: boolean;
  isReadOnly?: boolean;
  enableTableDoubleClick?: boolean;
  orderByKey?: boolean;
  doubleDelete?: boolean;
  [key: string]: unknown;
}

export interface PageSchema {
  setting: PageSetting;
  list: DataField[];
  addForm: DataField[];
  editForm: DataField[];
  detail: DataField[];
  search: DataField[];
}

export type LookupMap = Record<string, Record<string, string>>;

export type FieldControl =
  | 'input'
  | 'textarea'
  | 'password'
  | 'number'
  | 'switch'
  | 'select'
  | 'multi-select'
  | 'tree-select'
  | 'date'
  | 'datetime'
  | 'daterange'
  | 'time'
  | 'upload'
  | 'rich-text';

/* ------------------------------ 基础工具 ------------------------------ */

/** 后端字段名（PascalCase）→ 行对象键（camelCase）。ID/URL 等纯大写缩写整词小写。 */
export function camel(input: string): string {
  if (!input) return '';
  if (/^[A-Z0-9_]+$/.test(input) && input.length <= 3) return input.toLowerCase();
  return input.charAt(0).toLowerCase() + input.slice(1);
}

/** 行对象键归一：老版本后端返回 PascalCase 时也能对上 row-key / 列 prop */
export function normalizeRow(row: Record<string, unknown>): Record<string, any> {
  if (!row || typeof row !== 'object') return {};
  const out: Record<string, any> = {};
  for (const key of Object.keys(row)) out[camel(key)] = row[key];
  return out;
}

const BASE_TYPES = new Set([
  'string',
  'boolean',
  'byte',
  'sbyte',
  'char',
  'int16',
  'int32',
  'int64',
  'uint16',
  'uint32',
  'uint64',
  'single',
  'double',
  'decimal',
  'float',
  'datetime',
  'datetimeoffset',
  'date',
  'dateonly',
  'time',
  'timeonly',
  'timespan',
  'guid',
  'object',
  'json',
]);

const INT_TYPES = new Set(['int16', 'int32', 'int64', 'uint16', 'uint32', 'uint64', 'byte', 'sbyte']);
const FLOAT_TYPES = new Set(['single', 'double', 'decimal', 'float']);

/** 审计字段：由后端赋值，前端不给输入、不标必填 */
const AUDIT_FIELDS = new Set([
  'id',
  'createTime',
  'updateTime',
  'createUserID',
  'updateUserID',
  'createUser',
  'updateUser',
  'createIP',
  'updateIP',
  'createDeptID',
  'version',
  'isDeleted',
  'deleteTime',
]);

export function isBaseType(f: DataField): boolean {
  const t = String(f.typeName ?? '').toLowerCase();
  return !t || BASE_TYPES.has(t);
}

export function isEnumType(f: DataField): boolean {
  const t = String(f.typeName ?? '').trim();
  if (!t) return false;
  return !BASE_TYPES.has(t.toLowerCase());
}

export function isStringField(f: DataField): boolean {
  return String(f.typeName ?? '').toLowerCase() === 'string';
}

export function isBooleanField(f: DataField): boolean {
  return String(f.typeName ?? '').toLowerCase() === 'boolean';
}

export function isNumericField(f: DataField): boolean {
  const t = String(f.typeName ?? '').toLowerCase();
  return INT_TYPES.has(t) || FLOAT_TYPES.has(t);
}

export function isDateField(f: DataField): boolean {
  const t = String(f.typeName ?? '').toLowerCase();
  return t === 'datetime' || t === 'datetimeoffset';
}

export function isDayField(f: DataField): boolean {
  const t = String(f.typeName ?? '').toLowerCase();
  return t === 'date' || t === 'dateonly';
}

/** 是否主键/自增：新增表单不出现，编辑表单禁用 */
export function isKeyField(f: DataField): boolean {
  return f.primaryKey === true || f.isIdentity === true;
}

/** xxxID：命名约定的映射字段（外键） */
export function isIdField(f: DataField): boolean {
  if (isKeyField(f)) return false;
  const n = String(f.name ?? '');
  if (!/I[Dd]$/.test(n)) return false;
  return !AUDIT_FIELDS.has(camel(n));
}

/** xxxIDs：逗号分隔的多值外键 */
export function isIdsField(f: DataField): boolean {
  return /I[Dd][Ss]$/.test(String(f.name ?? ''));
}

/** mapField 非空 ⇒ 该字段是"显示名字段"，真实存储字段由 mapField 指出 */
export function isMappedField(f: DataField): boolean {
  return !!String(f.mapField ?? '').trim();
}

export function mappedFieldName(f: DataField): string {
  return camel(String(f.mapField ?? ''));
}

/** 映射源基名：RoleName/RoleNames/RoleIds → Role */
export function lookupBaseName(f: DataField): string {
  const raw = String((isMappedField(f) ? f.mapField : f.name) ?? '');
  return raw.replace(/I[Dd][Ss]?$/, '');
}

export function isMultiValue(f: DataField): boolean {
  if (isIdsField(f)) return true;
  return /I[Dd][Ss]$/.test(String(f.mapField ?? ''));
}

export function refersToParent(f: DataField): boolean {
  return String(f.name ?? '').toLowerCase() === 'parentid' || String(f.mapField ?? '').toLowerCase() === 'parentid';
}

/**
 * 必填三级判定（与后端语义一致，宽松兜底）：
 *   required === true → 必填
 *   nullable === false（明确 NOT NULL）→ 必填
 *   未下发 / true → 不必填
 * 系统字段与只读字段一律不参与。
 */
export interface FieldBehavior {
  required: boolean;
  disabled: boolean;
  hidden: boolean;
  readonly: boolean;
}

export function resolveFieldBehavior(f: DataField, mode: 'create' | 'edit' | 'detail' = 'edit'): FieldBehavior {
  const key = isKeyField(f) || AUDIT_FIELDS.has(camel(String(f.name ?? '')));
  const readonly = f.readOnly === true;
  const required = !key && !readonly && (f.required === true || f.nullable === false);

  return {
    required,
    readonly,
    disabled: readonly || (mode === 'edit' && key) || (mode === 'detail'),
    hidden: mode === 'create' && key,
  };
}

/* ------------------------------ 选项解析 ------------------------------ */

/**
 * 选项值。Cube 的 map/dataSource 键一律是字符串，但枚举 JSON 只接受数字
 * （status: "0" 会 400，status: 0 才成功）。纯数字键转成 number。
 */
function asOptionValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = value === null || value === undefined ? '' : String(value);
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}

/** dataSource 双形态归一：{text,value}[] / Record<value,label> / JSON 串 */
export function dictEntries(source: unknown): OptionItem[] {
  if (!source) return [];

  if (typeof source === 'string') {
    const s = source.trim();
    if (!s) return [];
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return dictEntries(JSON.parse(s));
      } catch {
        return [];
      }
    }
    return [];
  }

  if (Array.isArray(source)) {
    return source
      .map((item: any) => {
        if (item == null) return null;
        if (typeof item === 'string' || typeof item === 'number') {
          return { value: item, label: String(item) };
        }
        const value = item.value ?? item.Value ?? item.id ?? item.ID;
        const label = item.text ?? item.Text ?? item.label ?? item.Label ?? item.name ?? item.Name ?? value;
        if (value === undefined || value === null) return null;
        return { value: asOptionValue(value), label: String(label) };
      })
      .filter(Boolean) as OptionItem[];
  }

  if (typeof source === 'object') {
    return Object.entries(source as Record<string, unknown>).map(([value, label]) => ({
      value: asOptionValue(value),
      label: String(label),
    }));
  }

  return [];
}

export function toOptions(f: DataField): OptionItem[] {
  if (f.map && typeof f.map === 'object') {
    return Object.entries(f.map).map(([value, label]) => ({ value: asOptionValue(value), label: String(label) }));
  }
  return dictEntries(f.dataSource);
}

/** lookups 键大小写不敏感（Parent / parent 都能命中） */
function lookupDict(lookups: LookupMap | undefined, base: string): Record<string, string> | undefined {
  if (!lookups || !base) return undefined;
  const target = base.toLowerCase();
  const hit = Object.keys(lookups).find((k) => k.toLowerCase() === target);
  return hit ? lookups[hit] : undefined;
}

/** 表单下拉选项：map → dataSource → lookups */
export function resolveOptions(f: DataField, lookups?: LookupMap): OptionItem[] {
  const direct = toOptions(f);
  if (direct.length) return direct;

  if (isMappedField(f) || isIdField(f) || isIdsField(f)) {
    const dict = lookupDict(lookups, lookupBaseName(f));
    // 行数据里的外键是 number，字典键是 string。不转换时编辑回显会显示裸 ID。
    if (dict) return Object.entries(dict).map(([value, label]) => ({ value: asOptionValue(value), label: String(label) }));
  }
  return [];
}

/** 列表/详情回显：绝不显示原始外键 ID */
export function labelOf(f: DataField, value: unknown, lookups?: LookupMap): string {
  if (value === null || value === undefined || value === '') return '';

  const one = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '';
    if (isBooleanField(f)) {
      const s = String(v).toLowerCase();
      return s === 'true' || s === '1' ? '是' : '否';
    }
    if (f.map && typeof f.map === 'object') {
      const hit = (f.map as Record<string, string>)[String(v)];
      if (hit !== undefined) return String(hit);
    }
    const ds = toOptions(f);
    if (ds.length) {
      const hit = ds.find((o) => String(o.value) === String(v));
      if (hit) return hit.label;
    }
    if (isMappedField(f) || isIdField(f) || isIdsField(f)) {
      const dict = lookupDict(lookups, lookupBaseName(f));
      if (dict) {
        const hit = dict[String(v)];
        if (hit !== undefined) return String(hit);
      }
    }
    return String(v);
  };

  if (isMultiValue(f)) {
    const list = Array.isArray(value) ? value : String(value).split(',');
    const labels = list.map((v) => one(v)).filter(Boolean);
    return labels.join('、');
  }
  return one(value);
}

/** 多值标签（详情页拆成多个 tag） */
export function multiLabels(f: DataField, value: unknown, lookups?: LookupMap): string[] {
  if (value === null || value === undefined || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((v) => labelOf({ ...f, mapField: null, name: String(f.name).replace(/I[Dd][Ss]$/, 'ID') } as DataField, v, lookups)).filter(Boolean);
}

/* ------------------------------ 控件选型 ------------------------------ */

/**
 * 选型优先级（命中即返回，顺序不可调）：
 * itemType 特化 → Boolean → 映射字段(mapField) → 复数外键 → 枚举 → xxxID → map/dataSource → 基础类型
 */
export function selectFormControl(f: DataField): FieldControl {
  const item = String(f.itemType ?? '').toLowerCase();
  if (item === 'html' || item === 'richtext') return 'rich-text';
  if (item === 'image' || item === 'file' || item === 'attach' || item === 'upload') return 'upload';
  if (item === 'password') return 'password';

  if (isBooleanField(f)) return 'switch';

  if (isMappedField(f)) {
    const raw = String(f.mapField ?? '');
    if (/I[Dd][Ss]$/.test(raw)) return 'multi-select';
    if (raw.toLowerCase() === 'parentid') return 'tree-select';
    return 'select';
  }

  if (isIdsField(f)) return 'multi-select';
  if (isEnumType(f)) return 'select';

  if (isIdField(f)) {
    if (refersToParent(f)) return 'tree-select';
    return 'select';
  }

  if (f.map || f.dataSource) return 'select';

  const t = String(f.typeName ?? '').toLowerCase();
  if (t === 'datetime' || t === 'datetimeoffset') return 'datetime';
  if (t === 'date' || t === 'dateonly') return 'date';
  if (t === 'timespan' || t === 'time' || t === 'timeonly') return 'time';
  if (INT_TYPES.has(t) || FLOAT_TYPES.has(t)) return 'number';
  if (t === 'string' || !t) {
    const len = Number(f.length ?? 0);
    if (len > 200) return 'textarea';
    return 'input';
  }
  return 'input';
}

export function isRangeControl(control: FieldControl): boolean {
  return control === 'daterange';
}

/** 不支持富文本编辑器时降级（避免为一个字段引一整套依赖） */
export const CONTROL_FALLBACK: Partial<Record<FieldControl, FieldControl>> = {
  'rich-text': 'textarea',
};

/* ------------------------------ 列表列 ------------------------------ */

export interface ColumnSpec {
  prop: string;
  label: string;
  control: FieldControl;
  width?: number;
  minWidth?: number;
  align: 'left' | 'center' | 'right';
  sortable: boolean;
  field: DataField;
}

export function buildColumns(fields: DataField[], options: { exclude?: string[] } = {}): ColumnSpec[] {
  const exclude = new Set((options.exclude ?? []).map((s) => camel(s)));
  const cols: ColumnSpec[] = [];

  for (const f of fields) {
    const prop = camel(String(f.name ?? ''));
    if (!prop || exclude.has(prop)) continue;
    if (isKeyField(f)) continue;

    const control = selectFormControl(f);
    const label = String(f.displayName || f.name || prop);
    const longText = control === 'textarea' || control === 'rich-text';

    let width: number | undefined;
    let minWidth: number | undefined;
    if (control === 'switch') width = 88;
    else if (control === 'datetime') width = 168;
    else if (control === 'date') width = 120;
    else if (control === 'time') width = 100;
    else if (control === 'number') width = 120;
    else if (longText) minWidth = 220;
    else if (label.length <= 3) minWidth = 110;
    else minWidth = 140;

    cols.push({
      prop,
      label,
      control,
      width,
      minWidth,
      align: control === 'number' ? 'right' : control === 'switch' ? 'center' : 'left',
      sortable: f.sortable === true,
      field: f,
    });
  }
  return cols;
}

/* ------------------------------ 表单 ------------------------------ */

export interface FormItemSpec {
  prop: string;
  label: string;
  control: FieldControl;
  options: OptionItem[];
  multiple: boolean;
  required: boolean;
  disabled: boolean;
  placeholder: string;
  maxlength?: number;
  precision?: number;
  description?: string;
  field: DataField;
}

export function buildFormItems(
  fields: DataField[],
  options: { lookups?: LookupMap; mode?: 'create' | 'edit' | 'search'; onlyEditable?: boolean } = {},
): FormItemSpec[] {
  const { lookups, mode = 'edit', onlyEditable = true } = options;
  const items: FormItemSpec[] = [];

  for (const f of fields) {
    const behavior = resolveFieldBehavior(f, mode === 'search' ? 'detail' : mode);
    if (onlyEditable && behavior.hidden) continue;

    // 映射字段提交真实列（CategoryName + mapField=CategoryID → categoryID）。
    // 提交 categoryName 时后端不会回填外键，校验会报「分类不可以为空」。
    const prop = (isMappedField(f) ? mappedFieldName(f) : '') || camel(String(f.name ?? ''));
    if (!prop) continue;

    const control = selectFormControl(f);
    const required = mode === 'search' ? false : behavior.required;

    items.push({
      prop,
      label: String(f.displayName || f.name || prop),
      control,
      options: resolveOptions(f, lookups),
      multiple: isMultiValue(f),
      required,
      disabled: mode === 'search' ? false : behavior.disabled,
      placeholder: String(f.description || `请输入${f.displayName || f.name || ''}`),
      maxlength: f.length ? Number(f.length) : undefined,
      precision: FLOAT_TYPES.has(String(f.typeName ?? '').toLowerCase()) ? Number(f.precision ?? 2) || 2 : undefined,
      description: f.description ? String(f.description) : undefined,
      field: f,
    });
  }
  return items;
}

/** Element Plus 表单规则 */
export function buildFormRules(items: FormItemSpec[], mode: 'create' | 'edit' = 'create') {
  const rules: Record<string, any[]> = {};
  for (const it of items) {
    const list: any[] = [];
    if (it.required) {
      list.push({
        required: true,
        message: `请${it.multiple || it.control === 'select' || it.control === 'tree-select' ? '选择' : '填写'}${it.label}`,
        trigger: ['input', 'change', 'blur'],
      });
    }
    if (mode === 'create' && it.control === 'password' && it.maxlength) {
      list.push({ min: 6, message: '密码至少 6 位', trigger: 'blur' });
    }
    if (it.maxlength && it.control !== 'number') {
      list.push({ max: it.maxlength, message: `不能超过 ${it.maxlength} 个字符`, trigger: 'blur' });
    }
    if (list.length) rules[it.prop] = list;
  }
  return rules;
}

export const DEFAULT_CATEGORY = '基础信息';

/** 按 category 分组（表单 tab / 详情分区） */
export function groupByCategory<T extends { category?: string | null }>(
  fields: T[],
  defaultCategory = DEFAULT_CATEGORY,
): { category: string; fields: T[] }[] {
  const map = new Map<string, T[]>();
  for (const f of fields) {
    const key = String(f.category || '').trim() || defaultCategory;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return Array.from(map, ([category, fields]) => ({ category, fields }));
}

export function groupFormItems(items: FormItemSpec[], defaultCategory = DEFAULT_CATEGORY) {
  const map = new Map<string, FormItemSpec[]>();
  for (const it of items) {
    const key = String(it.field.category || '').trim() || defaultCategory;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map, ([category, items]) => ({ category, items }));
}

/* ------------------------------ 树形 ------------------------------ */

/**
 * 树形判定：**必须是字段组聚合**。
 * Cube 常把 ParentID 从 list 组隐藏、只留 ParentName(mapField=ParentID)，
 * 只看 list 组会把树误判成平铺表。
 */
export function isTreeSchema(groups: (DataField[] | undefined)[]): boolean {
  return groups.filter(Boolean).some((fields) => (fields as DataField[]).some(refersToParent));
}

export function buildTree(rows: any[], idKey = 'id', parentKey = 'parentID'): any[] {
  if (!Array.isArray(rows) || !rows.length) return [];
  const nodes = rows.map((r) => normalizeRow(r));
  const childrenOf = new Map<string, any[]>();
  const roots: any[] = [];

  for (const node of nodes) {
    const pid = node[parentKey];
    if (pid === null || pid === undefined || pid === '' || String(pid) === '0') roots.push(node);
    else {
      const key = String(pid);
      if (!childrenOf.has(key)) childrenOf.set(key, []);
      childrenOf.get(key)!.push(node);
    }
  }

  const link = (node: any, path: Set<string>) => {
    if (path.has(String(node[idKey]))) return; // 防御脏数据造成的环
    const kids = childrenOf.get(String(node[idKey]));
    if (kids?.length) {
      node.children = kids;
      const next = new Set(path).add(String(node[idKey]));
      kids.forEach((k) => link(k, next));
    }
  };
  roots.forEach((r) => link(r, new Set()));
  return roots;
}

/** 树形下拉数据；排除自身及其子树，避免把节点挂到自己下面 */
export function toTreeSelectData(nodes: any[], excludeId?: string | number, labelKey = 'name'): any[] {
  const excluded = new Set<string>();
  if (excludeId !== undefined && excludeId !== null && excludeId !== '') {
    const collect = (list: any[]) => {
      for (const n of list) {
        if (String(n.id) === String(excludeId)) {
          const mark = (node: any) => {
            excluded.add(String(node.id));
            (node.children ?? []).forEach(mark);
          };
          mark(n);
        } else collect(n.children ?? []);
      }
    };
    collect(nodes);
  }

  const mapNode = (n: any): any => {
    if (excluded.has(String(n.id))) return null;
    const children = (n.children ?? []).map(mapNode).filter(Boolean);
    const label = n[labelKey] ?? n.displayName ?? n.name ?? n.title ?? n.id;
    return {
      value: n.id,
      label: String(label),
      ...(children.length ? { children } : {}),
    };
  };
  return nodes.map(mapNode).filter(Boolean);
}

/* ------------------------------ 序列化 ------------------------------ */

/** 多选数组 → 逗号串；清空 → '' */
export function serializeMultiValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.join(',');
  return value ?? '';
}

/** 逗号串 → 数组。**永远返回数组**，否则 el-select multiple 首帧会因 null 报错 */
export function deserializeMultiValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string') {
    const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : [];
  }
  return [value];
}

export function serializeRangeValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(',');
  return String(value ?? '');
}

export function deserializeRangeValue(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string' && value.includes(',')) return value.split(',');
  return [];
}

/* ------------------------------ 查询参数 ------------------------------ */

export const RESERVED_PARAMS = new Set(['pageIndex', 'pageSize', 'sort', 'desc', 'Q', 'token']);

/**
 * 搜索模型 → 查询参数（契约 §5）：
 *   · 字符串字段走 Q 关键词（后端对字符串字段的精确参数不生效）
 *   · 数值/枚举/布尔/日期走字段参数，键名 camelCase（后端大小写不敏感）
 *   · 映射显示字段（RoleName 等）是虚拟列，不参与查询，由 paramMap 映射到真实字段
 */
export function toSearchParams(
  fields: DataField[],
  model: Record<string, any>,
  paramMap: Record<string, string> = {},
): Record<string, any> {
  const params: Record<string, any> = {};
  for (const f of fields) {
    const prop = camel(String(f.name ?? ''));
    const value = model[prop];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) continue;

    if (paramMap[prop]) {
      params[paramMap[prop]] = Array.isArray(value) ? value.join(',') : value;
      continue;
    }
    if (isMappedField(f)) continue;
    if (isStringField(f)) {
      params.Q = String(value).trim();
      continue;
    }
    params[prop] = Array.isArray(value) ? value.join(',') : value;
  }
  return params;
}

/**
 * 需要单独拉 id→name 字典的外键基名。
 * 已有 map/dataSource 的枚举不在此列；Parent 走树形自查找。
 */
export function foreignLookupBases(fields: DataField[]): string[] {
  const bases = new Set<string>();
  for (const f of fields) {
    const name = camel(String(f.name ?? ''));
    if (!name || AUDIT_FIELDS.has(name)) continue;
    if (!isMappedField(f) && !isIdField(f) && !isIdsField(f)) continue;
    if (refersToParent(f)) continue;
    if (toOptions(f).length) continue;
    const base = lookupBaseName(f);
    if (!base || base.toLowerCase() === 'parent') continue;
    bases.add(base);
  }
  return [...bases];
}

/** 只保留元数据里出现过的字段，避免把 UI 辅助字段提交给后端 */
export function pickPayload(fields: DataField[], model: Record<string, any>): Record<string, any> {
  const allowed = new Set<string>();
  for (const f of fields) {
    const name = camel(String(f.name ?? ''));
    if (name) allowed.add(name);
    if (isMappedField(f)) {
      const storage = mappedFieldName(f);
      if (storage) allowed.add(storage);
    }
  }
  const payload: Record<string, any> = {};
  for (const [key, value] of Object.entries(model)) {
    if (allowed.has(key)) payload[key] = value;
  }
  return payload;
}

/** 组件类型（供 FieldControl 动态渲染时做类型标注） */
export type AnyComponent = Component | string;
