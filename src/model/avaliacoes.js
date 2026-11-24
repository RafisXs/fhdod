const { pool } = require('../db');
const { asJson } = require('../utils/util');
const { escopo } = require('../middleware/auth');

// Lê avaliações (já no formato usado pelo painel), respeitando o alcance do perfil.
async function carregarAvaliacoes(user, { where = '', params = [], limite = 500, antes = null } = {}) {
  const w = ["a.status = 'concluida'"];
  const pr = [];
  const so = escopo(user);
  if (so) { w.push('a.setor_id = ?'); pr.push(so); }
  // Visualizador nunca recebe telefone nem anotações de contato
  const ct = user.papel === 'visualizador' ? 'NULL AS telefone, NULL AS contato_status, NULL AS contato_obs' : 'a.telefone, a.contato_status, a.contato_obs';
  if (where) { w.push(where); pr.push(...params); }
  if (antes !== null) { w.push('a.id < ?'); pr.push(antes); }
  const [rows] = await pool.query(
    `SELECT a.id, DATE_FORMAT(a.criado_em, '%Y-%m-%dT%H:%i:%sZ') AS criado_em, a.setor_id AS setor, a.nps, a.nota_media, a.abaixo_media,
            a.data_atendimento, a.turno, a.respondente, a.tipo_atendimento, ${ct}
       FROM avaliacoes a ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.id DESC LIMIT ?`, [...pr, limite]);
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

async function* iterarAvaliacoes(user, options = {}) {
  let antes = null;
  do {
    const rows = await carregarAvaliacoes(user, { ...options, limite: 500, antes });
    if (!rows.length) return;
    yield rows;
    antes = rows[rows.length - 1].id;
    if (rows.length < 500) return;
  } while (true);
}

module.exports = { carregarAvaliacoes, iterarAvaliacoes };
