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
 *   INFO —— **「按项目定制」豁免**：命中 `PROJECT_EDITABLE`（文案级改写，归一化后哈希相等）
 *           或 `PROJECT_FORKED`（结构级扩展，骨架锚点两侧全命中）的文件 —— 属预期差异，不计漂移。
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
// 复用血统判定：工程外壳清单随 `all` / `lite` 血统不同（all 用 src/types/env.d.ts，无 vite-env.d.ts）
import { detectLineage } from './check-starter-align.mjs';

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
const hashText = (t) => crypto.createHash('md5').update(t.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8').digest('hex');
const readText = (p) => fs.readFileSync(p, 'utf8');

const md5 = (p) => {
  const buf = fs.readFileSync(p);
  if (BINARY_EXT.has(path.extname(p).toLowerCase())) {
    return crypto.createHash('md5').update(buf).digest('hex');
  }
  return hashText(buf.toString('utf8'));
};

/**
 * ★ 按项目「必改」文件的比对豁免（2026-09-13 新增，修 D7）
 *
 * 背景：技能铁律**要求**某些文件按项目改写（最典型是登录页 `PROJECT` 文案，铁律 L1）。
 * 这些文件的正确工程态**本就与模板不同**，若照搬「MD5 一致才算通过」，会把
 * 「已按铁律正确填写」误报成「内容漂移／版本不同步」，并给出
 * 「以技能版为准覆盖」的建议 —— **该建议与铁律直接冲突，照做即抹掉项目业务文案**。
 *
 * 解法：比对前先用 `normalize()` 把「项目自填区段」剥掉再取哈希。
 *   · 归一化后一致 → INFO（预期差异，通过）
 *   · 归一化后仍不一致 → WARN（真漂移：模板骨架本身被人改过/是前代版本）
 */
const PROJECT_EDITABLE = [
  {
    rel: 'pages/LoginView.vue',
    why: '登录页左栏 PROJECT 文案（铁律 L1 要求按项目业务改写，必然与模板不同）',
    normalize: (t) => t.replace(/const PROJECT = \{[\s\S]*?\n\};/, 'const PROJECT = {/*PROJECT*/};'),
  },
];
/**
 * ★ 工程「派生件」：工程在技能骨架上做了**结构性扩展**后的豁免表。
 *
 * 与 PROJECT_EDITABLE 的分工（两者都属「预期差异」，但判据必须不同）：
 *   PROJECT_EDITABLE —— **文案级**改写：差异集中在某个可整体剥离的区段（如 `PROJECT` 常量）。
 *                       判据 = 剥掉该区段后哈希相等（骨架仍须逐字一致）。
 *   PROJECT_FORKED   —— **结构级**扩展：工程既改了既有行（换掉一段模板、给函数包 try/finally），
 *                       又追加了新行，差异散布全文件 ——「剥区段后哈希相等」根本不可能成立。
 *                       判据 = **骨架锚点存在性**（见下）。
 *
 * 为什么不给这类文件硬写正则把差异都剥掉：正则必然既宽又脆 ——
 * 剥多了会把真漂移一起吞掉（静默失守），剥少了仍报红灯（噪声训练人忽略红灯）。
 * 故改用**锚点**：人工挑一组「骨架地标行」（导入语句 / 关键函数签名 / 关键样式选择器），
 * 要求它们在**技能侧与工程侧同时逐字存在**：
 *   · 全部命中 → INFO（骨架仍在，工程扩展属预期，无需动作）
 *   · 任一侧缺失 → WARN（技能骨架换代而另一侧未合并，或工程把骨架删了 —— 须人工裁决）
 * ⚠️ 锚点只回答「骨架还在不在」，**不回答「工程扩展对不对」**—— 后者只能人工看。
 *
 * 登记本表前先自问：**这段扩展是业务专有，还是本该回灌技能？**
 *   通用改进（与业务无关的能力增强）应回灌 scaffold/src（§11.1）并 sync 到 core，**不入本表**。
 * 本表与 tri-diff.mjs 的同名表**必须逐字一致**（两边判据同源，改一处须同步改另一处）。
 */
const PROJECT_FORKED = [
  {
    rel: 'layouts/BasicLayout.vue',
    why: '顶栏用户区改为共用组件 `components/portal/UserMenu.vue`（门户与后台同一入口），原内联 t-dropdown 及其样式已随之删除',
    anchors: [
      "import { useAuthStore } from '@/stores/auth';",
      "import { titleOf, areaTitleOf } from '@/api/menuTitles';",
      "import MenuSidebar from '@/components/cube/MenuSidebar.vue';",
      "import SettingPanel from '@/components/cube/SettingPanel.vue';",
      "const menuTheme = computed<'light' | 'dark'>(() => (setting.mode === 'dark' ? 'dark' : 'light'));",
      "const areaLabel = computed(() => areaTitleOf(areaRaw.value) || areaRaw.value || '概览');",
      'function onTenant(v: SelectValue<SelectOption>) {',
      'function toggleCollapsed() {',
      '.content { padding: 20px; overflow: auto; background: var(--cube-content-bg); min-width: 0; }',
      '.side.collapsed .side-brand b { display: none; }',
    ],
  },
  {
    rel: 'pages/DashboardView.vue',
    why: '新增「应用登录分析」整块（服务端聚合 KPI + 条形图 + 明细表）与菜单树空态提示；KPI / 图表 / 排行 / 日志等原有区块仍为技能骨架',
    anchors: [
      "import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'",
      "import { getApi, getRaw } from '@/api/http'",
      "const FRAMEWORK_AREAS = new Set(['admin', 'cube', 'sys', 'core', 'xcode', 'log'])",
      'function isChildTableNode(n: any): boolean {',
      'async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {',
      'const areaStats = computed(() => {',
      'function cssVar(name: string, fallback: string): string {',
      'watch([topModules, areaStats], () => nextTick(renderCharts), { deep: true })',
      'function cellOf(row: any, key: string): string {',
      'function rankClass(idx: number) {',
      '.dash-item--main :deep(.t-card__title),',
    ],
  },
];

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
      const editable = PROJECT_EDITABLE.find((e) => e.rel === rel);
      if (editable) {
        // 按项目必改件：剥掉项目自填区段后仍一致 → 属预期差异，不算漂移
        const a = hashText(editable.normalize(readText(src)));
        const b = hashText(editable.normalize(readText(dst)));
        if (a === b) {
          info(`core:${rel}`, `${editable.why} —— 已按项目定制，属预期差异（归一化比对一致）`);
          continue;
        }
        warn(
          `core:${rel}`,
          `内容漂移（骨架级）：src/${rel} 在剥离「按项目必改区段」后仍与技能资产不一致 —— 骨架被改过或使用了前代版本，请按 §11.1 回灌`,
        );
        continue;
      }
      const forked = PROJECT_FORKED.find((e) => e.rel === rel);
      if (forked) {
        // 工程派生件：判据 = 骨架锚点在两侧都还在（对这类文件哈希判据不成立，理由见 PROJECT_FORKED 注释）
        const srcText = readText(src);
        const dstText = readText(dst);
        const missHere = forked.anchors.filter((a) => !srcText.includes(a));
        const missThere = forked.anchors.filter((a) => !dstText.includes(a));
        if (!missHere.length && !missThere.length) {
          info(
            `core:${rel}`,
            `${forked.why} —— 工程做了结构性扩展（属预期差异）；骨架锚点 ${forked.anchors.length} 条两侧全命中`,
          );
        } else {
          warn(
            `core:${rel}`,
            `骨架锚点缺失（技能侧缺 ${missHere.length} 条 / 工程侧缺 ${missThere.length} 条）—— ` +
              `技能骨架已换代而另一侧未合并，或工程把骨架删了；锚点只验证「骨架还在」，具体差异须人工裁决` +
              (missThere.length ? `；工程侧首个缺失：\`${missThere[0]}\`` : `；技能侧首个缺失：\`${missHere[0]}\``),
          );
        }
        continue;
      }
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
  //    ⚠️ 清单随血统不同：all 用 src/types/env.d.ts（**无** src/vite-env.d.ts）；lite 反之。
  const lineage = detectLineage(root).lineage;
  const shell =
    lineage === 'all'
      ? ['main.ts', 'App.vue', 'router/index.ts', 'types/env.d.ts']
      : ['main.ts', 'App.vue', 'router/index.ts', 'vite-env.d.ts'];
  const missingShell = shell.filter((s) => !fs.existsSync(path.join(srcRoot, s)));
  if (missingShell.length) {
    info(
      'shell',
      `工程外壳缺 ${missingShell.map((s) => `src/${s}`).join(' ')} —— 不在 assets/ 内，由 td-starter CLI 生成；形态判定见 check-starter-align.mjs（血统 = ${lineage}）`,
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
  L.push('   · all  血统：src/main.ts / src/App.vue / src/router/index.ts / src/types/env.d.ts（**无** vite-env.d.ts）');
  L.push('   · lite 血统：src/main.ts / src/App.vue / src/router/index.ts / src/vite-env.d.ts');
  L.push('   · 另见 tri-diff.mjs 的 SCAFFOLD_ONLY_EXPECTED 表（scaffold 独有 24 件，恒不在 core 内）');
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
      if (n.INFO) {
        L.push(
          `     另有 ${n.INFO} 条「已按项目定制」提示（归一化哈希 / 骨架锚点比对通过）—— 属预期差异，无需动作；` +
            `明细见上，登记表在 PROJECT_EDITABLE / PROJECT_FORKED`,
        );
      }
    }
    emit(L, outFile);
  }

  const fails = results.filter((r) => r.level === 'FAIL').length;
  const warns = results.filter((r) => r.level === 'WARN').length;
  process.exit(fails || (strict && warns) ? 1 : 0);
}
