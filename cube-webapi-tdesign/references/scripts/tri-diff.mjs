#!/usr/bin/env node
/**
 * tri-diff.mjs —— 三根对照：references/scaffold/src  vs  assets/core  vs  <工程>/src
 *
 * 与同目录脚本的分工：
 *   check-assets-copied.mjs  → 「工程是否与 assets/core 一致」（**判有无漂移，不判方向**）
 *   tri-diff.mjs             → 「三根谁是谁的超集」（**判方向：该以谁覆盖谁**）   ← 本文件
 *
 * 背景：技能有两根「技能侧」与一根「工程侧」，构成三根——
 *   ① `references/scaffold/src/`  = **唯一真相源**（SKILL.md §11.1）
 *   ② `assets/core/`              = ① 的**镜像拷贝源**（供 `cp -r` 并入业务工程）
 *   ③ `<工程>/src/`               = 下游产物（并入后的业务工程）
 *
 * 用法：
 *   node tri-diff.mjs <工程目录>
 *   node tri-diff.mjs <工程目录> --json          # CI 用
 *   node tri-diff.mjs <工程目录> --out r.txt     # 报告落盘（Windows 终端吞 stdout 时用）
 *   node tri-diff.mjs <工程目录> --core <dir> --scaffold <dir>   # 覆盖默认对照根
 *   SKILL_DIR=/path/to/skill node tri-diff.mjs <工程目录>        # 换技能目录
 *
 * 退出码：0 = 无 ENG-DRIFT / CORE-DRIFT（无需修的真实分叉）；
 *        1 = 存在 ENG-DRIFT 或 CORE-DRIFT（须按方向修复）；
 *        2 = 用法错误。
 *
 * ★ 判据是**文本等价**，不是字节相等：md5 前统一 CRLF/CR → LF。
 *   原因：技能仓库 `core.autocrlf=true`（工作区 CRLF），而业务工程多由
 *   `tdesign-starter-cli`（LF）产出——纯换行符差异不是漂移。
 *
 * ── flag 语义（ENG-DRIFT 与 CORE-DRIFT 的修复方向**相反**，勿一律 `cp`）──
 *   ALL-SAME        三根 md5 全同                          → 无需动作
 *   ENG-ONLY        技能两侧都没有，仅工程有               → **工程独有**（业务新增页 / 本地专有适配），无需动作
 *   ENG-DRIFT       scaffold == core，工程不同或缺件       → **以技能版覆盖工程**（§11.1）
 *   CORE-DRIFT      scaffold == 工程，core 是异类          → **以 scaffold/工程覆盖 core**
 *   SCAFFOLD-DRIFT  scaffold 独有（core/工程均缺）         → 属预期：DEV 验证页 pages/LovDemoView.vue
 *   ALL-DIFF        三者互不相同                            → 属预期：工程外壳 4 件，不归本脚本判
 *
 * ★ 存在性优先于 md5：缺失文件的 md5 是占位串 `----------`；若不先看存在性，
 *   会把「技能两侧都缺、仅工程有」的业务页（`pages/admin/*Page.vue` 等）误报成 ENG-DRIFT，
 *   照提示「以技能版覆盖工程」就会删掉业务页。
 *
 * ★ 期望的「健康态」= ENG-DRIFT=0 · CORE-DRIFT=0，只剩 1 条 SCAFFOLD-DRIFT + 4 条 ALL-DIFF。
 *   若出现其他条数，说明三根真的分叉了。
 *
 * ── 三根构成（2026-09-13 定稿；勿把「预期」读成「漂移」）──
 *   references/scaffold/src/（36 件）= assets/core/（31 件，必拷，镜像源）
 *                                    + 工程外壳 4 件（App.vue / main.ts / router/index.ts / vite-env.d.ts，
 *                                      由 td-starter 生成，**恒不在 core 内**）
 *                                    + DEV 演示页 1 件（pages/LovDemoView.vue，`/lov-demo` 路由用，生产不注册）
 *   ⇒ 后 5 件必然落进 SCAFFOLD-DRIFT（demo 页）或 ALL-DIFF（外壳 4 件），**不是缺陷**。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = process.env.SKILL_DIR || path.resolve(HERE, '..', '..');

/* ── 参数解析 ───────────────────────────────────────────── */
const argv = process.argv.slice(2);
const opt = { eng: null, core: null, scaffold: null, out: null, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') opt.json = true;
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--core') opt.core = argv[++i];
  else if (a === '--scaffold') opt.scaffold = argv[++i];
  else if (a === '-h' || a === '--help') opt.help = true;
  else if (!a.startsWith('--')) opt.eng = a;
  else { console.error(`未知参数：${a}`); process.exit(2); }
}

if (opt.help || !opt.eng) {
  console.error(
    '用法：node tri-diff.mjs <工程目录> [--core <dir>] [--scaffold <dir>] [--json] [--out <file>]\n' +
    '  默认 <core>     = <skill>/assets/core\n' +
    '  默认 <scaffold> = <skill>/references/scaffold/src\n' +
    '  <工程目录> 可为工程根（自动取 /src）或直接给 src 目录'
  );
  process.exit(2);
}

const SCAFFOLD_SRC = opt.scaffold || path.join(SKILL_ROOT, 'references/scaffold/src');
const CORE_DIR = opt.core || path.join(SKILL_ROOT, 'assets/core');
// 工程目录可直接给 `src/`，也可给工程根（自动补 `src`）
const ENG_SRC = path.basename(opt.eng) === 'src' ? opt.eng : path.join(opt.eng, 'src');

for (const [label, dir] of [['scaffold/src', SCAFFOLD_SRC], ['assets/core', CORE_DIR], ['工程 src', ENG_SRC]]) {
  if (!fs.existsSync(dir)) { console.error(`目录不存在（${label}）：${dir}`); process.exit(2); }
}

/* ── 工具 ───────────────────────────────────────────────── */
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const md5 = (p) => crypto.createHash('md5').update(norm(fs.readFileSync(p, 'utf8')), 'utf8').digest('hex').slice(0, 10).toUpperCase();
const size = (p, e) => (e ? fs.statSync(p).size : 0);
function walk(root, rel = '', out = []) {
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(root, r, out);
    else out.push(r);
  }
  return out;
}
const readSafe = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

/* ── 对照 ───────────────────────────────────────────────── */
const files = [...new Set([...walk(SCAFFOLD_SRC), ...walk(CORE_DIR), ...walk(ENG_SRC)])].sort();

const GROUPS = { 'ALL-SAME': [], 'ENG-ONLY': [], 'ENG-DRIFT': [], 'CORE-DRIFT': [], 'SCAFFOLD-DRIFT': [], 'ALL-DIFF': [] };
const detail = [];

for (const f of files) {
  const pa = path.join(SCAFFOLD_SRC, f), pb = path.join(CORE_DIR, f), pc = path.join(ENG_SRC, f);
  const ea = fs.existsSync(pa), eb = fs.existsSync(pb), ec = fs.existsSync(pc);
  const ha = ea ? md5(pa) : '----------';
  const hb = eb ? md5(pb) : '----------';
  const hc = ec ? md5(pc) : '----------';

  let flag;
  // ★ 存在性必须先于 md5 参与判定：缺失文件的 md5 是占位串 `----------`，
  //   若直接比串，会把「技能两侧都没有、仅工程有」的业务页误判成 ENG-DRIFT
  //   （那样按提示「以技能版覆盖工程」就会去删掉业务页）。
  const eq = (x, y) => x !== null && y !== null && x === y;
  const ka = ea ? ha : null, kb = eb ? hb : null, kc = ec ? hc : null;
  if (ka && kb && kc && ha === hb && hb === hc) flag = 'ALL-SAME';
  else if (!ea && !eb && ec) flag = 'ENG-ONLY';       // 工程独有（业务新增页），技能侧本就不提供
  else if (eq(ka, kb)) flag = 'ENG-DRIFT';           // 技能侧一致，工程分叉或缺件
  else if (eq(ka, kc)) flag = 'CORE-DRIFT';          // scaffold==工程，core 是异类
  else if (eq(kb, kc)) flag = 'SCAFFOLD-DRIFT';      // core==工程，scaffold 独有
  else if (ea && !eb && !ec) flag = 'SCAFFOLD-DRIFT'; // scaffold 独有（core/工程均缺）
  else flag = 'ALL-DIFF';

  GROUPS[flag].push(f);
  if (flag !== 'ALL-SAME') {
    detail.push({
      file: f, flag,
      scaffold: { md5: ha, exist: ea, bytes: size(pa, ea) },
      core: { md5: hb, exist: eb, bytes: size(pb, eb) },
      eng: { md5: hc, exist: ec, bytes: size(pc, ec) },
    });
  }
}

const bad = GROUPS['ENG-DRIFT'].length + GROUPS['CORE-DRIFT'].length;
const exitCode = bad > 0 ? 1 : 0;

/* ── 输出 ───────────────────────────────────────────────── */
const FIX_HINT = {
  'ENG-ONLY': '工程独有（业务新增页 / 本地专有适配），技能侧不提供 —— 无需动作',
  'ENG-DRIFT': '以技能版（scaffold/core）覆盖工程 —— §11.1',
  'CORE-DRIFT': '以 scaffold/工程 覆盖 assets/core',
  'SCAFFOLD-DRIFT': '预期：DEV 验证页 pages/LovDemoView.vue',
  'ALL-DIFF': '预期：工程外壳 4 件，不归本脚本判',
};

let text = '';
if (opt.json) {
  text = JSON.stringify({
    counts: Object.fromEntries(Object.entries(GROUPS).map(([k, v]) => [k, v.length])),
    exitCode, files: detail,
  }, null, 2) + '\n';
} else {
  const L = [];
  L.push(`三根对照：scaffold/src  vs  assets/core  vs  工程 src`);
  L.push(`  scaffold = ${SCAFFOLD_SRC}`);
  L.push(`  core     = ${CORE_DIR}`);
  L.push(`  eng      = ${ENG_SRC}`);
  L.push('');
  L.push(`共 ${files.length} 文件（三根并集）`);
  L.push(`分类计数: ALL-SAME=${GROUPS['ALL-SAME'].length}  ENG-ONLY=${GROUPS['ENG-ONLY'].length}  ` +
         `ENG-DRIFT=${GROUPS['ENG-DRIFT'].length}  CORE-DRIFT=${GROUPS['CORE-DRIFT'].length}  ` +
         `SCAFFOLD-DRIFT=${GROUPS['SCAFFOLD-DRIFT'].length}  ALL-DIFF=${GROUPS['ALL-DIFF'].length}`);
  L.push('');
  for (const flag of ['ENG-DRIFT', 'CORE-DRIFT', 'ENG-ONLY', 'SCAFFOLD-DRIFT', 'ALL-DIFF']) {
    const list = GROUPS[flag];
    if (!list.length) continue;
    L.push(`── ${flag}（${list.length}）· ${FIX_HINT[flag]} ──`);
    for (const d of detail.filter((x) => x.flag === flag)) {
      L.push(`  ${d.file}`);
      L.push(`      scaffold=${d.scaffold.md5}(${d.scaffold.bytes}B)  core=${d.core.md5}(${d.core.bytes}B)  eng=${d.eng.md5}(${d.eng.bytes}B)`);
    }
    L.push('');
  }
  L.push(bad === 0
    ? `✓ 健康态：ENG-DRIFT=0  CORE-DRIFT=0（剩余 SCAFFOLD-DRIFT / ALL-DIFF 属预期，不是漂移）`
    : `✗ 存在 ${bad} 条真实分叉（ENG-DRIFT=${GROUPS['ENG-DRIFT'].length}，CORE-DRIFT=${GROUPS['CORE-DRIFT'].length}）——按上表方向修复，注意两者方向相反`);
  text = L.join('\n') + '\n';
}

if (opt.out) fs.writeFileSync(opt.out, text, 'utf8');
process.stdout.write(text);
process.exit(exitCode);
