
const asJson = (v) => {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return v;
};

const erro = (res, status, msg) => res.status(status).json({ erro: msg });
const inteiro = (v) => (Number.isInteger(v) ? v : (/^\d+$/.test(String(v)) ? Number(v) : NaN));
const TURNOS = ['Dia', 'Noite'];
const RESPONDENTES = ['Paciente', 'Familiar'];
const TIPOS = ['SUS', 'Plano de Saúde', 'Particular'];
const STATUS = ['pendente', 'contatado', 'resolvido'];
const ABAIXO_MEDIA = 3;
const NPS_ORDEM = 3;
const MAX_PERGUNTAS = 30;
const NPS_TEXTO_PADRAO = 'De 1 a 10, qual a chance de você recomendar o hospital a um amigo ou familiar?';

const PERGUNTAS_PADRAO = [
  { tipo: 'escala', texto: 'Como foi o atendimento da equipe?' },
  { tipo: 'escala', texto: 'Como foi o tempo de espera?' },
  { tipo: 'nps', texto: NPS_TEXTO_PADRAO },
  { tipo: 'positivos', texto: 'O que foi bom no atendimento?', opcoes: ['Equipe atenciosa', 'Rapidez', 'Informações claras', 'Ambiente limpo', 'Conforto', 'Respeito'] },
  { tipo: 'negativos', texto: 'O que pode melhorar?', opcoes: ['Demora', 'Falta de informação', 'Atendimento frio', 'Limpeza', 'Estrutura e conforto', 'Nada a melhorar'] },
];
const NPS_MAX_DETRATOR = 6;


const celulaSegura = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);

module.exports = { asJson, erro, inteiro, TURNOS, RESPONDENTES, TIPOS, STATUS, ABAIXO_MEDIA, NPS_ORDEM, NPS_MAX_DETRATOR, MAX_PERGUNTAS, PERGUNTAS_PADRAO, celulaSegura };
