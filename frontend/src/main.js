/* Entrada da pesquisa: carregada depois dos componentes e da página. */
if (typeof iniciarAplicacao === 'function') iniciarAplicacao();
else if (typeof boot === 'function') boot();
