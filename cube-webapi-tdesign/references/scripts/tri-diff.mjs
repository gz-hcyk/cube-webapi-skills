#!/usr/bin/env node
/**
 * tri-diff.mjs —— 四方对照：scaffold/src  vs  assets/core  vs  demo/src  vs  <工程>/src
 *
 * 与同目录脚本的分工：
 *   check-assets-copied.mjs  → 「工程是否与 assets/core 一致」（**判有无漂移，不判方向**）
 *   tri-diff.mjs             → 「各根谁是谁的超集」（**判方向：该以谁覆盖谁**）   ← 本文件
 *
 * ── 四根（2026-09-13 由三根扩为四根；文件名保留以免文档大面积改动）──
 *   ① `references/scaffold/src/` = **主真相源**（生产级编排层，SKILL.md §11.1）
 *   ② `assets/core/`            = ① 的**镜像拷贝源**（供 `cp -r` 并入业务工程）
 *   ③ `references/demo/src/`    = **精简示例层**（源码级样例，**不是** scaffold 的同步目标）
 *   ④ `<工程>/src/`             = 下游产物（并入后的业务工程）
 *
 *   ★ ③ 与 ④ 角色不同：③ 是**技能侧样例**（同层，非下游），④ 是下游。
 *     ④ 陈旧 = `ENG-DRIFT`（须修）；③ 的「不同」**分两种**（2026-09-13 实证校准）：
 *       · `DEMO-STALE`     = ③ 是**陈旧副本**（本该同步却落后）→ **须同步**
 *       · `DEMO-DIVERGENT` = ③ 是**精简变体**（白名单 12 件，层次差异）→ **非漂移，无需同步**
 *   ★ ③ 可否缺席：demo 是**精简子集**，并非 scaffold 的完整拷贝。③ 缺某文件**不等于漂移**
 *     （缺件数由本脚本实测打印），只有「③ 有且与 ①/② 不同」才进上述两种之一。
 *
 * ── ③ 为何是「层次差异」而非「陈旧」（2026-09-13 双侧构建实证）──
 *   demo 侧 12 件同名文件体积仅为 scaffold 的 1/3 ~ 1/8（MenuSidebar 8.5×、useLookups 5.9×、
 *   FormDialog 5.1×、useEntityResource 4.6×、ListPage 3.2×、fieldRender 3.2×），
 *   且认证架构为**上一代形态**：demo 的 auth store 内联在 `api/auth.ts`（348 行），
 *   scaffold 已拆为 `api/token.ts` + `api/menuTitles.ts` + `stores/auth.ts`。
 *   两者**各自可独立构建通过**（demo 基线 3925 模块 / 1.54MB JS；加 20 动作迁移后 3931 模块 /
 *   8.84MB JS，两侧均 `vue-tsc --noEmit && vite build` exit=0）⇒ 不是「同一份东西的新旧版本」，
 *   故默认不再当缺陷报。若确需把 demo 升级为与 scaffold 同构的运行实例，
 *   **20 动作迁移配方**见 `references/scripts/README.md`（已实证可行，代价是 demo 失去
 *   「源码级轻量可读」属性：JS 1.54MB → 8.84MB，5.7×）。
 *
 * 用法：
 *   node tri-diff.mjs <工程目录>
 *   node tri-diff.mjs <工程目录> --json          # CI 用
 *   node tri-diff.mjs <工程目录> --out r.txt     # 报告落盘（Windows 终端吞 stdout 时用）
 *   node tri-diff.mjs <工程目录> --core <dir> --scaffold <dir> --demo <dir>   # 覆盖默认对照根
 *   node tri-diff.mjs <工程目录> --no-demo       # 关闭第四根（退化为旧三根行为）
 *   node tri-diff.mjs <工程目录> --strict        # 令 DEMO-STALE 也计入失败退出码
 *   node tri-diff.mjs <工程目录> --strict-demo   # 连 DEMO-DIVERGENT（已知层次差异）也计入
 *   SKILL_DIR=/path/to/skill node tri-diff.mjs <工程目录>        # 换技能目录
 *
 * 退出码：0 = 无 ENG-DRIFT / CORE-DRIFT（无需修的真实分叉）；
 *        1 = 存在 ENG-DRIFT 或 CORE-DRIFT（须按方向修复）；`--strict` 下 DEMO-STALE 同样返回 1；
 *            `--strict-demo` 下 DEMO-DIVERGENT 亦然（隐含 `--strict`）；
 *        2 = 用法错误。
 *   ★ 白名单腐化（`DEMO-WL-STALE`：某白名单条目已不再分歧）**永不改变退出码**，只提示清理。
 *
 * ★ 判据是**文本等价**，不是字节相等：md5 前统一 CRLF/CR → LF。
 *   原因：技能仓库 `core.autocrlf=true`（工作区 CRLF），而业务工程多由
 *   `tdesign-starter-cli`（LF）产出——纯换行符差异不是漂移。
 *
 * ── flag 语义（ENG-DRIFT 与 CORE-DRIFT 的修复方向**相反**，勿一律 `cp`）──
 *   ALL-SAME        ① ② ④ 三根 md5 全同（③ 同或缺）          → 无需动作
 *   ENG-ONLY        技能侧都没有，仅工程有                    → **工程独有**（业务页 / 本地专有适配），无需动作
 *   ENG-DRIFT       ① == ②，工程不同或缺件                    → **以技能版覆盖工程**（§11.1）
 *   CORE-DRIFT      ① == 工程，② 是异类                      → **以 scaffold/工程 覆盖 core**
 *   SCAFFOLD-DRIFT  ① 独有（② ③ ④ 均缺），或命中 SCAFFOLD_ONLY_EXPECTED 且 ② 缺
 *                                                             → 属预期：DEV 验证页 / 工程外壳 /
 *                                                               `-temp all` 保留的上游基础设施（见该表注释）
 *   ALL-DIFF        ① 有 · ② 缺 · ③④ 各不同                  → 属预期：工程外壳 3 件，不归本脚本判
 *   DEMO-STALE      ① == ② == 工程，③ 不同且**不在白名单**    → **同步 demo**（真陈旧副本）
 *   DEMO-DIVERGENT  ① == ② == 工程，③ 不同但**在白名单内**    → 属预期：demo 精简变体（12 件），非漂移
 *   DEMO-ONLY       仅 ③ 有（①② 均缺）                       → 属预期：注册 / 找回密码页只此一份
 *
 * ★ 存在性优先于 md5：缺失文件的 md5 是占位串 `----------`；若不先看存在性，
 *   会把「技能两侧都缺、仅工程有」的业务页（`pages/admin/*Page.vue` 等）误报成 ENG-DRIFT，
 *   照提示「以技能版覆盖工程」就会删掉业务页。
 *
 * ★ 期望的「健康态」= ENG-DRIFT=0 · CORE-DRIFT=0 · DEMO-STALE=0 · DEMO-WL-STALE=0 ·
 *   SCAFFOLD-ONLY-WL-STALE=0，只剩 24 条 SCAFFOLD-DRIFT + 12 条 DEMO-DIVERGENT + 7 条 DEMO-ONLY。
 *   （2026-09-13 scaffold 换代 `-temp all` 后：SCAFFOLD-DRIFT 由 1 → 24，ALL-DIFF 由 4 → 0，
 *     DEMO-ONLY 由 6 → 7。）
 *   若出现其他条数，说明四根真的分叉了。
 *
 * ── 各根构成（勿把「预期」读成「漂移」）──
 *   references/scaffold/src/（**55 件**，`-temp all` 血统）
 *                                 = assets/core/（31 件，必拷，镜像源）
 *                                 + 工程外壳 3 件（App.vue / main.ts / router/index.ts，
 *                                   由 td-starter 生成，**恒不在 core 内**）
 *                                 + DEV 演示页 1 件（pages/LovDemoView.vue，`/lov-demo` 路由用，生产不注册）
 *                                 + 上游基础设施 20 件（types/5 · locales/4 · config/3 · constants/1 ·
 *                                   hooks/1 · stores/index.ts · styles/*.less 5；**恒不在 core 内**）
 *                                   ⇒ 共 24 件 scaffold 独有，全在 SCAFFOLD_ONLY_EXPECTED 内
 *   references/demo/src/（28 件，**lite 血统**）= 精简示例工程，含 7 件 scaffold 没有的资产
 *                                    （注册 / 找回密码 / 主视图 / 主题展示 / vite-env.d.ts 等）
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = process.env.SKILL_DIR || path.resolve(HERE, '..', '..');

/* ── ③ demo 的「已知层次差异」白名单（2026-09-13 双侧构建实证）──────────────
 * demo 是**精简示例层**（源码级样例，不随包携带依赖；2026-09-13 双侧构建实证：装齐依赖后
 * `vue-tsc --noEmit && vite build` exit=0，可独立构建通过），**不是** scaffold 的同步目标。
 * 下列 12 件在 demo 侧为精简变体（体积为 scaffold 的 1/3 ~ 1/8），
 * 且认证架构为上一代形态（store 内联在 demo 的 `api/auth.ts`，scaffold 已拆出
 * `api/token.ts` + `api/menuTitles.ts` + `stores/auth.ts`）⇒ 报 `DEMO-DIVERGENT`（**非漂移**）。
 * 只有**不在**本表内、而「③ 有且与 ①② 不同」的，才是真陈旧 `DEMO-STALE`。
 * ★ 自带腐化检测：条目若已不再分歧（被同步 / 被删除 / 已改名），报 `DEMO-WL-STALE` 提示移除。
 */
const DEMO_DIVERGENT = new Map([
  ['api/fieldRender.ts',               '16057B vs 51940B（3.2×）—— demo 变体无 map / dataSource / width / align'],
  ['api/http.ts',                      '9105B vs 14427B —— demo 版未拆出 ./token'],
  ['api/useEntityResource.ts',         '4602B vs 21193B（4.6×）'],
  ['api/useLookups.ts',                '1810B vs 10704B（5.9×）'],
  ['api/useLov.ts',                    '8207B vs 12260B'],
  ['components/cube/DetailDrawer.vue', '2119B vs 10468B'],
  ['components/cube/FormDialog.vue',   '6273B vs 32176B（5.1×）'],
  ['components/cube/ListPage.vue',     '9205B vs 29645B（3.2×）'],
  ['components/cube/MenuSidebar.vue',  '1815B vs 15349B（8.5×）—— demo 未启用 registerMenuTitles'],
  ['pages/LoginView.vue',              '2625B/84 行 vs 15512B/342 行 —— demo 仅 Challenge，scaffold 为全特性'],
  ['theme/tokens.ts',                  '两版结构相同，仅十六进制大小写 + demo 多 3 行注释'],
  ['utils/camel.ts',                   '879B vs 2306B'],
]);

/**
 * scaffold 独有且**恒定不在 `core` 内**的 24 件（2026-09-13 起，scaffold 换代 `-temp all` 后）。
 *
 * 命中本表 ⇒ 不判 `CORE-DRIFT`（那是「真分叉，须以 scaffold 覆盖 core」的反向提示），
 * 改判 `SCAFFOLD-DRIFT`（**属预期，不是漂移**）。分三类：
 *   ① 工程外壳 3 件：`main.ts` / `App.vue` / `router/index.ts`（由 td-starter 生成并改造）
 *   ② DEV 验证页 1 件：`pages/LovDemoView.vue`（`/lov-demo` 路由用，生产不注册）
 *   ③ `all` 模板保留的上游基础设施 20 件：`types/`5 + `locales/`4 + `config/`3 +
 *      `constants/`1 + `hooks/`1 + `stores/index.ts`1 + `styles/*.less`5
 *
 * ⚠️ 这三类**都不该被拷进 `assets/core/`**：①② 与脚手架血统绑定（`lite` 血统下是另一组文件，
 * 见 `assets/README.md`）；③ 只服务「完整脚手架」形态，属可裁件。
 *
 * ★ 自带腐化检测：条目若已不再是「scaffold 独有」，报 WARN 提示移除。
 */
const SCAFFOLD_ONLY_EXPECTED = new Set([
  // ① 工程外壳
  'App.vue', 'main.ts', 'router/index.ts',
  // ② DEV 验证页
  'pages/LovDemoView.vue',
  // ③ all 模板保留的上游基础设施
  'config/color.ts', 'config/global.ts', 'config/style.ts',
  'constants/index.ts',
  'hooks/index.ts',
  'locales/index.ts', 'locales/useLocale.ts', 'locales/lang/en_US.json', 'locales/lang/zh_CN.json',
  'stores/index.ts',
  'styles/font-family.less', 'styles/index.less', 'styles/layout.less', 'styles/reset.less', 'styles/variables.less',
  'types/axios.d.ts', 'types/env.d.ts', 'types/globals.d.ts', 'types/interface.d.ts', 'types/router.d.ts',
]);

/* ── 参数解析 ───────────────────────────────────────────── */
const argv = process.argv.slice(2);
const opt = { eng: null, core: null, scaffold: null, demo: null, out: null, json: false, noDemo: false, strict: false, strictDemo: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') opt.json = true;
  else if (a === '--strict') opt.strict = true;
  else if (a === '--strict-demo') { opt.strictDemo = true; opt.strict = true; }
  else if (a === '--no-demo') opt.noDemo = true;
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--core') opt.core = argv[++i];
  else if (a === '--scaffold') opt.scaffold = argv[++i];
  else if (a === '--demo') opt.demo = argv[++i];
  else if (a === '-h' || a === '--help') opt.help = true;
  else if (!a.startsWith('--')) opt.eng = a;
  else { console.error(`未知参数：${a}`); process.exit(2); }
}

if (opt.help || !opt.eng) {
  console.error(
    '用法：node tri-diff.mjs <工程目录> [--core <dir>] [--scaffold <dir>] [--demo <dir>]\n' +
    '                                       [--no-demo] [--strict] [--strict-demo] [--json] [--out <file>]\n' +
    '  默认 <core>       = <skill>/assets/core\n' +
    '  默认 <scaffold>   = <skill>/references/scaffold/src\n' +
    '  默认 <demo>       = <skill>/references/demo/src（不存在则自动关闭第四根）\n' +
    '  --no-demo         关闭第四根，退化为旧三根行为\n' +
    '  --strict          令 DEMO-STALE 也计入失败退出码\n' +
    '  --strict-demo     连 DEMO-DIVERGENT（已知层次差异）也计入（隐含 --strict）\n' +
    '  <工程目录> 可为工程根（自动取 /src）或直接给 src 目录'
  );
  process.exit(2);
}

const SCAFFOLD_SRC = opt.scaffold || path.join(SKILL_ROOT, 'references/scaffold/src');
const CORE_DIR = opt.core || path.join(SKILL_ROOT, 'assets/core');
const DEMO_SRC = opt.noDemo ? null : (opt.demo || path.join(SKILL_ROOT, 'references/demo/src'));
// 工程目录可直接给 `src/`，也可给工程根（自动补 `src`）
const ENG_SRC = path.basename(opt.eng) === 'src' ? opt.eng : path.join(opt.eng, 'src');

const REQUIRED = [['scaffold/src', SCAFFOLD_SRC], ['assets/core', CORE_DIR], ['工程 src', ENG_SRC]];
if (DEMO_SRC) REQUIRED.push(['demo/src', DEMO_SRC]);
for (const [label, dir] of REQUIRED) {
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

/* ── 对照 ───────────────────────────────────────────────── */
const roots = [SCAFFOLD_SRC, CORE_DIR, ...(DEMO_SRC ? [DEMO_SRC] : []), ENG_SRC];
const files = [...new Set(roots.flatMap((r) => walk(r)))].sort();

const ALL_FLAGS = ['ALL-SAME', 'ENG-ONLY', 'ENG-DRIFT', 'CORE-DRIFT', 'SCAFFOLD-DRIFT', 'ALL-DIFF', 'DEMO-STALE', 'DEMO-DIVERGENT', 'DEMO-ONLY'];
const GROUPS = Object.fromEntries(ALL_FLAGS.map((k) => [k, []]));
const detail = [];
let demoMissing = 0;   // ①② 有、③ 缺 —— 缺件≠漂移，仅作信息

for (const f of files) {
  const pa = path.join(SCAFFOLD_SRC, f), pb = path.join(CORE_DIR, f);
  const pd = DEMO_SRC ? path.join(DEMO_SRC, f) : null, pc = path.join(ENG_SRC, f);
  const ea = fs.existsSync(pa), eb = fs.existsSync(pb), ec = fs.existsSync(pc);
  const ed = pd ? fs.existsSync(pd) : false;
  const ha = ea ? md5(pa) : null;
  const hb = eb ? md5(pb) : null;
  const hd = ed ? md5(pd) : null;
  const hc = ec ? md5(pc) : null;

  if (ea && !ed) demoMissing++;

  // ★ 存在性必须先于 md5 参与判定：缺失文件的 md5 是占位串 `----------`，
  //   若直接比串，会把「技能两侧都没有、仅工程有」的业务页误判成 ENG-DRIFT
  //   （那样按提示「以技能版覆盖工程」就会去删掉业务页）。
  const eq = (x, y) => x !== null && y !== null && x === y;

  let flag;
  if (!ea && !eb && ed) flag = 'DEMO-ONLY';            // 仅 demo 有（注册/找回密码页）
  else if (!ea && !eb && !ed && ec) flag = 'ENG-ONLY'; // 工程独有（业务新增页），技能侧本就不提供
  else if (ea && eb && ec && eq(ha, hb) && eq(hb, hc)) flag = 'ALL-SAME';
  else if (eq(ha, hb)) flag = 'ENG-DRIFT';             // 技能侧一致，工程分叉或缺件
  else if (!eb && SCAFFOLD_ONLY_EXPECTED.has(f)) flag = 'SCAFFOLD-DRIFT'; // ★ scaffold 独有且必然不在 core 内（外壳/DEV 页/上游基础设施）→ 属预期
  else if (eq(ha, hc)) flag = 'CORE-DRIFT';            // scaffold==工程，core 是异类
  else if (eq(hb, hc)) flag = 'SCAFFOLD-DRIFT';        // core==工程，scaffold 独有
  else if (ea && !eb && !ec) flag = 'SCAFFOLD-DRIFT';  // scaffold 独有（core/工程均缺）
  else flag = 'ALL-DIFF';

  // 第四根附加判定：仅在主 flag 已定且未命中异常时生效，**不改变旧 6 个 flag 的语义**。
  // ③ 与 ①② 不同时按白名单二分：白名单内 = 精简变体（DEMO-DIVERGENT），
  // 白名单外 = 真陈旧副本（DEMO-STALE，须同步）。
  if (ed && flag === 'ALL-SAME' && !eq(hd, ha)) {
    flag = DEMO_DIVERGENT.has(f) ? 'DEMO-DIVERGENT' : 'DEMO-STALE';
  }

  GROUPS[flag].push(f);
  if (flag !== 'ALL-SAME') {
    detail.push({
      file: f, flag,
      scaffold: { md5: ha ?? '----------', exist: ea, bytes: size(pa, ea) },
      core: { md5: hb ?? '----------', exist: eb, bytes: size(pb, eb) },
      demo: { md5: hd ?? '----------', exist: ed, bytes: size(pd, ed) },
      eng: { md5: hc ?? '----------', exist: ec, bytes: size(pc, ec) },
    });
  }
}

// 白名单腐化检测：条目若已不在 DEMO-DIVERGENT 组里（已同步 / 已删除 / 已改名），应清理
const wlRot = [...DEMO_DIVERGENT.keys()].filter((f) => !GROUPS['DEMO-DIVERGENT'].includes(f));

// 同类腐化检测（SCAFFOLD_ONLY_EXPECTED）：条目若已不再「scaffold 独有」，说明 core 收编了它或它被删了
// —— 两种都不该继续留在表里，否则会把真分叉（CORE-DRIFT）静默吞掉。
const sclRot = [...SCAFFOLD_ONLY_EXPECTED].filter((f) => !GROUPS['SCAFFOLD-DRIFT'].includes(f));

const bad = GROUPS['ENG-DRIFT'].length + GROUPS['CORE-DRIFT'].length;
const stale = opt.strict ? GROUPS['DEMO-STALE'].length : 0;
const diverged = opt.strictDemo ? GROUPS['DEMO-DIVERGENT'].length : 0;
const exitCode = bad + stale + diverged > 0 ? 1 : 0;

/* ── 输出 ───────────────────────────────────────────────── */
const FIX_HINT = {
  'ENG-ONLY': '工程独有（业务新增页 / 本地专有适配），技能侧不提供 —— 无需动作',
  'ENG-DRIFT': '以技能版（scaffold/core）覆盖工程 —— §11.1',
  'CORE-DRIFT': '以 scaffold/工程 覆盖 assets/core',
  'SCAFFOLD-DRIFT': '预期：工程外壳 / DEV 验证页 / `all` 保留的上游基础设施（共 24 件，恒不在 core 内）',
  'ALL-DIFF': '预期：工程外壳 4 件，不归本脚本判',
  'DEMO-STALE': 'demo **陈旧副本**（不在已知差异白名单内）—— 须同步 references/demo/src',
  'DEMO-DIVERGENT': '预期：demo **精简变体**（层次差异，非漂移）—— 无需同步；如需同构见 scripts/README 的 20 动作迁移配方',
  'DEMO-ONLY': '预期：注册 / 找回密码页只此一份，scaffold/core 本就不提供',
};

let text = '';
if (opt.json) {
  text = JSON.stringify({
    roots: { scaffold: SCAFFOLD_SRC, core: CORE_DIR, demo: DEMO_SRC, eng: ENG_SRC },
    counts: Object.fromEntries(ALL_FLAGS.map((k) => [k, GROUPS[k].length])),
    demoMissingFromCore: DEMO_SRC ? demoMissing : null,
    divergentWhitelistRot: wlRot,
    exitCode, strict: opt.strict, strictDemo: opt.strictDemo, files: detail,
  }, null, 2) + '\n';
} else {
  const L = [];
  L.push(DEMO_SRC ? `四方对照：scaffold/src  vs  assets/core  vs  demo/src  vs  工程 src`
                  : `三根对照（--no-demo）：scaffold/src  vs  assets/core  vs  工程 src`);
  L.push(`  scaffold = ${SCAFFOLD_SRC}`);
  L.push(`  core     = ${CORE_DIR}`);
  L.push(`  demo     = ${DEMO_SRC || '（已关闭，--no-demo）'}`);
  L.push(`  eng      = ${ENG_SRC}`);
  L.push('');
  L.push(`共 ${files.length} 文件（${roots.length} 根并集）`);
  L.push(`分类计数: ALL-SAME=${GROUPS['ALL-SAME'].length}  ENG-ONLY=${GROUPS['ENG-ONLY'].length}  ` +
         `ENG-DRIFT=${GROUPS['ENG-DRIFT'].length}  CORE-DRIFT=${GROUPS['CORE-DRIFT'].length}  ` +
         `SCAFFOLD-DRIFT=${GROUPS['SCAFFOLD-DRIFT'].length}  ALL-DIFF=${GROUPS['ALL-DIFF'].length}  ` +
         `DEMO-STALE=${GROUPS['DEMO-STALE'].length}  DEMO-DIVERGENT=${GROUPS['DEMO-DIVERGENT'].length}  ` +
         `DEMO-ONLY=${GROUPS['DEMO-ONLY'].length}`);
  if (DEMO_SRC) {
    L.push(`demo 未收录的 ①② 资产：${demoMissing} 件（③ 是精简子集，**缺件≠漂移**）`);
  }
  L.push('');
  const ORDER = ['ENG-DRIFT', 'CORE-DRIFT', 'DEMO-STALE', 'ENG-ONLY', 'SCAFFOLD-DRIFT', 'DEMO-DIVERGENT', 'DEMO-ONLY', 'ALL-DIFF'];
  for (const flag of ORDER) {
    const list = GROUPS[flag];
    if (!list.length) continue;
    L.push(`── ${flag}（${list.length}）· ${FIX_HINT[flag]} ──`);
    for (const d of detail.filter((x) => x.flag === flag)) {
      L.push(`  ${d.file}`);
      L.push(`      scaffold=${d.scaffold.md5}(${d.scaffold.bytes}B)  core=${d.core.md5}(${d.core.bytes}B)  ` +
             `demo=${d.demo.md5}(${d.demo.bytes}B)  eng=${d.eng.md5}(${d.eng.bytes}B)`);
      if (DEMO_DIVERGENT.has(d.file)) L.push(`      已知差异：${DEMO_DIVERGENT.get(d.file)}`);
    }
    L.push('');
  }
  if (wlRot.length) {
    L.push(`⚠ DEMO-WL-STALE（${wlRot.length}）· 白名单腐化：下列条目已不再分歧（已同步 / 已删除 / 已改名），`);
    L.push(`  应从 tri-diff.mjs 的 DEMO_DIVERGENT 表中移除（本项不影响退出码）`);
    for (const f of wlRot) L.push(`  ${f}  —— ${DEMO_DIVERGENT.get(f)}`);
    L.push('');
  }
  if (sclRot.length) {
    L.push(`⚠ SCAFFOLD-ONLY-WL-STALE（${sclRot.length}）· 白名单腐化：下列条目已不再「scaffold 独有」`);
    L.push(`  （core 已收编它，或它已被删除 / 改名），应从 tri-diff.mjs 的 SCAFFOLD_ONLY_EXPECTED 表中移除；`);
    L.push(`  留着会把真分叉（CORE-DRIFT）**静默吞掉**（本项不影响退出码）`);
    for (const f of sclRot) L.push(`  ${f}`);
    L.push('');
  }
  if (bad === 0) {
    L.push(`✓ 健康态：ENG-DRIFT=0  CORE-DRIFT=0（剩余 SCAFFOLD-DRIFT / ALL-DIFF / DEMO-DIVERGENT / DEMO-ONLY 属预期，不是漂移）`);
    if (GROUPS['DEMO-STALE'].length) {
      L.push(`! 另有 ${GROUPS['DEMO-STALE'].length} 条 DEMO-STALE：demo 侧**陈旧副本**（不在已知差异白名单内）⇒ 建议同步（--strict 时计入失败）`);
    } else if (DEMO_SRC) {
      L.push(`· demo 侧 ${GROUPS['DEMO-DIVERGENT'].length} 条 DEMO-DIVERGENT 全部命中白名单：属**精简变体**（层次差异），非漂移，无需同步。`);
    }
  } else {
    L.push(`✗ 存在 ${bad} 条真实分叉（ENG-DRIFT=${GROUPS['ENG-DRIFT'].length}，CORE-DRIFT=${GROUPS['CORE-DRIFT'].length}）——按上表方向修复，注意两者方向相反`);
  }
  text = L.join('\n') + '\n';
}

if (opt.out) fs.writeFileSync(opt.out, text, 'utf8');
process.stdout.write(text);
process.exit(exitCode);
