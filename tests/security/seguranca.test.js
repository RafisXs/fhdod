const test = require('node:test');
const assert = require('node:assert/strict');
require('../../backend/src/config/env');
if (!/^fhdod_verify_\d+$/.test(process.env.DB_NAME || '')) throw new Error('Execute pelo test:painel em banco temporário exclusivo.');
const { pool } = require('../../backend/src/config/db');
const BASE = process.env.BASE_URL;
const provisoria = 'Provisoria-teste-123';
const pessoal = 'Pessoal-teste-456';
const email = 'seguranca.' + Date.now() + '@teste.invalid';
async function req(method, path, body, cookie) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fhdod', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json(), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
test('Segurança de contas e trilha de auditoria', async t => {
  const manager = await req('POST', '/api/login', { email: process.env.TEST_GERENTE_EMAIL, senha: process.env.TEST_GERENTE_SENHA });
  assert.equal(manager.status, 200);
  const created = await req('POST', '/api/admin/usuarios', { nome: 'Teste de segurança', email, senha: provisoria, papel: 'visualizador' }, manager.cookie);
  assert.equal(created.status, 201);
  let user;
  await t.test('Senha provisória permite apenas perfil e alteração de senha', async () => {
    user = await req('POST', '/api/login', { email, senha: provisoria });
    assert.equal(user.json.trocar_senha, true);
    assert.equal((await req('GET', '/api/me', null, user.cookie)).status, 200);
    const forbidden = await req('GET', '/api/admin/avaliacoes', null, user.cookie);
    assert.equal(forbidden.status, 403); assert.equal(forbidden.json.codigo, 'TROCAR_SENHA');
  });
  const oldCookie = user.cookie;
  await t.test('Valida senha atual, repetição e limite de bytes UTF-8', async () => {
    assert.equal((await req('POST', '/api/senha', { senha_atual: 'incorreta', nova_senha: pessoal }, user.cookie)).status, 400);
    assert.equal((await req('POST', '/api/senha', { senha_atual: provisoria, nova_senha: provisoria }, user.cookie)).status, 400);
    assert.equal((await req('POST', '/api/senha', { senha_atual: provisoria, nova_senha: 'á'.repeat(37) }, user.cookie)).status, 400);
  });
  await t.test('Troca a própria senha e invalida sessão antiga', async () => {
    user = await req('POST', '/api/senha', { senha_atual: provisoria, nova_senha: pessoal }, oldCookie);
    assert.equal(user.status, 200);
    assert.equal((await req('GET', '/api/me', null, oldCookie)).status, 401);
    assert.equal((await req('GET', '/api/admin/avaliacoes', null, user.cookie)).status, 200);
    assert.equal((await req('GET', '/api/admin/auditoria', null, user.cookie)).status, 403);
  });
  await t.test('Cinco falhas bloqueiam a conta mesmo com a senha correta', async () => {
    for (let i=0; i<5; i++) assert.equal((await req('POST', '/api/login', { email, senha: 'incorreta' })).status, 401);
    assert.equal((await req('POST', '/api/login', { email, senha: pessoal })).status, 401);
    const [[u]] = await pool.query('SELECT tentativas_falhas, bloqueado_ate > UTC_TIMESTAMP() AS bloqueado FROM usuarios WHERE id=?', [created.json.id]);
    assert.equal(u.tentativas_falhas,5); assert.equal(u.bloqueado,1);
  });
  await t.test('Após expirar, login correto limpa o bloqueio', async () => {
    await pool.query('UPDATE usuarios SET bloqueado_ate=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE id=?',[created.json.id]);
    user = await req('POST','/api/login',{email,senha:pessoal}); assert.equal(user.status,200);
    const [[u]] = await pool.query('SELECT tentativas_falhas,bloqueado_ate FROM usuarios WHERE id=?',[created.json.id]);
    assert.equal(u.tentativas_falhas,0); assert.equal(u.bloqueado_ate,null);
  });
  await t.test('Redefinição pela gestão exige nova troca e revoga sessões',async()=>{
    assert.equal((await req('PATCH','/api/admin/usuarios/'+created.json.id,{senha:provisoria},manager.cookie)).status,200);
    assert.equal((await req('GET','/api/me',null,user.cookie)).status,401);
    const login=await req('POST','/api/login',{email,senha:provisoria});
    assert.equal(login.status,200); assert.equal(login.json.trocar_senha,true);
  });
  await t.test('Auditoria registra responsáveis sem senhas ou telefones',async()=>{
    const log=await req('GET','/api/admin/auditoria',null,manager.cookie); assert.equal(log.status,200);
    assert.ok(log.json.some(x=>x.acao==='senha.alterada' && x.usuario_id===created.json.id));
    assert.ok(log.json.some(x=>x.acao==='usuario.senha_redefinida'));
    const text=JSON.stringify(log.json); assert.ok(!text.includes(provisoria)); assert.ok(!text.includes(pessoal));
    assert.ok(log.json.some(x=>x.acao==='telefone.disponibilizado'));
  });
  await t.test('Auditoria cobre alterações de perguntas, setores e contatos',async()=>{
    const [events]=await pool.query('SELECT DISTINCT acao FROM auditoria');
    for (const action of ['perguntas.alteradas','setor.criado','setor.renomeado','setor.desativado','contato.atualizado','telefone.apagado','usuario.criado']) {
      assert.ok(events.some(x=>x.acao===action), action);
    }
  });
  await t.test('Falha da auditoria reverte a alteração correspondente',async()=>{
    const [[sector]]=await pool.query("SELECT id,nome FROM setores WHERE id='rec'");
    await pool.query("CREATE TRIGGER teste_falha_auditoria BEFORE INSERT ON auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha simulada da auditoria'");
    try {
      const result=await req('PATCH','/api/admin/setores/rec',{nome:'Nome que deve ser revertido'},manager.cookie);
      assert.equal(result.status,503);
      const [[after]]=await pool.query('SELECT nome FROM setores WHERE id=?',[sector.id]);
      assert.equal(after.nome,sector.nome);
      assert.equal((await req('GET','/api/admin/avaliacoes',null,manager.cookie)).status,503,'não disponibiliza telefones se não registrar o acesso');
    } finally { await pool.query('DROP TRIGGER teste_falha_auditoria'); }
  });
});
test.after(()=>pool.end());
