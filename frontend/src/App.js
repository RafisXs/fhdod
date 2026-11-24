/*
 * Ponto de composição documentado para o frontend em JavaScript nativo.
 * A entrada real da pesquisa é main.js; as páginas administrativas carregam
 * seus próprios módulos. Este arquivo não é um componente React.
 */
function iniciarAplicacao() {
  if (typeof boot === 'function') boot();
}

if (typeof window !== 'undefined') window.iniciarAplicacao = iniciarAplicacao;
