// 扫描技能内源码文件的引用关系，找出零引用（死）文件
//
// ⚠️ 白名单（降噪）：入口/外壳/可选类文件**结构上就不会被 import**，
//    零引用是正常状态，不应计入「死文件」。命中白名单的条目以 WHITELIST 单列，
//    不计入 dead 总结。判定规则见 isWhitelisted()。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const ROOT = process.env.SKILL_DIR || 'C:/Users/admin/.workbuddy/skills/cube-webapi-tdesign'
const SKIP = new Set(['node_modules', 'dist', '.git', 'public'])

/** 白名单：basename → 原因（入口/外壳/可选组件/权限模块，结构上天然零 import 引用） */
const WL_BASENAME = new Map([
  ['main.ts', '应用入口，被 index.html 挂载，无人 import'],
  ['App.vue', '根组件，被 main.ts 挂载'],
  ['vite.config.ts', '构建配置，由 vite CLI 读取'],
  ['vite-env.d.ts', '全局类型声明，靠 tsconfig include 生效'],
  ['shims-vue.d.ts', '全局类型声明'],
  ['env.d.ts', '全局类型声明'],
  ['permissions.ts', '权限模块（references/demo 内的源码级实现），可零静态引用'],
  ['IconPicker.vue', '可选组件（assets/optional，按需人工拷贝）'],
  ['PriceYuanInput.vue', '可选组件（assets/optional，按需人工拷贝）'],
  ['RoleMenuEditor.vue', '可选组件（assets/optional，按需人工拷贝）'],
])

/** 白名单：相对路径前缀（可选资产 / 独立可执行入口） */
const WL_PATH_PREFIX = [
  'assets/optional/',    // 可选资产：按需人工拷贝，core 不静态引用（结构上零引用）
  'references/scripts/',  // 独立 CLI 脚本，由 `node xxx.mjs` 直跑
  'references/scaffold/backend/', // Mock 后端入口，`node server.mjs` 直跑
  'references/demo/backend/',     // Mock 后端入口（demo 工程），同上
]

/** 白名单：路径片段（任意层级的 router 入口等） */
const WL_PATH_SEGMENT = [
  '/router/',            // 路由入口模块，由 createRouter 消费
]

/** 返回白名单原因；不在白名单则返回 null */
function isWhitelisted(rel) {
  const base = basename(rel)
  if (WL_BASENAME.has(base)) return WL_BASENAME.get(base)
  for (const p of WL_PATH_PREFIX) if (rel.startsWith(p)) return '可选/独立入口'
  for (const s of WL_PATH_SEGMENT) if (rel.includes(s)) return '路由入口'
  return null
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
const code = files.filter((f) => /\.(vue|ts|mjs)$/.test(f) && !f.includes('node_modules'))
const md = files.filter((f) => /\.md$/i.test(f))

// 收集所有文档正文（用于判定“是否被文档提及”）
const mdText = md.map((f) => readFileSync(f, 'utf8')).join('\n')

console.log('=== 源码文件引用扫描 ===\n')
const dead = []
const whitelisted = []
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

  const wl = isWhitelisted(rel)
  if (refCount === 0 && wl) {
    whitelisted.push({ rel, stem, mdHits, reason: wl })
    if (process.env.ALL) console.log(`WHITELIST ${rel}  (${wl}) mdHits=${mdHits}`)
    continue
  }
  if (refCount === 0) dead.push({ rel, stem, refCount, mdHits })
  if (refCount === 0 || process.env.ALL) {
    console.log(`${refCount === 0 ? 'DEAD' : ' ok '} ${rel}  refs=${refCount} mdHits=${mdHits}`)
  }
}

console.log(`\n=== 白名单豁免（结构上零引用，非死文件）${whitelisted.length} 个 ===`)
for (const d of whitelisted) console.log(`  ${d.rel}   (${d.reason}，文档提及 ${d.mdHits} 次)`)

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
