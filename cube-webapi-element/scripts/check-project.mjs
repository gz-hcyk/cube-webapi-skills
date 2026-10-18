#!/usr/bin/env node
/**
 * 工程闸门：把「铁律违反」变成机器可判的退出码。
 *
 *   node scripts/check-project.mjs <工程目录>
 *
 * 退出码 0 = 无 FAIL（WARN 需逐条确认）；1 = 存在 FAIL。
 * 只读工程，不修改任何文件。
 */
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.argv[2] || '.');
const results = [];
let failed = 0;
let warned = 0;

const c = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};

function record(level, title, detail = '') {
  results.push({ level, title, detail });
  if (level === 'FAIL') failed++;
  if (level === 'WARN') warned++;
}

const pass = (title, detail) => record('PASS', title, detail);
const fail = (title, detail) => record('FAIL', title, detail);
const warn = (title, detail) => record('WARN', title, detail);

function abs(rel) {
  return path.join(target, rel);
}

function exists(rel) {
  try {
    return fs.existsSync(abs(rel));
  } catch {
    return false;
  }
}

function read(rel) {
  try {
    return fs.readFileSync(abs(rel), 'utf8');
  } catch {
    return '';
  }
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vite', 'coverage']);

function walk(rel = 'src', out = []) {
  const dir = abs(rel);
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(rel, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) walk(child, out);
    else if (/\.(ts|tsx|vue|js|mjs)$/.test(entry.name)) out.push(child);
  }
  return out;
}

function grep(files, pattern) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'm');
  return files.filter((f) => re.test(read(f)));
}

function count(files, pattern) {
  return grep(files, pattern).length;
}

/* ============================ 1. 脚手架骨架 ============================ */

if (!fs.existsSync(target)) {
  console.error(`目录不存在：${target}`);
  process.exit(1);
}

const SKELETON = [
  'package.json',
  'vite.config.ts',
  'index.html',
  'src/main.ts',
  'src/App.vue',
  'src/router/index.ts',
];

const missing = SKELETON.filter((f) => !exists(f));
if (missing.length) {
  fail('脚手架骨架', `缺少 ${missing.join(', ')} —— 必须先用 create-vue 初始化，禁止手搭`);
} else if (!exists('tsconfig.json') && !exists('tsconfig.app.json')) {
  fail('脚手架骨架', '缺少 tsconfig.json / tsconfig.app.json');
} else {
  pass('脚手架骨架', '入口、路由、构建配置齐全');
}

/* ============================ 2. 依赖 ============================ */

let pkg = {};
try {
  pkg = JSON.parse(read('package.json') || '{}');
} catch {
  fail('package.json', '无法解析 JSON');
}

const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const REQUIRED = ['vue', 'element-plus', '@element-plus/icons-vue', 'vue-router', 'pinia', 'axios'];
const lack = REQUIRED.filter((d) => !deps[d]);
if (lack.length) fail('必需依赖', `缺少 ${lack.join(', ')}`);
else pass('必需依赖', REQUIRED.join(' / '));

if (deps.vue && !String(deps.vue).includes('3.')) {
  fail('Vue 版本', `期望 Vue 3，实际 ${deps.vue}`);
}

/* ============================ 3. 唯一 HTTP 层 ============================ */

const srcFiles = walk('src');
if (!srcFiles.length) fail('源码目录', 'src/ 下没有可扫描文件');

const axiosFiles = grep(srcFiles, /from\s+['"]axios['"]|require\(['"]axios['"]\)/);
if (axiosFiles.length === 0) {
  fail('HTTP 层', '找不到 axios 实例（api/http.ts 未拷入？）');
} else if (axiosFiles.length > 1) {
  fail('唯一 HTTP 层（E3）', `发现 ${axiosFiles.length} 个 axios 引用：${axiosFiles.join(', ')}`);
} else {
  pass('唯一 HTTP 层（E3）', axiosFiles[0]);
}

const httpSrc = read('src/api/http.ts');
if (httpSrc) {
  if (!/Authorization/.test(httpSrc) || !/Bearer/.test(httpSrc)) {
    fail('鉴权头（E3-H2）', 'api/http.ts 未注入 Authorization: Bearer');
  } else if (/set\(\s*['"]Authentication['"]/.test(httpSrc) || /\[['"]Authentication['"]\]/.test(httpSrc)) {
    fail('鉴权头（E3-H2）', '仍在使用 Authentication 头（后端只认 Authorization: Bearer）');
  } else {
    pass('鉴权头（E3-H2）', '仅 Authorization: Bearer');
  }

  if (!/rawHttp/.test(httpSrc)) warn('双实例', 'api/http.ts 未见 rawHttp（根族端点会缺前缀）');
  if (!/X-Tenant/.test(httpSrc)) warn('多租户', '拦截器未注入 X-Tenant');
} else {
  fail('HTTP 层', '缺少 src/api/http.ts');
}

/* ============================ 4. 令牌与租户 ============================ */

const tokenSrc = read('src/api/token.ts');
if (!tokenSrc) {
  fail('令牌模块', '缺少 src/api/token.ts');
} else if (!/cube_token/.test(tokenSrc)) {
  warn('令牌键名', 'token.ts 未使用约定的 cube_token 键');
} else {
  pass('令牌模块', 'cube_token / cube_refresh_token / cube_tenant_code');
}

const strayToken = grep(
  srcFiles.filter((f) => !f.endsWith('api/token.ts')),
  /localStorage\.(getItem|setItem)\(\s*['"]cube_token['"]/,
);
if (strayToken.length) fail('令牌唯一事实源（E3-H1）', `组件绕过 token.ts 读写令牌：${strayToken.join(', ')}`);

/* ============================ 5. 端点前缀与代理 ============================ */

const menuFiles = grep(srcFiles, /GetMenuTree/);
if (!menuFiles.length) {
  fail('动态菜单（E4-M1）', '找不到 GetMenuTree 调用');
} else {
  const bad = menuFiles.filter((f) => /['"]\/Admin\/Index\/GetMenuTree['"]/.test(read(f)));
  if (bad.length) fail('菜单前缀（E3-H2）', `菜单端点漏 /api：${bad.join(', ')}`);
  else pass('动态菜单（E4-M1）', menuFiles.join(', '));
}

const viteSrc = read('vite.config.ts');
if (viteSrc) {
  const need = ["'/api'", "'/Auth'", "'/Cube'"];
  const lackProxy = need.filter((n) => !viteSrc.includes(n));
  if (lackProxy.length) fail('dev 代理（E3-H3）', `proxy 缺少 ${lackProxy.join(', ')}`);
  else if (/['"]\/Admin['"]\s*:/.test(viteSrc)) fail('dev 代理（E3-H3）', '出现 /Admin 前缀代理，会吃掉前端页面路由');
  else pass('dev 代理（E3-H3）', '/api /Auth /Cube 已配置');
} else {
  warn('dev 代理', '未读到 vite.config.ts');
}

/* ============================ 6. 设计令牌与暗色 ============================ */

const tokens = read('src/styles/tokens.css');
if (!tokens) fail('设计令牌（E7）', '缺少 src/styles/tokens.css');
else if (!/--el-color-primary\s*:/.test(tokens)) fail('设计令牌（E7）', 'tokens.css 未定义 --el-color-primary');
else {
  const brand = (tokens.match(/--el-color-primary\s*:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || '';
  pass('设计令牌（E7）', `主色 ${brand}`);
}

const mainSrc = read('src/main.ts');
if (mainSrc) {
  const missingImport = [];
  if (!/styles\/tokens\.css/.test(mainSrc)) missingImport.push('tokens.css');
  if (!/styles\/theme-dark\.css/.test(mainSrc)) missingImport.push('theme-dark.css');
  if (!/dark\/css-vars\.css/.test(mainSrc)) missingImport.push('dark/css-vars.css');
  if (missingImport.length) fail('样式接线（E7）', `main.ts 缺少 ${missingImport.join(', ')}`);
  else pass('样式接线（E7）', '组件库 → 暗色 → 令牌 顺序正确');

  if (!/\.load\(\)/.test(mainSrc)) fail('外观初始化（E7）', 'main.ts 未调用 setting.load()');
  if (/assets\/main\.css/.test(mainSrc)) fail('样式覆盖', 'main.ts 仍引入 create-vue 的 assets/main.css');
} else {
  fail('入口', '缺少 src/main.ts');
}

const settingSrc = read('src/stores/setting.ts');
if (settingSrc && !/classList\.toggle\(\s*['"]dark['"]/.test(settingSrc)) {
  fail('暗色切换（E7）', 'setting.ts 未切换 html.dark');
}

const layoutSrc = read('src/layouts/BasicLayout.vue');
if (!layoutSrc) {
  fail('布局', '缺少 src/layouts/BasicLayout.vue');
} else {
  if (!/SettingPanel/.test(layoutSrc)) fail('外观入口（E7）', 'BasicLayout 未挂载 SettingPanel');
  if (!/MenuItems/.test(layoutSrc)) warn('菜单组件', 'BasicLayout 未复用 MenuItems');
  if (!/@open=/.test(layoutSrc) || !/\.close\s*\??\.\s*\(/.test(layoutSrc)) {
    fail('同层互斥（E4-M5）', '缺少 @open + close 的同层折叠逻辑');
  } else {
    pass('同层互斥（E4-M5）', '@open 关闭同父兄弟');
  }
  if (!/dashboard|DEFAULT_ROUTE/i.test(layoutSrc)) {
    fail('品牌回工作台（E4-M3）', 'BasicLayout 未见 /dashboard 跳转');
  } else {
    pass('品牌回工作台（E4-M3）', '品牌区回到默认落地页');
  }
}

/* ============================ 7. 页面与登录页 ============================ */

const login = read('src/views/LoginView.vue');
if (!login) {
  fail('登录页（E5）', '缺少 src/views/LoginView.vue');
} else {
  const failedBefore = failed;
  // UI 文案只看 template；注释里出现「租户」「接口路径」是正常的，不能误判
  const template = (login.match(/<template>([\s\S]*?)<\/template>/) || [, ''])[1];

  if (/ref\(\s*['"]admin['"]\s*\)/.test(login) || /username\s*:\s*['"]admin['"]/.test(login)) {
    fail('登录页（E5-L2）', '账号被预填为 admin');
  }
  if (/默认账号|测试账号|admin\s*\/\s*admin/i.test(template)) {
    fail('登录页（E5-L2）', '页面出现默认/测试账号提示');
  }
  if (/租户|tenant/i.test(template) || /\btenant(Code)?\s*:/.test(login)) {
    fail('登录页（E5-L4）', '出现租户相关控件或字段');
  }
  if (/\/Auth\/Login|\/api\//.test(template)) {
    fail('登录页（E5-L3）', '页面出现接口路径');
  }
  if (!/AuthShell/.test(login)) warn('登录页', '未复用 AuthShell');
  if (failed === failedBefore) pass('登录页（E5）', '无预填 / 无租户 / 无实现细节');
}

const listPage = read('src/components/cube/ListPage.vue');
if (!listPage) {
  fail('列表基类（E1）', '缺少 src/components/cube/ListPage.vue');
} else {
  if (!/buildColumns/.test(listPage)) fail('列表基类（E1）', 'ListPage 未用元数据生成列');
  if (!/FieldControl/.test(listPage)) warn('字段控件', 'ListPage 未复用 FieldControl');
  else pass('列表基类（E1）', '元数据列 + 通用字段控件');
}

const formDialog = read('src/components/cube/FormDialog.vue');
if (!formDialog) fail('表单基类（E1）', '缺少 FormDialog.vue');
else if (!/buildFormItems/.test(formDialog)) fail('表单基类（E1）', 'FormDialog 未用元数据生成表单项');

const handTables = walk('src/views').filter((f) => /<el-table/.test(read(f)));
if (handTables.length) {
  warn('手写列表', `views 下出现手写表格：${handTables.join(', ')}（应复用 ListPage）`);
}

const menuPush = grep(srcFiles, /menu(Items)?\.(value\.)?push\(/);
if (menuPush.length) warn('前端造菜单（E4-M1）', menuPush.join(', '));

/* ============================ 输出 ============================ */

const ICON = { PASS: `${c.green}✓${c.reset}`, FAIL: `${c.red}✗${c.reset}`, WARN: `${c.yellow}!${c.reset}` };

console.log(`\n${c.cyan}cube-webapi-element · 工程检查${c.reset}  ${c.dim}${target}${c.reset}\n`);

for (const r of results) {
  const color = r.level === 'FAIL' ? c.red : r.level === 'WARN' ? c.yellow : c.dim;
  console.log(`  ${ICON[r.level]} ${r.level.padEnd(4)} ${r.title}`);
  if (r.detail) console.log(`        ${color}${r.detail}${c.reset}`);
}

const passed = results.filter((r) => r.level === 'PASS').length;
console.log(
  `\n  合计 ${passed} 通过 · ${failed} 失败 · ${warned} 待确认\n`,
);

if (failed > 0) {
  console.log(`  ${c.red}存在 FAIL，按上表修复后重跑。${c.reset}\n`);
  process.exit(1);
}
console.log(`  ${c.green}骨架、请求层、令牌、暗色、菜单、登录页六类硬约束全部满足。${c.reset}\n`);
