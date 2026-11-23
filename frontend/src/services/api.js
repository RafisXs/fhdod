// Chamada à API do servidor. Em caso de erro, devolve um Error com .status e .dica
function api(metodo, caminho, corpo) {
  return fetch(caminho, {
    method: metodo,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fhdod" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) { var e = new Error(j.erro || "Erro " + r.status); e.status = r.status; e.dica = j.dica; e.codigo = j.codigo; throw e; }
      return j;
    });
  }, function () { var e = new Error("Sem conexão com o servidor. Confira se ele está ligado."); e.status = 0; throw e; });
}
