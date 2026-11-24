// Exit code 0 = HTTP e banco disponíveis; 1 = falha. Sem login nem dados de pacientes.
const target = process.env.MONITOR_URL || process.argv[2];
(async () => {
  const base = new URL(target);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Informe somente a origem HTTP(S), sem credenciais ou parâmetros.');
  for (const route of ['/api/vivo', '/api/saude']) {
    const response = await fetch(new URL(route, base.origin), { signal: AbortSignal.timeout(10000) });
    if (!response.ok || (await response.json()).ok !== true) throw new Error(`Verificação falhou em ${route}.`);
  }
  console.log(JSON.stringify({ evento: 'monitoramento', ok: true, horario: new Date().toISOString() }));
})().catch(() => {
  console.error(JSON.stringify({ evento: 'monitoramento', ok: false, mensagem: 'Serviço indisponível ou endereço inválido.' }));
  process.exitCode = 1;
});
