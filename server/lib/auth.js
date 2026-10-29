// Login com cookie seguro (JWT) e controle de perfis (gerente / admin / visualizador).
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { erro } = require('./util');

const COOKIE = 'fhdod_token';

// O segredo precisa ser longo, aleatório e diferente do texto de exemplo do .env.example
const segredoValido = (s) => !!s && s.length >= 24 && !/^troque_/.test(s);

function segredo() {
  const s = process.env.JWT_SECRET;
  if (!segredoValido(s)) throw new Error('JWT_SECRET ausente, curto demais ou igual ao exemplo. Defina um texto longo e aleatório no arquivo .env.');
  return s;
}

function emitirLogin(res, usuario) {
  const token = jwt.sign({ id: usuario.id }, segredo(), { expiresIn: '8h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,                 // o JavaScript da página não consegue ler o cookie
    sameSite: 'strict',             // não é enviado por outros sites
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

const sairLogin = (res) => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true' });

// Confere o login em TODA requisição e recarrega o perfil do banco,
// assim uma mudança de perfil ou um usuário desativado vale na hora.
async function exigirLogin(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return erro(res, 401, 'Faça login para continuar.');
  let payload;
  try { payload = jwt.verify(token, segredo()); } catch { return erro(res, 401, 'Sessão expirada. Entre novamente.'); }
  const [rows] = await pool.query('SELECT id, nome, email, papel, setor_id, ativo FROM usuarios WHERE id = ?', [payload.id]);
  const u = rows[0];
  if (!u || !u.ativo) return erro(res, 401, 'Conta desativada ou inexistente.');
  req.user = u;
  next();
}

// Só deixa passar quem tem um dos perfis informados: exigirPapel('gerente', 'admin')
const exigirPapel = (...papeis) => (req, res, next) => (papeis.includes(req.user.papel) ? next() : erro(res, 403, 'Seu perfil não permite fazer isso.'));

// Alcance de dados: null = todos os setores; senão, só o setor informado.
//   gerente = todos | admin = o seu setor | visualizador = o seu setor (ou todos, se sem setor)
const escopo = (u) => (u.papel === 'gerente' ? null : (u.setor_id || null));
const podeSetor = (user, setorId) => { const e = escopo(user); return e === null || e === setorId; };

// Proteção extra contra CSRF: pedidos que alteram dados precisam do cabeçalho abaixo,
// que outros sites não conseguem enviar.
function exigirCabecalho(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-Requested-With') !== 'fhdod') {
    return erro(res, 403, 'Requisição não permitida.');
  }
  next();
}

module.exports = { segredoValido, emitirLogin, sairLogin, exigirLogin, exigirPapel, escopo, podeSetor, exigirCabecalho };
