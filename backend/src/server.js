// Servidor da aplicação: serve as páginas e a API.
require('./config/env');
const { validarAmbiente } = require('./validations/ambiente');
const errosAmbiente = validarAmbiente(process.env);
if (errosAmbiente.length) {
  console.error('Configuração inválida:\n' + errosAmbiente.join('\n'));
  process.exit(1);
}
const app = require('./app');
const { testarConexao, pool } = require('./config/db');
const { segredoValido } = require('./middleware/auth');
const { migrar } = require('./services/migracao');

const PORT = Number(process.env.PORT || 3002);
const HOST = process.env.HOST || '0.0.0.0';
(async () => {
  if (!segredoValido(process.env.JWT_SECRET)) {
    console.error('FALHA: defina JWT_SECRET no arquivo .env com um texto longo e aleatório (mínimo 24 caracteres e diferente do exemplo do .env.example). Veja a seção "Variáveis de ambiente" do README.');
    process.exit(1);
  }
  if (await testarConexao()) {
    // Atualiza sozinho um banco criado por versão anterior (não mexe em banco já atualizado)
    try {
      const migracaoAutomatica = process.env.AUTO_MIGRATE === 'true' || (process.env.AUTO_MIGRATE !== 'false' && process.env.NODE_ENV !== 'production');
      const feitos = migracaoAutomatica ? await migrar(pool) : [];
      if (feitos.length) console.log('Banco atualizado: ' + feitos.join('; ') + '.');
    } catch (e) { console.error('FALHA ao atualizar o banco (rode "npm run migrar" e veja a mensagem):', e.code || '', e.message); process.exit(1); }
  } else { await pool.end(); process.exit(1); }
  // No Express 5, se a porta não puder ser usada o erro chega aqui: não anunciar sucesso nesse caso
  const server = app.listen(PORT, HOST, (err) => {
    if (err) {
      console.error(err.code === 'EADDRINUSE'
        ? `FALHA: a porta ${PORT} já está em uso (provavelmente o servidor já está rodando em outro terminal). Feche o outro ou mude PORT no arquivo .env.`
        : `FALHA ao iniciar o servidor: ${err.code || ''} ${err.message}`);
      process.exit(1);
    }
    console.log(`Servidor rodando em http://localhost:${PORT}  (pesquisa)  |  http://localhost:${PORT}/admin  (área restrita)`);
  });
  async function encerrar() {
    if (app.locals.encerrando) return;
    app.locals.encerrando = true;
    console.log(JSON.stringify({ evento: 'encerrando' }));
    const limite = setTimeout(() => process.exit(1), 30000);
    limite.unref();
    server.close(async () => {
      try { await pool.end(); clearTimeout(limite); process.exitCode = 0; }
      catch { process.exitCode = 1; }
    });
    server.closeIdleConnections();
  }
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
})();
