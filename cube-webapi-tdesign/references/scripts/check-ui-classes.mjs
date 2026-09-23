#!/usr/bin/env node
/**
 * check-ui-classes.mjs —— 「悬空形态类」闸门：模板引用了、却没有任何样式定义的类。
 *
 * ── 为什么需要它（真实事故）────────────────────────────────────────────────
 * 2026-09-23 在一个门户工程的可视验收里发现：`pages/PortalView.vue` 的两个区块写的是
 * `class="pv-grid pv-grid--lg"`、`class="pv-section__title"`，而 **`.pv-grid` 连
 * `display:grid` 都没有、`.pv-section__title` 根本没有规则** —— 于是：
 *   · 「最近使用 / 常用应用」的卡片被当成 block 撑满整行（本该是 4 列网格）；
 *   · 区块标题退化成浏览器默认 `h3`，与「全部应用」的标题样式不一致。
 * 这类缺陷**编译通过、类型检查通过、TDesign 组件也不报错**，靠单元测试更测不出来 ——
 * 上一轮只有「截图逐页看」才逮到。而它本质是纯静态可判的：**类名用了，规则不在**。
 *
 * ── 判据与噪声控制 ─────────────────────────────────────────────────────────
 * 1. 只看 `<template>` 里出现在 `class="…"` / `:class="…"` 中的**字符串字面量**；
 * 2. 只查含 `-` 且**非** TDesign 自有类（`t-*`）与非状态类（`is-/has-/js-/el-/v-`）的 token
 *    —— 这两类不是本技能的资产，定义了也查不到；
 * 3. 含 `${` 的 `:class` 整体跳过（运行时拼接，静态判不了）；
 * 4. 定义判定 = 在**任何** `.vue` 的 `<style>`、或 `.less/.css/.scss` 里出现 `.token` 且
 *    后接 空白 / `{` / `,` / `:` / `>` / `~` / `[` / `]` / `+` / `-`；
 * 5. `PROJECT_ROOT_HOOKS` 白名单收纳**已知良性根类**（只作语义包裹层、样式落在子元素上，
 *    如 `rme-bit` 的样式写在 `.rme-bits :deep(.t-checkbox)`）。白名单必须**给理由**，
 *    且自带腐化检测：若某条目旁边出现了 `.条目` 规则，说明它已被赋样式，应从表里移除。
 *
 * ⚠️ 本闸门**判不了**「样式写错了」（`.pv-grid{display:flex}` 同样是错的），只判「有没有」。
 *    它把「本该有样式的类名漏了规则」这种低级但隐蔽的错误变成红灯，仅此而已。
 *
 * 用法：
 *   node check-ui-classes.mjs <工程目录>
 *   node check-ui-classes.mjs <工程目录> --out r.txt
 *   node check-ui-classes.mjs <工程目录> --list-hooks    # 只打印白名单
 *
 * 退出码：0 = 无悬空类（或仅剩白名单命中）；1 = 存在未登记的悬空类；2 = 用法错误。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = process.env.SKILL_DIR || path.resolve(HERE, '..', '..');

/**
 * 已知良性「根类 / 包裹类」：模板里挂了名字，但**样式本就该落在子元素或自身无视觉**
 * ——它们出现在报告里只会淹没真问题。每条必须写清理由；改名/删文件后应移除。
 * 自带腐化检测：若哪天有人真给它们写了规则，会报 HOOKS-STALE 提示清理。
 */
const PROJECT_ROOT_HOOKS = new Map([
  ['entity-page', 'EntityPage.vue 根容器：仅作布局占位，实际排布交给内层 ListPage/FormDialog'],
  ['db-view', 'DbView.vue 根容器：仅作语义锚点，卡片与表格自带样式'],
  ['file-view', 'FileView.vue 根容器：同上'],
  ['server-info', 'ServerInfoView.vue 根容器：同上'],
  ['widget-view', 'WidgetBoardView.vue 根容器：同上'],
  ['setting-drawer', 'SettingPanel.vue 根容器：排版由 TDesign Drawer 与内层表单承担'],
  ['rme-bit', 'RoleMenuEditor.vue 单个权限位的包裹 span：视觉落在子元素 `.t-checkbox`（见 `.rme-bits :deep(.t-checkbox)`）'],
]);

const SKIP_PREFIXES = ['t-', 'is-', 'has-', 'js-', 'el-', 'v-', 'a-', 'n-', 'd-'];
const STYLE_EXT = new Set(['.less', '.css', '.scss', '.sass']);
const VUE_EXT = new Set(['.vue']);

const toPosix = (p) => p.split(path.sep).join('/');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const CLASS_ATTR = /(?::class|class)\s*=\s*"([^"]*)"/gs;
const TOKEN = /[A-Za-z][A-Za-z0-9_-]*/g;

/**
 * 取出 SFC 的**整个** `<template>` 块（含嵌套 `<template v-if>`）。
 *
 * ⚠️ 踩过的坑：最初写成 `/<template>([\s\S]*?)<\/template>/`（非贪婪），
 * 结果在嵌套模板处提前收尾 —— 只扫到根模板的前一小段，后面的区块**静默漏检**。
 * 反向测试（注入一个悬空类应当转红）当场把它暴露出来：注入后依然 exit=0。
 * 故这里按**标签配对**取块，不再依赖贪婪/非贪婪的运气。
 */
function templateOf(src) {
  const TAG = /<(\/?)template(\s[^>]*)?>/g;
  let start = -1;
  let depth = 0;
  for (const m of src.matchAll(TAG)) {
    const closing = m[1] === '/';
    if (start < 0) {
      if (closing) continue; // 出现在首个开标签之前，忽略
      start = m.index + m[0].length;
      depth = 1;
      continue;
    }
    depth += closing ? -1 : 1;
    if (depth === 0) return src.slice(start, m.index);
  }
  return start >= 0 ? src.slice(start) : null;
}

function classesUsedIn(html) {
  const used = new Set();
  for (const m of html.matchAll(CLASS_ATTR)) {
    const attr = m[1];
    if (attr.includes('${')) continue; // 运行时拼接，静态判不了
    for (const piece of attr.matchAll(/'([^']*)'|"([^"]*)"|([A-Za-z][\w-]*)/g)) {
      const s = piece[1] || piece[2] || piece[3] || '';
      for (const t of s.match(TOKEN) || []) {
        if (t.includes('-') && !SKIP_PREFIXES.some((p) => t.startsWith(p))) used.add(t);
      }
    }
  }
  return used;
}

function isDefined(tok, styles) {
  return new RegExp('\\.' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s,{:>~\\[\\]+-])').test(styles);
}

function emit(lines, outFile) {
  console.log(lines.join('\n'));
  if (outFile) fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
}

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  console.log('用法: node check-ui-classes.mjs <工程目录> [--out r.txt] [--list-hooks]');
  process.exit(0);
}
if (argv.includes('--list-hooks')) {
  emit([...PROJECT_ROOT_HOOKS].map(([k, v]) => `${k.padEnd(16)} ${v}`), null);
  process.exit(0);
}
const outIdx = argv.findIndex((a) => a === '--out' || a.startsWith('--out='));
const outFile = outIdx >= 0 ? (argv[outIdx].includes('=') ? argv[outIdx].split('=')[1] : argv[outIdx + 1]) : null;
if (outIdx >= 0 && !outFile) {
  console.error('--out 需要文件路径');
  process.exit(2);
}
const target = argv.find((a, i) => !a.startsWith('-') && (outIdx < 0 || i !== outIdx + 1));
if (!target) {
  console.error('用法: node check-ui-classes.mjs <工程目录> [--out r.txt]');
  process.exit(2);
}

const SRC = fs.existsSync(path.join(target, 'src')) ? path.join(target, 'src') : target;
if (!fs.existsSync(SRC)) {
  console.error(`工程目录不存在：${SRC}`);
  process.exit(2);
}

const files = walk(SRC);
const vueFiles = files.filter((f) => VUE_EXT.has(path.extname(f).toLowerCase()));
const styleFiles = files.filter((f) => STYLE_EXT.has(path.extname(f).toLowerCase()));

// 样式来源 = 独立样式文件 + 各 .vue 的 <style> 块（scoped 也算——类名仍是同一个类名）
let styles = styleFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
for (const f of vueFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styles += '\n' + m[1];
}

const dangling = [];
for (const f of vueFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const tpl = templateOf(src);
  if (!tpl) continue;
  const missing = [...classesUsedIn(tpl)].filter((t) => !isDefined(t, styles)).sort();
  if (missing.length) dangling.push({ file: toPosix(path.relative(SRC, f)), missing });
}

const hooksStale = [...PROJECT_ROOT_HOOKS.keys()].filter((h) => isDefined(h, styles));

const bad = [];
const known = [];
for (const d of dangling) {
  for (const t of d.missing) (PROJECT_ROOT_HOOKS.has(t) ? known : bad).push(`${d.file}  ${t}`);
}

const L = [];
L.push(`UI 悬空类校验：${SRC}`);
L.push(`  扫描 ${vueFiles.length} 个 .vue（样式来源：${styleFiles.length} 个样式文件 + 各 .vue 的 <style>）`);
L.push('');
if (bad.length) {
  L.push(`✗ 悬空形态类（${bad.length}）—— 模板引用了类名，但工程内没有任何对应规则：`);
  bad.forEach((x) => L.push(`    ${x}`));
  L.push('  这类类名**不报编译错、不影响类型**，只表现为「样式莫名不对」；');
  L.push('  请二选一：补规则，或删掉这个类名（别留一个看起来有样式的空壳）。');
  L.push('');
}
if (known.length) {
  L.push(`· 已知良性根类（${known.length}，白名单命中，不计失败）:`);
  known.forEach((x) => L.push(`    ${x}    ← ${PROJECT_ROOT_HOOKS.get(x.split(/\s+/).pop())}`));
  L.push('');
}
if (hooksStale.length) {
  L.push(`⚠ HOOKS-STALE：下列白名单条目**已有规则**，应改由闸门正常校验 → 从 PROJECT_ROOT_HOOKS 移除：`);
  hooksStale.forEach((h) => L.push(`    ${h}`));
  L.push('');
}
L.push(bad.length ? `结论：${bad.length} 个未登记的悬空类 → 需人工处置` : '结论：无悬空形态类 ✅');

emit(L, outFile);
process.exit(bad.length ? 1 : 0);
