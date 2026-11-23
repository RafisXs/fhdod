const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

async function auditar(db, req, acao, recurso, recursoId = null, detalhes = null) {
  // Apenas metadados definidos pelo servidor: nunca incluir corpos de pedidos ou telefones.
  await db.query('INSERT INTO auditoria (usuario_id, acao, recurso, recurso_id, detalhes) VALUES (?,?,?,?,?)',
    [req.user ? req.user.id : null, acao, recurso, recursoId == null ? null : String(recursoId), detalhes ? JSON.stringify(detalhes) : null]);
}

async function transacao(req, acao, recurso, id, executar) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const result = await executar(c);
    await auditar(c, req, acao, recurso, typeof id === 'function' ? id(result) : id);
    await c.commit();
    return result;
  } catch (e) { await c.rollback(); throw e; }
  finally { c.release(); }
}

function senhaValida(s) {
  return typeof s === 'string' && s.length >= 8 && Buffer.byteLength(s, 'utf8') <= 72;
}

async function alterarSenha(req, atual, nova) {
  if (!senhaValida(nova)) return { status: 400, erro: 'A nova senha deve ter pelo menos 8 caracteres e no máximo 72 bytes.' };
  if (typeof atual !== 'string' || Buffer.byteLength(atual, 'utf8') > 72) return { status: 400, erro: 'Informe a senha atual.' };
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [[u]] = await c.query('SELECT *, bloqueado_ate > UTC_TIMESTAMP() AS bloqueado FROM usuarios WHERE id=? FOR UPDATE', [req.user.id]);
    if (!u || !u.ativo || Number(u.versao_sessao) !== Number(req.user.versao_sessao)) { await c.rollback(); return { status: 401, erro: 'Sessão expirada. Entre novamente.' }; }
    if (u.bloqueado) { await c.rollback(); return { status: 429, erro: 'Conta temporariamente bloqueada. Aguarde 15 minutos.' }; }
    if (!await bcrypt.compare(atual, u.senha_hash)) {
      await falhaSenha(c, u);
      await auditar(c, req, 'senha.atual_incorreta', 'usuario', u.id);
      await c.commit();
      return { status: 400, erro: 'Senha atual incorreta.' };
    }
    if (await bcrypt.compare(nova, u.senha_hash)) { await c.rollback(); return { status: 400, erro: 'A nova senha deve ser diferente da senha atual.' }; }
    const hash = await bcrypt.hash(nova, 12);
    await c.query('UPDATE usuarios SET senha_hash=?, trocar_senha=0, versao_sessao=versao_sessao+1, tentativas_falhas=0, bloqueado_ate=NULL WHERE id=?', [hash, u.id]);
    await auditar(c, req, 'senha.alterada', 'usuario', u.id);
    await c.commit();
    return { usuario: { ...u, versao_sessao: Number(u.versao_sessao) + 1, trocar_senha: 0 } };
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}

async function falhaSenha(c, u) {
  const tentativas = u.bloqueado_ate ? 1 : Number(u.tentativas_falhas) + 1;
  await c.query(`UPDATE usuarios SET tentativas_falhas=?, bloqueado_ate=IF(? >= ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${BLOQUEIO_MINUTOS} MINUTE), NULL) WHERE id=?`,
    [tentativas, tentativas, MAX_TENTATIVAS, u.id]);
}

async function migrarSeguranca(c) {
  let atualizarPadrao = false;
  const colunas = {
    trocar_senha: 'TINYINT(1) NOT NULL DEFAULT 0',
    versao_sessao: 'INT UNSIGNED NOT NULL DEFAULT 0',
    tentativas_falhas: 'INT UNSIGNED NOT NULL DEFAULT 0',
    bloqueado_ate: 'DATETIME NULL',
  };
  for (const [nome, tipo] of Object.entries(colunas)) {
    const [r] = await c.query('SELECT COLUMN_DEFAULT AS padrao FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=\'usuarios\' AND COLUMN_NAME=?', [nome]);
    if (!r.length) await c.query(`ALTER TABLE usuarios ADD COLUMN ${nome} ${tipo}`);
    if (nome === 'trocar_senha' && (!r.length || String(r[0].padrao) !== '1')) atualizarPadrao = true;
  }
  if (atualizarPadrao) await c.query('ALTER TABLE usuarios ALTER COLUMN trocar_senha SET DEFAULT 1');
  await c.query(`CREATE TABLE IF NOT EXISTS auditoria (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NULL,
    acao VARCHAR(60) NOT NULL,
    recurso VARCHAR(40) NOT NULL,
    recurso_id VARCHAR(100) NULL,
    detalhes JSON NULL,
    KEY ix_auditoria_data (criado_em), KEY ix_auditoria_usuario (usuario_id, criado_em)
  ) ENGINE=InnoDB`);
}

module.exports = { auditar, transacao, senhaValida, alterarSenha, falhaSenha, migrarSeguranca };
