const express = require('express');
const c = require('../controller/admin');
const { exigirLogin, exigirPapel } = require('../middleware/auth');
const equipe = exigirPapel('gerente', 'admin');

const r = express.Router();
r.use(exigirLogin);

r.get('/avaliacoes', c.avaliacoes);
r.get('/avaliacoes/paginas', c.paginas);
r.get('/auditoria', exigirPapel('gerente'), c.auditoria);
r.get('/andamento', c.andamento);
r.patch('/avaliacoes/:id/contato', equipe, c.contato);
r.get('/perguntas/:setor', equipe, c.perguntas);
r.put('/perguntas/:setor', equipe, c.salvarPerguntas);
r.get('/setores', c.setores);
r.post('/setores', exigirPapel('gerente'), c.criarSetor);
r.patch('/setores/:id', exigirPapel('gerente'), c.alterarSetor);
r.get('/resultado-perguntas', c.resultados);
r.get('/export.xlsx', c.exportar);
r.get('/usuarios', equipe, c.usuarios);
r.post('/usuarios', equipe, c.criarUsuario);
r.patch('/usuarios/:id', equipe, c.alterarUsuario);

module.exports = r;
