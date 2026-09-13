#!/usr/bin/env node
// scan-assets-refs.mjs —— 技能自身维护：① 文档悬空引用 ② assets ↔ scaffold 副本一致性
//
// 用法：
//   node scan-assets-refs.mjs [--json] [--out <file>]
//   SKILL_DIR=/path/to/skill node scan-assets-refs.mjs      # 换技能目录
//
// 退出码：0 = 无悬空引用且无副本漂移；1 = 存在任一问题；2 = 用法错误。
//
// ★ 判据是**文本等价**，不是字节相等：md5 前统一 CRLF/CR → LF。
//   原因：技能仓库 `core.autocrlf=true`，工作区文本资产多为 CRLF，而个别文件由脚本以 LF 写入
//   ——纯换行符差异不是漂移。实测 `assets/core/api/useEntityResource.ts`（LF）vs
//   `references/scaffold/src/api/useEntityResource.ts`（CRLF）：455 行逐行全等，仅行尾不同，
//   早期按字节比对必然误报。二进制扩展名（png/jpg/ico/woff 等）仍按字节比对。
//   （同坑此前已在 `check-assets-copied.mjs` 修过一次——两脚本判据必须一致。）
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, relative, dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.SKILL_DIR || resolve(HERE, '..', '..')
const SKIP = new Set(['node_modules', 'dist', '.git'])

const argv = process.argv.slice(2)
const opt = { json: false, out: null }
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--json') opt.json = true
  else if (argv[i] === '--out') opt.out = argv[++i]
  else { console.error(`未知参数：${argv[i]}`); process.exit(2) }
}

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

const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.pdf'])
const normText = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
/** 文本文件按 CRLF 归一后的 md5 比对；二进制按字节比对。 */
const hash = (f) => {
  const buf = readFileSync(f)
  const payload = BINARY_EXT.has(extname(f).toLowerCase()) ? buf : Buffer.from(normText(buf), 'utf8')
  return createHash('md5').update(payload).digest('hex').slice(0, 8)
}

const lines = []
const report = { dangling: [], drift: [], coreOnly: [], counts: {} }

/* ── ① 文档引用的资产文件是否存在 ───────────────────────── */
lines.push('=== ① 文档引用的资产文件是否存在 ===')
// 结论记录类文件会刻意引用「已修复/已删除」的历史路径，跳过以免误报
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
if (!missing.size) lines.push('  无悬空引用')
for (const [p, from] of missing) {
  lines.push(`  ✗ ${p}   ← 被提及于: ${[...from].join(', ')}`)
  report.dangling.push({ path: p, from: [...from] })
}

/* ── ② assets/core ↔ references/scaffold/src 副本一致性 ─── */
lines.push('')
lines.push('=== ② assets ↔ scaffold 副本一致性 ===')
lines.push('  判据：文本等价（CRLF 归一后 md5），非字节相等')
let diffCnt = 0
for (const f of files) {
  const r = rel(f)
  const m = r.match(/^assets\/core\/(.+)$/)
  if (!m) continue
  const twin = join(ROOT, 'references/scaffold/src', m[1])
  if (!existsSync(twin)) {
    lines.push(`  ! core 有、scaffold 无: ${r}`)
    report.coreOnly.push(r)
    diffCnt++
    continue
  }
  if (hash(f) !== hash(twin)) {
    lines.push(`  ✗ 内容漂移: ${r}  <->  references/scaffold/src/${m[1]}`)
    report.drift.push({ core: r, scaffold: `references/scaffold/src/${m[1]}` })
    diffCnt++
  }
}
// 反向：scaffold 有、core 无 → 只提示，不判失败
// （工程外壳 4 件 + DEV 验证页 LovDemoView.vue 恒不在 core 内，属预期；详见 tri-diff.mjs 头注）
let scaffoldOnly = 0
for (const f of files) {
  const r = rel(f)
  const m = r.match(/^references\/scaffold\/src\/(.+)$/)
  if (!m) continue
  if (!existsSync(join(ROOT, 'assets/core', m[1]))) scaffoldOnly++
}
lines.push(`  core/scaffold 差异数: ${diffCnt}`)
lines.push(`  scaffold 独有（预期 5 件：工程外壳 4 + DEV 页 1）: ${scaffoldOnly}`)
if (scaffoldOnly !== 5) {
  lines.push(`  ! scaffold 独有件数非 5 —— 用 tri-diff.mjs 复查四根构成`)
}

const exitCode = missing.size || diffCnt ? 1 : 0
report.counts = { dangling: missing.size, drift: diffCnt, scaffoldOnly, exitCode }

const text = opt.json ? JSON.stringify(report, null, 2) + '\n' : lines.join('\n') + '\n'
if (opt.out) writeFileSync(opt.out, text, 'utf8')
process.stdout.write(text)
process.exit(exitCode)
