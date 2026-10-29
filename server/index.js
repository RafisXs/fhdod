// Servidor da aplicação: serve as páginas e a API.
require('./config');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { testarConexao, explicarErro } = require('./db');
const { exigirCabecalho, segredoValido } = require('./lib/auth');
const { migrar } = require('./lib/migracao');
const { pool } = require('./db');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
}));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

app.use('/api', exigirCabecalho, require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// Tratamento de erros: mensagens amigáveis, sem vazar detalhes internos
app.use((e, req, res, next) => {
  if (e.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.' });
  console.error(`[erro] ${req.method} ${req.originalUrl}:`, e.code || '', e.message);
  if (e.code && /^(ER_|E[A-Z]+$)/.test(e.code)) return res.status(503).json({ erro: 'Banco de dados indisponível.', dica: explicarErro(e) });
  res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
});

const PORT = Number(process.env.PORT || 3000);
(async () => {
  if (!segredoValido(process.env.JWT_SECRET)) {
    console.error('FALHA: defina JWT_SECRET no arquivo .env com um texto longo e aleatório (mínimo 24 caracteres e diferente do exemplo do .env.example). Veja a seção "Variáveis de ambiente" do README.');
    process.exit(1);
  }
  if (await testarConexao()) {
    // Atualiza sozinho um banco criado por versão anterior (não mexe em banco já atualizado)
    try {
      const feitos = await migrar(pool);
      if (feitos.length) console.log('Banco atualizado: ' + feitos.join('; ') + '.');
    } catch (e) { console.error('FALHA ao atualizar o banco (rode "npm run migrar" e veja a mensagem):', e.code || '', e.message); process.exit(1); }
  }
  // No Express 5, se a porta não puder ser usada o erro chega aqui: não anunciar sucesso nesse caso
  app.listen(PORT, (err) => {
    if (err) {
      console.error(err.code === 'EADDRINUSE'
        ? `FALHA: a porta ${PORT} já está em uso (provavelmente o servidor já está rodando em outro terminal). Feche o outro ou mude PORT no arquivo .env.`
        : `FALHA ao iniciar o servidor: ${err.code || ''} ${err.message}`);
      process.exit(1);
    }
    console.log(`Servidor rodando em http://localhost:${PORT}  (pesquisa)  |  http://localhost:${PORT}/admin  (área restrita)`);
  });
})();
