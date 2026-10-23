// Funções de apoio compartilhadas pelas rotas.
const asJson = (v) => {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return v; // MySQL já devolve o JSON convertido
};

const erro = (res, status, msg) => res.status(status).json({ erro: msg });
const inteiro = (v) => (Number.isInteger(v) ? v : (/^\d+$/.test(String(v)) ? Number(v) : NaN));
const TURNOS = ['Dia', 'Noite'];
const RESPONDENTES = ['Paciente', 'Familiar'];
const TIPOS = ['SUS', 'Plano de Saúde', 'Particular'];
const STATUS = ['pendente', 'contatado', 'resolvido'];
const ABAIXO_MEDIA = 3; // média das perguntas de nota abaixo disso = abaixo da média
const NPS_MAX_DETRATOR = 6; // recomendação até 6 também conta como abaixo da média

// Evita que o Excel execute fórmulas escondidas em textos (=, +, -, @).
const celulaSegura = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);

module.exports = { asJson, erro, inteiro, TURNOS, RESPONDENTES, TIPOS, STATUS, ABAIXO_MEDIA, NPS_MAX_DETRATOR, celulaSegura };
