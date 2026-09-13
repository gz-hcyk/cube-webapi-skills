#!/usr/bin/env node
/**
 * check-assets-copied.mjs —— 「三步走」第②步（技能资产复用）的出口校验
 *
 * 与同目录脚本的分工：
 *   check-starter-align.mjs  → 第①步出口：工程是否仍是 `tdesign-starter-cli` 产物形态
 *   check-assets-copied.mjs  → 第②步出口：技能 `assets/` 是否已正确并入目标工程   ← 本文件
 *   scan-assets-*.mjs        → 技能自身维护：内部死文件 / 悬空引用 / 副本漂移
 *
 * 用法：
 *   node check-assets-copied.mjs <工程目录>
 *   node check-assets-copied.mjs <工程目录> --json       # CI 用
 *   node check-assets-copied.mjs <工程目录> --strict     # WARN 也计入失败
 *   node check-assets-copied.mjs <工程目录> --out r.txt  # 报告同时落盘（Windows 终端吞 stdout 时用）
 *   node check-assets-copied.mjs --manifest             # 打印映射规则 + 已下线黑名单
 *
 * 退出码：0 = 无 FAIL；1 = 有 FAIL（`--strict` 下存在 WARN 亦为 1）。
 *
 * 三层判据（分级才有用，不是一票否决）：
 *   FAIL —— 资产缺失：`assets/core/**` 在 `<工程>/src/**` 找不到对应文件。
 *           core 之间是**静态 import** 关系（`specialControllers.ts` → `ConfigView.vue`/`DbView.vue`、
 *           `FormDialog.vue` → `LovListField.vue`），缺一个即构建失败，故为必修。
 *   WARN —— 内容漂移：文件在同名位置存在，但内容 MD5 与技能资产不一致（版本不同步）。
 *           典型场景：工程是**前代产物**（用了本技能早期版本），或本地改过却未回灌技能。
 *           ⚠️ 判据是**文本等价**，不是字节相等：比对前会把 CRLF/CR 统一为 LF。
 *              原因：技能仓库 `core.autocrlf=true`，工作区文本资产一律 CRLF；
 *              而目标工程多由 `tdesign-starter-cli`（LF）产出。二者内容完全相同时
 *              字节数差 = 行数 - 1，早期按字节比对会把这类**纯换行符差异**误报成漂移
 *              （实测 27 件资产中 4 件为纯假阳性）。二进制扩展名仍按字节比对。
 *   WARN —— 残留已下线资产：命中 `DEPRECATED` 黑名单（早期拆分件 / 第二套 HTTP 层 /
 *           遮蔽类型的 d.ts）。命中即「拷了旧版资产」，比缺失更危险（静默错版）。
 *   INFO —— `assets/optional/**` 的按需件，只提示不判定（不拷属正常）。
 *           ⚠️ **2026-09-13 起 `assets/optional/` 已取消**（3 件可选件全部提升进 `core/`），
 *              本分级当前不会触发；保留该分支仅为兼容旧版技能目录与历史工程盘点。
 *              `assets/` 现为**单层**：`assets/core/**` = 31 件必拷。
 *
 * 适用范围（勿误读）：本脚本是**第②步的验收闸门**，判据是「与技能 `assets/` 逐文件一致」。
 * 对**非本技能流程产出**的历史工程，FAIL/WARN 表达的是「偏离我们的资产基线」这一事实，
 * 是盘点结果而非必须立即修复的缺陷——补不补取决于该工程是否要并入本技能链路。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = process.env.SKILL_DIR || path.resolve(HERE, '..', '..');
const ASSETS_DIR = path.join(SKILL_ROOT, 'assets');
const CORE_DIR = path.join(ASSETS_DIR, 'core');
const OPTIONAL_DIR = path.join(ASSETS_DIR, 'optional');

/**
 * ★ 唯一映射规则：`assets/core/<X>` → `<工程>/src/<X>`
 * `assets/` 的每个文件路径本就镜像目标工程的 `src/`，剥掉 `core/` 前缀即可整目录拷：
 *   cp -r assets/core/.  <工程>/src/
 */
const TARGET_SRC = 'src';

/**
 * 已下线 / 已删除资产黑名单。`rel` 精确匹配（相对 `<工程>/src`），`base` 文件名匹配（任意层级）。
 * 命中即 WARN —— 这些文件拷贝过去不会立刻报错，但会静默错版或编译失败。
 */
const DEPRECATED = [
  {
    base: 'ListNavbar.vue',
    why: '早期拆分件：引用已删除的 `FormItem.name`/`selectFormControl`/`LookupMap` 等导出，拷贝即编译失败；能力已并入自包含的 ListPage.vue（§4.5）',
  },
  {
    base: 'ListSearchBar.vue',
    why: '同上（能力已内联进 ListPage.vue）',
  },
  {
    base: 'ListToolbar.vue',
    why: '同上（能力已内联进 ListPage.vue）',
  },
  {
    base: 'ListFooter.vue',
    why: '同上（能力已内联进 ListPage.vue）',
  },
  {
    base: 'DetailContent.vue',
    why: '早期详情内容件（旧 fieldRender 契约）；能力已并入 DetailDrawer.vue',
  },
  {
    base: 'CodeEditor.vue',
    why: '从未接线：`fieldRender.controlOf` 不产出 `code-editor`、FormDialog 无该分支；且依赖未声明的 @codemirror/*。2026-09 已从资产中删除',
  },
  {
    base: 'tdesign-icons.d.ts',
    why: '会**遮蔽** tdesign-icons-vue-next 的真实类型声明（实测令 AddIcon 等真导出被判 TS2305），类型可达性从 2350 压到 15。2026-09-13 已删除，勿再手写白名单声明',
  },
  {
    rel: 'api/api.ts',
    why: '第二套 axios 实例（令牌键 `cube_token`，双令牌头），违反铁律 H1。任何组件误引即「请求不带令牌 → 全接口 401 → 菜单树恒空」；唯一 HTTP 层只允许 `api/http.ts`',
  },
  {
    rel: 'api/permissions.ts',
    why: '2026-09-13 已删：职责由 `MenuSidebar` 取数 + `BasicLayout.onNavigate()` 归一化 + `DashboardView` 内联权限位判定取代',
  },
  {
    rel: 'api/menuTree.ts',
    why: '2026-09-13 已删：菜单树归一化已内联进 `MenuSidebar.vue`，无独立工具模块',
  },
];

// ── 结果收集 ────────────────────────────────────────────────────────────────
const R = [];
const add = (level, id, msg) => R.push({ level, id, msg });
const fail = (id, msg) => add('FAIL', id, msg);
const warn = (id, msg) => add('WARN', id, msg);
const info = (id, msg) => add('INFO', id, msg);
const pass = (id) => add('PASS', id, '');

// ── 工具 ────────────────────────────────────────────────────────────────────
const toPosix = (p) => p.split(path.sep).join('/');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.gz', '.7z', '.pdf', '.xlsx', '.docx', '.pptx',
]);

/** 文本资产：统一换行符后取哈希 —— 消除 CRLF/LF 假阳性（技能仓库 autocrlf=true）。 */
const md5 = (p) => {
  const buf = fs.readFileSync(p);
  if (BINARY_EXT.has(path.extname(p).toLowerCase())) {
    return crypto.createHash('md5').update(buf).digest('hex');
  }
  const text = buf.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
};
const sizeOf = (p) => {
  try {
    return fs.statSync(p).size;
  } catch {
    return -1;
  }
};

// ── 主校验 ──────────────────────────────────────────────────────────────────
export function check(root) {
  R.length = 0;

  if (!fs.existsSync(ASSETS_DIR)) {
    fail('assets:exists', `技能资产目录不存在：${ASSETS_DIR}（可用 SKILL_DIR 指定技能根）`);
    return R;
  }
  if (!fs.existsSync(path.join(root, TARGET_SRC))) {
    fail('target:src', `目标工程没有 ${TARGET_SRC}/ 目录：${root}（目录给错了？）`);
    return R;
  }

  // ① 正向：core 资产逐文件映射到 <工程>/src/
  const coreFiles = walk(CORE_DIR).sort();
  for (const src of coreFiles) {
    const rel = toPosix(path.relative(CORE_DIR, src));
    const dst = path.join(root, TARGET_SRC, rel);
    if (!fs.existsSync(dst)) {
      fail(`core:${rel}`, `缺 src/${rel}（拷入：assets/core/${rel}）`);
      continue;
    }
    if (md5(src) !== md5(dst)) {
      warn(
        `core:${rel}`,
        `内容漂移：src/${rel} 与技能资产不一致（${sizeOf(dst)}B vs ${sizeOf(src)}B）—— 版本不同步，按 §11.1 回灌或以技能版为准覆盖`,
      );
      continue;
    }
    pass(`core:${rel}`);
  }

  // ② 反向：残留已下线资产
  const srcRoot = path.join(root, TARGET_SRC);
  for (const f of walk(srcRoot)) {
    const rel = toPosix(path.relative(srcRoot, f));
    const base = path.basename(f);
    const hit = DEPRECATED.find((d) => (d.rel && d.rel === rel) || (d.base && d.base === base));
    if (hit) warn(`legacy:${rel}`, `残留已下线资产 src/${rel} —— ${hit.why}`);
  }

  // ③ optional 按需件：只提示，不判定（2026-09-13 起 optional/ 已取消，本分支不会触发；保留以兼容旧版技能目录）
  const optionalFiles = walk(OPTIONAL_DIR)
    .map((p) => toPosix(path.relative(OPTIONAL_DIR, p)))
    .sort();
  const copied = optionalFiles.filter((rel) => fs.existsSync(path.join(root, TARGET_SRC, rel)));
  if (optionalFiles.length) {
    info(
      'optional',
      `optional 按需件：已拷 ${copied.length}/${optionalFiles.length}` +
        (copied.length ? `（${copied.join(' ')}）` : '') +
        ` —— 不拷属正常，需要时从 assets/core/ 取`,
    );
  }

  // ④ 工程外壳（由 CLI 生成，不属 assets/）：仅作存在性提示，判定归 check-starter-align.mjs
  const shell = ['main.ts', 'App.vue', 'router/index.ts', 'vite-env.d.ts'];
  const missingShell = shell.filter((s) => !fs.existsSync(path.join(srcRoot, s)));
  if (missingShell.length) {
    info(
      'shell',
      `工程外壳缺 ${missingShell.map((s) => `src/${s}`).join(' ')} —— 不在 assets/ 内，由 td-starter CLI 生成；形态判定见 check-starter-align.mjs`,
    );
  }

  return R;
}

// ── 基线清单 ────────────────────────────────────────────────────────────────
function manifestLines() {
  const L = [];
  L.push('映射规则（唯一一条）：assets/core/<X>  →  <工程>/src/<X>\n');
  L.push('  整目录拷贝：cp -r assets/core/.  <工程>/src/');
  L.push('  即：assets/ 下每个文件的路径已镜像目标工程的 src/，剥掉 core/ 前缀即可。\n');

  const coreFiles = walk(CORE_DIR).map((p) => toPosix(path.relative(CORE_DIR, p))).sort();
  L.push(`core（必拷 ${coreFiles.length} 项，缺一即 FAIL）:`);
  coreFiles.forEach((f, i) => L.push(`  ${String(i + 1).padStart(2)}. src/${f}`));

  const optionalFiles = walk(OPTIONAL_DIR).map((p) => toPosix(path.relative(OPTIONAL_DIR, p))).sort();
  if (optionalFiles.length) {
    L.push(`\noptional（按需 ${optionalFiles.length} 项，不判定）:`);
    optionalFiles.forEach((f) => L.push(`   · src/${f}`));
  }

  L.push('\n已下线 / 已删除（命中即 WARN —— 拷了旧版资产）:');
  DEPRECATED.forEach((d) => L.push(`   · ${d.rel || d.base} —— ${d.why}`));

  L.push('\n不在 assets/ 内（由 td-starter CLI 生成，形态判定见 check-starter-align.mjs）:');
  L.push('   · src/main.ts / src/App.vue / src/router/index.ts / src/vite-env.d.ts');
  return L;
}

/** 统一出口：Windows 终端可能吞掉 stdout，故支持 --out 落盘（console.error 走 stderr 必可见）。 */
function emit(lines, outFile) {
  console.log(lines.join('\n'));
  if (outFile) {
    fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
    console.error(`[check-assets-copied] 报告已写入 ${outFile}`);
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
// 注意：Windows 下 `path.resolve(process.argv[1])` 与 `import.meta.url` 的大小写可能不一致
// （`admin` vs `Admin`），直接相等比较会**静默不执行任何校验并返回 0**，故先归一化。
const samePath = (a, b) => {
  let x = path.resolve(a);
  let y = path.resolve(b);
  try {
    x = fs.realpathSync.native(x);
  } catch {}
  try {
    y = fs.realpathSync.native(y);
  } catch {}
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
};
const isMain = process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url));

if (isMain) {
  const argv = process.argv.slice(2);

  // --out <file> 或 --out=<file>：报告落盘（Windows 终端可能吞 stdout）
  const outIdx = argv.findIndex((a) => a === '--out' || a.startsWith('--out='));
  let outFile = null;
  if (outIdx >= 0) {
    outFile = argv[outIdx].includes('=') ? argv[outIdx].split('=')[1] : argv[outIdx + 1];
    if (!outFile) {
      console.error('--out 需要文件路径');
      process.exit(2);
    }
  }

  if (argv.includes('--manifest') || argv.includes('-m')) {
    emit(manifestLines(), outFile);
    process.exit(0);
  }

  const strict = argv.includes('--strict');
  // ⚠️ 必须带 outIdx >= 0 守卫：未传 --out 时 outIdx === -1，outIdx + 1 === 0，
  //    会把**第一个位置参数（工程目录）**也排除掉，导致恒报「用法」并 exit(2)。
  const target = argv.find((a, i) => !a.startsWith('-') && (outIdx < 0 || i !== outIdx + 1));

  if (!target) {
    console.error('用法：node check-assets-copied.mjs <工程目录> [--json] [--strict] [--out 报告.txt]');
    console.error('      node check-assets-copied.mjs --manifest');
    process.exit(2);
  }

  const root = path.resolve(target);
  const results = check(root);

  if (argv.includes('--json')) {
    emit([JSON.stringify({ root, assets: ASSETS_DIR, results }, null, 2)], outFile);
  } else {
    const L = [];
    const icon = { FAIL: '✗ FAIL', WARN: '! WARN', PASS: '· pass', INFO: 'i info' };
    L.push(`技能资产并入校验：${root}`);
    L.push(`技能资产基线：${ASSETS_DIR}\n`);

    // 非 PASS 先行（问题好读），PASS 汇总压尾
    const bad = results.filter((r) => r.level !== 'PASS' && r.level !== 'INFO');
    const inf = results.filter((r) => r.level === 'INFO');
    for (const r of [...bad, ...inf]) {
      L.push(r.msg ? `  ${icon[r.level]}  [${r.id}] ${r.msg}` : `  ${icon[r.level]}  [${r.id}]`);
    }
    const n = { FAIL: 0, WARN: 0, PASS: 0, INFO: 0 };
    results.forEach((r) => n[r.level]++);
    L.push(`\n  通过 ${n.PASS} · 缺失 ${n.FAIL} · 漂移/残留 ${n.WARN} · 提示 ${n.INFO}`);
    if (n.FAIL) {
      L.push('\n结论：资产未拷全（FAIL > 0）—— 按 --manifest 的映射表补齐，core 之间是静态 import 关系，缺一即构建失败');
    } else if (n.WARN) {
      L.push('\n结论：资产已拷齐，但有内容漂移 / 已下线残留 —— 逐条确认后以技能版覆盖，或显式说明该工程不在本技能链路内');
    } else {
      L.push('\n结论：资产已完整并入（与技能 assets/ 逐文件一致）');
    }
    emit(L, outFile);
  }

  const fails = results.filter((r) => r.level === 'FAIL').length;
  const warns = results.filter((r) => r.level === 'WARN').length;
  process.exit(fails || (strict && warns) ? 1 : 0);
}
