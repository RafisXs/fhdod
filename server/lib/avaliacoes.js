// Regras de validação e gravação de uma avaliação enviada pelo paciente.
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

async function registrarAvaliacao(p) {
  if (!p || typeof p !== 'object') falha('Dados inválidos.');
  const setor = String(p.setor || '');
  const [perg] = await pool.query('SELECT id, ordem, texto, tipo, opcoes FROM perguntas WHERE setor_id = ? AND ativa = 1 ORDER BY ordem', [setor]);
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
    if (q.tipo === 'escala') {
      const n = inteiro(r.n);
      if (!(n >= 1 && n <= 5)) falha('Nota inválida.');
      soma += n; qtd += 1;
      linhas.push([q.id, q.texto, 'escala', n, null]);
    } else {
      const v = Array.isArray(r.v) ? r.v : falha('Resposta inválida.');
      const unicos = [...new Set(v.map(String))];
      if (unicos.length > 10 || unicos.some((o) => !q.opcoes.includes(o))) falha('Opção inválida.');
      linhas.push([q.id, q.texto, q.tipo, null, JSON.stringify(unicos)]);
    }
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
  const w = [];
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

module.exports = { registrarAvaliacao, carregarAvaliacoes, ErroValidacao };
