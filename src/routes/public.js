const express = require('express');
const c = require('../controller/public');
const { exigirLogin } = require('../middleware/auth');
const { limite, aoValidar } = require('../middleware/limites');

const r = express.Router();

r.get('/saude', c.saude);
r.get('/perguntas', c.perguntas);
r.post('/avaliacoes', limite(200, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), c.registrar);
r.post('/avaliacoes/iniciar', limite(600, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), aoValidar(c.iniciar));
r.put('/avaliacoes/:token/resposta', limite(6000, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), aoValidar(c.responder));
r.post('/avaliacoes/:token/concluir', limite(600, 15, 'Muitos envios deste endereço. Tente novamente em alguns minutos.'), aoValidar(c.concluir));
r.post('/login', limite(10, 15, 'Muitas tentativas de login. Aguarde 15 minutos.'), c.login);
r.post('/logout', c.logout);
r.get('/me', exigirLogin, c.me);
r.post('/senha', limite(10, 15, 'Muitas tentativas. Aguarde 15 minutos.'), exigirLogin, c.senha);
r.get('/tv', c.tv);

module.exports = r;
