// Rotas da área restrita (gerente, administrador de setor e visualizador).
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { pool } = require('../db');
const { auditar, transacao, senhaValida } = require('../services/seguranca');
const { exigirLogin, exigirPapel, podeSetor, escopo } = require('../middleware/auth');
const { carregarAvaliacoes, iterarAvaliacoes } = require('../model/avaliacoes');
const { asJson, erro, inteiro, TURNOS, TIPOS, STATUS, MAX_PERGUNTAS, PERGUNTAS_PADRAO, celulaSegura } = require('../utils/util');


const SETOR_RE = /^[a-z]{2,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Avaliações (painel): todos os perfis, dentro do seu alcance ----------
exports.avaliacoes = async (req, res) => {
  const rows = [];
  for await (const page of iterarAvaliacoes(req.user)) rows.push(...page);
  const ids = rows.filter(x => x.telefone).map(x => x.id);
  if (ids.length) await auditar(pool, req, 'telefone.disponibilizado', 'avaliacao', null, { ids });
  res.set('Cache-Control', 'no-store');
  res.json(rows);
};
exports.paginas = async (req, res) => {
  const antes = req.query.antes === undefined ? null : inteiro(req.query.antes);
  if (antes !== null && (!Number.isSafeInteger(antes) || antes < 1)) return erro(res, 400, 'Página inválida.');
  const itens = await carregarAvaliacoes(req.user, { antes });
  const ids = itens.filter(x => x.telefone).map(x => x.id);
  if (ids.length) await auditar(pool, req, 'telefone.disponibilizado', 'avaliacao', null, { ids });
  res.json({ itens, proxima: itens.length === 500 ? itens[itens.length - 1].id : null });
};

exports.auditoria = async (req, res) => {
  const antes = /^\d+$/.test(String(req.query.antes || '')) ? req.query.antes : null;
  const [rows] = await pool.query(`SELECT a.id, DATE_FORMAT(a.criado_em, '%Y-%m-%dT%H:%i:%sZ') AS criado_em,
    a.usuario_id, u.nome AS usuario, a.acao, a.recurso, a.recurso_id, a.detalhes
    FROM auditoria a LEFT JOIN usuarios u ON u.id=a.usuario_id
    ${antes ? 'WHERE a.id < ?' : ''} ORDER BY a.id DESC LIMIT 100`, antes ? [antes] : []);
  res.set('Cache-Control', 'no-store');
  res.json(rows);
};

// ---------- Ao vivo: avaliações em andamento ou abandonadas (cada resposta já está no banco) ----------
// Mostra quem está respondendo agora e o que já respondeu, mesmo sem terminar o formulário.
// Nunca traz telefone (o telefone só existe depois de enviar). Respeita o setor do perfil.
const AO_VIVO_SEGUNDOS = 30 * 60; // sem mexer há mais de 30 min = abandonada
exports.andamento = async (req, res) => {
  const so = escopo(req.user);
  const filtro = so ? ' AND a.setor_id = ?' : '';
  const pr = so ? [so] : [];
  const [rascunhos] = await pool.query(
    `SELECT a.id, a.setor_id AS setor, DATE_FORMAT(a.criado_em, '%Y-%m-%dT%H:%i:%sZ') AS criado_em,
            DATE_FORMAT(a.atualizado_em, '%Y-%m-%dT%H:%i:%sZ') AS atualizado_em,
            TIMESTAMPDIFF(SECOND, a.atualizado_em, NOW()) AS ha_seg,
            (SELECT COUNT(*) FROM respostas r WHERE r.avaliacao_id = a.id) AS respondidas,
            (SELECT COUNT(*) FROM perguntas p WHERE p.setor_id = a.setor_id AND p.ativa = 1) AS total
       FROM avaliacoes a
      WHERE a.status = 'rascunho' AND a.atualizado_em >= DATE_SUB(NOW(), INTERVAL 7 DAY)${filtro}
        AND EXISTS (SELECT 1 FROM respostas r WHERE r.avaliacao_id = a.id)
      ORDER BY a.atualizado_em DESC LIMIT 200`, pr);
  const mapa = new Map(rascunhos.map((x) => [x.id, { ...x, ao_vivo: x.ha_seg <= AO_VIVO_SEGUNDOS, respostas: [] }]));
  if (mapa.size) {
    const [rs] = await pool.query(
      `SELECT r.avaliacao_id, r.pergunta_texto AS texto, r.tipo, r.valor_num AS n, r.valores AS v, p.ordem
         FROM respostas r LEFT JOIN perguntas p ON p.id = r.pergunta_id WHERE r.avaliacao_id IN (?) ORDER BY p.ordem`, [[...mapa.keys()]]);
    for (const x of rs) mapa.get(x.avaliacao_id).respostas.push({ ordem: x.ordem, texto: x.texto, tipo: x.tipo, n: x.n, v: asJson(x.v) });
  }
  const [[c]] = await pool.query(`SELECT COUNT(*) AS n FROM avaliacoes a WHERE a.status = 'concluida'${filtro}`, pr);
  res.json({ concluidas: Number(c.n), itens: [...mapa.values()] });
};

// ---------- Contatos: telefone das avaliações abaixo da média (gerente e admin) ----------
exports.contato = async (req, res) => {
  const id = inteiro(req.params.id);
  const [rows] = await pool.query('SELECT setor_id, telefone FROM avaliacoes WHERE id = ?', [id]);
  const a = rows[0];
  if (!a || !podeSetor(req.user, a.setor_id)) return erro(res, 404, 'Avaliação não encontrada.');
  const { status, obs, apagar } = req.body || {};
  if (!STATUS.includes(status)) return erro(res, 400, 'Situação inválida.');
  const texto = obs == null ? null : String(obs).trim().slice(0, 500) || null;
  await transacao(req, apagar === true ? 'telefone.apagado' : 'contato.atualizado', 'avaliacao', id, async c => {
  if (apagar === true) {
    await c.query('UPDATE avaliacoes SET telefone = NULL, consentimento_contato = 0, contato_status = ?, contato_obs = ?, contato_em = NOW(), contato_por = ? WHERE id = ?', [status, texto, req.user.id, id]);
  } else {
    await c.query('UPDATE avaliacoes SET contato_status = ?, contato_obs = ?, contato_em = NOW(), contato_por = ? WHERE id = ?', [status, texto, req.user.id, id]);
  }
  });
  res.json({ ok: true });
};

// ---------- Perguntas (gerente: todos os setores; admin: o seu setor) ----------
exports.perguntas = async (req, res) => {
  const setor = String(req.params.setor);
  if (!SETOR_RE.test(setor) || !podeSetor(req.user, setor)) return erro(res, 403, 'Você não gerencia este setor.');
  const [rows] = await pool.query('SELECT id, ordem, texto, tipo, opcoes, ativa FROM perguntas WHERE setor_id = ? ORDER BY ordem', [setor]);
  res.json(rows.map((q) => ({ ...q, opcoes: asJson(q.opcoes), ativa: !!q.ativa })));
};

// Salva a lista completa de perguntas do setor, na ordem em que vem:
//  - itens com "id" atualizam a pergunta; itens sem "id" são perguntas novas;
//  - "remover: true" exclui a pergunta (as respostas já dadas ficam, com o texto da época);
//  - a pergunta de recomendação (nps) não some, não é desativada e não muda de tipo.
exports.salvarPerguntas = async (req, res) => {
  const setor = String(req.params.setor);
  if (!SETOR_RE.test(setor) || !podeSetor(req.user, setor)) return erro(res, 403, 'Você não gerencia este setor.');
  const [atuais] = await pool.query('SELECT id, tipo FROM perguntas WHERE setor_id = ?', [setor]);
  if (!atuais.length) return erro(res, 404, 'Setor não encontrado.');
  const porId = new Map(atuais.map((q) => [q.id, q]));
  const lista = Array.isArray(req.body && req.body.perguntas) ? req.body.perguntas : null;
  if (!lista || !lista.length) return erro(res, 400, 'Dados inválidos.');
  if (lista.some(q => !q || typeof q !== 'object' || Array.isArray(q))) return erro(res, 400, 'Dados inválidos.');
  // A lista precisa trazer todas as perguntas atuais (evita apagar sem querer com a tela desatualizada)
  const idsEnviados = lista.map((q) => inteiro(q && q.id)).filter((n) => Number.isInteger(n));
  if (new Set(idsEnviados).size !== idsEnviados.length || idsEnviados.length !== atuais.length || atuais.some((q) => !idsEnviados.includes(q.id))) {
    return erro(res, 409, 'A lista de perguntas mudou enquanto você editava. Recarregue a página e tente de novo.');
  }
  const mantidas = [], excluir = [];
  let pos = 0;
  for (const q of lista) {
    const id = inteiro(q.id);
    const atual = Number.isInteger(id) ? porId.get(id) : null;
    if (q.remover === true) {
      if (!atual) continue; // pergunta nova que o usuário descartou antes de salvar
      if (atual.tipo === 'nps') return erro(res, 400, 'A pergunta de recomendação (1 a 10) não pode ser excluída. Você pode mudar o texto e a posição.');
      excluir.push(atual.id);
      continue;
    }
    pos += 1;
    const rot = `Pergunta ${pos}`;
    const texto = String(q.texto || '').trim();
    if (texto.length < 5 || texto.length > 160) return erro(res, 400, `${rot}: o texto deve ter de 5 a 160 caracteres.`);
    const nps = atual && atual.tipo === 'nps';
    const tipo = nps ? 'nps' : q.tipo;
    if (!['escala', 'positivos', 'negativos'].includes(tipo) && !nps) return erro(res, 400, `${rot}: tipo inválido.`);
    let opcoes = null;
    if (tipo === 'positivos' || tipo === 'negativos') {
      const lim = Array.isArray(q.opcoes) ? q.opcoes.map((o) => String(o).trim()).filter(Boolean) : [];
      opcoes = [...new Set(lim)];
      if (opcoes.length < 2 || opcoes.length > 10) return erro(res, 400, `${rot}: informe de 2 a 10 opções.`);
      if (opcoes.some((o) => o.length > 40)) return erro(res, 400, `${rot}: cada opção pode ter até 40 caracteres.`);
    }
    mantidas.push({ id: atual ? atual.id : null, texto, tipo, opcoes: opcoes ? JSON.stringify(opcoes) : null, ativa: nps ? 1 : (q.ativa === false ? 0 : 1) });
  }
  if (mantidas.length > MAX_PERGUNTAS) return erro(res, 400, `Cada setor pode ter no máximo ${MAX_PERGUNTAS} perguntas.`);
  if (!mantidas.some((q) => q.tipo === 'nps')) return erro(res, 400, 'O setor precisa manter a pergunta de recomendação (1 a 10).');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const id of excluir) await conn.query('DELETE FROM perguntas WHERE id = ? AND setor_id = ?', [id, setor]);
    // Posições temporárias (500+) porque (setor, posição) é único; depois voltam para 1, 2, 3...
    for (let i = 0; i < mantidas.length; i++) {
      const q = mantidas[i], tmp = 500 + i + 1;
      if (q.id) await conn.query('UPDATE perguntas SET texto = ?, tipo = ?, opcoes = ?, ativa = ?, ordem = ? WHERE id = ? AND setor_id = ?', [q.texto, q.tipo, q.opcoes, q.ativa, tmp, q.id, setor]);
      else await conn.query('INSERT INTO perguntas (setor_id, ordem, texto, tipo, opcoes, ativa) VALUES (?,?,?,?,?,?)', [setor, tmp, q.texto, q.tipo, q.opcoes, q.ativa]);
    }
    await conn.query('UPDATE perguntas SET ordem = ordem - 500 WHERE setor_id = ? AND ordem > 500', [setor]);
    await auditar(conn, req, 'perguntas.alteradas', 'setor', setor);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json({ ok: true });
};

// ---------- Setores (todos os perfis leem; só o gerente cria e altera) ----------
// Setor desativado some da pesquisa e da TV, mas o histórico fica. Não há exclusão definitiva.
exports.setores = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.nome, s.ordem, s.ativo, s.origem,
            (SELECT COUNT(*) FROM perguntas p WHERE p.setor_id = s.id AND p.ativa = 1) AS perguntas,
            (SELECT COUNT(*) FROM avaliacoes a WHERE a.setor_id = s.id AND a.status = 'concluida') AS avaliacoes
       FROM setores s ORDER BY s.ordem, s.nome`);
  res.json(rows.map((x) => ({ ...x, ativo: !!x.ativo, perguntas: Number(x.perguntas), avaliacoes: Number(x.avaliacoes) })));
};

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
async function gerarIdSetor(conn, nome) {
  const letras = semAcento(nome).toLowerCase().replace(/[^a-z]/g, '');
  if (letras.length < 2) return null;
  const base = letras.slice(0, 10);
  for (const cand of [base, ...[...'abcdefghijklmnopqrstuvwxyz'].map((l) => base.slice(0, 9) + l)]) {
    const [r] = await conn.query('SELECT 1 FROM setores WHERE id = ?', [cand]);
    if (!r.length) return cand;
  }
  return null;
}
const nomeSetorValido = (v) => { const n = String(v || '').trim().replace(/\s+/g, ' '); return n.length >= 3 && n.length <= 60 ? n : null; };

exports.criarSetor = async (req, res) => {
  const nome = nomeSetorValido(req.body && req.body.nome);
  if (!nome) return erro(res, 400, 'Informe o nome do setor (de 3 a 60 caracteres).');
  const conn = await pool.getConnection();
  try {
    const [dup] = await conn.query('SELECT 1 FROM setores WHERE nome = ?', [nome]);
    if (dup.length) return erro(res, 409, 'Já existe um setor com este nome.');
    const id = await gerarIdSetor(conn, nome);
    if (!id) return erro(res, 400, 'Use um nome com pelo menos 2 letras.');
    await conn.beginTransaction();
    const [[o]] = await conn.query('SELECT COALESCE(MAX(ordem), 0) + 1 AS o FROM setores');
    if (o.o > 120) { await conn.rollback(); return erro(res, 400, 'Limite de setores atingido.'); }
    await conn.query("INSERT INTO setores (id, nome, ordem, origem, ativo) VALUES (?,?,?, 'cadastrado', 1)", [id, nome, o.o]);
    for (let i = 0; i < PERGUNTAS_PADRAO.length; i++) {
      const q = PERGUNTAS_PADRAO[i];
      await conn.query('INSERT INTO perguntas (setor_id, ordem, texto, tipo, opcoes) VALUES (?,?,?,?,?)', [id, i + 1, q.texto, q.tipo, q.opcoes ? JSON.stringify(q.opcoes) : null]);
    }
    await auditar(conn, req, 'setor.criado', 'setor', id);
    await conn.commit();
    res.status(201).json({ id, nome });
  } catch (e) { try { await conn.rollback(); } catch { /* sem transação */ } throw e; } finally { conn.release(); }
};

exports.alterarSetor = async (req, res) => {
  const id = String(req.params.id);
  if (!SETOR_RE.test(id)) return erro(res, 404, 'Setor não encontrado.');
  const [rows] = await pool.query('SELECT id, nome, ordem, ativo FROM setores WHERE id = ?', [id]);
  if (!rows.length) return erro(res, 404, 'Setor não encontrado.');
  const b = req.body || {};
  if (b.ativo !== undefined && typeof b.ativo !== 'boolean') return erro(res, 400, 'Dados inválidos.');
  if (b.mover !== undefined && !['cima', 'baixo'].includes(b.mover)) return erro(res, 400, 'Dados inválidos.');
  if (b.nome !== undefined) {
    const nome = nomeSetorValido(b.nome);
    if (!nome) return erro(res, 400, 'Informe o nome do setor (de 3 a 60 caracteres).');
    const [dup] = await pool.query('SELECT 1 FROM setores WHERE nome = ? AND id <> ?', [nome, id]);
    if (dup.length) return erro(res, 409, 'Já existe um setor com este nome.');
    await transacao(req, 'setor.renomeado', 'setor', id, c => c.query('UPDATE setores SET nome = ? WHERE id = ?', [nome, id]));
  }
  if (b.ativo !== undefined) {
    if (typeof b.ativo !== 'boolean') return erro(res, 400, 'Dados inválidos.');
    if (!b.ativo) {
      const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM setores WHERE ativo = 1 AND id <> ?', [id]);
      if (!c.n) return erro(res, 400, 'Mantenha pelo menos um setor ativo na pesquisa.');
    }
    await transacao(req, b.ativo ? 'setor.ativado' : 'setor.desativado', 'setor', id, c => c.query('UPDATE setores SET ativo = ? WHERE id = ?', [b.ativo ? 1 : 0, id]));
  }
  if (b.mover !== undefined) {
    const dir = b.mover === 'cima' ? -1 : b.mover === 'baixo' ? 1 : 0;
    if (!dir) return erro(res, 400, 'Dados inválidos.');
    const [todos] = await pool.query('SELECT id FROM setores ORDER BY ordem, nome');
    const i = todos.findIndex((x) => x.id === id), j = i + dir;
    if (j >= 0 && j < todos.length) {
      [todos[i], todos[j]] = [todos[j], todos[i]];
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (let k = 0; k < todos.length; k++) await conn.query('UPDATE setores SET ordem = ? WHERE id = ?', [k + 1, todos[k].id]);
        await auditar(conn, req, 'setor.reordenado', 'setor', id);
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    }
  }
  res.json({ ok: true });
};

// ---------- Resultado por pergunta (nota média, recomendação e opções mais escolhidas) ----------
exports.resultados = async (req, res) => {
  const q = req.query, w = ["a.status = 'concluida'"], p = [];
  const so = escopo(req.user);
  if (so) { w.push('a.setor_id = ?'); p.push(so); } else if (SETOR_RE.test(String(q.s || ''))) { w.push('a.setor_id = ?'); p.push(q.s); }
  if (['7', '30', '90'].includes(String(q.p))) { w.push('a.criado_em >= DATE_SUB(NOW(), INTERVAL ? DAY)'); p.push(Number(q.p)); }
  if (TURNOS.includes(q.t)) { w.push('a.turno = ?'); p.push(q.t); }
  if (TIPOS.includes(q.u)) { w.push('a.tipo_atendimento = ?'); p.push(q.u); }
  const [rows] = await pool.query(
    `SELECT a.setor_id AS setor, r.pergunta_texto COLLATE utf8mb4_bin AS texto, r.tipo,
            COALESCE(MAX(pe.ordem), 999) AS ordem, COUNT(*) AS total,
            SUM(r.valor_num) AS soma, SUM(r.valor_num >= 4) AS bons,
            SUM(r.valor_num >= 9) AS prom, SUM(r.valor_num <= 6) AS det
       FROM respostas r JOIN avaliacoes a ON a.id = r.avaliacao_id LEFT JOIN perguntas pe ON pe.id = r.pergunta_id
      WHERE ${w.join(' AND ')} GROUP BY a.setor_id, r.pergunta_texto COLLATE utf8mb4_bin, r.tipo`, p);
  const [opcoes] = await pool.query(
    `SELECT a.setor_id AS setor, r.pergunta_texto COLLATE utf8mb4_bin AS texto, r.tipo,
            jt.opcao COLLATE utf8mb4_bin AS opcao, COUNT(*) AS total
       FROM respostas r JOIN avaliacoes a ON a.id = r.avaliacao_id
       JOIN JSON_TABLE(COALESCE(r.valores, JSON_ARRAY()), '$[*]' COLUMNS (opcao VARCHAR(255) PATH '$')) jt
      WHERE ${w.join(' AND ')} AND r.tipo IN ('positivos','negativos')
      GROUP BY a.setor_id, r.pergunta_texto COLLATE utf8mb4_bin, r.tipo, jt.opcao COLLATE utf8mb4_bin`, p);
  const [setores] = await pool.query('SELECT id, ordem FROM setores');
  const ordemSetor = new Map(setores.map((s) => [s.id, s.ordem]));
  const grupos = new Map();
  const chave = x => JSON.stringify([x.setor, x.tipo, x.texto]);
  for (const x of rows) grupos.set(chave(x), { ...x, opcoes: new Map() });
  for (const x of opcoes) {
    const grupo = grupos.get(chave(x));
    if (grupo) grupo.opcoes.set(x.opcao, Number(x.total));
  }
  const itens = [...grupos.values()].map((g) => ({
    setor: g.setor, texto: g.texto, tipo: g.tipo, ordem: g.ordem, total: g.total,
    media: g.tipo === 'escala' || g.tipo === 'nps' ? Math.round((g.soma / g.total) * 10) / 10 : null,
    satisfeitos: g.tipo === 'escala' ? Math.round((100 * g.bons) / g.total) : null,
    nps: g.tipo === 'nps' ? Math.round((100 * (g.prom - g.det)) / g.total) : null,
    opcoes: [...g.opcoes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
  })).sort((a, b) => (ordemSetor.get(a.setor) || 999) - (ordemSetor.get(b.setor) || 999) || a.ordem - b.ordem);
  res.json({ itens });
};

// ---------- Exportação em Excel (todos os perfis, dentro do seu alcance) ----------
exports.exportar = async (req, res) => {
  const q = req.query;
  const w = [], p = [];
  if (!escopo(req.user) && SETOR_RE.test(String(q.s || ''))) { w.push('a.setor_id = ?'); p.push(q.s); }
  if (['7', '30', '90'].includes(String(q.p))) { w.push('a.criado_em >= DATE_SUB(NOW(), INTERVAL ? DAY)'); p.push(Number(q.p)); }
  if (TURNOS.includes(q.t)) { w.push('a.turno = ?'); p.push(q.t); }
  if (TIPOS.includes(q.u)) { w.push('a.tipo_atendimento = ?'); p.push(q.u); }
  const [setores] = await pool.query('SELECT id, nome FROM setores ORDER BY ordem');
  const nome = new Map(setores.map((s) => [s.id, s.nome]));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="avaliacoes-fhdod-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
  wb.creator = 'Avaliação do Atendimento - FHDOD';
  const ws = wb.addWorksheet('Avaliações');
  ws.columns = [
    { header: 'Respondida em (UTC)', key: 'c', width: 22 }, { header: 'Setor', key: 's', width: 28 },
    { header: 'Nota média (1-5)', key: 'm', width: 16 }, { header: 'Recomendação (1-10)', key: 'n', width: 20 },
    { header: 'Pontos positivos', key: 'p', width: 40 }, { header: 'Pontos a melhorar', key: 'g', width: 40 },
    { header: 'Data do atendimento', key: 'd', width: 20 }, { header: 'Turno', key: 't', width: 10 },
    { header: 'Respondente', key: 'r', width: 14 }, { header: 'Tipo de atendimento', key: 'u', width: 20 },
    { header: 'Abaixo da média', key: 'a', width: 16 }, { header: 'Situação do contato', key: 'k', width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const totais = new Map();
  for await (const rows of iterarAvaliacoes(req.user, { where: w.join(' AND '), params: p })) {
    if (res.destroyed) return;
    for (const x of rows) {
      if (!totais.has(x.setor)) totais.set(x.setor, { n: 0, soma: 0, notas: 0, prom: 0, det: 0, satisfeitos: 0, ns: 0, abaixo: 0 });
      const t = totais.get(x.setor); t.n++;
      if (x.nota_media != null) { t.soma += x.nota_media; t.notas++; }
      if (x.nps >= 9) t.prom++;
      if (x.nps <= 6) t.det++;
      t.ns += x.ns.length; t.satisfeitos += x.ns.filter(v => v >= 4).length;
      if (x.abaixo_media) t.abaixo++;
      ws.addRow({ c: x.criado_em.replace('T', ' ').replace('Z', ''), s: nome.get(x.setor) || x.setor, m: x.nota_media, n: x.nps,
        p: celulaSegura(x.pos.join(', ')), g: celulaSegura(x.neg.join(', ')), d: x.data_atendimento, t: x.turno, r: x.respondente,
        u: x.tipo_atendimento, a: x.abaixo_media ? 'Sim' : 'Não',
        k: (req.user.papel === 'visualizador' || !x.abaixo_media) ? '' : (x.telefone || x.contato_status !== 'pendente' ? x.contato_status : 'sem telefone') }).commit();
    }
  }
  ws.commit();
  const rs = wb.addWorksheet('Resumo por setor');
  rs.columns = [{ header: 'Setor', key: 's', width: 30 }, { header: 'Respostas', key: 'n', width: 12 }, { header: 'Nota média', key: 'm', width: 12 }, { header: 'NPS (-100 a 100)', key: 'p', width: 18 }, { header: 'Satisfeitos (%)', key: 'f', width: 16 }, { header: 'Abaixo da média', key: 'a', width: 16 }];
  rs.getRow(1).font = { bold: true };
  for (const s of setores) {
    const t = totais.get(s.id);
    if (!t) continue;
    rs.addRow({ s: s.nome, n: t.n, m: t.notas ? Math.round(t.soma / t.notas * 100) / 100 : null,
      p: Math.round(100 * (t.prom - t.det) / t.n),
      f: t.ns ? Math.round(100 * t.satisfeitos / t.ns) : null, a: t.abaixo }).commit();
  }
  rs.commit();
  const sb = wb.addWorksheet('Sobre');
  sb.getColumn(1).width = 100;
  ['Fundação Hospitalar Dr. Oswaldo Diesel — Sistema de Avaliação do Atendimento.',
    'Gerado em ' + new Date().toLocaleString('pt-BR') + ' por ' + req.user.nome + '.',
    'Esta planilha não contém telefone nem nome de pacientes.'].forEach((t) => sb.addRow([t]));
  sb.commit();
  await wb.commit();
};

// ---------- Equipe ----------
//   gerente: vê e gerencia todas as contas
//   admin:   vê e gerencia só os visualizadores do próprio setor
const PAPEIS = ['gerente', 'admin', 'visualizador'];

function podeGerir(user, alvo) {
  if (user.papel === 'gerente') return true;
  return user.papel === 'admin' && alvo.papel === 'visualizador' && alvo.setor_id === user.setor_id;
}

exports.usuarios = async (req, res) => {
  const adm = req.user.papel === 'admin';
  const [rows] = await pool.query(
    `SELECT id, nome, email, papel, setor_id, ativo FROM usuarios ${adm ? "WHERE papel = 'visualizador' AND setor_id = ?" : ''}
      ORDER BY FIELD(papel, 'gerente', 'admin', 'visualizador'), nome`, adm ? [req.user.setor_id] : []);
  res.json(rows.map((u) => ({ ...u, ativo: !!u.ativo })));
};

// alvo = usuário que está sendo alterado (null na criação)
async function validarUsuario(b, alvo) {
  const out = {};
  if (!alvo || b.nome !== undefined) { out.nome = String(b.nome || '').trim(); if (out.nome.length < 3 || out.nome.length > 100) throw new Error('Informe o nome (3 a 100 caracteres).'); }
  if (!alvo) { out.email = String(b.email || '').trim().toLowerCase(); if (!EMAIL_RE.test(out.email) || out.email.length > 150) throw new Error('E-mail inválido.'); }
  if (!alvo || b.senha) { const s = String(b.senha || ''); if (!senhaValida(s)) throw new Error('A senha deve ter pelo menos 8 caracteres e até 72 bytes.'); out.senha_hash = await bcrypt.hash(s, 12); }
  if (!alvo || b.papel !== undefined || b.setor_id !== undefined) {
    const papel = b.papel !== undefined ? b.papel : alvo.papel;
    if (!PAPEIS.includes(papel)) throw new Error('Perfil inválido.');
    out.papel = papel;
    if (papel === 'gerente') out.setor_id = null;
    else {
      const sid = String(b.setor_id === undefined ? (alvo ? alvo.setor_id : '') : b.setor_id || '');
      if (papel === 'visualizador' && !sid) out.setor_id = null; // visualizador sem setor = vê todos
      else {
        const [s] = await pool.query('SELECT id FROM setores WHERE id = ?', [sid]);
        if (!s[0]) throw new Error('Escolha o setor.');
        out.setor_id = s[0].id;
      }
    }
  }
  return out;
}

function erroDuplicado(e, res) {
  if (e.code !== 'ER_DUP_ENTRY') throw e;
  if (/uk_um_admin_por_setor/.test(e.message)) return erro(res, 409, 'Este setor já tem um administrador ativo. Desative o atual antes de ativar ou criar outro.');
  return erro(res, 409, 'Já existe uma conta com este e-mail.');
}

exports.criarUsuario = async (req, res) => {
  let b = req.body || {};
  if (req.user.papel === 'admin') {
    // O administrador só cria visualizadores, e sempre do próprio setor
    if (b.papel !== undefined && b.papel !== 'visualizador') return erro(res, 403, 'Você só pode criar contas de visualizador do seu setor.');
    b = { ...b, papel: 'visualizador', setor_id: req.user.setor_id };
  }
  let d;
  try { d = await validarUsuario(b, null); } catch (e) { return erro(res, 400, e.message); }
  try {
    const ins = await transacao(req, 'usuario.criado', 'usuario', created => created.insertId, async c => {
      const [created] = await c.query('INSERT INTO usuarios (nome, email, senha_hash, papel, setor_id, trocar_senha) VALUES (?,?,?,?,?,1)', [d.nome, d.email, d.senha_hash, d.papel, d.setor_id]);
      return created;
    });
    res.status(201).json({ id: ins.insertId });
  } catch (e) { return erroDuplicado(e, res); }
};

exports.alterarUsuario = async (req, res) => {
  const id = inteiro(req.params.id);
  const [rows] = await pool.query('SELECT id, papel, setor_id, ativo FROM usuarios WHERE id = ?', [id]);
  const alvo = rows[0];
  if (!alvo || !podeGerir(req.user, alvo)) return erro(res, 404, 'Usuário não encontrado.');
  const b = { ...(req.body || {}) };
  if (b.ativo !== undefined && typeof b.ativo !== 'boolean') return erro(res, 400, 'Situação da conta inválida.');
  if (req.user.papel === 'admin') { delete b.papel; delete b.setor_id; } // admin não muda perfil nem setor
  let d;
  try { d = await validarUsuario(b, alvo); } catch (e) { return erro(res, 400, e.message); }
  const novoAtivo = b.ativo === undefined ? !!alvo.ativo : !!b.ativo;
  const novoPapel = d.papel || alvo.papel;
  if (id === req.user.id && (!novoAtivo || novoPapel !== alvo.papel)) return erro(res, 400, 'Você não pode desativar nem mudar o perfil da própria conta.');
  if (alvo.papel === 'gerente' && (!novoAtivo || novoPapel !== 'gerente')) {
    const [[c]] = await pool.query("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'gerente' AND ativo = 1 AND id <> ?", [id]);
    if (!c.n) return erro(res, 400, 'Precisa existir pelo menos um gerente ativo.');
  }
  const campos = [], vals = [];
  for (const k of ['nome', 'senha_hash', 'papel', 'setor_id']) if (d[k] !== undefined) { campos.push(`${k} = ?`); vals.push(d[k]); }
  if (b.ativo !== undefined) { campos.push('ativo = ?'); vals.push(novoAtivo ? 1 : 0); }
  if (!campos.length) return erro(res, 400, 'Nada para alterar.');
  if (d.senha_hash) campos.push('trocar_senha=1', 'tentativas_falhas=0', 'bloqueado_ate=NULL');
  campos.push('versao_sessao=versao_sessao+1');
  try { await transacao(req, d.senha_hash ? 'usuario.senha_redefinida' : b.ativo !== undefined ? (novoAtivo ? 'usuario.ativado' : 'usuario.desativado') : 'usuario.alterado', 'usuario', id,
    c => c.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...vals, id])); } catch (e) { return erroDuplicado(e, res); }
  res.json({ ok: true });
};

