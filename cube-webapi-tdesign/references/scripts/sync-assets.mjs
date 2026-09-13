#!/usr/bin/env node
/**
 * sync-assets.mjs — 把「两镜像」的同步从**手工双写**降级为**单向派生**。
 *
 * 背景（D-17 的结构性成因）：
 *   技能资产是「两镜像 + 一独立层」：
 *     · references/scaffold/src/  ← 真相源（55 件，完整可运行 CLI 产物）
 *     · assets/core/              ← 派生镜像（31 件，是 scaffold/src 的严格子集，供 `cp -r` 用）
 *     · references/demo/src/      ← **独立层**（lite 血统第二基线，**不是**同步目标）
 *   以往靠「改一个文件就两处手工各改一遍」，两次踩坑（D-15/D-17：漏改 scaffold 副本，
 *   生成出来的工程编译即报 `Cannot find name 'route'`）。
 *   本脚本把这一步变成一条命令，方向固定 **scaffold/src → assets/core**。
 *
 * 用法：
 *   node references/scripts/sync-assets.mjs            # 写入模式：把 scaffold 的对应文件覆盖到 assets
 *   node references/scripts/sync-assets.mjs --check    # 只报告不写入；有差异则 exit=1（可进 CI/聚合器）
 *   node references/scripts/sync-assets.mjs --verbose  # 逐件打印
 *
 * 判据与 `scan-assets-refs.mjs` 的关系（两者互补，不是替代）：
 *   · 本脚本 = 「怎么修」（单向 copy，幂等）
 *   · scan-assets-refs.mjs = 「查出来」（判 ② ⊆ ① 且逐件同 md5，含悬空引用）
 *   改完资产后建议：sync-assets.mjs → scan-assets-refs.mjs → check-all.mjs
 *
 * 退出码：0 = 一致（或写入成功）；1 = --check 下有差异；2 = 结构异常（路径读不到）
 * 零依赖（Node ≥ 18）。
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKILL_DIR = process.env.SKILL_DIR ? path.resolve(process.env.SKILL_DIR) : path.resolve(HERE, '..', '..')

const SRC_ROOT = path.join(SKILL_DIR, 'references', 'scaffold', 'src') // 真相源
const DST_ROOT = path.join(SKILL_DIR, 'assets', 'core') // 派生镜像

const argv = process.argv.slice(2)
const CHECK = argv.includes('--check')
const VERBOSE = argv.includes('--verbose')

/** 统一换行后取 md5（技能仓库 core.autocrlf=true，纯换行差异不算漂移） */
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
const hashOf = (p) => crypto.createHash('md5').update(norm(fs.readFileSync(p, 'utf8')), 'utf8').digest('hex')

function walk(dir) {
  const out = []
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const p = path.join(cur, e.name)
      if (e.isDirectory()) stack.push(p)
      else out.push(p)
    }
  }
  return out
}

if (!fs.existsSync(SRC_ROOT) || !fs.existsSync(DST_ROOT)) {
  console.error(`[sync-assets] 路径不存在：\n  真相源 ${SRC_ROOT}\n  镜像   ${DST_ROOT}\n（可用 SKILL_DIR 指定技能目录）`)
  process.exit(2)
}

// ★ 清单来源 = assets/core 自身的文件树。理由：assets 就是「拷进工程的白名单」，
//   目录结构即清单、对读者最直观；scaffold 里那 24 件骨架/上游件**故意不进 assets**，
//   所以不能用目录级通配去猜（同目录下业务件与骨架件是混排的，如 pages/）。
const manifest = walk(DST_ROOT).map((p) => path.relative(DST_ROOT, p).split(path.sep).join('/'))

const changed = []
const same = []
const missingInSrc = []

for (const rel of manifest) {
  const s = path.join(SRC_ROOT, rel)
  const d = path.join(DST_ROOT, rel)
  if (!fs.existsSync(s)) {
    missingInSrc.push(rel)
    continue
  }
  if (hashOf(s) === hashOf(d)) {
    same.push(rel)
    continue
  }
  changed.push(rel)
  if (!CHECK) {
    fs.mkdirSync(path.dirname(d), { recursive: true })
    fs.copyFileSync(s, d)
  }
}

if (VERBOSE) {
  console.log('--- 逐件 ---')
  for (const f of same) console.log(`  = ${f}`)
  for (const f of changed) console.log(`  ${CHECK ? '≠' : '→'} ${f}`)
}

console.log('')
console.log(`[sync-assets] 方向：references/scaffold/src → assets/core`)
console.log(`  一致    ${same.length} 件`)
console.log(`  需同步  ${changed.length} 件${changed.length ? (CHECK ? '（--check，未写入）' : '（已写入）') : ''}`)
if (changed.length) changed.slice(0, 12).forEach((f) => console.log(`            · ${f}`))
if (changed.length > 12) console.log(`            · ...另有 ${changed.length - 12} 件`)

// 反向提醒：assets 里出现、但 scaffold 里没有 → 说明白名单有孤儿件（真相源已被删/改名）
if (missingInSrc.length) {
  console.log(`\n  ⚠️ 孤儿件 ${missingInSrc.length} 件（assets 有、scaffold 无 → 真相源可能已删或改名，需人工裁决）：`)
  missingInSrc.forEach((f) => console.log(`            · ${f}`))
}

// 结构性提示：scaffold 里存在、但不属白名单的文件（新增业务资产时需人工决定是否纳入 assets）
const srcFiles = new Set(walk(SRC_ROOT).map((p) => path.relative(SRC_ROOT, p).split(path.sep).join('/')))
const notInManifest = [...srcFiles].filter((f) => !manifest.includes(f))
console.log(`\n  （信息）scaffold/src 共 ${srcFiles.size} 件 = 白名单 ${manifest.length} 件 + 骨架/上游 ${notInManifest.length} 件`)

const bad = changed.length > 0 || missingInSrc.length > 0
if (CHECK && bad) {
  console.log(`\n[sync-assets] --check：检测到 ${changed.length} 件漂移${missingInSrc.length ? ` + ${missingInSrc.length} 件孤儿` : ''} → exit=1`)
  process.exit(1)
}
console.log(`\n[sync-assets] ${CHECK ? '两镜像一致 ✅' : '同步完成 ✅'}${missingInSrc.length ? '（仍有孤儿件待人工裁决）' : ''}`)
process.exit(missingInSrc.length ? 1 : 0)
