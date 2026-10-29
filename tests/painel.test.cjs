const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
process.chdir(path.resolve(__dirname, '../..'));
require('../server/config');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const dbName = 'fhdod_verify_' + Date.now();
let connection, server, chrome;
async function ready(url) {
  for (let i = 0; i < 30; i++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (r.ok) return r; } catch {} await delay(200); }
  throw new Error('Não foi possível acessar ' + url);
}
function run(file, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, ...options });
    child.on('error', reject); child.on('exit', code => code ? reject(new Error('Processo terminou com código ' + code)) : resolve());
  });
}
(async () => {
  connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true });
  const schema = fs.readFileSync('app/database/schema.sql', 'utf8').replaceAll('hospital_experiencia', dbName);
  await connection.query(schema);
  const [[original]] = await connection.query("SELECT texto FROM perguntas WHERE setor_id='rec' AND ordem=2");
  await connection.query("UPDATE perguntas SET texto='Como foi o atendimento na recepção?' WHERE setor_id='rec' AND ordem=1");
  await connection.query("UPDATE perguntas SET texto='Enunciado personalizado para verificação' WHERE setor_id='rec' AND ordem=2");
  connection.release = () => {};
  const { migrar } = require('../server/lib/migracao');
  await migrar({ getConnection: async () => connection });
  const [revised] = await connection.query("SELECT texto FROM perguntas WHERE setor_id='rec' ORDER BY ordem");
  assert.equal(revised[0].texto, 'Como você avalia o atendimento prestado pela recepção?');
  assert.equal(revised[1].texto, 'Enunciado personalizado para verificação');
  await connection.query("UPDATE perguntas SET texto=? WHERE setor_id='rec' AND ordem=2", [original.texto]);
  assert.equal((await migrar({ getConnection: async () => connection })).length, 0);
  console.log('Revisão dos enunciados: padrões atualizados, personalizações preservadas e migração repetível.');
  const password = require('node:crypto').randomBytes(20).toString('hex');
  const email = 'verificacao@hospital.test';
  const [created] = await connection.query("INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES (?,?,?,'gerente')", ['Verificação', email, await bcrypt.hash(password, 4)]);
  const env = { ...process.env, DB_NAME: dbName, PORT: '3137', BASE_URL: 'http://127.0.0.1:3137', TEST_GERENTE_EMAIL: email, TEST_GERENTE_SENHA: password, TV_TOKEN: '' };
  server = spawn(process.execPath, ['server/index.js'], { cwd: path.resolve('app'), env, windowsHide: true, stdio: 'ignore' });
  await ready(env.BASE_URL + '/api/saude');
  await run(process.execPath, ['--test', 'tests/api.test.js'], { cwd: path.resolve('app'), env, stdio: 'inherit' });
  const cookie = 'fhdod_token=' + jwt.sign({ id: created.insertId }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const request = async route => { const r = await fetch(env.BASE_URL + route, { headers: { Cookie: cookie } }); assert.equal(r.status, 200); return r.json(); };
  const evaluations = await request('/api/admin/avaliacoes');
  for (const query of ['t=Dia', 't=Noite', 'u=SUS', 'u=Particular', 's=rx&t=Dia&u=SUS']) {
    const filters = new URLSearchParams(query);
    const selected = evaluations.filter(r => (!filters.has('s') || r.setor === filters.get('s')) && (!filters.has('t') || r.turno === filters.get('t')) && (!filters.has('u') || r.tipo_atendimento === filters.get('u')));
    const result = await request('/api/admin/resultado-perguntas?p=all&' + query);
    assert.equal(result.itens.filter(x => x.tipo === 'nps').reduce((n,x) => n+x.total,0), selected.length, query);
  }
  console.log('Filtros por pergunta: OK');
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9333', '--user-data-dir=' + path.resolve('.chrome-verify'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const version = await (await ready('http://127.0.0.1:9333/json/version')).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0; const pending = new Map(); const errors = [];
  ws.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result); } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); };
  const send = (method, params = {}, sessionId) => new Promise((resolve,reject) => { const id = ++seq; pending.set(id, { resolve,reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cdp = (method,params) => send(method,params,sessionId);
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable');
  await cdp('Network.setCookie', { name: 'fhdod_token', value: cookie.split('=')[1], url: env.BASE_URL, httpOnly: true, sameSite: 'Strict' });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: env.BASE_URL + '/admin' });
  async function evaluate(expression) { const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
  async function until(expression) { for (let i=0;i<60;i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error('Espera excedida: '+expression); }
  await until('document.querySelector(".hist") !== null');
  await evaluate('F.p="all";updRes()');
  await until('document.querySelector("#rpq details") !== null');
  assert.equal(await evaluate('document.querySelectorAll(".hc").length'), 10);
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".hist-track i")).every(el=>el.getBoundingClientRect().height<=el.parentElement.getBoundingClientRect().height+1)'), true);
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".hist-track")).every(el=>el.getBoundingClientRect().width>15)'),true);
  await evaluate('setTab("ctt")');
  assert.ok(await evaluate('Array.from(document.querySelectorAll(".contact-actions a")).some(a=>a.href.startsWith("https://wa.me/55"))'));
  assert.ok(await evaluate('Array.from(document.querySelectorAll(".contact-actions a")).some(a=>a.href.startsWith("tel:+55"))'));
  await evaluate('setTab("per")'); await until('document.querySelector("#qadd") !== null');
  const initial = await evaluate('QL.length');
  await until('document.querySelector("#qnt").parentElement.querySelector(".select-trigger") !== null');
  assert.ok(await evaluate('getComputedStyle(document.querySelector("#qnt").parentElement.querySelector(".select-trigger")).minHeight === "48px"'));
  assert.equal(await evaluate('document.querySelectorAll("main select").length === document.querySelectorAll("main .select-trigger").length'),true);
  await evaluate('document.querySelector("#qnt").parentElement.querySelector(".select-trigger").click()');
  assert.equal(await evaluate('document.querySelector(".select-menu").hidden'),false);
  assert.ok(await evaluate('getComputedStyle(document.querySelector(".select-option")).fontSize === "16px"'));
  await evaluate('document.querySelectorAll(".select-option")[1].click()');
  assert.equal(await evaluate('document.querySelector("#qnt").value'),'positivos');
  await evaluate('document.querySelector("#qadd").click()');
  assert.equal(await evaluate('QL.length'), initial+1);
  assert.equal(await evaluate('QL[QL.length-1].tipo'), 'positivos');
  await evaluate('document.querySelector("#qsave").click()');
  await until('!QBUSY && document.querySelector("#qmsg").classList.contains("ok")');
  await evaluate('document.querySelector(".qe:last-of-type [data-a=up]").click()');
  assert.equal(await evaluate('QL[QL.length-2].tipo'), 'positivos');
  await evaluate('document.querySelector("#qsave").click()');
  await until('!QBUSY && document.querySelector("#qmsg").classList.contains("ok")');
  await evaluate('window.confirm=()=>true;document.querySelectorAll(".qe")[QL.length-2].querySelector("[data-a=del]").click();document.querySelector("#qsave").click()');
  await until('!QBUSY && document.querySelector("#qmsg").classList.contains("ok")');
  assert.equal(await evaluate('QL.length'),initial);
  await evaluate('setTab("res");F.p="all";updRes()'); await until('document.querySelector(".hist") !== null');
  fs.mkdirSync('verification', { recursive:true });
  let screenshot = await cdp('Page.captureScreenshot', { format:'png', captureBeyondViewport: true }); fs.writeFileSync('verification/admin-desktop.png', Buffer.from(screenshot.data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', { width:390,height:844,deviceScaleFactor:1,mobile:true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
  screenshot = await cdp('Page.captureScreenshot', { format:'png', captureBeyondViewport:true }); fs.writeFileSync('verification/admin-mobile.png',Buffer.from(screenshot.data,'base64'));
  await evaluate('setTab("per")'); await until('document.querySelector("#qadd") !== null');
  screenshot = await cdp('Page.captureScreenshot', { format:'png', captureBeyondViewport:true }); fs.writeFileSync('verification/perguntas-mobile.png',Buffer.from(screenshot.data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('Navegador: gráficos, contatos, criação, reordenação, exclusão, salvamento e largura móvel OK.');
  await send('Browser.close'); ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if (server) server.kill(); if (chrome) chrome.kill();
  if (connection) { await connection.query('DROP DATABASE IF EXISTS `' + dbName + '`'); await connection.end(); }
});
