const VERSAO_PRIVACIDADE = '2026-10-29.v1';
function aceiteValido(p) {
  return p && p.aceite_privacidade === true && p.privacidade_versao === VERSAO_PRIVACIDADE;
}
module.exports = { VERSAO_PRIVACIDADE, aceiteValido };
