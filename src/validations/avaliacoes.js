const { inteiro } = require('../utils/util');

class ErroValidacao extends Error {}
const falha = (msg) => { throw new ErroValidacao(msg); };

function validarData(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) falha('Data do atendimento inválida.');
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) falha('Data do atendimento inválida.');
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const valor = tipo => partes.find(p => p.type === tipo).value;
  const hoje = new Date(`${valor('year')}-${valor('month')}-${valor('day')}T00:00:00Z`);
  const limite = new Date(hoje); limite.setUTCFullYear(limite.getUTCFullYear() - 1);
  if (d > hoje) falha('A data do atendimento não pode ser futura.');
  if (d < limite) falha('A data do atendimento é muito antiga.');
  return s;
}


// ---------------------------------------------------------------------------
// Validação de UMA resposta (usada tanto na gravação em tempo real quanto no envio completo)
// devolve a linha pronta para a tabela respostas: [pergunta_id, texto, tipo, valor_num, valores]
// ---------------------------------------------------------------------------
function linhaResposta(q, r) {
  if (q.tipo === 'nps') {
    const n = inteiro(r && r.n);
    if (!(n >= 1 && n <= 10)) falha('Nota de recomendação inválida.');
    return [q.id, q.texto, 'nps', n, null];
  }
  if (q.tipo === 'escala') {
    const n = inteiro(r && r.n);
    if (!(n >= 1 && n <= 5)) falha('Nota inválida.');
    return [q.id, q.texto, 'escala', n, null];
  }
  const v = Array.isArray(r && r.v) ? r.v : falha('Resposta inválida.');
  const unicos = [...new Set(v.map(String))];
  if (unicos.length > 10 || unicos.some((o) => !q.opcoes.includes(o))) falha('Opção inválida.');
  return [q.id, q.texto, q.tipo, null, JSON.stringify(unicos)];
}

module.exports = { ErroValidacao, falha, validarData, linhaResposta };
