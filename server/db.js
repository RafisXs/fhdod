// Conexão com o MySQL (pool). As credenciais vêm do arquivo .env.
require('./config');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: true,
  decimalNumbers: true,
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
    console.error(`  Mensagem: ${e.message}`);
    console.error(`  Dica: ${explicarErro(e)}`);
    return false;
  }
}

module.exports = { pool, testarConexao, explicarErro };
