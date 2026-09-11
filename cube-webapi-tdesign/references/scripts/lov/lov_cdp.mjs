// LovListField 端到端 CDP 验收（headless Chrome）
// 覆盖：元数据加载 → 单选（直连）行点击回填并关闭 → 多选（服务端代理）跨页已选统计 → 确定回填
import { spawn, execSync } from 'node:child_process'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9391
const PROFILE = 'C:/tmp/cdp_lov_' + Date.now()
const APP = 'http://localhost:5183' // vite 绑定在 ::1，127.0.0.1 不通
const OUT = dirname(fileURLToPath(import.meta.url)) // 产物输出到脚本同目录（脱离硬编码，便于随技能分发）
const LOG = OUT + '/cdp.log'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(OUT, { recursive: true })
const log = (...a) => {
  const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')
  appendFileSync(LOG, s + '\n')
  console.log(s)
}
writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n')

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) })
  log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ' :: ' + detail : ''}`)
}

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--window-size=1440,1000', '--force-device-scale-factor=1',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  ],
  { stdio: 'ignore' },
)

function getVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const out = execSync(`curl -s --noproxy '*' http://127.0.0.1:${PORT}/json/version`, { timeout: 5000 })
      const j = JSON.parse(out.toString())
      if (j.webSocketDebuggerUrl) return j
    } catch {}
    const end = Date.now() + 300
    while (Date.now() < end) {}
  }
  throw new Error('ws not up')
}

async function main() {
  const ver = getVersion()
  const ws = new WebSocket(ver.webSocketDebuggerUrl)
  let msgId = 0
  const pending = new Map()
  const send = (method, params, sid) =>
    new Promise((res, rej) => {
      const id = ++msgId
      const to = setTimeout(() => rej(new Error('send timeout ' + method)), 20000)
      pending.set(id, (m) => {
        clearTimeout(to)
        res(m)
      })
      ws.send(JSON.stringify({ id, method, params: params || {}, sessionId: sid }))
    })
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  }
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('ws onopen timeout')), 10000)
    ws.onopen = () => {
      clearTimeout(t)
      res()
    }
    ws.onerror = (e) => {
      clearTimeout(t)
      rej(new Error('ws error ' + (e && (e.message || e.type))))
    }
  })

  const ct = await send('Target.createTarget', { url: APP + '/login' })
  const sid = (await send('Target.attachToTarget', { targetId: ct.result.targetId, flatten: true })).result.sessionId
  await send('Page.enable', {}, sid)
  await send('Runtime.enable', {}, sid)
  await send('Network.enable', {}, sid)
  await sleep(2500)

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid)
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text }
    if (r.result && r.result.result !== undefined) return r.result.result.value
    if (r.result && r.result.value !== undefined) return r.result.value
    return null
  }
  // ⚠️ TDesign t-dialog 可见性：隐藏弹窗仍留在 DOM（无 `t-dialog--hidden` 类），只是尺寸 0×0。
  //    必须用 getBoundingClientRect().width>0 判定，否则会命中隐藏弹窗（实测 C3/A2 误判根因）。
  const VIS = `(d=>{const r=d.getBoundingClientRect();return r.width>0&&r.height>0})`
  const visibleDlg = (titleExpr) =>
    `[...document.querySelectorAll('.t-dialog')].filter(${VIS}).find(d=>{const h=d.querySelector('.t-dialog__header')||d.querySelector('.t-dialog__header-content');return h&&(${titleExpr})})`
  const waitFor = async (expr, ms = 8000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if (await ev(expr)) return true
      await sleep(180)
    }
    return false
  }
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' }, sid)
    if (r.result && r.result.data) {
      writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'))
      log('  shot: ' + name + '.png')
    }
  }

  // ── 注入令牌（Mock 只校验存在性），再进验证页 ──
  await ev(`localStorage.setItem('assets_token','mock-token-for-cdp')`)
  await send('Page.navigate', { url: APP + '/lov-demo' }, sid)
  await sleep(3500)

  log('\n== A. 页面与元数据 ==')
  const bodyText = await ev(`document.body.innerText`)
  check('A1 进入 /lov-demo 且渲染验证页', typeof bodyText === 'string' && bodyText.includes('值集选择组件'), '')
  check('A2 左侧菜单已渲染（BasicLayout 壳）', typeof bodyText === 'string' && bodyText.includes('系统管理'), '')
  const metaErr = await ev(`(document.querySelector('.ld-err')||{}).innerText||''`)
  check('A3 值集元数据加载成功（无错误条）', !metaErr, metaErr)
  const metaInfo = await ev(`(()=>{const c=window.__VUE_DEVTOOLS_GLOBAL_HOOK__;return 1})()`)
  await shot('01_lov_demo_page')

  // ── B. 单选（前端直连） ──
  log('\n== B. 单选 · 前端直连 ==')
  await ev(`document.querySelector('[data-testid="open-single"]').click()`)
  const dlgSel = visibleDlg(`h.innerText.includes('角色（前端直连）')`)
  check('B1 单选弹窗可见', await waitFor(`!!(${dlgSel})`), '')
  await sleep(900)
  const singleDiag = await ev(`(()=>{const d=${dlgSel};if(!d)return {none:true};
    return {rows:d.querySelectorAll('tbody tr').length, radios:d.querySelectorAll('.t-radio').length,
            checkboxes:d.querySelectorAll('.t-checkbox').length, count:(d.querySelector('.llf-count')||{}).innerText||'',
            cols:[...d.querySelectorAll('thead th')].map(t=>t.innerText.trim()),
            firstRow:(d.querySelector('tbody tr')||{}).innerText||''}})()`)
  check('B2 表格有数据行', singleDiag && singleDiag.rows > 0, JSON.stringify(singleDiag))
  check('B3 单选模式渲染 radio 列（非复选框）', singleDiag && singleDiag.radios > 0 && singleDiag.checkboxes === 0, '')
  check('B4 列头含 refLovCode 翻译列「来源」', singleDiag && (singleDiag.cols || []).includes('来源'), JSON.stringify(singleDiag && singleDiag.cols))
  check('B5 来源列已翻译为中文（内置/自定义）', singleDiag && /内置|自定义/.test(singleDiag.firstRow), singleDiag && singleDiag.firstRow)
  check('B6 初始已选 0 项', singleDiag && singleDiag.count === '已选 0 项', singleDiag && singleDiag.count)
  await shot('02_single_dialog')

  // 点第 3 行 → 选中并关闭
  await ev(`(()=>{const d=${dlgSel};const tr=d.querySelectorAll('tbody tr')[2];tr.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1})()`)
  check('B7 点行后弹窗关闭', await waitFor(`!(${dlgSel})`, 6000), '')
  const singleVal = await ev(`document.querySelector('[data-testid="single-value"]').innerText`)
  check('B8 单选值已回填到宿主（id=3）', typeof singleVal === 'string' && singleVal.includes('3'), singleVal)

  // ── C. 多选（服务端代理）+ 跨页已选统计 ──
  log('\n== C. 多选 · 服务端代理 · 跨页 ==')
  await ev(`document.querySelector('[data-testid="open-multi"]').click()`)
  const dlgMulti = visibleDlg(`h.innerText.includes('角色（服务端代理）')`)
  check('C1 多选弹窗可见', await waitFor(`!!(${dlgMulti})`), '')
  await sleep(900)
  const multiDiag = await ev(`(()=>{const d=${dlgMulti};if(!d)return {none:true};
    return {rows:d.querySelectorAll('tbody tr').length, radios:d.querySelectorAll('.t-radio').length,
            checkboxes:d.querySelectorAll('.t-checkbox').length, count:(d.querySelector('.llf-count')||{}).innerText||'',
            pages:[...d.querySelectorAll('.t-pagination__number')].map(b=>b.innerText.trim())}})()`)
  check('C2 代理通道取到第 1 页 20 行（共 24）', multiDiag && multiDiag.rows === 20, JSON.stringify(multiDiag))
  check('C3 多选模式渲染复选框列（非 radio）', multiDiag && multiDiag.checkboxes > 0 && multiDiag.radios === 0, '')
  check('C4 分页出现第 2 页', multiDiag && (multiDiag.pages || []).includes('2'), JSON.stringify(multiDiag && multiDiag.pages))
  check('C5 初始已选 0 项', multiDiag && multiDiag.count === '已选 0 项', multiDiag && multiDiag.count)

  const clickCk = (dlgExpr, idx) =>
    `(()=>{const d=${dlgExpr};const tr=d.querySelectorAll('tbody tr')[${idx}];const box=tr.querySelector('td label.t-checkbox')||tr.querySelector('td input.t-checkbox__former');box.click();return 1})()`

  await ev(clickCk(dlgMulti, 0))
  await sleep(300)
  await ev(clickCk(dlgMulti, 1))
  await sleep(400)
  let cnt = await ev(`(${dlgMulti}.querySelector('.llf-count')||{}).innerText||''`)
  check('C6 第 1 页勾 2 行 → 已选 2 项', cnt === '已选 2 项', cnt)
  await shot('03_multi_page1_selected2')

  // 翻到第 2 页
  await ev(`(()=>{const d=${dlgMulti};const nums=[...d.querySelectorAll('.t-pagination__number')];const p2=nums.find(b=>b.innerText.trim()==='2');p2.click();return 1})()`)
  await sleep(1200)
  const page2Rows = await ev(`(${dlgMulti}).querySelectorAll('tbody tr').length`)
  check('C7 第 2 页渲染 4 行（24-20）', page2Rows === 4, String(page2Rows))
  cnt = await ev(`(${dlgMulti}.querySelector('.llf-count')||{}).innerText||''`)
  check('C8 ★ 翻页后已选统计未被裁剪（仍 2 项）', cnt === '已选 2 项', cnt)
  const keptChecked = await ev(`[...(${dlgMulti}).querySelectorAll('tbody tr td label.t-checkbox')].filter(l=>l.className.includes('t-is-checked')).length`)
  check('C9 第 2 页无越界勾选残留', keptChecked === 0, String(keptChecked))

  await ev(clickCk(dlgMulti, 0))
  await sleep(300)
  await ev(clickCk(dlgMulti, 1))
  await sleep(400)
  cnt = await ev(`(${dlgMulti}.querySelector('.llf-count')||{}).innerText||''`)
  check('C10 第 2 页再勾 2 行 → 已选 4 项（跨页累计）', cnt === '已选 4 项', cnt)
  await shot('04_multi_page2_selected4')

  // 翻回第 1 页：跨页保留 + 回显勾选
  await ev(`(()=>{const d=${dlgMulti};const nums=[...d.querySelectorAll('.t-pagination__number')];const p1=nums.find(b=>b.innerText.trim()==='1');p1.click();return 1})()`)
  await sleep(1200)
  cnt = await ev(`(${dlgMulti}.querySelector('.llf-count')||{}).innerText||''`)
  const p1checked = await ev(`[...(${dlgMulti}).querySelectorAll('tbody tr td label.t-checkbox')].filter(l=>l.className.includes('t-is-checked')).length`)
  check('C11 翻回第 1 页仍为已选 4 项', cnt === '已选 4 项', cnt)
  check('C12 ★ 第 1 页原勾选项已回显（2 个勾选态）', p1checked === 2, String(p1checked))
  await shot('05_multi_back_page1')

  // 确定
  await ev(`(()=>{const d=${dlgMulti};const btns=[...d.querySelectorAll('.t-dialog__footer button')];const ok=btns.find(b=>b.innerText.includes('确定'));ok.click();return 1})()`)
  check('C13 点确定后弹窗关闭', await waitFor(`!(${dlgMulti})`, 6000), '')
  const multiVal = await ev(`document.querySelector('[data-testid="multi-value"]').innerText`)
  const idCount = (String(multiVal).match(/\d+/g) || []).length
  check('C14 多选值已回填 4 个 id', idCount === 4, multiVal)

  // ── D. 搜索（Q 关键词） ──
  log('\n== D. 搜索栏 Q 关键词 ==')
  await ev(`document.querySelector('[data-testid="open-multi"]').click()`)
  await waitFor(`!!(${dlgMulti})`)
  await sleep(800)
  await ev(`(()=>{const d=${dlgMulti};const inp=d.querySelector('.llf-search input');inp.value='审计';inp.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`)
  await sleep(300)
  await ev(`(()=>{const d=${dlgMulti};const btn=[...d.querySelectorAll('.llf-search button')].find(b=>b.innerText.includes('搜索'));btn.click();return 1})()`)
  await sleep(1200)
  const searchDiag = await ev(`(()=>{const d=${dlgMulti};return {rows:d.querySelectorAll('tbody tr').length,
    first:(d.querySelector('tbody tr')||{}).innerText||''}})()`)
  check('D1 搜索「审计」命中 1 行', searchDiag && searchDiag.rows === 1, JSON.stringify(searchDiag))
  await shot('06_search_q')
  await ev(`(()=>{const d=${dlgMulti};const btn=[...d.querySelectorAll('.llf-search button')].find(b=>b.innerText.includes('重置'));btn.click();return 1})()`)
  await sleep(1000)
  const afterReset = await ev(`(${dlgMulti}).querySelectorAll('tbody tr').length`)
  check('D2 重置后恢复 20 行', afterReset === 20, String(afterReset))

  // 关闭
  await ev(`(()=>{const d=${dlgMulti};const btns=[...d.querySelectorAll('.t-dialog__footer button')];const c=btns.find(b=>b.innerText.includes('取消'));c.click();return 1})()`)
  await sleep(700)
  await shot('07_final')

  const pass = results.filter((r) => r.ok).length
  log(`\n===== 合计 ${pass}/${results.length} 通过 =====`)
  writeFileSync(OUT + '/result.json', JSON.stringify({ pass, total: results.length, results }, null, 2))
  ws.close()
  chrome.kill('SIGKILL')
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  log('FATAL ' + (e && (e.stack || e.message || e)))
  writeFileSync(OUT + '/result.json', JSON.stringify({ fatal: String(e && (e.stack || e.message || e)), results }, null, 2))
  try {
    chrome.kill('SIGKILL')
  } catch {}
  process.exit(2)
})
