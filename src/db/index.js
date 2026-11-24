// Conexão com o MySQL (pool). As credenciais vêm do arquivo .env.
const fs = require('node:fs');
const path = require('node:path');
require('../config/env');
const mysql = require('mysql2/promise');

function obterSsl() {
  const ssl = { rejectUnauthorized: true };
  const caArquivo = process.env.DB_SSL_CA_FILE;
  if (caArquivo) {
    const caminho = path.isAbsolute(caArquivo) ? caArquivo : path.resolve(__dirname, '../../', caArquivo);
    if (!fs.existsSync(caminho)) throw new Error(`Certificado CA do MySQL não encontrado: ${caminho}`);
    ssl.ca = fs.readFileSync(caminho);
  }
  return ssl;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: obterSsl(),
  waitForConnections: false,
  connectionLimit: 10,
  queueLimit: 0
});

pool.pool.on('connection', (c) => c.query("SET time_zone = '+00:00'")); // horários sempre em UTC

// Traduz os erros mais comuns do MySQL em dicas fáceis de entender.
function explicarErro(e) {
  const dicas = {
    ECONNREFUSED: 'O MySQL não está rodando ou a porta/host estão errados. Inicie o serviço do MySQL e confira DB_HOST e DB_PORT no .env.',
    ER_ACCESS_DENIED_ERROR: 'Usuário ou senha incorretos. Confira DB_USER e DB_PASSWORD no .env.',
    ER_BAD_DB_ERROR: 'O banco não existe. Rode o arquivo database/schema.sql no MySQL Workbench e confira DB_NAME no .env.',
    ENOTFOUND: 'O endereço do servidor (DB_HOST) não foi encontrado.',
    ER_NO_SUCH_TABLE: 'Falta criar as tabelas. Rode o arquivo database/schema.sql no MySQL Workbench.',
    ETIMEDOUT: 'Tempo esgotado ao conectar. Confira DB_HOST, DB_PORT e o firewall.',
  };
  return dicas[e.code] || 'Erro inesperado ao falar com o MySQL.';
}

async function testarConexao() {
  try {
    const [r] = await pool.query('SELECT DATABASE() AS banco, VERSION() AS versao');
    console.log(`Banco de dados conectado com sucesso. (banco: ${r[0].banco}, MySQL ${r[0].versao})`);
    return true;
  } catch (e) {
    console.error('FALHA ao conectar no banco de dados.');
    console.error(`  Código: ${e.code || 'desconhecido'}`);
    console.error(`  Dica: ${explicarErro(e)}`);
    return false;
  }
}

module.exports = { pool, testarConexao, explicarErro };
