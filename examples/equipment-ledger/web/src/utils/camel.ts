/**
 * 键名归一化（camelCase）——技能 scaffold `utils/camel.ts` 契约，与项目实况对齐。
 *
 * 铁律：后端实体字段为 PascalCase 或纯大写缩写（ID / URL / IP），必须归一为小驼峰键，
 * 否则 row-key / 列回显 / 树形父子链接会全部错位。
 *
 * 本文件是「技能 scaffold 契约名」与「项目实况名」的合并超集，三者并存：
 *   camel(name)          单键归一（含「纯大写缩写整体小写」分支：ID→id / URL→url）
 *   camelFieldName(name) camel 的别名（技能契约名，勿删）
 *   camelize(value)      递归归一对象 / 数组（技能契约名，勿删）
 *
 * ⚠️ 全局 camelize 已从 http.ts 移除（对齐项目实况）：键名归一**下移到消费端**——
 *    `useEntityResource.normalizeRows` / 组件自行调用本模块，避免「信封整体 camelize
 *    把值集键 `Enum.X` 改写成 `enum.X`」这类副作用。
 */

/**
 * 单键归一：`ID→id`、`URL→url`、`IP→ip`（纯大写缩写整体小写）；
 * `SchoolID→schoolID`、`ParentID→parentID`（仅首字母小写）；`Name→name`。
 * ⚠️ 早期版本仅做「首字母小写」，会把 `ID→iD`、`URL→uRL`，与其自身注释自相矛盾；此处已修正。
 */
export function camel(name: string): string {
  if (!name) return name
  const m = name.match(/^([A-Z]+)([a-z].*)?$/)
  if (m) {
    if (!m[2]) return name.toLowerCase() // ID / URL / IP → id / url / ip
    return name.charAt(0).toLowerCase() + name.slice(1) // ParentID → parentID
  }
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/** 技能契约别名（对应 scaffold `camelFieldName`）：仅对单个字段名做归一。 */
export const camelFieldName = camel

/**
 * 递归归一化对象 / 数组的键（对应 scaffold `camelize`）。
 * 行数据已是小驼峰时幂等；`Date` 实例原样返回，避免被拆成空对象。
 */
export function camelize(value: any): any {
  if (Array.isArray(value)) return value.map(camelize)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: any = {}
    for (const k of Object.keys(value)) out[camel(k)] = camelize(value[k])
    return out
  }
  return value
}
