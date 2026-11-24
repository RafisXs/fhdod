const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCREENSHOTS = path.join(PROJECT_ROOT, 'verification/screenshots');
process.chdir(PROJECT_ROOT);
require('../../backend/src/config/env');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const dbName = 'fhdod_verify_' + Date.now();
let connection, server, chrome;
async function portaLivre() {
  const listener = require('node:net').createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}
async function ready(url) {
  for (let i = 0; i < 150; i++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (r.ok) return r; } catch {} await delay(200); }
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
  const schema = fs.readFileSync(path.join(PROJECT_ROOT, 'database/schema.sql'), 'utf8').replaceAll('hospital_experiencia', dbName);
  await connection.query(schema);
  const [[original]] = await connection.query("SELECT texto FROM perguntas WHERE setor_id='rec' AND ordem=2");
  await connection.query("UPDATE perguntas SET texto='Como foi o atendimento na recepção?' WHERE setor_id='rec' AND ordem=1");
  await connection.query("UPDATE perguntas SET texto='Enunciado personalizado para verificação' WHERE setor_id='rec' AND ordem=2");
  connection.release = () => {};
  const { migrar } = require('../../backend/src/services/migracao');
  await migrar({ getConnection: async () => connection });
  const [revised] = await connection.query("SELECT texto FROM perguntas WHERE setor_id='rec' ORDER BY ordem");
  assert.equal(revised[0].texto, 'Como você avalia o atendimento prestado pela recepção?');
  assert.equal(revised[1].texto, 'Enunciado personalizado para verificação');
  await connection.query("UPDATE perguntas SET texto=? WHERE setor_id='rec' AND ordem=2", [original.texto]);
  assert.equal((await migrar({ getConnection: async () => connection })).length, 0);
  console.log('Revisão dos enunciados: padrões atualizados, personalizações preservadas e migração repetível.');
  const password = require('node:crypto').randomBytes(20).toString('hex');
  const email = 'verificacao@hospital.test';
  const [created] = await connection.query("INSERT INTO usuarios (nome,email,senha_hash,papel,trocar_senha) VALUES (?,?,?,'gerente',0)", ['Verificação', email, await bcrypt.hash(password, 4)]);
  const port = await portaLivre(), debugPort = await portaLivre();
  const env = { ...process.env, DB_NAME: dbName, HOST: '127.0.0.1', PORT: String(port), BASE_URL: 'http://127.0.0.1:'+port, TEST_GERENTE_EMAIL: email, TEST_GERENTE_SENHA: password, TV_TOKEN: '' };
  server = spawn(process.execPath, ['backend/src/server.js'], { cwd: PROJECT_ROOT, env, windowsHide: true, stdio: 'ignore' });
  await ready(env.BASE_URL + '/api/saude');
  await run(process.execPath, ['--test', 'tests/api/api.test.js'], { cwd: PROJECT_ROOT, env, stdio: 'inherit' });
  server.kill(); await new Promise(resolve => server.once('exit', resolve));
  server = spawn(process.execPath, ['backend/src/server.js'], { cwd: PROJECT_ROOT, env, windowsHide: true, stdio: 'ignore' });
  await ready(env.BASE_URL + '/api/saude');
  await run(process.execPath, ['--test', 'tests/security/seguranca.test.js'], { cwd: PROJECT_ROOT, env, stdio: 'inherit' });
  await run(process.execPath, ['--test', 'tests/integration/relatorios.test.js'], { cwd: PROJECT_ROOT, env, stdio: 'inherit' });
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
  console.log('Iniciando verificação no Chrome isolado.');
  chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--in-process-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port='+debugPort, '--user-data-dir=' + path.join(PROJECT_ROOT, 'verification/browser/chrome-' + dbName), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  chrome.on('error', e => { console.error('Chrome:', e.code); });
  const version = await (await ready('http://127.0.0.1:'+debugPort+'/json/version')).json();
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
  for (const width of [360,768,1280]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Resultados: '+width);
  }
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
  fs.mkdirSync(SCREENSHOTS, { recursive:true });
  let screenshot = await cdp('Page.captureScreenshot', { format:'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(SCREENSHOTS, 'admin-desktop.png'), Buffer.from(screenshot.data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', { width:390,height:844,deviceScaleFactor:1,mobile:true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
  screenshot = await cdp('Page.captureScreenshot', { format:'png', captureBeyondViewport:true }); fs.writeFileSync(path.join(SCREENSHOTS, 'admin-mobile.png'),Buffer.from(screenshot.data,'base64'));
  await evaluate('setTab("per")'); await until('document.querySelector("#qadd") !== null');
  screenshot = await cdp('Page.captureScreenshot', { format:'png', captureBeyondViewport:true }); fs.writeFileSync(path.join(SCREENSHOTS, 'perguntas-mobile.png'),Buffer.from(screenshot.data,'base64'));
  await evaluate('setTab("audit")');
  await until('document.querySelector("#audit-list table") !== null');
  assert.ok(await evaluate('document.querySelectorAll("#audit-list tbody tr").length > 0'));
  for (const [tab, selector] of [['per','#qadd'],['set','#slist table'],['eq','#nf'],['ctt','.cards'],['audit','#audit-list table']]) {
    await evaluate('setTab('+JSON.stringify(tab)+')');
    await until('document.querySelector('+JSON.stringify(selector)+') !== null');
    for (const width of [360,768,1280]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,tab+': '+width);
    }
  }
  await evaluate('setTab("senha")');
  await until('document.querySelector("#senha-form") !== null');
  for (const width of [360,768,1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width===360});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true, 'Senha: '+width);
    assert.ok(await evaluate('document.querySelector("#senha-salvar").getBoundingClientRect().height>=44'));
  }
  await evaluate('document.querySelector("#senha-mostrar").click()');
  assert.equal(await evaluate('document.querySelector("#senha-nova").type'),'text');
  await evaluate('document.querySelector("#senha-mostrar").click()');
  await evaluate('document.querySelector("#senha-atual").value="Atual-teste";document.querySelector("#senha-nova").value="Nova-teste-123";document.querySelector("#senha-confirmar").value="Diferente-123";document.querySelector("#senha-form").requestSubmit()');
  assert.equal(await evaluate('document.activeElement.id'),'senha-confirmar');
  await evaluate('document.querySelector("#senha-atual").value=' + JSON.stringify(password) + ';document.querySelector("#senha-nova").value="Senha-pessoal-browser-987";document.querySelector("#senha-confirmar").value="Senha-pessoal-browser-987";document.querySelector("#senha-form").requestSubmit()');
  await until('document.querySelector("#t-res") !== null && document.querySelector("#dbody") !== null');
  const stale = await fetch(env.BASE_URL + '/api/me', { headers: { Cookie: cookie } });
  assert.equal(stale.status,401);
  // Confere também a tela obrigatória no primeiro acesso, usando a conta de teste redefinida.
  const [[provisional]] = await connection.query("SELECT id FROM usuarios WHERE email LIKE 'seguranca.%@teste.invalid' LIMIT 1");
  const [[sessionVersion]]=await connection.query('SELECT versao_sessao FROM usuarios WHERE id=?',[provisional.id]);
  const token=jwt.sign({id:provisional.id,sv:sessionVersion.versao_sessao},process.env.JWT_SECRET,{expiresIn:'10m'});
  await cdp('Network.setCookie',{name:'fhdod_token',value:token,url:env.BASE_URL,httpOnly:true,sameSite:'Strict'});
  await cdp('Page.navigate',{url:env.BASE_URL+'/admin'});
  await until('document.querySelector("#senha-form") !== null');
  assert.equal(await evaluate('document.querySelector("#senha-voltar") === null'),true);
  await evaluate('document.querySelector("#senha-atual").value="Provisoria-teste-123";document.querySelector("#senha-nova").value="Senha-primeiro-acesso-456";document.querySelector("#senha-confirmar").value="Senha-primeiro-acesso-456";document.querySelector("#senha-form").requestSubmit()');
  await until('document.querySelector("#t-res") !== null');
  const [[beforePrivacy]]=await connection.query('SELECT COUNT(*) AS n FROM avaliacoes');
  await cdp('Page.navigate',{url:env.BASE_URL+'/?setor=rx'});
  await until('document.querySelector("#privacy-accept") !== null');
  assert.equal(await evaluate('document.querySelector("#privacy-accept").checked'),false);
  assert.equal(await evaluate('document.querySelector("#privacy-continue").disabled'),true);
  const [[noConsent]]=await connection.query('SELECT COUNT(*) AS n FROM avaliacoes');
  assert.equal(noConsent.n,beforePrivacy.n);
  assert.equal(await evaluate('document.querySelector("#privacy-decline") === null'),true);
  // Acelera somente o relógio do aceite; confere que a aplicação solicita 30 segundos.
  await evaluate('window.originalTimeout=window.setTimeout;window.setTimeout=function(fn,ms){if(ms===30000){window.privacyDelay=ms;return originalTimeout(fn,30)}return originalTimeout(fn,ms)};aceiteInicial()');
  await until('document.querySelector(".sec") !== null');
  assert.equal(await evaluate('window.privacyDelay'),30000);
  await evaluate('window.setTimeout=window.originalTimeout;start(S.find(s=>s.id==="rx"))');
  await evaluate('document.querySelector("#privacy-accept").click()');
  assert.equal(await evaluate('document.querySelector("#privacy-continue").disabled'),false);
  assert.equal(await evaluate('document.querySelector("#privacy-accept").checked'),true);
  await evaluate('document.querySelector("#privacy-accept").click()');
  assert.equal(await evaluate('document.querySelector("#privacy-continue").disabled'),true);
  screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(SCREENSHOTS, 'aceite-lgpd-mobile.png'),Buffer.from(screenshot.data,'base64'));
  await evaluate('document.querySelector("#privacy-accept").click();document.querySelector("#privacy-continue").click()');
  await until('document.querySelector(".opt") !== null');
  await evaluate('document.querySelector(".opt").click();fila');
  const [[draft]]=await connection.query('SELECT id,privacidade_versao,privacidade_aceita_em,status FROM avaliacoes ORDER BY id DESC LIMIT 1');
  assert.equal(draft.status,'rascunho');assert.ok(draft.privacidade_aceita_em);
  const [[saved]]=await connection.query('SELECT COUNT(*) AS n FROM respostas WHERE avaliacao_id=?',[draft.id]);
  assert.equal(saved.n,1);
  const hospitalDateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const hospitalDateValue = type => hospitalDateParts.find(part => part.type === type).value;
  const hospitalDate = `${hospitalDateValue('year')}-${hospitalDateValue('month')}-${hospitalDateValue('day')}`;
  await evaluate('Q().forEach(q=>{ans.r[q.id]=q.tipo==="escala"?5:q.tipo==="nps"?10:[]});ans.d=' + JSON.stringify(hospitalDate) + ';ans.tu="Dia";ans.re="Paciente";ans.ti="SUS";T0=Date.now()-10000;st=Q().length;render()');
  assert.equal(await evaluate('document.querySelector("#send").disabled'),false);
  await evaluate('document.querySelector("#send").click()');
  await until('document.querySelector("#again") !== null');
  const [[complete]]=await connection.query('SELECT privacidade_versao,privacidade_aceita_em,status,telefone FROM avaliacoes ORDER BY id DESC LIMIT 1');
  assert.equal(complete.status,'concluida');assert.ok(complete.privacidade_aceita_em);assert.equal(complete.telefone,null);
  assert.deepEqual(errors,[]);
  // Seleção múltipla mantém nós, posição, foco e respostas ao voltar.
  await evaluate('cur=S.find(s=>s.id==="rx");ans={r:{},aceite_privacidade:true,privacidade_versao:PRIVACIDADE_VERSAO};st=Q().findIndex(q=>q.opcoes&&q.opcoes.length>2);render()');
  for (const width of [360,768,1280]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
    await evaluate('ans.r[Q()[st].id]=[];render();window.firstChip=document.querySelector(".chip");window.positions=Array.from(document.querySelectorAll(".chip")).map(e=>[e.offsetTop,e.offsetLeft]);firstChip.focus();firstChip.click();document.querySelectorAll(".chip")[1].click()');
    assert.equal(await evaluate('document.querySelectorAll(".chip[aria-pressed=true]").length'),2);
    assert.equal(await evaluate('firstChip===document.querySelector(".chip")'),true);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".chip")).map(e=>[e.offsetTop,e.offsetLeft])'),await evaluate('positions'));
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Pesquisa: '+width);
    await evaluate('document.querySelector("#go").click();document.querySelector("#back").click()');
    assert.equal(await evaluate('document.querySelectorAll(".chip[aria-pressed=true]").length'),2);
  }
  await evaluate('fila');
  // Cada alternativa deve ser independente em todos os setores, inclusive "Nada a melhorar".
  const questionarios = await evaluate('S.map(s=>({id:s.id,perguntas:PQ[s.id].filter(q=>q.tipo==="positivos"||q.tipo==="negativos").map(q=>({id:q.id,opcoes:q.opcoes}))}))');
  let verificadas = 0;
  for (const setor of questionarios) {
    await evaluate('fila');
    await evaluate('start(S.find(s=>s.id==='+JSON.stringify(setor.id)+'));ans.aceite_privacidade=true;ans.privacidade_versao=PRIVACIDADE_VERSAO');
    for (const q of setor.perguntas) {
      await evaluate('st=Q().findIndex(q=>q.id==='+q.id+');render()');
      for (let i=0;i<q.opcoes.length;i++) {
        await evaluate('document.querySelectorAll(".chip")['+i+'].click()');
        assert.deepEqual(await evaluate('ans.r[Q()[st].id]'),q.opcoes.slice(0,i+1));
      }
      await evaluate('fila');
      const [[salva]] = await connection.query('SELECT r.valores FROM respostas r JOIN avaliacoes a ON a.id=r.avaliacao_id WHERE a.token=? AND r.pergunta_id=?', [await evaluate('tok'),q.id]);
      assert.deepEqual(typeof salva.valores==='string'?JSON.parse(salva.valores):salva.valores,q.opcoes);
      await evaluate('document.querySelector("#go").click();document.querySelector("#back").click()');
      assert.equal(await evaluate('document.querySelectorAll(".chip[aria-pressed=true]").length'),q.opcoes.length);
      for (let i=0;i<q.opcoes.length;i++) {
        await evaluate('document.querySelectorAll(".chip")['+i+'].click()');
        assert.deepEqual(await evaluate('ans.r[Q()[st].id]'),q.opcoes.slice(i+1));
      }
      await evaluate('fila');
      verificadas++;
    }
  }
  console.log('Seleção múltipla: '+verificadas+' perguntas verificadas em '+questionarios.length+' setores, com persistência no banco.');
  for (const query of ['geral=1','setor=rx&nome=Raio-X','todos=1']) {
    await cdp('Page.navigate',{url:env.BASE_URL+'/qr.html?'+query+'&base='+encodeURIComponent('https://hospital.example')});
    await until('document.querySelector(".cartaz svg") !== null');
    assert.equal(await evaluate('document.querySelector(".cartaz")._url'),query.startsWith('setor')?'https://hospital.example/?setor=rx':'https://hospital.example/');
    assert.ok(await evaluate('document.querySelector(".cartaz")._qr.m>=4'));
    console.log('QR validado: URL e margem; decodificador nativo disponível:',await evaluate('typeof BarcodeDetector!=="undefined"'));
    for (const width of [360,768,1280]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'QR: '+width);
      assert.ok(await evaluate('document.querySelector(".qr").getBoundingClientRect().width >= Math.min(220, innerWidth * 0.55)'), 'QR legível: '+width);
      assert.ok(await evaluate('document.querySelector(".cartaz h2").getBoundingClientRect().width >= document.querySelector(".cartaz").getBoundingClientRect().width * 0.7'), 'Texto usa a largura do cartaz: '+width);
    }
    const pdf = await cdp('Page.printToPDF',{preferCSSPageSize:true,printBackground:true});
    const pages = (Buffer.from(pdf.data,'base64').toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
    assert.equal(pages,await evaluate('document.querySelectorAll(".cartaz").length'),'Uma página A4 por cartaz');
  }
  await cdp('Page.navigate',{url:env.BASE_URL+'/tv.html'});
  await until('document.querySelector(".k") !== null');
  for (const width of [360,768,1280]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'TV: '+width);
  }
  assert.deepEqual(errors,[]);
  console.log('Navegador: painel, senhas e pesquisa com aceite LGPD, recusa sem coleta e envio sem telefone OK.');
  await send('Browser.close'); ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if (server) server.kill(); if (chrome) chrome.kill();
  if (connection) { await connection.query('DROP DATABASE IF EXISTS `' + dbName + '`'); await connection.end(); }
});
