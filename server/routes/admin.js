// Rotas da área restrita (gerente, administrador de setor e visualizador).
const express = require('express');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { pool } = require('../db');
const { exigirLogin, exigirPapel, podeSetor, escopo } = require('../lib/auth');
const { carregarAvaliacoes } = require('../lib/avaliacoes');
const { asJson, erro, inteiro, TURNOS, TIPOS, STATUS, celulaSegura } = require('../lib/util');

const r = express.Router();
r.use(exigirLogin);

const SETOR_RE = /^[a-z]{2,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const equipe = exigirPapel('gerente', 'admin');

// ---------- Avaliações (painel): todos os perfis, dentro do seu alcance ----------
r.get('/avaliacoes', async (req, res) => res.json(await carregarAvaliacoes(req.user)));

// ---------- Contatos: telefone das avaliações abaixo da média (gerente e admin) ----------
r.patch('/avaliacoes/:id/contato', equipe, async (req, res) => {
  const id = inteiro(req.params.id);
  const [rows] = await pool.query('SELECT setor_id, telefone FROM avaliacoes WHERE id = ?', [id]);
  const a = rows[0];
  if (!a || !podeSetor(req.user, a.setor_id)) return erro(res, 404, 'Avaliação não encontrada.');
  const { status, obs, apagar } = req.body || {};
  if (!STATUS.includes(status)) return erro(res, 400, 'Situação inválida.');
  const texto = obs == null ? null : String(obs).trim().slice(0, 500) || null;
  if (apagar === true) {
    await pool.query('UPDATE avaliacoes SET telefone = NULL, consentimento_contato = 0, contato_status = ?, contato_obs = ?, contato_em = NOW(), contato_por = ? WHERE id = ?', [status, texto, req.user.id, id]);
  } else {
    await pool.query('UPDATE avaliacoes SET contato_status = ?, contato_obs = ?, contato_em = NOW(), contato_por = ? WHERE id = ?', [status, texto, req.user.id, id]);
  }
  res.json({ ok: true });
});

// ---------- Perguntas (gerente: todos os setores; admin: o seu setor) ----------
r.get('/perguntas/:setor', equipe, async (req, res) => {
  const setor = String(req.params.setor);
  if (!SETOR_RE.test(setor) || !podeSetor(req.user, setor)) return erro(res, 403, 'Você não gerencia este setor.');
  const [rows] = await pool.query('SELECT id, ordem, texto, tipo, opcoes, ativa FROM perguntas WHERE setor_id = ? ORDER BY ordem', [setor]);
  res.json(rows.map((q) => ({ ...q, opcoes: asJson(q.opcoes), ativa: !!q.ativa })));
});

r.put('/perguntas/:setor', equipe, async (req, res) => {
  const setor = String(req.params.setor);
  if (!SETOR_RE.test(setor) || !podeSetor(req.user, setor)) return erro(res, 403, 'Você não gerencia este setor.');
  const [atuais] = await pool.query('SELECT id, ordem FROM perguntas WHERE setor_id = ?', [setor]);
  const porId = new Map(atuais.map((q) => [q.id, q]));
  const lista = Array.isArray(req.body && req.body.perguntas) ? req.body.perguntas : null;
  if (!lista || !lista.length) return erro(res, 400, 'Dados inválidos.');
  const updates = [];
  for (const q of lista) {
    const atual = porId.get(inteiro(q.id));
    if (!atual) return erro(res, 400, 'Pergunta não pertence a este setor.');
    const texto = String(q.texto || '').trim();
    if (texto.length < 5 || texto.length > 160) return erro(res, 400, `Pergunta ${atual.ordem}: o texto deve ter de 5 a 160 caracteres.`);
    const ultima = atual.ordem === 5;
    const tipo = ultima ? 'nps' : q.tipo;
    if (!['escala', 'positivos', 'negativos', 'nps'].includes(tipo) || (!ultima && tipo === 'nps')) return erro(res, 400, `Pergunta ${atual.ordem}: tipo inválido.`);
    let opcoes = null;
    if (tipo === 'positivos' || tipo === 'negativos') {
      const lim = Array.isArray(q.opcoes) ? q.opcoes.map((o) => String(o).trim()).filter(Boolean) : [];
      opcoes = [...new Set(lim)];
      if (opcoes.length < 2 || opcoes.length > 10) return erro(res, 400, `Pergunta ${atual.ordem}: informe de 2 a 10 opções.`);
      if (opcoes.some((o) => o.length > 40)) return erro(res, 400, `Pergunta ${atual.ordem}: cada opção pode ter até 40 caracteres.`);
    }
    updates.push([texto, tipo, opcoes ? JSON.stringify(opcoes) : null, ultima ? 1 : (q.ativa === false ? 0 : 1), atual.id]);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const u of updates) await conn.query('UPDATE perguntas SET texto = ?, tipo = ?, opcoes = ?, ativa = ? WHERE id = ?', u);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json({ ok: true });
});

// ---------- Exportação em Excel (todos os perfis, dentro do seu alcance) ----------
r.get('/export.xlsx', async (req, res) => {
  const q = req.query;
  const w = [], p = [];
  if (!escopo(req.user) && SETOR_RE.test(String(q.s || ''))) { w.push('a.setor_id = ?'); p.push(q.s); }
  if (['7', '30', '90'].includes(String(q.p))) { w.push('a.criado_em >= DATE_SUB(NOW(), INTERVAL ? DAY)'); p.push(Number(q.p)); }
  if (TURNOS.includes(q.t)) { w.push('a.turno = ?'); p.push(q.t); }
  if (TIPOS.includes(q.u)) { w.push('a.tipo_atendimento = ?'); p.push(q.u); }
  const rows = await carregarAvaliacoes(req.user, { where: w.join(' AND '), params: p, limite: 20000 });
  const [setores] = await pool.query('SELECT id, nome FROM setores ORDER BY ordem');
  const nome = new Map(setores.map((s) => [s.id, s.nome]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Avaliação do Atendimento - FHDOD (protótipo acadêmico)';
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
  for (const x of rows) {
    ws.addRow({ c: x.criado_em.replace('T', ' ').replace('Z', ''), s: nome.get(x.setor) || x.setor, m: x.nota_media, n: x.nps,
      p: celulaSegura(x.pos.join(', ')), g: celulaSegura(x.neg.join(', ')), d: x.data_atendimento, t: x.turno, r: x.respondente,
      u: x.tipo_atendimento, a: x.abaixo_media ? 'Sim' : 'Não',
      k: (req.user.papel === 'visualizador' || !x.abaixo_media) ? '' : (x.telefone || x.contato_status !== 'pendente' ? x.contato_status : 'sem telefone') });
  }
  const rs = wb.addWorksheet('Resumo por setor');
  rs.columns = [{ header: 'Setor', key: 's', width: 30 }, { header: 'Respostas', key: 'n', width: 12 }, { header: 'Nota média', key: 'm', width: 12 }, { header: 'NPS (-100 a 100)', key: 'p', width: 18 }, { header: 'Satisfeitos (%)', key: 'f', width: 16 }, { header: 'Abaixo da média', key: 'a', width: 16 }];
  rs.getRow(1).font = { bold: true };
  for (const s of setores) {
    const g = rows.filter((x) => x.setor === s.id);
    if (!g.length) continue;
    const notas = g.filter((x) => x.nota_media != null);
    const ns = g.flatMap((x) => x.ns);
    rs.addRow({ s: s.nome, n: g.length, m: notas.length ? Math.round((notas.reduce((t, x) => t + x.nota_media, 0) / notas.length) * 100) / 100 : null,
      p: Math.round((100 * (g.filter((x) => x.nps >= 9).length - g.filter((x) => x.nps <= 6).length)) / g.length),
      f: ns.length ? Math.round((100 * ns.filter((v) => v >= 4).length) / ns.length) : null, a: g.filter((x) => x.abaixo_media).length });
  }
  const sb = wb.addWorksheet('Sobre');
  sb.getColumn(1).width = 100;
  ['Projeto acadêmico / protótipo de solução para a Fundação Hospitalar Dr. Oswaldo Diesel (não é o sistema oficial da FHDOD).',
    'Gerado em ' + new Date().toLocaleString('pt-BR') + ' por ' + req.user.nome + '.',
    'Esta planilha não contém telefone nem nome de pacientes.'].forEach((t) => sb.addRow([t]));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="avaliacoes-fhdod-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// ---------- Equipe ----------
//   gerente: vê e gerencia todas as contas
//   admin:   vê e gerencia só os visualizadores do próprio setor
const PAPEIS = ['gerente', 'admin', 'visualizador'];

function podeGerir(user, alvo) {
  if (user.papel === 'gerente') return true;
  return user.papel === 'admin' && alvo.papel === 'visualizador' && alvo.setor_id === user.setor_id;
}

r.get('/usuarios', equipe, async (req, res) => {
  const adm = req.user.papel === 'admin';
  const [rows] = await pool.query(
    `SELECT id, nome, email, papel, setor_id, ativo FROM usuarios ${adm ? "WHERE papel = 'visualizador' AND setor_id = ?" : ''}
      ORDER BY FIELD(papel, 'gerente', 'admin', 'visualizador'), nome`, adm ? [req.user.setor_id] : []);
  res.json(rows.map((u) => ({ ...u, ativo: !!u.ativo })));
});

// alvo = usuário que está sendo alterado (null na criação)
async function validarUsuario(b, alvo) {
  const out = {};
  if (!alvo || b.nome !== undefined) { out.nome = String(b.nome || '').trim(); if (out.nome.length < 3 || out.nome.length > 100) throw new Error('Informe o nome (3 a 100 caracteres).'); }
  if (!alvo) { out.email = String(b.email || '').trim().toLowerCase(); if (!EMAIL_RE.test(out.email) || out.email.length > 150) throw new Error('E-mail inválido.'); }
  if (!alvo || b.senha) { const s = String(b.senha || ''); if (s.length < 8 || s.length > 72) throw new Error('A senha deve ter de 8 a 72 caracteres.'); out.senha_hash = await bcrypt.hash(s, 12); }
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

r.post('/usuarios', equipe, async (req, res) => {
  let b = req.body || {};
  if (req.user.papel === 'admin') {
    // O administrador só cria visualizadores, e sempre do próprio setor
    if (b.papel !== undefined && b.papel !== 'visualizador') return erro(res, 403, 'Você só pode criar contas de visualizador do seu setor.');
    b = { ...b, papel: 'visualizador', setor_id: req.user.setor_id };
  }
  let d;
  try { d = await validarUsuario(b, null); } catch (e) { return erro(res, 400, e.message); }
  try {
    const [ins] = await pool.query('INSERT INTO usuarios (nome, email, senha_hash, papel, setor_id) VALUES (?,?,?,?,?)', [d.nome, d.email, d.senha_hash, d.papel, d.setor_id]);
    res.status(201).json({ id: ins.insertId });
  } catch (e) { return erroDuplicado(e, res); }
});

r.patch('/usuarios/:id', equipe, async (req, res) => {
  const id = inteiro(req.params.id);
  const [rows] = await pool.query('SELECT id, papel, setor_id, ativo FROM usuarios WHERE id = ?', [id]);
  const alvo = rows[0];
  if (!alvo || !podeGerir(req.user, alvo)) return erro(res, 404, 'Usuário não encontrado.');
  const b = { ...(req.body || {}) };
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
  try { await pool.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...vals, id]); } catch (e) { return erroDuplicado(e, res); }
  res.json({ ok: true });
});

module.exports = r;
