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
const NPS_ORDEM = 3; // posição fixa da pergunta de recomendação (carinhas de 1 a 10)
const MAX_PERGUNTAS = 30; // limite técnico por setor (evita pesquisa interminável e abuso)
const NPS_TEXTO_PADRAO = 'Em uma escala de 1 a 10, qual é a probabilidade de você recomendar este hospital a um familiar ou amigo?';
// Perguntas de um setor recém-criado (o gerente ou o admin do setor edita depois)
const PERGUNTAS_PADRAO = [
  { tipo: 'escala', texto: 'Como você avalia o atendimento prestado pela equipe?' },
  { tipo: 'escala', texto: 'Como você avalia o tempo de espera para o atendimento?' },
  { tipo: 'nps', texto: NPS_TEXTO_PADRAO },
  { tipo: 'positivos', texto: 'Quais aspectos do atendimento você considera positivos?', opcoes: ['Equipe atenciosa', 'Rapidez', 'Informações claras', 'Ambiente limpo', 'Conforto', 'Respeito'] },
  { tipo: 'negativos', texto: 'Quais aspectos do atendimento precisam ser aprimorados?', opcoes: ['Demora', 'Falta de informação', 'Atendimento frio', 'Limpeza', 'Estrutura e conforto', 'Nada a melhorar'] },
];
const NPS_MAX_DETRATOR = 6; // recomendação até 6 também conta como abaixo da média

// Evita que o Excel execute fórmulas escondidas em textos (=, +, -, @).
const celulaSegura = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);

module.exports = { asJson, erro, inteiro, TURNOS, RESPONDENTES, TIPOS, STATUS, ABAIXO_MEDIA, NPS_ORDEM, NPS_MAX_DETRATOR, MAX_PERGUNTAS, PERGUNTAS_PADRAO, celulaSegura };
