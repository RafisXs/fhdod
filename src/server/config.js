const path = require('node:path');

// Prioriza o .env na raiz do repositório; aceita o caminho antigo no workspace.
require('dotenv').config({
  path: [path.resolve(__dirname, '../../.env'), path.resolve(__dirname, '../../../.env')],
  quiet: true,
});
