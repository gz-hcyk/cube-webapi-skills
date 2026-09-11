// 扫描技能内源码文件的引用关系，找出零引用（死）文件
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const ROOT = process.env.SKILL_DIR || 'C:/Users/admin/.workbuddy/skills/cube-webapi-tdesign'
const SKIP = new Set(['node_modules', 'dist', '.git', 'public'])

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
const code = files.filter((f) => /\.(vue|ts|mjs)$/.test(f) && !f.includes('node_modules'))
const md = files.filter((f) => /\.md$/i.test(f))

// 收集所有文档正文（用于判定“是否被文档提及”）
const mdText = md.map((f) => readFileSync(f, 'utf8')).join('\n')

console.log('=== 源码文件引用扫描 ===\n')
const dead = []
for (const f of code) {
  const name = basename(f)
  const stem = name.replace(/\.(vue|ts|mjs)$/, '')
  const rel = relative(ROOT, f).replace(/\\/g, '/')

  // 在其他源码里搜 import/引用
  let refCount = 0
  const refFrom = new Set()
  for (const g of code) {
    if (g === f) continue
    let t = ''
    try { t = readFileSync(g, 'utf8') } catch { continue }
    // 注意：路径可能带扩展名（'@/layouts/BasicLayout.vue'），故 stem 后允许 \.(vue|ts|mjs|js)
    const re = new RegExp(`(from\\s+['"][^'"]*${stem}(\\.(vue|ts|mjs|js))?['"]|import\\s*\\(\\s*['"][^'"]*${stem}(\\.(vue|ts|mjs|js))?['"]|<${stem}\\b|\\b${stem}\\s*\\()`, 'g')
    if (re.test(t)) { refCount++; refFrom.add(relative(ROOT, g).replace(/\\/g, '/')) }
  }
  // 文档提及次数
  const mdHits = (mdText.match(new RegExp(`\\b${stem}\\b`, 'g')) || []).length

  if (refCount === 0) dead.push({ rel, stem, refCount, mdHits })
  if (refCount === 0 || process.env.ALL) {
    console.log(`${refCount === 0 ? 'DEAD' : ' ok '} ${rel}  refs=${refCount} mdHits=${mdHits}`)
  }
}

console.log(`\n=== 零引用文件 ${dead.length} 个 ===`)
for (const d of dead) console.log(`  ${d.rel}   (文档提及 ${d.mdHits} 次)`)

// 产物文件（运行生成）
console.log('\n=== 疑似运行产物 ===')
for (const f of files) {
  if (/\.(png|log)$/i.test(f) || /_result\.json$|^\d+_result/.test(basename(f))) {
    const st = statSync(f)
    console.log(`  ${relative(ROOT, f).replace(/\\/g, '/')}  ${(st.size / 1024).toFixed(1)}KB`)
  }
}
