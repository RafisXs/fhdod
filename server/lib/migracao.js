// Atualiza um banco criado por uma versão anterior (pode rodar várias vezes sem estragar nada).
//   1) a pergunta de recomendação (1 a 10 com carinhas) passa da posição 5 para a 3;
//   1b) perguntas sem limite de 5 (uma recomendação por setor, em qualquer posição) e setores ativáveis;
//   2) avaliações ganham "rascunho" (cada resposta é gravada na hora, antes de enviar).
// Num banco novo (schema.sql atual) não há nada a fazer.
const { NPS_ORDEM } = require('./util');

const temColuna = async (c, tabela, coluna) => {
  const [r] = await c.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [tabela, coluna]);
  return r.length > 0;
};
const temIndice = async (c, tabela, nome) => {
  const [r] = await c.query('SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1', [tabela, nome]);
  return r.length > 0;
};
const textoCheck = async (c, nome) => {
  const [r] = await c.query('SELECT CHECK_CLAUSE AS t FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?', [nome]);
  return r.length ? String(r[0].t) : null;
};
const temCheck = async (c, tabela, nome) => {
  const [r] = await c.query("SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'", [tabela, nome]);
  return r.length > 0;
};

async function migrar(pool) {
  const feitos = [];
  const c = await pool.getConnection();
  try {
    // ---- 1) Pergunta de recomendação na 3ª posição (versão antiga: estava na 5ª) ----
    let clausulaNps = await textoCheck(c, 'ck_perguntas_nps');
    if (clausulaNps && /`ordem`\s*=\s*5\)/.test(clausulaNps)) {
      if (await temCheck(c, 'perguntas', 'ck_perguntas_ordem')) await c.query('ALTER TABLE perguntas DROP CHECK ck_perguntas_ordem');
      await c.query('ALTER TABLE perguntas DROP CHECK ck_perguntas_nps'); // o antigo exigia a recomendação na 5ª posição
      clausulaNps = null;
      await c.beginTransaction();
      try {
        // Passa por valores temporários porque (setor, ordem) é único. A recomendação vira a 3ª e as
        // perguntas que estavam nas posições 3 e 4 descem uma posição, mantendo textos e opções.
        await c.query('UPDATE perguntas SET ordem = ordem + 10 WHERE ordem >= ?', [NPS_ORDEM]);
        await c.query("UPDATE perguntas SET ordem = IF(tipo = 'nps', ?, ordem - 10 + 1) WHERE ordem > 10", [NPS_ORDEM]);
        await c.commit();
      } catch (e) { await c.rollback(); throw e; }
      feitos.push('pergunta de recomendação movida para a posição 3');
    }

    // ---- 1b) Perguntas sem limite de 5 e setores que o gerente pode criar ----
    if (clausulaNps) await c.query('ALTER TABLE perguntas DROP CHECK ck_perguntas_nps'); // a posição deixa de ser fixa
    const [[tp]] = await c.query("SELECT DATA_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'perguntas' AND COLUMN_NAME = 'ordem'");
    if (tp.t !== 'smallint') { await c.query('ALTER TABLE perguntas MODIFY ordem SMALLINT NOT NULL'); feitos.push('perguntas: sem limite de 5 por setor'); }
    const clausulaOrdem = await textoCheck(c, 'ck_perguntas_ordem');
    if (clausulaOrdem && !/1000/.test(clausulaOrdem)) await c.query('ALTER TABLE perguntas DROP CHECK ck_perguntas_ordem');
    if (!(await temCheck(c, 'perguntas', 'ck_perguntas_ordem'))) await c.query('ALTER TABLE perguntas ADD CONSTRAINT ck_perguntas_ordem CHECK (ordem BETWEEN 1 AND 1000)');
    if (!(await temColuna(c, 'perguntas', 'nps_setor'))) {
      await c.query("ALTER TABLE perguntas ADD COLUMN nps_setor VARCHAR(10) GENERATED ALWAYS AS (IF(tipo = 'nps', setor_id, NULL)) STORED, ADD UNIQUE KEY uk_perguntas_um_nps (nps_setor)");
    }
    if (!(await temColuna(c, 'setores', 'ativo'))) {
      await c.query('ALTER TABLE setores ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1');
      feitos.push('setores: ativar e desativar');
    }
    const [[og]] = await c.query("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'setores' AND COLUMN_NAME = 'origem'");
    if (!/cadastrado/.test(og.t)) await c.query("ALTER TABLE setores MODIFY origem ENUM('site_oficial','pesquisa_impressa','prototipo','cadastrado') NOT NULL");

    // ---- 2) Rascunho: gravação de cada resposta na hora ----
    if (!(await temColuna(c, 'avaliacoes', 'status'))) {
      await c.query(`ALTER TABLE avaliacoes
        ADD COLUMN status ENUM('rascunho','concluida') NOT NULL DEFAULT 'concluida' AFTER setor_id,
        ADD COLUMN token CHAR(32) NULL AFTER status,
        ADD COLUMN atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER criado_em,
        MODIFY nps TINYINT NULL,
        MODIFY data_atendimento DATE NULL,
        MODIFY turno ENUM('Dia','Noite') NULL,
        MODIFY respondente ENUM('Paciente','Familiar') NULL,
        MODIFY tipo_atendimento ENUM('SUS','Plano de Saúde','Particular') NULL`);
      feitos.push('avaliações: colunas de rascunho');
    }
    if (!(await temIndice(c, 'avaliacoes', 'uk_avaliacoes_token'))) await c.query('ALTER TABLE avaliacoes ADD UNIQUE KEY uk_avaliacoes_token (token)');
    if (!(await temIndice(c, 'avaliacoes', 'ix_avaliacoes_status_criado'))) await c.query('ALTER TABLE avaliacoes ADD KEY ix_avaliacoes_status_criado (status, criado_em)');
    if (!(await temCheck(c, 'avaliacoes', 'ck_avaliacoes_concluida'))) {
      await c.query(`ALTER TABLE avaliacoes ADD CONSTRAINT ck_avaliacoes_concluida CHECK (status = 'rascunho' OR (nps IS NOT NULL AND data_atendimento IS NOT NULL
        AND turno IS NOT NULL AND respondente IS NOT NULL AND tipo_atendimento IS NOT NULL))`);
    }
    if (!(await temIndice(c, 'respostas', 'uk_respostas_avaliacao_pergunta'))) {
      await c.query('ALTER TABLE respostas ADD UNIQUE KEY uk_respostas_avaliacao_pergunta (avaliacao_id, pergunta_id)');
      feitos.push('respostas: uma resposta por pergunta');
    }
    // Atualiza apenas os enunciados padrão, mantendo textos personalizados e o histórico.
    const enunciados = require('./enunciados');
    const [atualizadas] = await c.query(
      `UPDATE perguntas SET texto = CASE texto ${enunciados.map(() => 'WHEN ? THEN ?').join(' ')} ELSE texto END
       WHERE BINARY texto IN (${enunciados.map(() => '?').join(',')})`,
      [...enunciados.flat(), ...enunciados.map(([anterior]) => anterior)]);
    if (atualizadas.affectedRows) feitos.push('enunciados padrão revisados');
  } finally { c.release(); }
  return feitos;
}

module.exports = { migrar };
