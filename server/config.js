const path = require('node:path');

// Prioriza o .env da aplicação e aceita a configuração na pasta principal.
require('dotenv').config({
  path: [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', '..', '.env')],
  quiet: true,
});
