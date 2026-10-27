// Atualiza um banco criado por uma versão anterior (pode rodar várias vezes sem estragar nada).
//   1) a pergunta de recomendação (1 a 10 com carinhas) passa da posição 5 para a 3;
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
const temCheck = async (c, tabela, nome) => {
  const [r] = await c.query("SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'", [tabela, nome]);
  return r.length > 0;
};

async function migrar(pool) {
  const feitos = [];
  const c = await pool.getConnection();
  try {
    // ---- 1) Pergunta de recomendação na 3ª posição ----
    const [[velha]] = await c.query("SELECT COUNT(*) AS n FROM perguntas WHERE tipo = 'nps' AND ordem <> ?", [NPS_ORDEM]);
    if (velha.n > 0) {
      if (await temCheck(c, 'perguntas', 'ck_perguntas_nps')) await c.query('ALTER TABLE perguntas DROP CHECK ck_perguntas_nps');
      if (await temCheck(c, 'perguntas', 'ck_perguntas_ordem')) await c.query('ALTER TABLE perguntas DROP CHECK ck_perguntas_ordem');
      await c.beginTransaction();
      try {
        // Passa por valores temporários porque (setor, ordem) é único. A recomendação vira a 3ª e as
        // perguntas que estavam nas posições 3 e 4 descem uma posição, mantendo textos e opções.
        await c.query('UPDATE perguntas SET ordem = ordem + 10 WHERE ordem >= ?', [NPS_ORDEM]);
        await c.query("UPDATE perguntas SET ordem = IF(tipo = 'nps', ?, ordem - 10 + 1) WHERE ordem > 10", [NPS_ORDEM]);
        await c.commit();
      } catch (e) { await c.rollback(); throw e; }
      await c.query('ALTER TABLE perguntas ADD CONSTRAINT ck_perguntas_ordem CHECK (ordem BETWEEN 1 AND 5)');
      await c.query(`ALTER TABLE perguntas ADD CONSTRAINT ck_perguntas_nps CHECK ((tipo = 'nps') = (ordem = ${Number(NPS_ORDEM)}))`);
      feitos.push('pergunta de recomendação movida para a posição 3');
    }

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
  } finally { c.release(); }
  return feitos;
}

module.exports = { migrar };
