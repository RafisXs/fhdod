const path = require('node:path');

// Variáveis do processo têm prioridade sobre o .env da raiz do repositório.
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});
