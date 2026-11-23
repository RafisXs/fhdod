// Atualiza o banco existente para a versão atual:  npm run migrar
// (o servidor também faz isso sozinho ao iniciar; este comando é só para rodar na mão)
require('../../backend/src/config/env');
const { pool } = require('../../backend/src/config/db');
const { migrar } = require('../../backend/src/services/migracao');

migrar(pool)
  .then((f) => { console.log(f.length ? 'Banco atualizado:\n- ' + f.join('\n- ') : 'O banco já está na versão atual. Nada a fazer.'); return pool.end(); })
  .catch((e) => { console.error('FALHA ao atualizar o banco:', e.code || '', e.message); process.exit(1); });
