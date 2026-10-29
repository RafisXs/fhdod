// Regras de validação e gravação de uma avaliação enviada pelo paciente.
const crypto = require('crypto');
const { pool } = require('../db');
const { asJson, inteiro, TURNOS, RESPONDENTES, TIPOS, ABAIXO_MEDIA, NPS_MAX_DETRATOR } = require('./util');
const { escopo } = require('./auth');

class ErroValidacao extends Error {}
const falha = (msg) => { throw new ErroValidacao(msg); };

function validarData(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) falha('Data do atendimento inválida.');
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) falha('Data do atendimento inválida.');
  const hoje = Date.now();
  if (d.getTime() > hoje + 36 * 3600 * 1000) falha('A data do atendimento não pode ser futura.');
  if (d.getTime() < hoje - 400 * 86400 * 1000) falha('A data do atendimento é muito antiga.');
  return s;
}


// ---------------------------------------------------------------------------
// Validação de UMA resposta (usada tanto na gravação em tempo real quanto no envio completo)
// devolve a linha pronta para a tabela respostas: [pergunta_id, texto, tipo, valor_num, valores]
// ---------------------------------------------------------------------------
function linhaResposta(q, r) {
  if (q.tipo === 'nps') {
    const n = inteiro(r && r.n);
    if (!(n >= 1 && n <= 10)) falha('Nota de recomendação inválida.');
    return [q.id, q.texto, 'nps', n, null];
  }
  if (q.tipo === 'escala') {
    const n = inteiro(r && r.n);
    if (!(n >= 1 && n <= 5)) falha('Nota inválida.');
    return [q.id, q.texto, 'escala', n, null];
  }
  const v = Array.isArray(r && r.v) ? r.v : falha('Resposta inválida.');
  const unicos = [...new Set(v.map(String))];
  if (unicos.length > 10 || unicos.some((o) => !q.opcoes.includes(o))) falha('Opção inválida.');
  return [q.id, q.texto, q.tipo, null, JSON.stringify(unicos)];
}

async function perguntasAtivas(db, setor) {
  const [perg] = await db.query('SELECT id, ordem, texto, tipo, opcoes FROM perguntas WHERE setor_id = ? AND ativa = 1 ORDER BY ordem', [setor]);
  return perg.map((q) => ({ ...q, opcoes: asJson(q.opcoes) }));
}

// Nota média (só perguntas de nota), recomendação e "abaixo da média" a partir das respostas gravadas
function resumo(respostas) {
  const ns = respostas.filter((r) => r.tipo === 'escala').map((r) => r.valor_num);
  const np = respostas.find((r) => r.tipo === 'nps');
  const nps = np ? np.valor_num : null;
  const media = ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 100) / 100 : null;
  const abaixo = (media !== null && media < ABAIXO_MEDIA) || (nps !== null && nps <= NPS_MAX_DETRATOR);
  return { nps, media, abaixo };
}

// ---------------------------------------------------------------------------
// Gravação em tempo real: o paciente responde, cada resposta vai para o banco na hora.
// ---------------------------------------------------------------------------
const VALIDADE_RASCUNHO_HORAS = 24;

async function iniciarRascunho(setor) {
  setor = String(setor || '');
  const [[ok]] = await pool.query('SELECT COUNT(*) AS n FROM perguntas p JOIN setores s ON s.id = p.setor_id WHERE p.setor_id = ? AND p.ativa = 1 AND s.ativo = 1', [setor]);
  if (!ok.n) falha('Setor inválido.');
  const token = crypto.randomBytes(16).toString('hex');
  await pool.query("INSERT INTO avaliacoes (setor_id, status, token) VALUES (?, 'rascunho', ?)", [setor, token]);
  return token;
}

async function buscarRascunho(db, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{32}$/.test(token)) falha('Avaliação não encontrada. Recarregue a página.');
  const [rows] = await db.query(
    `SELECT id, setor_id FROM avaliacoes WHERE token = ? AND status = 'rascunho' AND criado_em >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [token, VALIDADE_RASCUNHO_HORAS]);
  if (!rows.length) falha('Esta avaliação não está mais aberta. Recarregue a página para começar de novo.');
  return rows[0];
}

async function gravarNaLinha(db, av, perg, r) {
  const q = perg.find((x) => x.id === inteiro(r && r.p));
  if (!q) falha('Resposta inválida.');
  const l = linhaResposta(q, r);
  await db.query(
    `INSERT INTO respostas (avaliacao_id, pergunta_id, pergunta_texto, tipo, valor_num, valores) VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE pergunta_texto = VALUES(pergunta_texto), valor_num = VALUES(valor_num), valores = VALUES(valores)`,
    [av.id, ...l]);
}

async function recalcular(db, avaliacaoId) {
  const [rs] = await db.query('SELECT tipo, valor_num FROM respostas WHERE avaliacao_id = ?', [avaliacaoId]);
  const { nps, media, abaixo } = resumo(rs);
  await db.query('UPDATE avaliacoes SET nps = ?, nota_media = ?, abaixo_media = ? WHERE id = ?', [nps, media, abaixo ? 1 : 0, avaliacaoId]);
  return { nps, media, abaixo };
}

// Grava (ou troca) uma resposta do rascunho
async function gravarResposta(token, r) {
  const av = await buscarRascunho(pool, token);
  const perg = await perguntasAtivas(pool, av.setor_id);
  await gravarNaLinha(pool, av, perg, r);
  await recalcular(pool, av.id);
}

// Finaliza: confere tudo, grava o contexto (dia, turno...) e o telefone, e libera para os painéis
async function concluirRascunho(token, p) {
  if (!p || typeof p !== 'object') falha('Dados inválidos.');
  const conn = await pool.getConnection();
  try {
    const av = await buscarRascunho(conn, token);
    const perg = await perguntasAtivas(conn, av.setor_id);
    if (!TURNOS.includes(p.turno)) falha('Turno inválido.');
    if (!RESPONDENTES.includes(p.respondente)) falha('Informe se você é paciente ou familiar.');
    if (!TIPOS.includes(p.tipo_atendimento)) falha('Tipo de atendimento inválido.');
    const data = validarData(p.data_atendimento);
    await conn.beginTransaction();
    // Reenvio de segurança: se alguma gravação em tempo real falhou (internet), as respostas vêm de novo aqui
    if (p.respostas !== undefined) {
      if (!Array.isArray(p.respostas)) falha('Respostas inválidas.');
      for (const r of p.respostas) await gravarNaLinha(conn, av, perg, r);
    }
    const [salvas] = await conn.query('SELECT pergunta_id, tipo, valor_num FROM respostas WHERE avaliacao_id = ?', [av.id]);
    const ids = new Set(salvas.map((x) => x.pergunta_id));
    if (perg.some((q) => q.tipo === 'nps' && !ids.has(q.id))) falha('Falta a nota de recomendação.');
    if (perg.some((q) => q.tipo === 'escala' && !ids.has(q.id))) falha('Responda todas as perguntas de nota.');
    const { abaixo, nps, media } = await recalcular(conn, av.id);

    let telefone = String(p.telefone || '').replace(/\D/g, '');
    if (telefone && !abaixo) telefone = '';
    if (telefone) {
      if (p.consentimento !== true) falha('Para deixar o telefone, é preciso autorizar o contato.');
      if (!/^[1-9][0-9]9?[0-9]{8}$/.test(telefone)) falha('Telefone inválido. Informe o DDD e o número.');
    }
    await conn.query(
      `UPDATE avaliacoes SET status = 'concluida', token = NULL, data_atendimento = ?, turno = ?, respondente = ?, tipo_atendimento = ?,
              telefone = ?, consentimento_contato = ?, criado_em = NOW() WHERE id = ?`,
      [data, p.turno, p.respondente, p.tipo_atendimento, telefone || null, telefone ? 1 : 0, av.id]);
    await conn.commit();
    return { id: av.id, nps, media, abaixo };
  } catch (e) { try { await conn.rollback(); } catch { /* sem transação aberta */ } throw e; } finally { conn.release(); }
}

// Envio completo de uma vez (usado pela API e pelos testes; a pesquisa usa a gravação em tempo real)
async function registrarAvaliacao(p) {
  if (!p || typeof p !== 'object') falha('Dados inválidos.');
  const setor = String(p.setor || '');
  const [perg] = await pool.query('SELECT p.id, p.ordem, p.texto, p.tipo, p.opcoes FROM perguntas p JOIN setores s ON s.id = p.setor_id WHERE p.setor_id = ? AND p.ativa = 1 AND s.ativo = 1 ORDER BY p.ordem', [setor]);
  if (!perg.length) falha('Setor inválido.');
  const porId = new Map(perg.map((q) => [q.id, { ...q, opcoes: asJson(q.opcoes) }]));

  const nps = inteiro(p.nps);
  if (!(nps >= 1 && nps <= 10)) falha('Nota de recomendação inválida.');
  if (!TURNOS.includes(p.turno)) falha('Turno inválido.');
  if (!RESPONDENTES.includes(p.respondente)) falha('Informe se você é paciente ou familiar.');
  if (!TIPOS.includes(p.tipo_atendimento)) falha('Tipo de atendimento inválido.');
  const data = validarData(p.data_atendimento);

  // Respostas: cada pergunta ativa (exceto a de recomendação) no máximo uma vez
  const lista = Array.isArray(p.respostas) ? p.respostas : falha('Respostas inválidas.');
  const vistas = new Set();
  const linhas = [];
  let soma = 0, qtd = 0;
  for (const r of lista) {
    const id = inteiro(r && r.p);
    const q = porId.get(id);
    if (!q || q.tipo === 'nps' || vistas.has(id)) falha('Resposta inválida.');
    vistas.add(id);
    const l = linhaResposta(q, r);
    if (q.tipo === 'escala') { soma += l[3]; qtd += 1; }
    linhas.push(l);
  }
  for (const q of porId.values()) {
    if (q.tipo === 'escala' && !vistas.has(q.id)) falha('Responda todas as perguntas de nota.');
  }
  const qNps = perg.find((q) => q.tipo === 'nps');
  linhas.push([qNps.id, qNps.texto, 'nps', nps, null]);

  const media = qtd ? Math.round((soma / qtd) * 100) / 100 : null;
  const abaixo = (media !== null && media < ABAIXO_MEDIA) || nps <= NPS_MAX_DETRATOR;

  // Telefone: só aceito quando a nota é abaixo da média e há autorização expressa
  let telefone = String(p.telefone || '').replace(/\D/g, '');
  if (telefone && !abaixo) telefone = '';
  if (telefone) {
    if (p.consentimento !== true) falha('Para deixar o telefone, é preciso autorizar o contato.');
    if (!/^[1-9][0-9]9?[0-9]{8}$/.test(telefone)) falha('Telefone inválido. Informe o DDD e o número.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT INTO avaliacoes (setor_id, nps, nota_media, abaixo_media, data_atendimento, turno, respondente, tipo_atendimento, telefone, consentimento_contato)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [setor, nps, media, abaixo ? 1 : 0, data, p.turno, p.respondente, p.tipo_atendimento, telefone || null, telefone ? 1 : 0]);
    await conn.query(
      'INSERT INTO respostas (avaliacao_id, pergunta_id, pergunta_texto, tipo, valor_num, valores) VALUES ?',
      [linhas.map((l) => [ins.insertId, ...l])]);
    await conn.commit();
    return ins.insertId;
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

// Lê avaliações (já no formato usado pelo painel), respeitando o alcance do perfil.
async function carregarAvaliacoes(user, { where = '', params = [], limite = 5000 } = {}) {
  const w = ["a.status = 'concluida'"];
  const pr = [];
  const so = escopo(user);
  if (so) { w.push('a.setor_id = ?'); pr.push(so); }
  // Visualizador nunca recebe telefone nem anotações de contato
  const ct = user.papel === 'visualizador' ? 'NULL AS telefone, NULL AS contato_status, NULL AS contato_obs' : 'a.telefone, a.contato_status, a.contato_obs';
  if (where) { w.push(where); pr.push(...params); }
  const [rows] = await pool.query(
    `SELECT a.id, DATE_FORMAT(a.criado_em, '%Y-%m-%dT%H:%i:%sZ') AS criado_em, a.setor_id AS setor, a.nps, a.nota_media, a.abaixo_media,
            a.data_atendimento, a.turno, a.respondente, a.tipo_atendimento, ${ct}
       FROM avaliacoes a ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.criado_em DESC LIMIT ?`, [...pr, limite]);
  const mapa = new Map(rows.map((r) => [r.id, Object.assign(r, { abaixo_media: !!r.abaixo_media, pos: [], neg: [], ns: [] })]));
  if (mapa.size) {
    const [rs] = await pool.query('SELECT avaliacao_id, tipo, valor_num, valores FROM respostas WHERE avaliacao_id IN (?)', [[...mapa.keys()]]);
    for (const r of rs) {
      const a = mapa.get(r.avaliacao_id);
      if (r.tipo === 'escala') a.ns.push(r.valor_num);
      else if (r.tipo === 'positivos') a.pos.push(...(asJson(r.valores) || []));
      else if (r.tipo === 'negativos') a.neg.push(...(asJson(r.valores) || []));
    }
  }
  return rows;
}

module.exports = { registrarAvaliacao, iniciarRascunho, gravarResposta, concluirRascunho, carregarAvaliacoes, ErroValidacao };
