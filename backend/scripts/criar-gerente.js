// Cria o gerente (ou redefine a senha dele):  npm run criar-gerente
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
// Guarda as linhas digitadas (funciona digitando no terminal ou colando/encadeando várias linhas)
const fila = [];
let espera = null;
rl.on('line', (l) => { if (espera) { const f = espera; espera = null; f(l); } else fila.push(l); });
const perguntar = (t) => { process.stdout.write(t); return new Promise((ok) => { if (fila.length) ok(fila.shift()); else espera = ok; }); };

(async () => {
  try {
    // Também aceita GERENTE_NOME, GERENTE_EMAIL e GERENTE_SENHA como variáveis de ambiente (sem perguntas)
    const nome = (process.env.GERENTE_NOME || await perguntar('Nome do gerente: ')).trim();
    const email = (process.env.GERENTE_EMAIL || await perguntar('E-mail: ')).trim().toLowerCase();
    const senha = process.env.GERENTE_SENHA || await perguntar('Senha (mínimo 8 caracteres): ');
    if (nome.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 8 || senha.length > 72) {
      console.error('Dados inválidos: nome com 3+ letras, e-mail válido e senha de 8 a 72 caracteres.');
      process.exitCode = 1; return;
    }
    const hash = await bcrypt.hash(senha, 12);
    const [r] = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, setor_id) VALUES (?,?,?, 'gerente', NULL)
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), senha_hash = VALUES(senha_hash), papel = 'gerente', setor_id = NULL, ativo = 1`, [nome, email, hash]);
    console.log(r.affectedRows === 1 ? 'Gerente criado com sucesso.' : 'Gerente já existia: dados e senha atualizados.');
  } catch (e) {
    console.error('Não foi possível criar o gerente:', e.code || '', e.message);
    process.exitCode = 1;
  } finally { rl.close(); await pool.end(); }
})();
