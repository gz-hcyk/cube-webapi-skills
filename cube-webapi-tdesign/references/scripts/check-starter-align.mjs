#!/usr/bin/env node
/**
 * check-starter-align.mjs —— tdesign-starter CLI 基线对齐校验（**lite / all 双基线**）
 *
 * 用途：校验一个前端工程是否仍是 **tdesign-starter-cli 产物形态**（即铁律 C1「必须由 tdesign-starter
 *       初始化」可验证），并检出所有「未声明的偏差」。技能内两套工程副本（references/scaffold、
 *       references/demo）与真实业务工程都可拿它做体检。
 *
 * 用法：
 *   node check-starter-align.mjs                      # 默认检查 references/scaffold
 *   node check-starter-align.mjs <工程目录>            # 检查指定工程
 *   node check-starter-align.mjs <工程目录> --json     # 输出 JSON（CI 用）
 *   node check-starter-align.mjs --manifest           # 打印两套 CLI 基线清单（人工核对用）
 *
 * 退出码：0 = 无 FAIL；1 = 有 FAIL。
 *
 * ── 双基线（2026-09-13 起） ──────────────────────────────────────────────────
 *   all  = `td-starter init <名> -type vue3 -temp all`             → **当前唯一受支持形态**（193 件）
 *   lite = `td-starter init <名> -type vue3 -bt vite -temp lite`   → **历史形态**，仅用于校验存量工程
 *
 *   ⚠️ 两者骨架**实质性不同**，用单基线校验必然互相误报。血统判据（见 detectLineage）：
 *      `tsconfig.node.json` 存在 ⇒ **lite**（all 恒无此文件）
 *      `tsconfig.node.json` 缺失 ⇒ **all**
 *
 * 三层判据：
 *   FAIL —— 骨架 / 构建契约被破坏，**必须修**（缺骨架文件、build 不做类型检查、存在 `prepare`、
 *           缺必需依赖、缺 `@` 别名、index.html 缺 favicon/挂载点、main.ts 缺外壳、血统自相矛盾）。
 *   WARN —— 「工程选择」级偏离（tsconfig 编译策略、工具链件缺失、上游演示代码残留、
 *           rolldown 废弃 API 等）：**允许，但必须在工程 README 显式声明**。
 *   INFO —— CLI 演示件 / 上游文档件的存在或移除，移除即「已声明偏差」，不扣分。
 *
 * 基线来源：tdesign-starter-cli v0.5.3（2026-09-13 本机实测）
 *   ⚠️ 两套模板的 `package.json` 都带一条 `prepare` 脚本调**未声明的** `is-ci`（lite 还走 `husky install`）
 *      → `npm run prepare` exit=1。lite 下 `npm install` 必然失败；all 下恰好不阻断安装但仍属必删项。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..', '..');

// ═════════════════════ 基线 A：all（完整脚手架，当前唯一受支持） ═════════════════════
/**
 * `-temp all` 实测产物 **193 件**（含 `src/pages/` 50 件、`src/layouts/` 18 件等上游演示业务代码）。
 * 这里只列**结构与骨架条目**，供 `--manifest` 人工核对。
 */
export const CLI_PRODUCTS_ALL = [
  '.editorconfig',
  '.env',
  '.env.development',
  '.env.site',
  '.env.test',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.prettierrc.js',
  '.stylelintignore',
  '.yarnrc.yml',
  '.cnb.yml',
  '.cnb/',
  '.github/',
  '.husky/',
  '.vscode/',
  'commitlint.config.js',
  'eslint.config.js',
  'stylelint.config.js',
  'index.html',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'public/',
  'mock/',
  'README.md',
  'README-zh_CN.md',
  'CHANGELOG.md',
  'LICENSE',
  'PUBLISH.md',
  'docs/',
  'src/main.ts',
  'src/App.vue',
  'src/permission.ts',
  'src/api/',
  'src/assets/',
  'src/components/',
  'src/config/',
  'src/constants/',
  'src/hooks/',
  'src/layouts/',
  'src/locales/',
  'src/pages/',
  'src/router/',
  'src/store/',
  'src/style/',
  'src/types/',
  'src/utils/',
];

/** all 产物总件数（不含 node_modules / dist / .git） */
export const CLI_PRODUCTS_ALL_COUNT = 193;

/** all 基线「工程骨架」——目标工程**必须存在**，缺一即 FAIL */
const MUST_KEEP_ALL = [
  'index.html',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'public/favicon.ico',
  'src/main.ts',
  'src/types/env.d.ts',
];

/** all 基线「完整脚手架工具链」——缺一即 WARN（用户明确要求 all 完整形态，非仅运行所需） */
const TOOLCHAIN_ALL = [
  '.editorconfig',
  '.env',
  '.env.development',
  '.env.site',
  '.env.test',
  '.gitignore',
  '.npmrc',
  '.prettierrc.js',
  '.stylelintignore',
  '.husky/',
  '.vscode/',
  'commitlint.config.js',
  'eslint.config.js',
  'stylelint.config.js',
  'package-lock.json',
];

/** all 基线「上游演示件 / 仓库文档件」——允许删除，删除即「已声明偏差」，仅记 INFO */
const DEMO_ONLY_ALL = [
  'README.md',
  'README-zh_CN.md',
  'CHANGELOG.md',
  'LICENSE',
  'PUBLISH.md',
  'docs',
  '.github',
  '.cnb',
  '.cnb.yml',
  '.gitattributes',
  'src/permission.ts',
  'mock',
];

/** all 基线 tsconfig.json 的 compilerOptions（逐字从模板抄录；差异记 WARN） */
const ALL_TSCONFIG = {
  ignoreDeprecations: '6.0',
  target: 'esnext',
  module: 'esnext',
  moduleResolution: 'bundler',
  jsx: 'preserve',
  jsxImportSource: 'vue',
  sourceMap: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  skipLibCheck: true,
  allowSyntheticDefaultImports: true,
  lib: ['esnext', 'dom'],
  types: ['vite/client', 'tdesign-vue-next/global'],
  noEmit: true,
  noImplicitAny: true,
  strictFunctionTypes: true,
  strictBindCallApply: true,
  noImplicitThis: true,
  alwaysStrict: true,
};

/** all 基线 tsconfig.json 的 include（逐字） */
const ALL_TSCONFIG_INCLUDE = ['**/*.ts', 'src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.vue'];

/** all 基线**必须存在**的依赖（少一个即 FAIL） */
const REQUIRED_DEPS_ALL = ['vue-router', 'pinia', 'axios', 'tdesign-vue-next'];

/** all 基线若保留 i18n（`src/locales/`）则连带必需的依赖（缺失记 WARN） */
const LOCALES_DEPS_ALL = ['vue-i18n', '@vueuse/core'];

// ═════════════════════ 基线 B：lite（历史形态，校验存量工程用） ═════════════════════
/** CLI `-temp lite` 的全部产物（相对工程根，共 13 项） */
export const CLI_PRODUCTS_LITE = [
  '.npmignore',
  'README.md',
  'index.html',
  'package.json',
  'public/favicon.ico',
  'public/tdesign-logo.svg',
  'src/App.vue',
  'src/assets/svg/vite-logo.svg',
  'src/main.ts',
  'src/vite-env.d.ts',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
];

/** lite 基线骨架（必须存在，缺一即 FAIL） */
const MUST_KEEP_LITE = [
  'index.html',
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'public/favicon.ico',
  'src/main.ts',
  'src/vite-env.d.ts',
];

/** lite 基线演示件（允许删，记 INFO） */
const DEMO_ONLY_LITE = [
  '.npmignore',
  'README.md',
  'public/tdesign-logo.svg',
  'src/assets/svg/vite-logo.svg',
  'src/App.vue',
];

/** lite 基线 tsconfig.json 的 compilerOptions（逐字从 CLI 产物抄录） */
const LITE_TSCONFIG = {
  target: 'ESNext',
  useDefineForClassFields: true,
  module: 'ESNext',
  moduleResolution: 'Node',
  strict: true,
  jsx: 'preserve',
  sourceMap: true,
  resolveJsonModule: true,
  isolatedModules: true,
  esModuleInterop: true,
  lib: ['ESNext', 'DOM'],
  skipLibCheck: true,
};

/** lite 基线 tsconfig.json 的 references（必须逐字等于此值） */
const LITE_TSCONFIG_REFERENCES = [{ path: './tsconfig.node.json' }];

/** lite 基线 tsconfig.node.json 的 compilerOptions（差异记 WARN） */
const LITE_TSCONFIG_NODE = {
  composite: true,
  module: 'ESNext',
  moduleResolution: 'Node',
  allowSyntheticDefaultImports: true,
};

/** lite 基线**必须补齐**的依赖（模板不含，不补跑不起来） */
const REQUIRED_DEPS_LITE = ['vue-router', 'pinia', 'axios'];

// ═════════════════════════ 两基线共用 ═════════════════════════
/** 允许的 tsconfig 补丁键（C1 补丁白名单）；其余差异记 WARN 并要求「显式声明」 */
const TSCONFIG_PATCH_KEYS = new Set(['baseUrl', 'paths']);

/** 禁止出现在 scripts 中的脚本 → 原因 */
const FORBIDDEN_SCRIPTS = {
  prepare:
    '实测致命：CLI 的 prepare 调 `is-ci`（lite 还走 `husky install`），`is-ci` 不在任何依赖里 → `npm run prepare` exit=1。lite 下 `npm install` 必然失败；all 下恰好不阻断安装但仍属必删项。必须删除。',
};

/**
 * all 血统：上游演示业务代码残留探针。
 * 命中即 WARN —— 说明 `-temp all` 的演示层没删干净，会与本技能资产（同路径不同内容）打架。
 */
const UPSTREAM_RESIDUE_ALL = [
  'src/layouts/BlankLayout.vue',
  'src/layouts/components/Footer.vue',
  'src/pages/result/index.vue',
  'src/pages/dashboard/index.vue',
  'src/pages/login/index.vue',
  'src/router/modules/main.ts',
  'src/store/modules/user.ts',
  'src/utils/charts.ts',
  'src/utils/date.ts',
  'src/utils/request.ts',
  'src/style/variables.less',
];

/** 基线注册表 */
export const BASELINES = {
  all: {
    id: 'all',
    cli: 'td-starter init <名> -type vue3 -temp all',
    label: '完整脚手架',
    products: CLI_PRODUCTS_ALL,
    productsCount: CLI_PRODUCTS_ALL_COUNT,
    mustKeep: MUST_KEEP_ALL,
    toolchain: TOOLCHAIN_ALL,
    demoOnly: DEMO_ONLY_ALL,
    tsconfig: ALL_TSCONFIG,
    tsconfigInclude: ALL_TSCONFIG_INCLUDE,
    tsconfigReferences: null,
    tsconfigNode: null,
    requiredDeps: REQUIRED_DEPS_ALL,
    requirePrivate: false,
  },
  lite: {
    id: 'lite',
    cli: 'td-starter init <名> -type vue3 -bt vite -temp lite',
    label: '精简模板（历史）',
    products: CLI_PRODUCTS_LITE,
    productsCount: CLI_PRODUCTS_LITE.length,
    mustKeep: MUST_KEEP_LITE,
    toolchain: [],
    demoOnly: DEMO_ONLY_LITE,
    tsconfig: LITE_TSCONFIG,
    tsconfigInclude: null,
    tsconfigReferences: LITE_TSCONFIG_REFERENCES,
    tsconfigNode: LITE_TSCONFIG_NODE,
    requiredDeps: REQUIRED_DEPS_LITE,
    requirePrivate: true,
  },
};

// ───────────────────────────────── 工具 ─────────────────────────────────
const R = [];
const add = (level, id, msg) => R.push({ level, id, msg });
const fail = (id, msg) => add('FAIL', id, msg);
const warn = (id, msg) => add('WARN', id, msg);
const info = (id, msg) => add('INFO', id, msg);
const pass = (id) => add('PASS', id, '');

function readText(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
}
function readJson(root, rel) {
  const t = readText(root, rel);
  if (t == null) return null;
  try {
    return JSON.parse(t);
  } catch (e) {
    fail('json-parse', `${rel} 不是合法 JSON：${e.message}`);
    return null;
  }
}
/**
 * 去 JSON 注释（字符串感知）。
 * ⚠️ 不可用正则图省事：tsconfig 里的 `"@/*"` + `"src/**\/*"` 会被朴素正则误判为块注释起止，把 JSON 撕烂。
 */
function stripJsonComments(src) {
  let out = '';
  let inStr = false;
  let quote = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += n ?? '';
        i++;
      } else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      out += c;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** 去掉 JSON 注释后解析（容忍 tsconfig 的 // 与块注释） */
function readJsonLoose(root, rel) {
  const t = readText(root, rel);
  if (t == null) return null;
  try {
    return JSON.parse(stripJsonComments(t.replace(/^\uFEFF/, '')));
  } catch {
    return null;
  }
}

const NODE_RES = new Set(['node', 'node16', 'nodenext']);
const BUNDLER_RES = new Set(['bundler']);
/**
 * tsconfig 值等价比较。
 * ⚠️ 只需对 `moduleResolution` 做大小写 + 同义归一：lite 模板写 `Node`、业务工程常写 `Bundler`，
 *    JSON 直接比会因大小写产生假 WARN。其余键保持严格（`strict: false` ≠ `true` 是实质偏离）。
 */
function tsEq(k, a, b) {
  if (k === 'moduleResolution') {
    const bucket = (x) => {
      const s = String(x ?? '').toLowerCase();
      return NODE_RES.has(s) ? 'node' : BUNDLER_RES.has(s) ? 'bundler' : s;
    };
    return bucket(a) === bucket(b);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

// ───────────────────────────────── 血统判定 ─────────────────────────────────
/**
 * 探测工程血统。单一充分判据：**`tsconfig.node.json` 存在 ⇒ lite**。
 *
 * 依据（均为 2026-09-13 本机实测）：
 *   lite 产物（13 件）必带 `tsconfig.node.json` + `src/vite-env.d.ts` + `pkg.private: true`，
 *     `tsconfig.json` 有 `references: [{path:'./tsconfig.node.json'}]`；
 *   all 产物（193 件）**不含** `tsconfig.node.json`、**不含** `src/vite-env.d.ts`、**不含** `pkg.private`，
 *     环境类型由 `src/types/env.d.ts` + `src/types/globals.d.ts` 承担，`tsconfig.json` 无 `references`。
 *
 * @returns {{lineage:'all'|'lite', evidence:string[]}}
 */
export function detectLineage(root) {
  const has = (p) => fs.existsSync(path.join(root, p));
  if (has('tsconfig.node.json')) {
    return { lineage: 'lite', evidence: ['tsconfig.node.json 存在 → lite（all 恒不生成此文件）'] };
  }
  const evidence = ['tsconfig.node.json 缺失 → all'];
  if (has('src/types/env.d.ts')) evidence.push('src/types/env.d.ts 存在（all 特征）');
  if (has('src/locales/index.ts')) evidence.push('src/locales/index.ts 存在（all 特征）');
  if (has('src/vite-env.d.ts')) evidence.push('src/vite-env.d.ts 存在（lite 特征，与 all 血统冲突）');
  return { lineage: 'all', evidence };
}

// ───────────────────────────────── 校验 ─────────────────────────────────
export function check(root) {
  R.length = 0;
  if (!fs.existsSync(root)) {
    fail('root', `工程目录不存在：${root}`);
    return R;
  }

  const exists = (p) => fs.existsSync(path.join(root, p));

  // 0. 血统判定
  const { lineage, evidence } = detectLineage(root);
  const B = BASELINES[lineage];
  info('lineage', `血统 = ${lineage}（${B.label}）｜依据：${evidence.join('；')}｜基线：${B.cli}`);

  // 1. 骨架文件存在性
  for (const f of B.mustKeep) {
    if (exists(f)) pass(`keep:${f}`);
    else fail(`keep:${f}`, `${lineage} 基线骨架文件缺失：${f}（工程外壳必须保持 td-starter 产物形态）`);
  }

  // 2. 工具链件（all：「完整脚手架」承诺的一部分，缺记 WARN）
  for (const f of B.toolchain) {
    if (exists(f)) pass(`toolchain:${f}`);
    else
      warn(
        `toolchain:${f}`,
        `all 完整脚手架的工具链件缺失：${f}（用户明确要求 all 完整形态；若确为有意裁剪，请在工程 README 声明）`,
      );
  }

  // 3. CLI 演示件 / 上游仓库件（允许缺，记 INFO）
  for (const f of B.demoOnly) {
    if (exists(f)) info(`demo:${f}`, `CLI 演示件 / 上游件仍在：${f}`);
    else info(`demo:${f}`, `CLI 演示件 / 上游件已移除：${f}`);
  }

  // 3b. all 血统专属：上游演示业务代码残留 + lite 形态残留
  if (lineage === 'all') {
    const residue = UPSTREAM_RESIDUE_ALL.filter((f) => exists(f));
    if (residue.length)
      warn(
        'all:upstream-residue',
        `检测到上游演示业务代码残留（${residue.length} 项）：${residue.join(', ')} —— \`-temp all\` 的演示层会与本技能资产同路径打架，须按 SKILL.md「all 模板必删清单」清理。`,
      );
    else pass('all:upstream-residue');

    if (exists('src/vite-env.d.ts'))
      warn(
        'all:stale-vite-env',
        'src/vite-env.d.ts 存在：all 血统用 src/types/env.d.ts 承担环境类型，二者并存易造成 `/// <reference>` 重复声明漂移，建议删除前者。',
      );
    else pass('all:stale-vite-env');
  }

  // 4. package.json 形态
  const pkg = readJson(root, 'package.json');
  if (pkg) {
    if (B.requirePrivate) {
      if (pkg.private === true) pass('pkg:private');
      else fail('pkg:private', 'package.json 缺 `"private": true`（lite 基线形态）');
    } else if (pkg.private === true) {
      pass('pkg:private');
    } else {
      info('pkg:private', 'package.json 无 `"private": true` —— all 模板原始形态；业务工程建议补上（防误 `npm publish`）');
    }

    if (pkg.type === 'module') pass('pkg:type');
    else fail('pkg:type', 'package.json 缺 `"type": "module"`（CLI 基线形态）');

    const build = pkg.scripts?.build ?? '';
    if (build.includes('vue-tsc')) pass('pkg:build');
    else
      fail(
        'pkg:build',
        `scripts.build = "${build}"，CLI 基线形如 "vue-tsc --noEmit && vite build"。缺类型检查会让「编译 0 错误」铁律失守。`,
      );

    const hasTypeEntry = ['typecheck', 'build:type'].some((k) => pkg.scripts?.[k]);
    if (hasTypeEntry) pass('pkg:typecheck');
    else info('pkg:typecheck', 'scripts 无独立类型检查入口（建议补 `"typecheck": "vue-tsc --noEmit"`，便于不构建即校验）');

    for (const [name, why] of Object.entries(FORBIDDEN_SCRIPTS)) {
      if (pkg.scripts?.[name] != null) fail(`pkg:script:${name}`, `scripts.${name} 必须删除。${why}`);
      else pass(`pkg:script:${name}`);
    }

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const missing = B.requiredDeps.filter((d) => !deps[d]);
    if (missing.length === 0) pass('pkg:deps');
    else
      fail(
        'pkg:deps',
        lineage === 'all'
          ? `必需依赖缺失：${missing.join(', ')}`
          : `CLI lite 模板不含、必须补齐的依赖缺失：${missing.join(', ')}`,
      );

    if (lineage === 'all' && exists('src/locales/index.ts')) {
      const lm = LOCALES_DEPS_ALL.filter((d) => !deps[d]);
      if (lm.length) warn('pkg:deps:locales', `保留 src/locales/ 但缺依赖：${lm.join(', ')}（i18n / useLocale 会解析失败）`);
      else pass('pkg:deps:locales');
    }

    if (deps['vite-svg-loader']) {
      const cfg = readText(root, 'vite.config.ts') || '';
      if (!cfg.includes('vite-svg-loader'))
        warn(
          'pkg:vite-svg-loader',
          '依赖含 `vite-svg-loader` 但 `vite.config.ts` 未注册该插件 —— CLI 自身即如此（属死依赖）；保留不影响运行，可删。',
        );
    }
  }

  // 5. tsconfig.json 形态
  //    ① 结构性契约（paths / references）→ FAIL；② 编译策略（target/module/…/include）→ WARN。
  const ts = readJsonLoose(root, 'tsconfig.json');
  if (ts?.compilerOptions) {
    const co = ts.compilerOptions;

    const paths = co.paths ?? {};
    if (paths['@/*']) pass('tsconfig:paths');
    else
      fail(
        'tsconfig:paths',
        `tsconfig.json 缺 \`paths: { "@/*": ["src/*"] }\`（C1 必要补丁，否则 \`@/\` 导入全报 TS2307）；当前 paths = ${JSON.stringify(paths)}`,
      );

    if (B.tsconfigReferences) {
      const refs = JSON.stringify(ts.references);
      if (refs === JSON.stringify(B.tsconfigReferences)) pass('tsconfig:references');
      else
        fail(
          'tsconfig:references',
          `tsconfig.json references 偏离 ${lineage} 基线：${refs}（基线为 ${JSON.stringify(B.tsconfigReferences)}）`,
        );
    } else if (ts.references == null || (Array.isArray(ts.references) && ts.references.length === 0)) {
      pass('tsconfig:references');
    } else {
      fail(
        'tsconfig:references',
        `all 血统 tsconfig.json 不应有 references（实测模板无此键），当前为 ${JSON.stringify(ts.references)} —— 出现即说明混入了 lite 形态（all 用单一 tsconfig，无 project references）。`,
      );
    }

    const diff = [];
    for (const [k, v] of Object.entries(B.tsconfig)) {
      if (!tsEq(k, co[k], v)) diff.push(`${k}: ${JSON.stringify(co[k])} ≠ 基线 ${JSON.stringify(v)}`);
    }
    const extra = Object.keys(co).filter((k) => !(k in B.tsconfig) && !TSCONFIG_PATCH_KEYS.has(k));
    const incBad = B.tsconfigInclude != null && JSON.stringify(ts.include) !== JSON.stringify(B.tsconfigInclude);
    if (diff.length || extra.length || incBad) {
      warn(
        'tsconfig:strategy',
        `tsconfig.json 编译策略偏离 ${lineage} 基线（允许，但须在工程 README 显式声明）——` +
          [diff.join('; '), extra.length ? `额外键: ${extra.join(', ')}` : '', incBad ? `include: ${JSON.stringify(ts.include)}` : '']
            .filter(Boolean)
            .join(' | '),
      );
    } else {
      pass('tsconfig:strategy');
    }

    if (lineage === 'all' && co.noEmit !== true)
      warn('tsconfig:noEmit', 'all 血统 tsconfig.compilerOptions.noEmit 应为 true（模板取值；vue-tsc 只做检查不产 d.ts）');
  } else {
    fail('tsconfig', 'tsconfig.json 缺失或无法解析（JSONC 语法错误？）');
  }

  // 6. tsconfig.node.json —— lite 必需 / all 必须不存在
  if (B.tsconfigNode) {
    const tsn = readJsonLoose(root, 'tsconfig.node.json');
    if (tsn?.compilerOptions) {
      const bad = Object.entries(B.tsconfigNode).filter(
        ([k, v]) => JSON.stringify(tsn.compilerOptions[k]) !== JSON.stringify(v),
      );
      if (bad.length)
        warn(
          'tsconfig.node:strategy',
          `tsconfig.node.json 编译策略偏离基线（允许，但须声明）：${bad.map(([k, v]) => `${k} ≠ ${JSON.stringify(v)}`).join('; ')}`,
        );
      else pass('tsconfig.node:strategy');
    } else {
      fail('tsconfig.node', 'tsconfig.node.json 缺失或无法解析');
    }
  } else {
    pass('tsconfig.node');
  }

  // 7. index.html 骨架
  const html = readText(root, 'index.html');
  if (html) {
    const need = [
      [/<div id="app"><\/div>/, '`<div id="app"></div>` 挂载点'],
      [/<script[^>]+type="module"[^>]+src="\/src\/main\.ts"/, '`<script type="module" src="/src/main.ts">`'],
    ];
    const miss = need.filter(([re]) => !re.test(html)).map(([, d]) => d);
    if (miss.length) fail('index.html:shell', `index.html 缺 ${miss.join('、')}`);
    else pass('index.html:shell');

    if (/<link[^>]+rel="icon"[^>]+href="\/favicon\.ico"/.test(html)) pass('index.html:favicon');
    else
      fail(
        'index.html:favicon',
        'index.html 缺 `<link rel="icon" href="/favicon.ico" />`（CLI 基线自带；缺失 = 浏览器对 /favicon.ico 报 404）',
      );
  } else {
    fail('index.html:shell', 'index.html 缺失');
  }

  // 8. src/main.ts 外壳
  const main = readText(root, 'src/main.ts');
  if (main) {
    if (main.includes('createApp(') && main.includes('.mount(')) pass('main:shell');
    else fail('main:shell', 'src/main.ts 未保持 `createApp(App)...mount()` 外壳形态');
    if (main.includes('.use(TDesign)')) pass('main:tdesign');
    else fail('main:tdesign', 'src/main.ts 未 `app.use(TDesign)`（TDesign 全局组件不生效）');
  } else {
    fail('main:shell', 'src/main.ts 缺失');
  }

  // 9. vite.config.ts 的 `@` 别名 + plugin-vue + rolldown 废弃 API
  const vite = readText(root, 'vite.config.ts');
  if (vite) {
    if (vite.includes('alias') && /'@'|"@"/.test(vite)) pass('vite:alias');
    else fail('vite:alias', 'vite.config.ts 缺 `@` 别名（与 tsconfig.paths 必须成对，否则 dev 解析失败）');
    if (/'@vitejs\/plugin-vue'|"@vitejs\/plugin-vue"/.test(vite)) pass('vite:plugin-vue');
    else fail('vite:plugin-vue', 'vite.config.ts 未挂 `@vitejs/plugin-vue`');

    // all 血统用 vite@8（rolldown）：对象式 manualChunks 已废弃 → 必须改 codeSplitting.groups
    if (lineage === 'all') {
      if (/manualChunks\s*:\s*\{/.test(vite))
        warn(
          'vite:manualChunks',
          'vite.config.ts 使用对象式 `manualChunks`：vite@8 / rolldown 下该字段只剩函数形式（注释明示 "object form is not supported"），' +
            '写对象会 TS2322 且运行时被静默忽略；对象式分包须改用 `build.rolldownOptions.output.codeSplitting.groups`。',
        );
      else pass('vite:manualChunks');
    }
  } else {
    fail('vite:alias', 'vite.config.ts 缺失');
  }

  // 10. CLI 演示 SVG 若已删除，不得仍有引用
  const appVue = readText(root, 'src/App.vue');
  if (appVue) {
    const dangling = [];
    if (!exists('public/tdesign-logo.svg') && /tdesign-logo\.svg/.test(appVue)) dangling.push('public/tdesign-logo.svg');
    if (!exists('src/assets/svg/vite-logo.svg') && /vite-logo\.svg/.test(appVue)) dangling.push('src/assets/svg/vite-logo.svg');
    if (dangling.length) fail('app:dangling-svg', `src/App.vue 仍引用已删除的 CLI 演示资源：${dangling.join(', ')}`);
    else pass('app:dangling-svg');

    if (/<router-view/.test(appVue)) pass('app:router-view');
    else info('app:router-view', 'src/App.vue 未见 `<router-view>` —— 若这是 CLI 未替换的演示 App.vue，属未声明偏差');
  }

  return R;
}

// ───────────────────────────────── CLI ─────────────────────────────────
function printOneBaseline(B) {
  console.log(`\n━━━━━━━━━━ 基线 ${B.id.toUpperCase()}（${B.label}）━━━━━━━━━━`);
  console.log(`CLI：tdesign-starter-cli v0.5.3 / \`${B.cli}\``);
  console.log(`实测产物 ${B.productsCount} 项${B.id === 'all' ? '（此处仅列结构骨架项）' : ''}：`);
  B.products.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${f}`));

  console.log('\n工程骨架（必须保留，缺一 → FAIL）:');
  B.mustKeep.forEach((f) => console.log(`   · ${f}`));

  if (B.toolchain.length) {
    console.log('\n工具链件（all「完整脚手架」承诺，缺一 → WARN）:');
    B.toolchain.forEach((f) => console.log(`   · ${f}`));
  }

  console.log('\nCLI 演示件 / 上游件（可删，删了即「已声明偏差」→ INFO）:');
  B.demoOnly.forEach((f) => console.log(`   · ${f}`));

  if (B.id === 'all') {
    console.log('\n上游演示业务代码残留探针（命中 → WARN，须按必删清单清理）:');
    UPSTREAM_RESIDUE_ALL.forEach((f) => console.log(`   · ${f}`));
  }
}

function printManifest() {
  console.log('tdesign-starter-cli v0.5.3 —— 双基线清单（实测于 2026-09-13）');
  console.log('血统判据：tsconfig.node.json 存在 ⇒ lite；缺失 ⇒ all。');
  printOneBaseline(BASELINES.all);
  printOneBaseline(BASELINES.lite);

  console.log('\n━━━━━━━━━━ 两基线共用 ━━━━━━━━━━');
  console.log('\n必须删除:');
  Object.entries(FORBIDDEN_SCRIPTS).forEach(([k, why]) => console.log(`   · scripts.${k} —— ${why}`));
  console.log('\n必须补齐:');
  console.log(`   · all  → ${REQUIRED_DEPS_ALL.join(' / ')}`);
  console.log(`   · lite → ${REQUIRED_DEPS_LITE.join(' / ')}（模板不含，不补跑不起来）`);
  console.log('\n结构性契约（两基线同，缺一 → FAIL）:');
  console.log('   · tsconfig.paths["@/*"] = ["src/*"]');
  console.log('   · vite.config.ts alias "@" + @vitejs/plugin-vue');
  console.log('   · index.html #app 挂载点 + /src/main.ts + /favicon.ico');
  console.log('   · src/main.ts createApp(...).mount(...) + .use(TDesign)');
  console.log('   · scripts.build 含 vue-tsc');
  console.log(`   · lite references = ${JSON.stringify(LITE_TSCONFIG_REFERENCES)}（all 反之：必须无 references）`);
}

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
  // --out <file>：报告落盘（Windows 终端可能吞掉 stdout，此时只能靠文件读结果）
  const outIdx = process.argv.findIndex((a) => a === '--out' || a.startsWith('--out='));
  const outFile = outIdx < 0 ? null : process.argv[outIdx].includes('=') ? process.argv[outIdx].split('=')[1] : process.argv[outIdx + 1];
  if (outFile) {
    // 必须**同步**写：本脚本全程同步执行并以 process.exit() 收尾，
    // 异步流（createWriteStream）的 open() 还没完成进程就退出了 —— 文件根本不会生成。
    try {
      fs.writeFileSync(outFile, '');
    } catch (e) {
      console.error(`无法写入 --out 文件：${outFile}（${e.message}）`);
    }
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...rest) => {
      try {
        fs.appendFileSync(outFile, typeof chunk === 'string' ? chunk : String(chunk));
      } catch {}
      return orig(chunk, ...rest);
    };
  }
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== outFile);
  if (process.argv.includes('--manifest')) {
    printManifest();
    process.exit(0);
  }
  const root = path.resolve(args[0] || path.join(SKILL_ROOT, 'references', 'scaffold'));
  const results = check(root);
  const lineage = results.find((r) => r.id === 'lineage');

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ root, lineage: detectLineage(root), results }, null, 2));
  } else {
    const icon = { FAIL: '✗ FAIL', WARN: '! WARN', PASS: '· pass', INFO: 'i info' };
    console.log(`td-starter 对齐校验：${root}`);
    if (lineage) console.log(`   ${lineage.msg}\n`);
    for (const r of results) {
      if (r.level === 'PASS') continue;
      console.log(`  ${icon[r.level]}  [${r.id}] ${r.msg}`);
    }
    const n = { FAIL: 0, WARN: 0, PASS: 0, INFO: 0 };
    results.forEach((r) => n[r.level]++);
    console.log(`\n  通过 ${n.PASS} · 不一致 ${n.FAIL} · 提醒 ${n.WARN} · 已声明偏差 ${n.INFO}`);
    console.log(n.FAIL ? '\n结论：未对齐（FAIL > 0）' : '\n结论：已对齐 CLI 基线（无 FAIL）');
  }
  const fails = results.filter((r) => r.level === 'FAIL').length;
  process.exit(fails ? 1 : 0);
}
