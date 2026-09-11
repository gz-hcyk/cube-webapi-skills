// ① 检查文档里提到的资产文件是否真实存在（悬空引用）
// ② 检查 assets 与 scaffold 副本是否内容一致（副本漂移）
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = process.env.SKILL_DIR || 'C:/Users/admin/.workbuddy/skills/cube-webapi-tdesign'
const SKIP = new Set(['node_modules', 'dist', '.git'])
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
const files = walk(ROOT)
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/')

console.log('=== ① 文档引用的资产文件是否存在 ===')
// 结论记录类文件会刻意引用“已修复/已删除”的历史路径，跳过以免误报
const EXCLUDE_MD = /references[\\/]scripts[\\/]README\.md$/
const mds = files.filter((f) => /\.md$/i.test(f) && !EXCLUDE_MD.test(f))
const missing = new Map()
for (const m of mds) {
  const t = readFileSync(m, 'utf8')
  // 形如 assets/xxx/yyy.vue 、 references/.../yyy.ts 的相对资产路径
  for (const mt of t.matchAll(/(assets|references)\/[A-Za-z0-9_\-./]*?\.(vue|ts|mjs|md|png|css|json)\b/g)) {
    const p = mt[0]
    if (!existsSync(join(ROOT, p))) {
      if (!missing.has(p)) missing.set(p, new Set())
      missing.get(p).add(rel(m))
    }
  }
}
if (!missing.size) console.log('  无悬空引用')
for (const [p, from] of missing) console.log(`  ✗ ${p}   ← 被提及于: ${[...from].join(', ')}`)

console.log('\n=== ② assets ↔ scaffold 副本一致性 ===')
const hash = (f) => createHash('md5').update(readFileSync(f)).digest('hex').slice(0, 8)
const pairs = [
  ['assets/core', 'references/scaffold/src'],
]
// core 全量比对
let diffCnt = 0
for (const f of files) {
  const r = rel(f)
  const m = r.match(/^assets\/core\/(.+)$/)
  if (!m) continue
  const twin = join(ROOT, 'references/scaffold/src', m[1])
  if (!existsSync(twin)) { console.log(`  ! core 有、scaffold 无: ${r}`); diffCnt++; continue }
  if (hash(f) !== hash(twin)) { console.log(`  ✗ 内容漂移: ${r}  <->  references/scaffold/src/${m[1]}`); diffCnt++ }
}
// optional 与 scaffold 同名比对
for (const f of files) {
  const r = rel(f)
  const m = r.match(/^assets\/optional\/(.+)$/)
  if (!m) continue
  const twin = join(ROOT, 'references/scaffold/src', m[1])
  if (!existsSync(twin)) { console.log(`  - optional 有、scaffold 无（未在验证工程内编译）: ${r}`); continue }
  console.log(`  ${hash(f) === hash(twin) ? '✓' : '✗ 漂移'} optional ↔ scaffold: ${m[1]}`)
  if (hash(f) !== hash(twin)) diffCnt++
}
console.log(`  core/scaffold 差异数: ${diffCnt}`)
