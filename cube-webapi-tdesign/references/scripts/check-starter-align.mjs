#!/usr/bin/env node
/**
 * check-starter-align.mjs —— tdesign-starter CLI 基线对齐校验
 *
 * 用途：校验一个前端工程是否仍是 **tdesign-starter-cli 产物形态**（即铁律 C1「必须由 tdesign-starter 初始化」可验证），
 *       并检出所有「未声明的偏差」。技能内三套工程副本（references/scaffold、references/demo）与
 *       真实业务工程都可拿它做体检。
 *
 * 用法：
 *   node check-starter-align.mjs                      # 默认检查 references/scaffold
 *   node check-starter-align.mjs <工程目录>            # 检查指定工程
 *   node check-starter-align.mjs <工程目录> --json     # 输出 JSON（CI 用）
 *   node check-starter-align.mjs --manifest           # 打印 CLI 基线清单（人工核对用）
 *
 * 退出码：0 = 无 FAIL；1 = 有 FAIL。
 *
 * 三层判据：
 *   FAIL —— 工程骨架 / 构建契约被破坏，**必须修**（缺骨架文件、build 不做类型检查、存在 `prepare`、
 *           缺 `vue-router|pinia|axios`、缺 `@` 别名、index.html 缺 favicon/挂载点、main.ts 缺外壳）。
 *   WARN —— 「工程选择」级偏离（tsconfig 编译策略、`vite-svg-loader` 死依赖等）：**允许，但必须在工程
 *           README 显式声明**，否则下次对齐时无从判断是「有意」还是「漏了」。
 *   INFO —— CLI 演示件（`tdesign-logo.svg` / `vite-logo.svg` / `.npmignore` / `App.vue`）的存在或移除，
 *           移除即「已声明偏差」，不扣分。
 *
 * 基线来源：`td-starter init <名> -type vue3 -bt vite -temp lite`（tdesign-starter-cli v0.5.3，2026-09-13 实测）
 *   ⚠️ CLI 会自行 `git init`，且其 `package.json` 带一条 `prepare` 脚本调用**未声明的** `is-ci` / `husky`
 *      → 实测 `npm run prepare` exit=1 → **`npm install` 必然失败**。故「有 prepare」= FAIL。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..', '..');

// ───────────────────────────── CLI 基线清单（实测） ─────────────────────────────
/** CLI `-temp lite` 的全部产物（相对工程根） */
export const CLI_PRODUCTS = [
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

/** 基线中属于「工程骨架」——目标工程**必须存在**，缺一即 FAIL */
const MUST_KEEP = [
  'index.html',
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'public/favicon.ico',
  'src/main.ts',
  'src/vite-env.d.ts',
];

/** 基线中属于「CLI 演示内容」——允许删除，但删除即视为「已声明偏差」，仅记 INFO */
const DEMO_ONLY = ['.npmignore', 'README.md', 'public/tdesign-logo.svg', 'src/assets/svg/vite-logo.svg', 'src/App.vue'];

/** CLI `tsconfig.json` 的 compilerOptions（仅作对照参考——差异记 WARN 而非 FAIL，见下「三层判据」） */
const CLI_TSCONFIG = {
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

/** 允许的 tsconfig 补丁键（C1 补丁白名单）；其余差异记 WARN 并要求「显式声明」 */
const TSCONFIG_PATCH_KEYS = new Set(['baseUrl', 'paths']);

/** CLI `tsconfig.node.json` 全文（差异记 WARN） */
const CLI_TSCONFIG_NODE = {
  composite: true,
  module: 'ESNext',
  moduleResolution: 'Node',
  allowSyntheticDefaultImports: true,
};

/** 必要补丁：CLI lite 模板不含，不补则 router/pinia/请求层直接跑不起来 */
const REQUIRED_DEPS = ['vue-router', 'pinia', 'axios'];

/** 禁止出现在 scripts 中的脚本 → 原因 */
const FORBIDDEN_SCRIPTS = {
  prepare:
    '实测致命：CLI 的 prepare 调 `is-ci`/`husky`，二者不在 dependencies 中 → `npm install` 必然 exit=1（CLI 会自行 git init，使脚本走 husky 分支）。必须删除。',
};

// ───────────────────────────────── 工具 ─────────────────────────────────
const R = []; // 结果
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
  // 容忍尾随逗号
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** 去掉 JSON 注释后解析（容忍 tsconfig 的 // 与 块注释） */
function readJsonLoose(root, rel) {
  const t = readText(root, rel);
  if (t == null) return null;
  try {
    return JSON.parse(stripJsonComments(t.replace(/^\uFEFF/, '')));
  } catch {
    return null;
  }
}

// ───────────────────────────────── 校验 ─────────────────────────────────
export function check(root) {
  R.length = 0;
  if (!fs.existsSync(root)) {
    fail('root', `工程目录不存在：${root}`);
    return R;
  }

  // 1. 骨架文件存在性
  for (const f of MUST_KEEP) {
    if (fs.existsSync(path.join(root, f))) pass(`keep:${f}`);
    else fail(`keep:${f}`, `CLI 基线骨架文件缺失：${f}（工程外壳必须保持 td-starter 产物形态）`);
  }

  // 2. CLI 演示内容（允许缺，记 INFO）
  for (const f of DEMO_ONLY) {
    if (fs.existsSync(path.join(root, f))) info(`demo:${f}`, `CLI 演示件仍在：${f}`);
    else info(`demo:${f}`, `CLI 演示件已移除：${f}`);
  }

  // 3. package.json 形态
  const pkg = readJson(root, 'package.json');
  if (pkg) {
    if (pkg.private === true) pass('pkg:private');
    else fail('pkg:private', 'package.json 缺 `"private": true`（CLI 基线形态）');

    if (pkg.type === 'module') pass('pkg:type');
    else fail('pkg:type', 'package.json 缺 `"type": "module"`（CLI 基线形态）');

    const build = pkg.scripts?.build ?? '';
    if (build.includes('vue-tsc')) pass('pkg:build');
    else
      fail(
        'pkg:build',
        `scripts.build = "${build}"，CLI 基线为 "vue-tsc --noEmit && vite build"。缺类型检查会让编译 0 错误铁律失守。`,
      );

    for (const [name, why] of Object.entries(FORBIDDEN_SCRIPTS)) {
      if (pkg.scripts?.[name] != null) fail(`pkg:script:${name}`, `scripts.${name} 必须删除。${why}`);
      else pass(`pkg:script:${name}`);
    }

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const missing = REQUIRED_DEPS.filter((d) => !deps[d]);
    if (missing.length === 0) pass('pkg:deps');
    else fail('pkg:deps', `CLI lite 模板不含、必须补齐的依赖缺失：${missing.join(', ')}`);

    if (deps['vite-svg-loader']) {
      const cfg = readText(root, 'vite.config.ts') || '';
      if (!cfg.includes('vite-svg-loader'))
        warn(
          'pkg:vite-svg-loader',
          '依赖含 `vite-svg-loader` 但 `vite.config.ts` 未注册该插件 —— CLI v0.5.3 自身即如此（属死依赖）；保留不影响运行，可删。',
        );
    }
  }

  // 4. tsconfig.json 形态
  //    三层判据：① 结构性契约（paths/references）→ FAIL；② 编译策略（target/module/moduleResolution/lib/额外键/include）→ WARN，允许按 Vite 最佳实践偏离，但必须显式声明。
  const ts = readJsonLoose(root, 'tsconfig.json');
  if (ts?.compilerOptions) {
    const co = ts.compilerOptions;

    const paths = co.paths ?? {};
    if (paths['@/*']) pass('tsconfig:paths');
    else fail('tsconfig:paths', 'tsconfig.json 缺 `paths: { "@/*": ["src/*"] }`（C1 必要补丁，否则 `@/` 导入全报 TS2307）');

    const refs = JSON.stringify(ts.references);
    if (refs === JSON.stringify([{ path: './tsconfig.node.json' }])) pass('tsconfig:references');
    else fail('tsconfig:references', `tsconfig.json references 偏离基线：${refs}（CLI 基线为 [{path:"./tsconfig.node.json"}]）`);

    const diff = [];
    for (const [k, v] of Object.entries(CLI_TSCONFIG)) {
      if (JSON.stringify(co[k]) !== JSON.stringify(v)) diff.push(`${k}: ${JSON.stringify(co[k])} ≠ 基线 ${JSON.stringify(v)}`);
    }
    const extra = Object.keys(co).filter((k) => !(k in CLI_TSCONFIG) && !TSCONFIG_PATCH_KEYS.has(k));
    const incBad = JSON.stringify(ts.include) !== JSON.stringify(['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.vue']);
    if (diff.length || extra.length || incBad) {
      warn(
        'tsconfig:strategy',
        `tsconfig.json 编译策略偏离 CLI 基线（允许，但须在工程 README 显式声明）——` +
          [diff.join('; '), extra.length ? `额外键: ${extra.join(', ')}` : '', incBad ? `include: ${JSON.stringify(ts.include)}` : '']
            .filter(Boolean)
            .join(' | '),
      );
    } else {
      pass('tsconfig:strategy');
    }
  } else {
    fail('tsconfig', 'tsconfig.json 缺失或无法解析（JSONC 语法错误？）');
  }

  // 5. tsconfig.node.json 形态（编译策略，WARN 级）
  const tsn = readJsonLoose(root, 'tsconfig.node.json');
  if (tsn?.compilerOptions) {
    const bad = Object.entries(CLI_TSCONFIG_NODE).filter(([k, v]) => JSON.stringify(tsn.compilerOptions[k]) !== JSON.stringify(v));
    if (bad.length)
      warn(
        'tsconfig.node:strategy',
        `tsconfig.node.json 编译策略偏离基线（允许，但须声明）：${bad.map(([k, v]) => `${k} ≠ ${JSON.stringify(v)}`).join('; ')}`,
      );
    else pass('tsconfig.node:strategy');
  } else {
    fail('tsconfig.node', 'tsconfig.node.json 缺失或无法解析');
  }

  // 6. index.html 骨架
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

  // 7. src/main.ts 外壳
  const main = readText(root, 'src/main.ts');
  if (main) {
    if (main.includes('createApp(') && main.includes('.mount(')) pass('main:shell');
    else fail('main:shell', 'src/main.ts 未保持 `createApp(App)...mount()` 外壳形态');
    if (main.includes('.use(TDesign)')) pass('main:tdesign');
    else fail('main:tdesign', 'src/main.ts 未 `app.use(TDesign)`（TDesign 全局组件不生效）');
  } else {
    fail('main:shell', 'src/main.ts 缺失');
  }

  // 8. vite.config.ts 的 `@` 别名（C1 必要补丁）
  const vite = readText(root, 'vite.config.ts');
  if (vite) {
    if (vite.includes('alias') && /'@'|"@"/.test(vite)) pass('vite:alias');
    else fail('vite:alias', 'vite.config.ts 缺 `@` 别名（与 tsconfig.paths 必须成对，否则 dev 解析失败）');
    if (/'@vitejs\/plugin-vue'|"@vitejs\/plugin-vue"/.test(vite)) pass('vite:plugin-vue');
    else fail('vite:plugin-vue', 'vite.config.ts 未挂 `@vitejs/plugin-vue`');
  } else {
    fail('vite:alias', 'vite.config.ts 缺失');
  }

  // 9. CLI 演示 SVG 若已删除，不得仍有引用
  const appVue = readText(root, 'src/App.vue');
  if (appVue) {
    const dangling = [];
    if (!fs.existsSync(path.join(root, 'public/tdesign-logo.svg')) && /tdesign-logo\.svg/.test(appVue))
      dangling.push('public/tdesign-logo.svg');
    if (!fs.existsSync(path.join(root, 'src/assets/svg/vite-logo.svg')) && /vite-logo\.svg/.test(appVue))
      dangling.push('src/assets/svg/vite-logo.svg');
    if (dangling.length) fail('app:dangling-svg', `src/App.vue 仍引用已删除的 CLI 演示资源：${dangling.join(', ')}`);
    else pass('app:dangling-svg');

    if (/<router-view/.test(appVue)) pass('app:router-view');
    else info('app:router-view', 'src/App.vue 未见 `<router-view>` —— 若这是 CLI 未替换的演示 App.vue，属未声明偏差');
  }

  return R;
}

// ───────────────────────────────── CLI ─────────────────────────────────
function printManifest() {
  console.log('tdesign-starter-cli v0.5.3 / `-type vue3 -bt vite -temp lite` 实测产物（13 项）：\n');
  CLI_PRODUCTS.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${f}`));
  console.log('\n工程骨架（必须保留）:');
  MUST_KEEP.forEach((f) => console.log(`   · ${f}`));
  console.log('\nCLI 演示内容（可删，删了即「已声明偏差」）:');
  DEMO_ONLY.forEach((f) => console.log(`   · ${f}`));
  console.log('\n必须删除:');
  Object.entries(FORBIDDEN_SCRIPTS).forEach(([k, why]) => console.log(`   · scripts.${k} —— ${why}`));
  console.log('\n必须补齐（lite 模板不含）:');
  REQUIRED_DEPS.forEach((d) => console.log(`   · ${d}`));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (process.argv.includes('--manifest')) {
    printManifest();
    process.exit(0);
  }
  const root = path.resolve(args[0] || path.join(SKILL_ROOT, 'references', 'scaffold'));
  const results = check(root);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ root, results }, null, 2));
  } else {
    const icon = { FAIL: '✗ FAIL', WARN: '! WARN', PASS: '· pass', INFO: 'i info' };
    console.log(`td-starter 对齐校验：${root}\n`);
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
