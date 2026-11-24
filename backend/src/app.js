require('./config/env');
const { randomUUID } = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { explicarErro } = require('./config/db');
const { exigirCabecalho } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.set('X-Request-Id', req.requestId);
  next();
});

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
// Impede cache compartilhado de respostas autenticadas e dados de contato.
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.locals.encerrando = false;
app.get('/api/vivo', (req, res) => res.status(app.locals.encerrando ? 503 : 200).json({ ok: !app.locals.encerrando }));
app.use('/api', (req, res, next) => app.locals.encerrando ? res.status(503).json({ erro: 'Serviço reiniciando. Tente novamente.' }) : next());
app.use('/api', exigirCabecalho, require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

require('./routes/pages')(app);

// Tratamento de erros: mensagens amigáveis, sem vazar detalhes internos
app.use((e, req, res, next) => {
  if (res.headersSent) return next(e);
  if (e.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.' });
  if (e.type === 'entity.too.large') return res.status(413).json({ erro: 'Dados excedem o tamanho permitido.' });
  // Mensagens SQL e query strings podem conter dados pessoais ou tokens.
  console.error(JSON.stringify({ evento: 'erro_http', request_id: req.requestId, metodo: req.method, codigo: e.code || 'INTERNO' }));
  if (e.code && /^(ER_|E[A-Z]+$)/.test(e.code)) return res.status(503).json({ erro: 'Banco de dados indisponível.', request_id: req.requestId, ...(process.env.NODE_ENV === 'production' ? {} : { dica: explicarErro(e) }) });
  res.status(500).json({ erro: 'Erro interno. Tente novamente.', request_id: req.requestId });
});

module.exports = app;
