// FormDialog 挂 lov-list 分支 端到端 CDP 验收（headless Chrome）
// 覆盖：实体列表 → 新增弹窗 → lov-list 只读展示 → 打开值集弹窗 → 单选回填 → 多选回填
import { spawn, execSync } from 'node:child_process'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9392
const PROFILE = 'C:/tmp/cdp_lovform_' + Date.now()
const APP = 'http://localhost:5183'
const OUT = dirname(fileURLToPath(import.meta.url)) // 产物输出到脚本同目录（脱离硬编码，便于随技能分发）
const LOG = OUT + '/lov_form_cdp.log'
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
  await sleep(2500)

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid)
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text }
    if (r.result && r.result.result !== undefined) return r.result.result.value
    if (r.result && r.result.value !== undefined) return r.result.value
    return null
  }
  // ⚠️ TDesign t-dialog 的可见性判定：隐藏的弹窗**仍留在 DOM 里**（无 `t-dialog--hidden` 类），
  //    只是尺寸变 0×0。必须用 getBoundingClientRect().width>0 判定，否则会命中隐藏弹窗（实测）。
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

  await ev(`localStorage.setItem('assets_token','mock-token-for-cdp')`)
  await send('Page.navigate', { url: APP + '/entity/Admin/User' }, sid)
  await sleep(3800)

  log('\n== A. 实体列表页 ==')
  const bodyText = await ev(`document.body.innerText`)
  check('A1 进入 /entity/Admin/User 并渲染列表', typeof bodyText === 'string' && bodyText.includes('登录名'), '')
  check('A2 左侧菜单已渲染', typeof bodyText === 'string' && bodyText.includes('系统管理'), '')
  const rowCount = await ev(`document.querySelectorAll('tbody tr').length`)
  check('A3 列表有数据行（3）', rowCount === 3, String(rowCount))
  await shot('10_form_list')

  log('\n== B. 打开新增表单（含 lov-list 字段）==')
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='新增');b&&b.click();return 1})()`)
  const dlgAdd = visibleDlg(`h.innerText.trim()==='新增'`)
  check('B1 新增弹窗可见', await waitFor(`!!(${dlgAdd})`), '')
  await sleep(900)
  const lovDiag = await ev(`(()=>{const d=${dlgAdd};if(!d)return {none:true};
    const boxes=[...d.querySelectorAll('.fd-lov')];
    return {count:boxes.length, inputs:boxes.map(b=>{const i=b.querySelector('input');return {ph:(i&&i.placeholder)||'',ro:i?i.readOnly:null,val:i?i.value:null}})}})()`)
  check('B2 表单渲染 2 个 lov-list 字段', lovDiag && lovDiag.count === 2, JSON.stringify(lovDiag))
  const singleBox = lovDiag && lovDiag.inputs && lovDiag.inputs.find((x) => /单选/.test(x.ph))
  check('B3 单选 lov-list 为只读展示输入', !!singleBox && singleBox.ro === true, JSON.stringify(singleBox))
  await shot('11_form_dialog')

  log('\n== C. 单选 lov-list：打开弹窗 → 选行回填 ==')
  const openSingle = `(()=>{const d=${dlgAdd};const b=[...d.querySelectorAll('.fd-lov')].find(x=>{const i=x.querySelector('input');return i&&/单选/.test(i.placeholder)});const i=b&&b.querySelector('input');i&&i.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1})()`
  await ev(openSingle)
  const dlgLov = visibleDlg(`h.innerText.includes('选择 角色（前端直连）')`)
  check('C1 值集弹窗打开（单选）', await waitFor(`!!(${dlgLov})`), '')
  await sleep(900)
  const lovRows = await ev(`(${dlgLov}||{querySelectorAll:()=>[]}).querySelectorAll('tbody tr').length`)
  check('C2 值集弹窗有数据行', lovRows > 0, String(lovRows))
  await shot('12_form_lov_open')
  // 点第 3 行（id=3 审计员）
  await ev(`(()=>{const d=${dlgLov};const tr=d.querySelectorAll('tbody tr')[2];tr.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1})()`)
  check('C3 值集弹窗选行后关闭', await waitFor(`!(${dlgLov})`, 6000), '')
  await sleep(500)
  const singleVal = await ev(`(()=>{const d=${dlgAdd};const b=[...d.querySelectorAll('.fd-lov')].find(x=>{const i=x.querySelector('input');return i&&/单选/.test(i.placeholder)});const i=b&&b.querySelector('input');return i?i.value:null})()`)
  // ★ 只读框显示的是**名称**（第3行=审计员），id 进 model 提交（见 lov_display_cdp 的 C2 断言）
  check('C4 单选回填后只读框显示名称「审计员」', singleVal === '审计员', String(singleVal))

  log('\n== D. 多选 lov-list：打开弹窗 → 勾 2 行 → 确定回填 ==')
  const openMulti = `(()=>{const d=${dlgAdd};const b=[...d.querySelectorAll('.fd-lov')].find(x=>{const i=x.querySelector('input');return i&&/多选/.test(i.placeholder)});const i=b&&b.querySelector('input');i&&i.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1})()`
  await ev(openMulti)
  check('D1 值集弹窗打开（多选）', await waitFor(`!!(${dlgLov})`), '')
  await sleep(900)
  const multiMode = await ev(`(()=>{const d=${dlgLov};return {cbs:d.querySelectorAll('.t-checkbox').length,radios:d.querySelectorAll('.t-radio').length}})()`)
  check('D2 多选模式渲染复选框', multiMode && multiMode.cbs > 0 && multiMode.radios === 0, JSON.stringify(multiMode))
  const clickCk = (idx) =>
    `(()=>{const d=${dlgLov};const tr=d.querySelectorAll('tbody tr')[${idx}];const box=tr.querySelector('td label.t-checkbox')||tr.querySelector('td input.t-checkbox__former');box.click();return 1})()`
  await ev(clickCk(0))
  await sleep(250)
  await ev(clickCk(1))
  await sleep(350)
  const cnt = await ev(`(${dlgLov}.querySelector('.llf-count')||{}).innerText||''`)
  check('D3 已选 2 项', cnt === '已选 2 项', cnt)
  await shot('13_form_lov_multi')
  await ev(`(()=>{const d=${dlgLov};const bs=[...d.querySelectorAll('.t-dialog__footer button')];const ok=bs.find(b=>b.innerText.includes('确定'));ok.click();return 1})()`)
  check('D4 确定后值集弹窗关闭', await waitFor(`!(${dlgLov})`, 6000), '')
  await sleep(500)
  const multiVal = await ev(`(()=>{const d=${dlgAdd};const b=[...d.querySelectorAll('.fd-lov')].find(x=>{const i=x.querySelector('input');return i&&/多选/.test(i.placeholder)});const i=b&&b.querySelector('input');return i?i.value:null})()`)
  // ★ 显示名称（顿号连接），逗号 id 串进 model 提交
  check('D5 多选回填后只读框显示名称「管理员、普通用户」', multiVal === '管理员、普通用户', String(multiVal))
  await shot('14_form_after_fill')

  log('\n== E. 搜索栏降级（lov-list 字段不出弹窗）==')
  // 关闭表单
  await ev(`(()=>{const d=${dlgAdd};const bs=[...d.querySelectorAll('.t-dialog__footer button')];const c=bs.find(b=>b.innerText.includes('取消'));c&&c.click();return 1})()`)
  await sleep(700)
  await shot('15_final')

  const pass = results.filter((r) => r.ok).length
  log(`\n===== 合计 ${pass}/${results.length} 通过 =====`)
  writeFileSync(OUT + '/lov_form_result.json', JSON.stringify({ pass, total: results.length, results }, null, 2))
  ws.close()
  chrome.kill('SIGKILL')
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  log('FATAL ' + (e && (e.stack || e.message || e)))
  writeFileSync(OUT + '/lov_form_result.json', JSON.stringify({ fatal: String(e && (e.stack || e.message || e)), results }, null, 2))
  try {
    chrome.kill('SIGKILL')
  } catch {}
  process.exit(2)
})
