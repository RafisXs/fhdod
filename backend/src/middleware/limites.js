const rateLimit = require('express-rate-limit');
const { ErroValidacao } = require('../validations/avaliacoes');
const { erro } = require('../utils/util');

const limite = (max, minutos, msg) => rateLimit({ windowMs: minutos * 60 * 1000, limit: max, standardHeaders: true, legacyHeaders: false, message: { erro: msg } });
const aoValidar = fn => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof ErroValidacao) return erro(res, 400, e.message);
    throw e;
  }
};
module.exports = { limite, aoValidar };
