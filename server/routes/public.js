// Rotas públicas: pesquisa de satisfação, login e TV Wall.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { emitirLogin, sairLogin, exigirLogin } = require('../lib/auth');
const { registrarAvaliacao, iniciarRascunho, gravarResposta, concluirRascunho, ErroValidacao } = require('../lib/avaliacoes');
const { asJson, erro, ABAIXO_MEDIA, NPS_MAX_DETRATOR } = require('../lib/util');

const r = express.Router();
const limite = (max, minutos, msg) => rateLimit({ windowMs: minutos * 60 * 1000, limit: max, standardHeaders: true, legacyHeaders: false, message: { erro: msg } });

// Teste de conexão com o banco
r.get('/saude', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, mensagem: 'Banco de dados conectado com sucesso.' });
});

// Setores e perguntas ativas (a pesquisa monta as telas com isso)
r.get('/perguntas', async (req, res) => {
  const [setores] = await pool.query('SELECT id, nome FROM setores ORDER BY ordem');
  const [perg] = await pool.query('SELECT id, setor_id, ordem, texto, tipo, opcoes FROM perguntas WHERE ativa = 1 ORDER BY setor_id, ordem');
  res.json({
    setores,
    limites: { abaixoMedia: ABAIXO_MEDIA, npsMaxDetrator: NPS_MAX_DETRATOR },
    perguntas: perg.map((q) => ({ ...q, opcoes: asJson(q.opcoes) })),
  });
});

// Envio completo de uma vez (alternativa à gravação em tempo real; usada pela API e pelos testes)
r.post('/avaliacoes', limite(200, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), async (req, res) => {
  try {
    await registrarAvaliacao(req.body);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e instanceof ErroValidacao) return erro(res, 400, e.message);
    throw e;
  }
});

// ---- Gravação em tempo real: cada resposta vai para o banco assim que o paciente responde ----
// Os limites são por endereço; o hospital pode ter muitos pacientes saindo do mesmo Wi-Fi.
const aoValidar = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof ErroValidacao) return erro(res, 400, e.message);
    throw e;
  }
};
r.post('/avaliacoes/iniciar', limite(600, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), aoValidar(async (req, res) => {
  const token = await iniciarRascunho(req.body && req.body.setor);
  res.status(201).json({ token });
}));
r.put('/avaliacoes/:token/resposta', limite(6000, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), aoValidar(async (req, res) => {
  await gravarResposta(req.params.token, req.body);
  res.json({ ok: true });
}));
r.post('/avaliacoes/:token/concluir', limite(600, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), aoValidar(async (req, res) => {
  await concluirRascunho(req.params.token, req.body);
  res.status(201).json({ ok: true });
}));

// ---- Login ----
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-igualar-o-tempo', 12);
r.post('/login', limite(10, 15, 'Muitas tentativas de login. Aguarde 15 minutos.'), async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const senha = String((req.body && req.body.senha) || '');
  const [rows] = await pool.query('SELECT id, nome, email, senha_hash, papel, setor_id, ativo FROM usuarios WHERE email = ?', [email]);
  const u = rows[0];
  const ok = await bcrypt.compare(senha, u ? u.senha_hash : HASH_FALSO); // mesmo tempo com ou sem usuário
  if (!u || !u.ativo || !ok) return erro(res, 401, 'E-mail ou senha incorretos.');
  emitirLogin(res, u);
  res.json({ nome: u.nome, email: u.email, papel: u.papel, setor_id: u.setor_id });
});

r.post('/logout', (req, res) => { sairLogin(res); res.json({ ok: true }); });

r.get('/me', exigirLogin, (req, res) => {
  const { nome, email, papel, setor_id } = req.user;
  res.json({ nome, email, papel, setor_id });
});

// ---- TV Wall: só números agregados, nunca dados de pacientes ----
r.get('/tv', async (req, res) => {
  const token = process.env.TV_TOKEN;
  if (token) {
    const a = Buffer.from(String(req.query.token || ''));
    const b = Buffer.from(token);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return erro(res, 401, 'Link da TV inválido.');
  }
  const D30 = "a.status = 'concluida' AND a.criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
  const [[t]] = await pool.query(
    `SELECT COUNT(*) AS total, AVG(a.nota_media) AS nota, SUM(a.nps >= 9) AS pro, SUM(a.nps <= 6) AS det,
            SUM(a.abaixo_media) AS abaixo, SUM(a.criado_em >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS hoje
       FROM avaliacoes a WHERE ${D30}`);
  const [[s]] = await pool.query(
    `SELECT COUNT(*) AS n, SUM(r.valor_num >= 4) AS ok FROM respostas r JOIN avaliacoes a ON a.id = r.avaliacao_id
      WHERE r.tipo = 'escala' AND ${D30}`);
  const [setores] = await pool.query(
    `SELECT st.id, st.nome, COUNT(a.id) AS respostas, AVG(a.nota_media) AS nota,
            SUM(a.nps >= 9) AS pro, SUM(a.nps <= 6) AS det
       FROM setores st LEFT JOIN avaliacoes a ON a.setor_id = st.id AND ${D30}
      GROUP BY st.id, st.nome, st.ordem ORDER BY st.ordem`);
  const [serie] = await pool.query(
    `SELECT DATE_FORMAT(a.criado_em, '%Y-%m-%d') AS dia, COUNT(*) AS n FROM avaliacoes a
      WHERE a.status = 'concluida' AND a.criado_em >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY dia ORDER BY dia`);
  const n = Number(t.total) || 0;
  const nps = (pro, det, q) => (q ? Math.round((100 * (Number(pro) - Number(det))) / q) : null);
  res.json({
    atualizadoEm: new Date().toISOString(),
    total: n,
    hoje: Number(t.hoje) || 0,
    nota: t.nota == null ? null : Number(t.nota),
    nps: nps(t.pro, t.det, n),
    satisfeitos: s.n ? Math.round((100 * Number(s.ok)) / Number(s.n)) : null,
    abaixoMedia: Number(t.abaixo) || 0,
    setores: setores.map((x) => ({ id: x.id, nome: x.nome, respostas: Number(x.respostas), nota: x.nota == null ? null : Number(x.nota), nps: nps(x.pro, x.det, Number(x.respostas)) })),
    serie: serie.map((x) => ({ dia: x.dia, n: Number(x.n) })),
  });
});

module.exports = r;
