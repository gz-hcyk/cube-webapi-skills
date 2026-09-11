// LovListField id→名称回显 + FormDialog「显示名称、提交 id」端到端 CDP 验收
// 覆盖：编辑态回显名称（非原始 id）→ 重新单选换行（框显示新名称）→ 保存（PUT 提交的是 id）
import { spawn, execSync } from 'node:child_process'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9394
const PROFILE = 'C:/tmp/cdp_lovdisplay_' + Date.now()
const APP = 'http://localhost:5183'
const MOCK = 'http://localhost:3001'
const OUT = dirname(fileURLToPath(import.meta.url)) // 产物输出到脚本同目录（脱离硬编码，便于随技能分发）
const LOG = OUT + '/lov_display_cdp.log'
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

/** 复位 mock 行数据，保证脚本可重复运行（★ 用原生 fetch，不用 execSync+curl：
 *  Windows 下 cmd 不认单引号，`-d '{"id":2}'` 会被整体当字符串送出 → mock 收非法 JSON
 *  静默失败；Node 的 fetch(undici) 不读系统代理，无需绕 NO_PROXY） */
const SEED = { id: 2, name: 'zhangsan', displayName: '张三', roleID: 2, roleLovID: 3, roleIds: '1,2', departmentID: 2, mail: 'zhang@cube.local', mobile: '13800000001', enabled: true }
async function resetRow(quiet) {
  try {
    const r = await fetch(`${MOCK}/api/Admin/User/2`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer mock', 'Content-Type': 'application/json' },
      body: JSON.stringify(SEED),
    })
    const j = await r.json()
    if (!quiet) log(`  复位 mock 数据：${j?.data?.roleLovID === 3 ? '已复位（roleLovID→3, roleIds→1,2）' : '异常 ' + JSON.stringify(j).slice(0, 120)}`)
  } catch (e) {
    if (!quiet) log('  复位失败（不影响断言）：' + e)
  }
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
    ws.onopen = () => { clearTimeout(t); res() }
    ws.onerror = (e) => { clearTimeout(t); rej(new Error('ws error ' + (e && (e.message || e.type)))) }
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
  // ⚠️ TDesign t-dialog 隐藏后仍留 DOM 且无 t-dialog--hidden 类，可见性唯一判据是尺寸>0
  const VIS = `(d=>{const r=d.getBoundingClientRect();return r.width>0&&r.height>0})`
  const visibleDlg = (titleExpr) =>
    `[...document.querySelectorAll('.t-dialog')].filter(${VIS}).find(d=>{const h=d.querySelector('.t-dialog__header')||d.querySelector('.t-dialog__header-content');return h&&(${titleExpr})})`
  const waitFor = async (expr, ms = 9000) => {
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

  // 读取某个 lov-list 输入框（按 placeholder 里的「单选/多选」区分）
  const readLovBox = (dlgExpr, kind) =>
    `(()=>{const d=${dlgExpr};if(!d)return null;const b=[...d.querySelectorAll('.fd-lov')].find(x=>{const i=x.querySelector('input');return i&&/${kind}/.test(i.placeholder)});const i=b&&b.querySelector('input');return i?i.value:null})()`

  await ev(`localStorage.setItem('assets_token','mock-token-for-cdp')`)
  await send('Page.navigate', { url: APP + '/entity/Admin/User' }, sid)
  await sleep(3800)

  // 先复位再断言：上一轮若中途失败/中断，mock 内存态会留下 id=5 的脏数据
  await resetRow(true)

  log('\n== A. 编辑态回显（显示名称而非原始 id）==')
  // 找 zhangsan（id=2，roleLovID=3 审计员，roleIds='1,2' 管理员、普通用户）行的「编辑」按钮
  const openEdit = await ev(`(()=>{const tr=[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('zhangsan'));if(!tr)return 0;const b=[...tr.querySelectorAll('button,a')].find(x=>x.innerText.trim()==='编辑');if(!b)return 0;b.click();return 1})()`)
  check('A0 找到并点击 zhangsan 行编辑', openEdit === 1, String(openEdit))
  const dlgEdit = visibleDlg(`h.innerText.trim()==='编辑'`)
  check('A1 编辑弹窗可见', await waitFor(`!!(${dlgEdit})`), '')
  await sleep(1600) // 等 useLov.load + lovFetchRows(整表) 回填名称
  const editSingle = await ev(readLovBox(dlgEdit, '单选'))
  const editMulti = await ev(readLovBox(dlgEdit, '多选'))
  check('A2 单选 lov-list 回显名称「审计员」（非原始 id 3）', editSingle === '审计员', String(editSingle))
  check('A3 多选 lov-list 回显名称「管理员、普通用户」（非 1,2）', editMulti === '管理员、普通用户', String(editMulti))
  await shot('20_edit_echo')

  log('\n== B. 重新单选换行：框显示新名称 ==')
  const openSingle = `(()=>{const d=${dlgEdit};const b=[...d.querySelectorAll('.fd-lov')].find(x=>{const i=x.querySelector('input');return i&&/单选/.test(i.placeholder)});const i=b&&b.querySelector('input');i&&i.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1})()`
  await ev(openSingle)
  const dlgLov = visibleDlg(`h.innerText.includes('选择 角色（前端直连）')`)
  check('B1 值集弹窗打开', await waitFor(`!!(${dlgLov})`), '')
  await sleep(900)
  // 已选回显：审计员(id3) 应是高亮/选中态
  const echoChecked = await ev(`(()=>{const d=${dlgLov};const tr=[...d.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('审计员'));if(!tr)return -1;const inp=tr.querySelector('input[type=radio]');return inp?(inp.checked?1:0):((tr.querySelector('.t-radio.is-checked')||tr.className.includes('selected'))?1:0)})()`)
  check('B2 弹窗打开时原选「审计员」为选中态', echoChecked === 1, String(echoChecked))
  // 选「仓库管理员」（id=5，第 5 行）
  await ev(`(()=>{const d=${dlgLov};const tr=[...d.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('仓库管理员'));tr.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1})()`)
  check('B3 选行后弹窗关闭', await waitFor(`!(${dlgLov})`, 6000), '')
  await sleep(500)
  const newSingle = await ev(readLovBox(dlgEdit, '单选'))
  check('B4 单选框更新为新名称「仓库管理员」', newSingle === '仓库管理员', String(newSingle))
  await shot('21_after_reselect')

  log('\n== C. 保存：提交的是 id 而非名称 ==')
  await ev(`(()=>{const d=${dlgEdit};const bs=[...d.querySelectorAll('.t-dialog__footer button')];const ok=bs.find(b=>b.innerText.includes('保存'));ok&&ok.click();return 1})()`)
  check('C1 编辑弹窗关闭（保存成功）', await waitFor(`!(${dlgEdit})`, 6000), '')
  await shot('22_after_save')
  ws.close()
  chrome.kill('SIGKILL')

  // C2/C3：绕开浏览器（无 CORS 干扰），直连 mock 读回该行，验证「提交 id、显示名称」分离
  const raw = execSync(`curl -s --noproxy '*' -H "Authorization: Bearer mock" ${MOCK}/api/Admin/User/2`, { timeout: 8000 }).toString()
  let saved = null
  try { saved = JSON.parse(raw).data } catch {}
  check('C2 ★ 后端存的是 id=5（仓库管理员），不是名称字符串', saved && String(saved.roleLovID) === '5', JSON.stringify(saved && { roleLovID: saved.roleLovID, roleIds: saved.roleIds }))
  check('C3 未改动的多选仍为逗号串 id "1,2"', saved && String(saved.roleIds) === '1,2', String(saved && saved.roleIds))

  await resetRow()

  const pass = results.filter((r) => r.ok).length
  log(`\n===== 合计 ${pass}/${results.length} 通过 =====`)
  writeFileSync(OUT + '/lov_display_result.json', JSON.stringify({ pass, total: results.length, results }, null, 2))
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  log('FATAL ' + (e && (e.stack || e.message || e)))
  writeFileSync(OUT + '/lov_display_result.json', JSON.stringify({ fatal: String(e && (e.stack || e.message || e)), results }, null, 2))
  try { chrome.kill('SIGKILL') } catch {}
  process.exit(2)
})
