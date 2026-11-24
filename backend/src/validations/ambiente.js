// Validação sem acesso ao banco, reutilizada na inicialização e nos testes.
function validarAmbiente(env) {
  const erros = [];
  const porta = Number(env.PORT || 3000);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) erros.push('PORT deve estar entre 1 e 65535.');
  if (env.TRUST_PROXY && !/^(?:[0-9]|10)$/.test(env.TRUST_PROXY)) erros.push('TRUST_PROXY deve ser um número de proxies entre 0 e 10.');
  for (const nome of ['COOKIE_SECURE', 'AUTO_MIGRATE']) {
    if (env[nome] && !['true', 'false'].includes(env[nome])) erros.push(`${nome} deve ser true ou false.`);
  }
  if (env.NODE_ENV === 'production') {
    if (env.COOKIE_SECURE !== 'true') erros.push('Produção exige COOKIE_SECURE=true e HTTPS no proxy.');
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 48 || /^(troque_|SUBSTITUIR)/i.test(env.JWT_SECRET)) erros.push('Produção exige JWT_SECRET exclusivo com pelo menos 48 caracteres.');
    if (!env.DB_USER || env.DB_USER.toLowerCase() === 'root') erros.push('Produção exige uma conta MySQL exclusiva, diferente de root.');
    if (!env.DB_PASSWORD) erros.push('Produção exige DB_PASSWORD.');
    if (!env.DB_NAME) erros.push('Produção exige DB_NAME.');
  }
  return erros;
}

module.exports = { validarAmbiente };
