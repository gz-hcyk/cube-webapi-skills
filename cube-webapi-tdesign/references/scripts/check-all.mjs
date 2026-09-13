#!/usr/bin/env node
/**
 * check-all.mjs —— **技能自检的单一入口**（把所有闸门串成一条命令）
 *
 * 存在理由（踩过的坑，见 troubleshooting.md G15）：
 *   技能有多个判据**正交**的闸门，但一直没有聚合入口，于是「只跑了一个闸门就宣布全绿」
 *   真实发生过 —— D-17：改技能资产后只跑 `check-assets-copied.mjs`（工程↔assets，绿），
 *   漏跑 `scan-assets-refs.mjs`（assets↔scaffold，红，报 core/scaffold 差异 1），
 *   结果技能主真相源里的 `MenuSidebar.vue` 缺 `const route = useRoute()`，
 *   脚手架生成的新工程**编译即失败**。
 *
 *   → 结论：判据正交的闸门**不能选着跑**。本脚本让你「跑全部」这件事变成一条命令。
 *
 * 用法：
 *   node check-all.mjs                       # 只跑技能自身维护类闸门（无需工程）
 *   node check-all.mjs <工程目录>             # 追加工程侧闸门（推荐，收尾自检用这个）
 *   node check-all.mjs <工程目录> --json      # 机器可读汇总
 *   node check-all.mjs <工程目录> --no-tridiff  # 跳过耗时的四方对照
 *
 * ★ 红了怎么办（唯一有「一条命令修好」的闸门）：
 *   `sync-assets` 红 → `node sync-assets.mjs`（把真相源 scaffold/src 单向派生到镜像 assets/core）。
 *   其余闸门只报告、不自动修，需人工裁决。
 *
 * ★ 路径口径：`<工程目录>` 用 **Windows 风格**且传**含 `src/` 的 frontend 那一层**
 *   （正确 `C:/proj/frontend`；错误 `/c/proj/frontend` 会被 Git-Bash 拼成 `C:\c\proj\frontend`）。
 *
 * 退出码：0 = 全部闸门 PASS；1 = 有任一 FAIL；2 = 用法错误。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const asJson = args.includes('--json')
const noTri = args.includes('--no-tridiff')
const proj = args.find((a) => !a.startsWith('--')) || null

if (args.includes('-h') || args.includes('--help')) {
  console.log('用法: node check-all.mjs [<工程目录，含 src/ 的 frontend 层>] [--json] [--no-tridiff]')
  process.exit(0)
}

/** 闸门定义：run 为 true 表示本次会执行（缺工程时跳过工程侧闸门） */
const GATES = [
  {
    // ★ 放在第一位：这是「两镜像是否一致」的**可修复判据**（其余闸门只报告、不修）。
    //   D-17 那类「改一处漏一处」现在有了一条命令的出口：
    //   红 → 跑 `node sync-assets.mjs`（scaffold → assets 单向派生）→ 再跑本聚合器。
    id: 'sync-assets',
    title: '技能内部：两镜像一致性（scaffold/src → assets/core，方向固定）',
    run: true,
    cmd: ['sync-assets.mjs', '--check'],
    expect: /需同步\s*0\s*件/,
    expectsProj: false,
  },
  {
    id: 'scan-assets-refs',
    title: '技能内部：文档悬空引用 + assets↔scaffold 副本一致性',
    run: true,
    cmd: ['scan-assets-refs.mjs'],
    // 判据：core/scaffold 差异数必须为 0
    // ★ 分隔符要写 `[=:：]`——各脚本风格不统一（实测 tri-diff 打 `ENG-DRIFT=0`、
    //   scan-assets-refs 打 `差异数:`），只认冒号会把绿灯判成红灯。
    expect: /差异(数)?\s*[=:：]\s*0|无漂移|0\s*处/,
    expectsProj: false,
  },
  {
    id: 'scan-assets-dead',
    title: '技能内部：死文件（零引用）扫描',
    run: true,
    cmd: ['scan-assets-dead.mjs'],
    expect: null,
    expectsProj: false,
  },
  {
    id: 'check-starter-align',
    title: '工程侧：是否仍是 tdesign-starter CLI 产物形态（lite/all 双基线）',
    run: true, // 无工程时脚本自身默认检查 references/scaffold
    cmd: proj ? ['check-starter-align.mjs', proj] : ['check-starter-align.mjs'],
    expect: /0 FAIL|无 FAIL/,
    expectsProj: true,
  },
  {
    id: 'check-assets-copied',
    title: '工程侧：技能 assets/ 是否已完整并入工程 src/',
    run: !!proj,
    cmd: proj ? ['check-assets-copied.mjs', proj] : [],
    expect: /漂移\/残留\s*0/,
    expectsProj: true,
  },
  {
    id: 'tri-diff',
    title: '多根对照：scaffold/src vs assets/core vs 工程 src（demo 已归档，默认不参与）',
    run: !!proj && !noTri,
    cmd: proj ? ['tri-diff.mjs', proj] : [],
    // 判据：ENG-DRIFT 与 CORE-DRIFT 必须**同时**为 0
    //   （SCAFFOLD-DRIFT 是骨架件属预期；demo 已归档移出技能，默认不再产出 DEMO-* 行）
    expect: /ENG-DRIFT\s*[=:：]\s*0[\s\S]*CORE-DRIFT\s*[=:：]\s*0|健康态[：:]?\s*ENG-DRIFT\s*[=:：]\s*0/,
    expectsProj: true,
  },
]

/** 没传工程时给出显式提醒，避免「以为跑了全部、其实只跑了一半」 */
if (!proj && !asJson) {
  console.log('提示：未传工程目录 → 只跑技能自身维护类闸门。')
  console.log('      收尾自检请传工程目录： node check-all.mjs C:/path/to/proj/frontend')
  console.log('')
}

if (proj && !existsSync(join(proj, 'src'))) {
  console.error(`FAIL  工程目录无效：${proj}`)
  console.error('      应传**含 src/ 的那一层**（通常是 <工程>/frontend），且用 Windows 风格路径。')
  process.exit(1)
}

const results = []

for (const g of GATES) {
  if (!g.run) {
    results.push({ id: g.id, skipped: true, code: null, note: g.expectsProj ? '需要工程目录' : '' })
    continue
  }
  // ★ 只把 HERE 拼到**脚本名**上，其余参数原样透传。
  //   踩过的坑：写成 `join(HERE, ...g.cmd)` 会把工程路径也拼进去 →
  //   `.../check-assets-copied.mjs/C:/proj/frontend` → `Cannot find module`（exit=1），
  //   表现为「聚合器把 3 个本来全绿的闸门报成 FAIL」。
  const argv = [join(HERE, g.cmd[0]), ...g.cmd.slice(1)]
  const r = spawnSync(process.execPath, argv, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const out = (r.stdout || '') + (r.stderr || '')
  const code = r.status === null ? 1 : r.status
  results.push({
    id: g.id,
    title: g.title,
    skipped: false,
    code,
    out,
    judged: g.expect ? g.expect.test(out) : code === 0,
  })
}

const failed = results.filter((r) => !r.skipped && (r.code !== 0 || !r.judged))

if (asJson) {
  console.log(
    JSON.stringify(
      {
        project: proj,
        gates: results.map((r) => ({
          id: r.id,
          skipped: !!r.skipped,
          exitCode: r.code,
          judged: r.judged ?? null,
          note: r.note ?? null,
        })),
        failed: failed.map((r) => r.id),
        pass: failed.length === 0,
      },
      null,
      2,
    ),
  )
} else {
  console.log('══════ 技能自检总览（全部闸门） ══════')
  console.log(`工程：${proj || '(未传，仅技能自身维护类闸门)'}`)
  console.log('')
  for (const r of results) {
    if (r.skipped) {
      console.log(`  SKIP  ${r.id.padEnd(22)} ${r.note || ''}`)
      continue
    }
    const ok = r.code === 0 && r.judged
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(22)} exit=${r.code} 判据${r.judged ? '命中' : '**未命中**'}`)
    // FAIL 时把关键行摘出来，省得再跑一遍。
    // ★ 关键行一条都没匹配上时，**必须原样回吐前若干行**——否则聚合器会变成「静默红灯」，
    //   比不跑还糟（看不到原因，只能再手动跑一遍）。
    if (!ok) {
      const all = (r.out || '').split(/\r?\n/)
      const key = all.filter((l) => /FAIL|漂移|差异|DRIFT|不一致/.test(l))
      const show = key.length ? key : all.filter((l) => l.trim()).slice(0, 12)
      if (!show.length) console.log('        │ (子脚本无任何输出 —— 退出码非 0 但未打印原因)')
      show.slice(0, 12).forEach((l) => console.log(`        │ ${l.trim()}`))
      if (show.length > 12) console.log(`        │ ...另有 ${show.length - 12} 行`)
    }
  }
  console.log('')
  if (failed.length === 0) {
    const ran = results.filter((r) => !r.skipped).length
    console.log(`结论：${ran} 个闸门全部 PASS。`)
  } else {
    console.log(`结论：${failed.length} 个闸门 FAIL → ${failed.map((r) => r.id).join(', ')}`)
    console.log('★ 判据正交：任一闸门红，都不允许宣布「技能资产正确」。')
  }
}

process.exit(failed.length === 0 ? 0 : 1)
