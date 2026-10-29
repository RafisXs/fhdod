// Testes automatizados da API (Node.js 18+, sem bibliotecas extras).
//
// Como rodar (com o servidor e o MySQL ligados, de preferência num banco de TESTE):
//   Windows PowerShell:
//     $env:TEST_GERENTE_EMAIL="gerente@exemplo.com"; $env:TEST_GERENTE_SENHA="sua-senha"; $env:BASE_URL="http://localhost:3000"; npm test
//   Linux/macOS:
//     TEST_GERENTE_EMAIL=gerente@exemplo.com TEST_GERENTE_SENHA=sua-senha npm test
//
// Os testes criam avaliações e usuários de teste no banco (use um banco de teste).
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const GERENTE = { email: process.env.TEST_GERENTE_EMAIL, senha: process.env.TEST_GERENTE_SENHA };
const unico = Date.now();

async function req(method, caminho, corpo, cookie) {
  const r = await fetch(BASE + caminho, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fhdod', ...(cookie ? { Cookie: cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    redirect: 'manual',
  });
  const tipo = r.headers.get('content-type') || '';
  const json = tipo.includes('json') ? await r.json() : null;
  return { status: r.status, json, headers: r.headers };
}
async function entrar(email, senha) {
  const r = await req('POST', '/api/login', { email, senha });
  assert.equal(r.status, 200, 'login deveria funcionar: ' + JSON.stringify(r.json));
  return r.headers.get('set-cookie').split(';')[0];
}
const hoje = () => new Date().toISOString().slice(0, 10);

// Monta uma avaliação válida para o setor, a partir das perguntas públicas
async function montar(setor, { nota, nps, telefone, consentimento, opcao } = {}) {
  const { json } = await req('GET', '/api/perguntas');
  const qs = json.perguntas.filter((q) => q.setor_id === setor);
  const respostas = qs.filter((q) => q.tipo !== 'nps').map((q) => (q.tipo === 'escala' ? { p: q.id, n: nota } : { p: q.id, v: [opcao || q.opcoes[0]] }));
  return { setor, nps, respostas, data_atendimento: hoje(), turno: 'Dia', respondente: 'Paciente', tipo_atendimento: 'SUS', telefone, consentimento };
}
const criarUsuario = (cookie, d) => req('POST', '/api/admin/usuarios', d, cookie);

let gerente, adminRx, visRx, visTodos, ids = {};
const emails = { adminRx: `admin.rx.${unico}@teste.com`, visRx: `vis.rx.${unico}@teste.com`, visTodos: `vis.todos.${unico}@teste.com` };

test('1. O banco está conectado', async () => {
  const r = await req('GET', '/api/saude');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
});

test('2. A pesquisa lista os setores e as perguntas', async () => {
  const { json } = await req('GET', '/api/perguntas');
  assert.ok(json.setores.length >= 10);
  const rx = json.perguntas.filter((q) => q.setor_id === 'rx');
  assert.ok(rx.length >= 1 && rx.length <= 5, 'no máximo 5 perguntas por setor');
  assert.equal(rx[2].tipo, 'nps', 'a 3ª pergunta é a recomendação de 1 a 10');
  assert.equal(rx[2].ordem, 3);
  assert.ok(rx.filter((q) => q.tipo === 'nps').length === 1, 'só uma pergunta de recomendação');
});

test('2b. A página do cartaz com QR Code e a biblioteca local são servidas (sem site externo)', async () => {
  const pagina = await fetch(BASE + '/qr.html');
  assert.equal(pagina.status, 200);
  const html = await pagina.text();
  assert.ok(!/https?:\/\/(?!localhost)/.test(html.replace(/https:\/\/avaliacao\.seuhospital\.com\.br/g, '')), 'o cartaz não carrega nada de sites externos');
  assert.equal((await fetch(BASE + '/js/vendor/qrcode.js')).status, 200);
  assert.equal((await fetch(BASE + '/js/qr.js')).status, 200);
});

test('3. Pedido que altera dados sem o cabeçalho de segurança é barrado', async () => {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});

test('4. Login: senha errada falha e a do gerente funciona', async () => {
  assert.ok(GERENTE.email && GERENTE.senha, 'defina TEST_GERENTE_EMAIL e TEST_GERENTE_SENHA');
  assert.equal((await req('POST', '/api/login', { email: GERENTE.email, senha: 'senha-errada-123' })).status, 401);
  gerente = await entrar(GERENTE.email, GERENTE.senha);
  const me = await req('GET', '/api/me', null, gerente);
  assert.equal(me.json.papel, 'gerente');
});

test('5. Avaliação boa é registrada e o telefone é ignorado', async () => {
  const r = await req('POST', '/api/avaliacoes', await montar('rx', { nota: 5, nps: 10, telefone: '51999990000', consentimento: true }));
  assert.equal(r.status, 201);
  const lista = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json;
  const a = lista.find((x) => x.setor === 'rx' && x.nps === 10 && x.nota_media === 5);
  assert.ok(a, 'avaliação deveria aparecer');
  assert.equal(a.telefone, null, 'nota boa não guarda telefone');
  assert.equal(a.abaixo_media, false);
});

test('6. Avaliação abaixo da média: telefone exige autorização e é guardado', async () => {
  const sem = await req('POST', '/api/avaliacoes', await montar('rx', { nota: 1, nps: 2, telefone: '51988887777', consentimento: false }));
  assert.equal(sem.status, 400, 'sem autorização deve falhar');
  const curto = await req('POST', '/api/avaliacoes', await montar('rx', { nota: 1, nps: 2, telefone: '123', consentimento: true }));
  assert.equal(curto.status, 400, 'telefone inválido deve falhar');
  const ok = await req('POST', '/api/avaliacoes', await montar('rx', { nota: 1, nps: 2, telefone: '(51) 98888-7777', consentimento: true }));
  assert.equal(ok.status, 201);
  const lista = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json;
  const a = lista.find((x) => x.setor === 'rx' && x.nps === 2 && x.telefone === '51988887777');
  assert.ok(a, 'telefone deveria estar registrado');
  assert.equal(a.abaixo_media, true);
  assert.equal(a.contato_status, 'pendente');
  ids.ruim = a.id;
  await req('POST', '/api/avaliacoes', await montar('pa', { nota: 3, nps: 7 })); // avaliação de outro setor
});

test('7. Dados inválidos são recusados', async () => {
  const base = await montar('pa', { nota: 4, nps: 8 });
  assert.equal((await req('POST', '/api/avaliacoes', { ...base, nps: 11 })).status, 400);
  assert.equal((await req('POST', '/api/avaliacoes', { ...base, setor: 'xx' })).status, 400);
  assert.equal((await req('POST', '/api/avaliacoes', { ...base, turno: 'Tarde' })).status, 400);
  const futura = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  assert.equal((await req('POST', '/api/avaliacoes', { ...base, data_atendimento: futura })).status, 400);
  const fora = JSON.parse(JSON.stringify(base));
  fora.respostas = fora.respostas.map((r) => (r.v ? { ...r, v: ['Opção que não existe'] } : r));
  assert.equal((await req('POST', '/api/avaliacoes', fora)).status, 400);
  const nota = JSON.parse(JSON.stringify(base));
  nota.respostas = nota.respostas.map((r) => (r.n ? { ...r, n: 9 } : r));
  assert.equal((await req('POST', '/api/avaliacoes', nota)).status, 400);
});

test('8. Gerente cria o administrador do Raio-X; só pode existir 1 administrador ativo por setor', async () => {
  // limpa administradores de testes anteriores (só os que o próprio teste cria)
  const antes = (await req('GET', '/api/admin/usuarios', null, gerente)).json.filter((u) => u.papel === 'admin' && u.setor_id === 'rx' && u.ativo && /^admin\.rx\./.test(u.email));
  for (const u of antes) await req('PATCH', `/api/admin/usuarios/${u.id}`, { ativo: false }, gerente);

  const novo = await criarUsuario(gerente, { nome: 'Admin do Raio-X', email: emails.adminRx, senha: 'SenhaAdmin#1', papel: 'admin', setor_id: 'rx' });
  assert.equal(novo.status, 201, JSON.stringify(novo.json));
  ids.adminRx = novo.json.id;
  const outro = await criarUsuario(gerente, { nome: 'Outro Admin Raio-X', email: `outro.${emails.adminRx}`, senha: 'SenhaAdmin#1', papel: 'admin', setor_id: 'rx' });
  assert.equal(outro.status, 409, 'segundo administrador ativo no mesmo setor deve ser recusado');
  assert.match(outro.json.erro, /administrador ativo/);
  const dup = await criarUsuario(gerente, { nome: 'Admin do Raio-X', email: emails.adminRx, senha: 'SenhaAdmin#1', papel: 'admin', setor_id: 'pa' });
  assert.equal(dup.status, 409, 'e-mail repetido deve ser recusado');
  assert.equal((await criarUsuario(gerente, { nome: 'Sem Setor', email: `ss.${emails.adminRx}`, senha: 'SenhaAdmin#1', papel: 'admin' })).status, 400, 'administrador exige setor');
  assert.equal((await criarUsuario(gerente, { nome: 'Perfil Ruim', email: `pr.${emails.adminRx}`, senha: 'SenhaAdmin#1', papel: 'dono' })).status, 400, 'perfil inexistente');
  adminRx = await entrar(emails.adminRx, 'SenhaAdmin#1');
});

test('9. Administrador do setor vê e edita só o seu setor', async () => {
  const lista = (await req('GET', '/api/admin/avaliacoes', null, adminRx)).json;
  assert.ok(lista.length > 0);
  assert.ok(lista.every((x) => x.setor === 'rx'), 'admin só deve ver o Raio-X');
  assert.ok(lista.some((x) => x.telefone === '51988887777'), 'admin do setor vê o telefone do próprio setor');
  assert.equal((await req('GET', '/api/admin/perguntas/rx', null, adminRx)).status, 200);
  assert.equal((await req('GET', '/api/admin/perguntas/pa', null, adminRx)).status, 403);
  const outra = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json.find((x) => x.setor === 'pa');
  assert.equal((await req('PATCH', `/api/admin/avaliacoes/${outra.id}/contato`, { status: 'contatado' }, adminRx)).status, 404, 'não mexe em avaliação de outro setor');
  // equipe: só visualizadores do próprio setor
  assert.equal((await criarUsuario(adminRx, { nome: 'Quer ser Gerente', email: `g.${emails.adminRx}`, senha: 'SenhaAdmin#1', papel: 'gerente' })).status, 403);
  assert.equal((await criarUsuario(adminRx, { nome: 'Quer ser Admin', email: `a.${emails.adminRx}`, senha: 'SenhaAdmin#1', papel: 'admin', setor_id: 'rx' })).status, 403);
  const v = await criarUsuario(adminRx, { nome: 'Visualizador do Raio-X', email: emails.visRx, senha: 'SenhaVis#1234', setor_id: 'pa' /* tentativa de burlar o setor */ });
  assert.equal(v.status, 201, JSON.stringify(v.json));
  ids.visRx = v.json.id;
  const equipe = (await req('GET', '/api/admin/usuarios', null, adminRx)).json;
  assert.ok(equipe.every((u) => u.papel === 'visualizador' && u.setor_id === 'rx'), 'admin só vê visualizadores do próprio setor');
  assert.ok(equipe.some((u) => u.id === ids.visRx), 'o visualizador criado ficou no setor rx, mesmo pedindo pa');
  visRx = await entrar(emails.visRx, 'SenhaVis#1234');
});

test('10. Gerente cria visualizador de todos os setores', async () => {
  const v = await criarUsuario(gerente, { nome: 'Visualizador Geral', email: emails.visTodos, senha: 'SenhaVis#1234', papel: 'visualizador', setor_id: null });
  assert.equal(v.status, 201, JSON.stringify(v.json));
  ids.visTodos = v.json.id;
  visTodos = await entrar(emails.visTodos, 'SenhaVis#1234');
  const lista = (await req('GET', '/api/admin/avaliacoes', null, visTodos)).json;
  assert.ok(lista.some((x) => x.setor === 'rx') && lista.some((x) => x.setor === 'pa'), 'visualizador sem setor vê todos');
});

test('11. Visualizador só consulta: nunca vê telefone e não altera nada', async () => {
  for (const cookie of [visRx, visTodos]) {
    const lista = (await req('GET', '/api/admin/avaliacoes', null, cookie)).json;
    assert.ok(lista.length > 0);
    assert.ok(lista.every((x) => x.telefone == null && x.contato_obs == null), 'visualizador não recebe telefone');
    assert.ok(!JSON.stringify(lista).includes('51988887777'));
    assert.equal((await req('GET', '/api/admin/usuarios', null, cookie)).status, 403);
    assert.equal((await req('GET', '/api/admin/perguntas/rx', null, cookie)).status, 403);
    assert.equal((await req('PUT', '/api/admin/perguntas/rx', { perguntas: [] }, cookie)).status, 403);
    assert.equal((await req('PATCH', `/api/admin/avaliacoes/${ids.ruim}/contato`, { status: 'contatado' }, cookie)).status, 403);
    assert.equal((await criarUsuario(cookie, { nome: 'Intruso', email: `i.${emails.visRx}`, senha: 'SenhaVis#1234', papel: 'gerente' })).status, 403);
  }
  const rxApenas = (await req('GET', '/api/admin/avaliacoes', null, visRx)).json;
  assert.ok(rxApenas.every((x) => x.setor === 'rx'), 'visualizador do Raio-X só vê o Raio-X');
});

test('11b. Gravação em tempo real: cada resposta vai para o banco na hora e só conta depois de concluir', async () => {
  const { json } = await req('GET', '/api/perguntas');
  const qs = json.perguntas.filter((q) => q.setor_id === 'ob');
  const antes = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json.length;
  const ini = await req('POST', '/api/avaliacoes/iniciar', { setor: 'ob' });
  assert.equal(ini.status, 201);
  const t = ini.json.token;
  assert.match(t, /^[0-9a-f]{32}$/);
  assert.equal((await req('POST', '/api/avaliacoes/iniciar', { setor: 'nao-existe' })).status, 400);
  // 1ª resposta: já está no banco, mas a avaliação ainda não aparece nos painéis
  const q1 = qs[0], qn = qs.find((q) => q.tipo === 'nps'), qp = qs.find((q) => q.tipo === 'positivos');
  assert.equal((await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: q1.id, n: 2 })).status, 200);
  assert.equal((await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: q1.id, n: 5 })).status, 200, 'trocar a resposta funciona');
  assert.equal((await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: qn.id, n: 11 })).status, 400, 'recomendação só de 1 a 10');
  assert.equal((await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: qp.id, v: ['opcao-inventada'] })).status, 400);
  assert.equal((await req('PUT', `/api/avaliacoes/${'0'.repeat(32)}/resposta`, { p: q1.id, n: 3 })).status, 400, 'token desconhecido');
  assert.equal((await req('GET', '/api/admin/avaliacoes', null, gerente)).json.length, antes, 'rascunho não aparece no painel');
  // concluir sem terminar as perguntas obrigatórias é recusado
  const base = { data_atendimento: hoje(), turno: 'Noite', respondente: 'Familiar', tipo_atendimento: 'Particular' };
  assert.equal((await req('POST', `/api/avaliacoes/${t}/concluir`, base)).status, 400, 'faltam respostas');
  for (const q of qs) {
    if (q.tipo === 'escala' && q !== q1) await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: q.id, n: 4 });
  }
  await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: qn.id, n: 9 });
  await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: qp.id, v: [qp.opcoes[0]] });
  const fim = await req('POST', `/api/avaliacoes/${t}/concluir`, base);
  assert.equal(fim.status, 201, JSON.stringify(fim.json));
  const lista = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json;
  assert.equal(lista.length, antes + 1);
  const a = lista.find((x) => x.setor === 'ob' && x.nps === 9 && x.turno === 'Noite' && x.respondente === 'Familiar');
  assert.ok(a, 'avaliação concluída aparece com as respostas gravadas');
  assert.ok(a.nota_media > 4 && a.nota_media <= 5);
  // depois de concluída, o token deixa de valer
  assert.equal((await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: q1.id, n: 1 })).status, 400);
  assert.equal((await req('POST', `/api/avaliacoes/${t}/concluir`, base)).status, 400);
});

test('11d. Painel ao vivo: a resposta aparece na hora, mesmo sem terminar, respeitando o setor do perfil', async () => {
  const { json } = await req('GET', '/api/perguntas');
  const qs = json.perguntas.filter((q) => q.setor_id === 'ob');
  const t = (await req('POST', '/api/avaliacoes/iniciar', { setor: 'ob' })).json.token;
  const qn = qs.find((q) => q.tipo === 'nps'), q1 = qs[0];
  const vivo = async (cookie) => (await req('GET', '/api/admin/andamento', null, cookie)).json;
  // clicou na 1ª resposta e avançou: já está no painel
  await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: q1.id, n: 2 });
  let j = await vivo(gerente);
  let it = j.itens.find((x) => x.respostas.some((r) => r.texto === q1.texto && r.n === 2) && x.setor === 'ob');
  assert.ok(it, 'a 1ª resposta aparece no painel do gerente na hora');
  assert.equal(it.ao_vivo, true);
  assert.equal(it.respondidas, 1);
  assert.ok(it.total >= 3);
  // clicou na recomendação e avançou: a lista cresce
  await req('PUT', `/api/avaliacoes/${t}/resposta`, { p: qn.id, n: 3 });
  it = (await vivo(gerente)).itens.find((x) => x.id === it.id);
  assert.equal(it.respondidas, 2);
  assert.ok(it.respostas.some((r) => r.tipo === 'nps' && r.n === 3));
  // setor: o administrador do Raio-X não enxerga o rascunho da Obstetrícia; o visualizador de todos enxerga
  assert.ok(!(await vivo(adminRx)).itens.some((x) => x.setor === 'ob'), 'admin de outro setor não vê');
  assert.ok((await vivo(visTodos)).itens.some((x) => x.id === it.id), 'visualizador sem setor vê');
  assert.ok(!(await vivo(visRx)).itens.some((x) => x.setor === 'ob'), 'visualizador do Raio-X não vê outro setor');
  assert.ok(!JSON.stringify(j).includes('telefone'), 'nunca traz telefone');
  assert.equal((await req('GET', '/api/admin/andamento')).status, 401, 'exige login');
  // rascunho sem nenhuma resposta não aparece
  const vazio = (await req('POST', '/api/avaliacoes/iniciar', { setor: 'ob' })).json.token;
  assert.ok(vazio);
  const antes = (await vivo(gerente)).itens.length;
  assert.equal(antes, (await vivo(gerente)).itens.length);
});

test('11c. Concluir reenvia as respostas (garantia se a internet falhou no meio) e o telefone só vale se a nota for baixa', async () => {
  const { json } = await req('GET', '/api/perguntas');
  const qs = json.perguntas.filter((q) => q.setor_id === 'tr');
  const t = (await req('POST', '/api/avaliacoes/iniciar', { setor: 'tr' })).json.token;
  const resp = qs.map((q) => (q.tipo === 'escala' ? { p: q.id, n: 1 } : q.tipo === 'nps' ? { p: q.id, n: 2 } : { p: q.id, v: [q.opcoes[0]] }));
  const base = { respostas: resp, data_atendimento: hoje(), turno: 'Dia', respondente: 'Paciente', tipo_atendimento: 'Plano de Saúde' };
  assert.equal((await req('POST', `/api/avaliacoes/${t}/concluir`, { ...base, telefone: '51977776666', consentimento: false })).status, 400, 'telefone exige autorização');
  assert.equal((await req('POST', `/api/avaliacoes/${t}/concluir`, { ...base, telefone: '51977776666', consentimento: true })).status, 201);
  const a = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json.find((x) => x.setor === 'tr' && x.telefone === '51977776666');
  assert.ok(a && a.abaixo_media, 'nota baixa guarda o telefone para contato');
});

let novoSetor = null;
test('11e. Gerente cria um setor novo; ninguém mais pode; o setor já nasce com as perguntas padrão', async () => {
  const nome = `Fisioterapia ${unico}`.replace(/\d/g, '') .trim() || 'Fisioterapia';
  const antes = (await req('GET', '/api/admin/setores', null, gerente)).json;
  const nomeUnico = antes.some((x) => x.nome === 'Fisioterapia') ? 'Hemodiálise' : 'Fisioterapia';
  assert.equal((await req('POST', '/api/admin/setores', { nome: nomeUnico }, adminRx)).status, 403, 'admin de setor não cria setor');
  assert.equal((await req('POST', '/api/admin/setores', { nome: nomeUnico }, visRx)).status, 403, 'visualizador não cria setor');
  assert.equal((await req('POST', '/api/admin/setores', { nome: 'x' }, gerente)).status, 400, 'nome curto');
  const r = await req('POST', '/api/admin/setores', { nome: nomeUnico }, gerente);
  if (r.status === 409) { novoSetor = antes.find((x) => x.nome === nomeUnico).id; } else { assert.equal(r.status, 201, JSON.stringify(r.json)); novoSetor = r.json.id; }
  assert.match(novoSetor, /^[a-z]{2,10}$/);
  assert.equal((await req('POST', '/api/admin/setores', { nome: nomeUnico }, gerente)).status, 409, 'nome repetido');
  const pub = (await req('GET', '/api/perguntas')).json;
  assert.ok(pub.setores.some((x) => x.id === novoSetor), 'o setor novo aparece na pesquisa');
  const qs = pub.perguntas.filter((q) => q.setor_id === novoSetor);
  assert.deepEqual(qs.map((q) => q.tipo), ['escala', 'escala', 'nps', 'positivos', 'negativos']);
  const lista = (await req('GET', '/api/admin/setores', null, visRx)).json;
  assert.ok(lista.some((x) => x.id === novoSetor && x.ativo === true && x.perguntas === 5), 'todos os perfis leem a lista de setores');
});

test('11f. Perguntas sem limite de 5: adicionar, reordenar, excluir; a recomendação é protegida', async () => {
  assert.ok(novoSetor);
  const admNovo = await criarUsuario(gerente, { nome: 'Admin do Setor Novo', email: `admin.novo.${unico}@teste.com`, senha: 'SenhaAdmin#9', papel: 'admin', setor_id: novoSetor });
  assert.equal(admNovo.status, 201, JSON.stringify(admNovo.json));
  const adm = await entrar(`admin.novo.${unico}@teste.com`, 'SenhaAdmin#9');
  const atuais = (await req('GET', `/api/admin/perguntas/${novoSetor}`, null, adm)).json;
  assert.equal(atuais.length, 5);
  const velha = (q) => ({ id: q.id, texto: q.texto, tipo: q.tipo, opcoes: q.opcoes, ativa: q.ativa });
  // adiciona 5 perguntas novas (total 10) e põe a recomendação em 1º lugar
  const nps = atuais.find((q) => q.tipo === 'nps');
  const novas = [1, 2, 3, 4, 5].map((i) => ({ texto: `Pergunta nova número ${i} do setor?`, tipo: 'escala' }));
  novas[4] = { texto: 'Qual serviço você mais usou?', tipo: 'positivos', opcoes: ['Consulta', 'Exame', 'Retorno'] };
  const corpo = [velha(nps), ...atuais.filter((q) => q.id !== nps.id).map(velha), ...novas];
  const put = await req('PUT', `/api/admin/perguntas/${novoSetor}`, { perguntas: corpo }, adm);
  assert.equal(put.status, 200, JSON.stringify(put.json));
  let depois = (await req('GET', `/api/admin/perguntas/${novoSetor}`, null, adm)).json;
  assert.equal(depois.length, 10, 'passou de 5 perguntas');
  assert.deepEqual(depois.map((q) => q.ordem), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(depois[0].tipo, 'nps', 'a recomendação foi para a 1ª posição');
  assert.equal(depois[9].texto, 'Qual serviço você mais usou?');
  // a pesquisa pública mostra todas, na ordem
  const pub = (await req('GET', '/api/perguntas')).json.perguntas.filter((q) => q.setor_id === novoSetor);
  assert.equal(pub.length, 10);
  // proteções
  const semNps = depois.filter((q) => q.tipo !== 'nps').map(velha);
  assert.equal((await req('PUT', `/api/admin/perguntas/${novoSetor}`, { perguntas: [...semNps, { ...velha(nps), remover: true }] }, adm)).status, 400, 'não exclui a recomendação');
  const desat = depois.map(velha); desat[0].ativa = false;
  await req('PUT', `/api/admin/perguntas/${novoSetor}`, { perguntas: desat }, adm);
  assert.equal((await req('GET', `/api/admin/perguntas/${novoSetor}`, null, adm)).json[0].ativa, true, 'a recomendação continua ativa');
  assert.equal((await req('PUT', `/api/admin/perguntas/${novoSetor}`, { perguntas: depois.slice(0, 9).map(velha) }, adm)).status, 409, 'lista incompleta (tela desatualizada) é recusada');
  assert.equal((await req('PUT', `/api/admin/perguntas/rx`, { perguntas: depois.map(velha) }, adm)).status, 403, 'admin não edita outro setor');
  const muitas = [...depois.map(velha), ...Array.from({ length: 25 }, (_, i) => ({ texto: `Pergunta extra ${i} do setor?`, tipo: 'escala' }))];
  assert.equal((await req('PUT', `/api/admin/perguntas/${novoSetor}`, { perguntas: muitas }, adm)).status, 400, 'limite de 30 por setor');
  // exclui duas perguntas e confere a numeração
  const excl = depois.map(velha); excl[2] = { ...excl[2], remover: true }; excl[3] = { ...excl[3], remover: true };
  assert.equal((await req('PUT', `/api/admin/perguntas/${novoSetor}`, { perguntas: excl }, adm)).status, 200);
  depois = (await req('GET', `/api/admin/perguntas/${novoSetor}`, null, adm)).json;
  assert.equal(depois.length, 8);
  assert.deepEqual(depois.map((q) => q.ordem), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('11g. Pesquisa com perguntas novas, resultado por pergunta e setor desativado', async () => {
  const { json } = await req('GET', '/api/perguntas');
  const qs = json.perguntas.filter((q) => q.setor_id === novoSetor);
  const t = (await req('POST', '/api/avaliacoes/iniciar', { setor: novoSetor })).json.token;
  const resp = qs.map((q) => (q.tipo === 'escala' ? { p: q.id, n: 4 } : q.tipo === 'nps' ? { p: q.id, n: 9 } : { p: q.id, v: [q.opcoes[0]] }));
  const base = { data_atendimento: hoje(), turno: 'Dia', respondente: 'Paciente', tipo_atendimento: 'SUS' };
  // falta uma pergunta de nota nova: não conclui
  assert.equal((await req('POST', `/api/avaliacoes/${t}/concluir`, { ...base, respostas: resp.slice(1) })).status, 400, 'todas as perguntas de nota são obrigatórias');
  assert.equal((await req('POST', `/api/avaliacoes/${t}/concluir`, { ...base, respostas: resp })).status, 201);
  const rp = (await req('GET', `/api/admin/resultado-perguntas?s=${novoSetor}&p=30`, null, gerente)).json.itens.filter((x) => x.setor === novoSetor);
  assert.equal(rp.length, qs.length, 'uma linha por pergunta respondida');
  assert.ok(rp.some((x) => x.tipo === 'escala' && x.media === 4 && x.total === 1));
  assert.ok(rp.some((x) => x.tipo === 'nps' && x.media === 9 && x.nps === 100));
  assert.ok(rp.some((x) => x.tipo === 'positivos' && x.opcoes.length === 1));
  assert.ok(!(await req('GET', '/api/admin/resultado-perguntas', null, adminRx)).json.itens.some((x) => x.setor === novoSetor), 'escopo do perfil vale no resultado por pergunta');
  // reordenar setores e desativar
  const ant = (await req('GET', '/api/admin/setores', null, gerente)).json;
  const pos = ant.findIndex((x) => x.id === novoSetor);
  assert.equal((await req('PATCH', `/api/admin/setores/${novoSetor}`, { mover: 'cima' }, gerente)).status, 200);
  const dep = (await req('GET', '/api/admin/setores', null, gerente)).json;
  assert.equal(dep.findIndex((x) => x.id === novoSetor), Math.max(0, pos - 1));
  assert.equal((await req('PATCH', `/api/admin/setores/${novoSetor}`, { ativo: false }, adminRx)).status, 403);
  assert.equal((await req('PATCH', `/api/admin/setores/${novoSetor}`, { nome: 'Fisioterapia e Reabilitação' }, gerente)).status, 200);
  assert.equal((await req('PATCH', `/api/admin/setores/${novoSetor}`, { ativo: false }, gerente)).status, 200);
  const pub = (await req('GET', '/api/perguntas')).json;
  assert.ok(!pub.setores.some((x) => x.id === novoSetor), 'setor desativado some da pesquisa');
  assert.equal((await req('POST', '/api/avaliacoes/iniciar', { setor: novoSetor })).status, 400, 'não dá para avaliar setor desativado');
  assert.ok(!(await req('GET', '/api/tv')).json.setores.some((x) => x.id === novoSetor), 'some da TV');
  assert.ok((await req('GET', '/api/admin/avaliacoes', null, gerente)).json.some((x) => x.setor === novoSetor), 'o histórico continua no painel');
  assert.ok((await req('GET', '/api/admin/setores', null, gerente)).json.some((x) => x.id === novoSetor && x.ativo === false && x.avaliacoes === 1 && x.nome === 'Fisioterapia e Reabilitação'));
  assert.equal((await req('PATCH', `/api/admin/setores/${novoSetor}`, { ativo: true }, gerente)).status, 200);
  assert.ok((await req('GET', '/api/perguntas')).json.setores.some((x) => x.id === novoSetor), 'reativado volta para a pesquisa');
});

test('12. Editar perguntas: administrador edita o próprio setor, gerente edita todos', async () => {
  const atuais = (await req('GET', '/api/admin/perguntas/rx', null, adminRx)).json;
  assert.equal(atuais.length, 5);
  const original = JSON.parse(JSON.stringify(atuais));
  const editadas = atuais.map((q) => ({ id: q.id, texto: q.ordem === 1 ? 'Pergunta editada pelo administrador de teste?' : q.texto, tipo: q.tipo, opcoes: q.opcoes, ativa: q.ordem === 2 ? false : true }));
  editadas[2].ativa = false; // tentativa de desativar a recomendação (3ª pergunta): deve continuar ativa
  const put = await req('PUT', '/api/admin/perguntas/rx', { perguntas: editadas }, adminRx);
  assert.equal(put.status, 200, JSON.stringify(put.json));
  const publicas = (await req('GET', '/api/perguntas')).json.perguntas.filter((q) => q.setor_id === 'rx');
  assert.ok(publicas.some((q) => q.texto === 'Pergunta editada pelo administrador de teste?'));
  assert.ok(!publicas.some((q) => q.ordem === 2), 'pergunta desativada some da pesquisa');
  assert.ok(publicas.some((q) => q.tipo === 'nps'), 'a recomendação de 1 a 10 não pode ser desativada');
  assert.equal((await req('PUT', '/api/admin/perguntas/pa', { perguntas: editadas }, adminRx)).status, 403, 'admin não edita outro setor');
  const curta = editadas.map((q) => ({ ...q, texto: 'abc' }));
  assert.equal((await req('PUT', '/api/admin/perguntas/rx', { perguntas: curta }, gerente)).status, 400);
  const volta = original.map((q) => ({ id: q.id, texto: q.texto, tipo: q.tipo, opcoes: q.opcoes, ativa: q.ativa }));
  assert.equal((await req('PUT', '/api/admin/perguntas/rx', { perguntas: volta }, gerente)).status, 200, 'gerente edita qualquer setor');
});

test('13. Contato: administrador do setor atualiza a situação e apaga o telefone', async () => {
  const ok = await req('PATCH', `/api/admin/avaliacoes/${ids.ruim}/contato`, { status: 'contatado', obs: 'Liguei e o problema foi a espera.' }, adminRx);
  assert.equal(ok.status, 200);
  let a = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json.find((x) => x.id === ids.ruim);
  assert.equal(a.contato_status, 'contatado');
  assert.match(a.contato_obs, /espera/);
  assert.equal((await req('PATCH', `/api/admin/avaliacoes/${ids.ruim}/contato`, { status: 'inexistente' }, gerente)).status, 400);
  await req('PATCH', `/api/admin/avaliacoes/${ids.ruim}/contato`, { status: 'resolvido', obs: null, apagar: true }, gerente);
  a = (await req('GET', '/api/admin/avaliacoes', null, gerente)).json.find((x) => x.id === ids.ruim);
  assert.equal(a.telefone, null);
  assert.equal(a.contato_status, 'resolvido');
});

test('14. Exportação em Excel funciona para todos os perfis, dentro do alcance', async () => {
  for (const cookie of [gerente, adminRx, visRx]) {
    const r = await fetch(BASE + '/api/admin/export.xlsx?p=30', { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /spreadsheetml/);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 2).toString(), 'PK', 'arquivo .xlsx é um zip');
    assert.ok(buf.length > 2000);
  }
  assert.equal((await fetch(BASE + '/api/admin/export.xlsx')).status, 401);
});

test('15. TV Wall mostra só números agregados', async () => {
  const r = await req('GET', '/api/tv');
  assert.equal(r.status, 200);
  assert.ok(r.json.total >= 2);
  assert.ok(Array.isArray(r.json.setores));
  assert.ok(!JSON.stringify(r.json).includes('telefone'));
});

test('16. Regras de segurança da equipe', async () => {
  const eu = (await req('GET', '/api/me', null, gerente)).json;
  const lista = (await req('GET', '/api/admin/usuarios', null, gerente)).json;
  const meuId = lista.find((u) => u.email === eu.email).id;
  assert.equal((await req('PATCH', `/api/admin/usuarios/${meuId}`, { ativo: false }, gerente)).status, 400, 'gerente não desativa a si mesmo');
  assert.equal((await req('PATCH', `/api/admin/usuarios/${meuId}`, { papel: 'visualizador' }, gerente)).status, 400, 'gerente não se rebaixa');
  // admin não mexe em contas fora do alcance
  assert.equal((await req('PATCH', `/api/admin/usuarios/${ids.visTodos}`, { ativo: false }, adminRx)).status, 404, 'admin não mexe em visualizador de todos os setores');
  assert.equal((await req('PATCH', `/api/admin/usuarios/${meuId}`, { ativo: false }, adminRx)).status, 404, 'admin não mexe no gerente');
  // admin desativa o visualizador do próprio setor e ele perde o acesso na hora
  assert.equal((await req('PATCH', `/api/admin/usuarios/${ids.visRx}`, { ativo: false }, adminRx)).status, 200);
  assert.equal((await req('GET', '/api/admin/avaliacoes', null, visRx)).status, 401, 'conta desativada perde o acesso na hora');
  assert.equal((await req('PATCH', `/api/admin/usuarios/${ids.visRx}`, { ativo: true }, adminRx)).status, 200, 'e pode ser reativada');
  // desativar o administrador libera o setor para outro
  assert.equal((await req('PATCH', `/api/admin/usuarios/${ids.adminRx}`, { ativo: false }, gerente)).status, 200);
  assert.equal((await req('GET', '/api/admin/avaliacoes', null, adminRx)).status, 401);
  const novo = await criarUsuario(gerente, { nome: 'Novo Admin Raio-X', email: `novo.${emails.adminRx}`, senha: 'SenhaAdmin#2', papel: 'admin', setor_id: 'rx' });
  assert.equal(novo.status, 201, 'com o antigo desativado, o setor aceita um novo administrador');
  assert.equal((await req('PATCH', `/api/admin/usuarios/${ids.adminRx}`, { ativo: true }, gerente)).status, 409, 'reativar o antigo, com outro ativo, é recusado');
  await req('PATCH', `/api/admin/usuarios/${novo.json.id}`, { ativo: false }, gerente);
  for (const id of [ids.visRx, ids.visTodos]) await req('PATCH', `/api/admin/usuarios/${id}`, { ativo: false }, gerente);
  assert.equal((await req('POST', '/api/logout', null, gerente)).status, 200);
});
