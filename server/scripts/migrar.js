

require('dotenv').config();
const { pool } = require('../db');
const { migrar } = require('../lib/migracao');

migrar(pool)
  .then((f) => { console.log(f.length ? 'Banco atualizado:\n- ' + f.join('\n- ') : 'O banco já está na versão atual. Nada a fazer.'); return pool.end(); })
  .catch((e) => { console.error('FALHA ao atualizar o banco:', e.code || '', e.message); process.exit(1); });
