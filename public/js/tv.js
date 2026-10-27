/* TV Wall: indicadores agregados, atualizados sozinhos. Nunca mostra dados de pacientes. */
var tv = document.getElementById("tv"), rel = document.getElementById("rel");
var TOKEN = ""; try { TOKEN = new URLSearchParams(location.search).get("token") || ""; } catch (e) {}
var ATUALIZADO = null;
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function f1(x) { return x == null ? "—" : x.toFixed(1).replace(".", ","); }
function tom(nota) { return nota == null ? "nd" : nota >= 4 ? "ok" : nota >= 3 ? "mid" : "bad"; }
function k(l, v, s, t) { return '<div class="k ' + (t || "") + '"><small>' + l + "</small><b>" + v + "</b><span>" + s + "</span></div>"; }
function serie(d) {
  var mx = Math.max.apply(null, d.map(function (x) { return x.n; }).concat([1])), dias = [], n = 14, hoje = new Date();
  var m = {}; d.forEach(function (x) { m[x.dia] = x.n; });
  for (var i = n - 1; i >= 0; i--) { var t = new Date(hoje); t.setDate(t.getDate() - i); dias.push(t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2)); }
  var bw = 600 / n;
  return '<svg class="sv" viewBox="0 0 600 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Avaliações por dia nos últimos 14 dias, máximo ' + mx + '">' + dias.map(function (k2, i2) { var v = m[k2] || 0, h = Math.round(165 * v / mx); return '<rect x="' + (i2 * bw + 3).toFixed(1) + '" y="' + (190 - h) + '" width="' + (bw - 6).toFixed(1) + '" height="' + h + '" rx="4"><title>' + k2.slice(8) + "/" + k2.slice(5, 7) + ": " + v + "</title></rect>" + (v ? '<text x="' + (i2 * bw + bw / 2).toFixed(1) + '" y="' + (184 - h) + '" font-size="17" font-weight="700" text-anchor="middle">' + v + "</text>" : ""); }).join("") + '<line x1="0" y1="190.5" x2="600" y2="190.5" stroke="currentColor" opacity=".35"/><text x="0" y="218" font-size="18">' + dias[0].slice(8) + "/" + dias[0].slice(5, 7) + '</text><text x="600" y="218" font-size="18" text-anchor="end">hoje</text></svg>';
}
function paint(j) {
  var ord = j.setores.slice().sort(function (a, b) { return (b.nota == null ? -1 : b.nota) - (a.nota == null ? -1 : a.nota); });
  var npsTom = j.nps == null ? "" : j.nps >= 50 ? "ok" : j.nps >= 0 ? "mid" : "bad";
  tv.innerHTML = k("Avaliações", j.total, "nos últimos 30 dias") + k("Hoje", j.hoje, "nas últimas 24 horas") + k("Nota média", j.nota == null ? "—" : f1(j.nota) + "/5", "perguntas de nota", tom(j.nota)) + k("NPS", j.nps == null ? "—" : j.nps, "recomendação, de -100 a 100", npsTom) + k("Satisfeitos", j.satisfeitos == null ? "—" : j.satisfeitos + "%", "notas 4 e 5", j.satisfeitos == null ? "" : j.satisfeitos >= 80 ? "ok" : j.satisfeitos >= 60 ? "mid" : "bad") +
    '<section class="p rk"><h2>Nota média por setor (1 a 5)</h2><div class="rows">' + ord.map(function (s) {
      var t = tom(s.nota);
      return '<div class="hb ' + t + '"><span class="nm">' + esc(s.nome) + (t === "bad" ? '<span class="bdg">ATENÇÃO</span>' : "") + '</span><span class="tr"><i style="width:' + (s.nota == null ? 0 : Math.round(s.nota / 5 * 100)) + '%"></i></span><b>' + (s.nota == null ? "—" : f1(s.nota)) + "<small>" + (s.nota == null ? "sem resp." : s.respostas + " resp.") + "</small></b></div>";
    }).join("") + '</div></section><div class="col"><section class="p"><h2>Avaliações por dia (14 dias)</h2>' + serie(j.serie) + '</section><section class="p"><div class="ab"><b>' + j.abaixoMedia + '</b><span>avaliações abaixo da média no período.<br>A gestão do setor entra em contato quando o paciente deixa o telefone.</span></div></section></div>';
  ATUALIZADO = new Date(j.atualizadoEm);
  relogio();
}
function relogio() {
  var agora = new Date();
  rel.innerHTML = '<i aria-hidden="true"></i>' + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "<small>" + agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) +
    (ATUALIZADO ? " · dados de " + ATUALIZADO.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "") + "</small>";
}
function load() {
  fetch("/api/tv" + (TOKEN ? "?token=" + encodeURIComponent(TOKEN) : ""), { headers: { "X-Requested-With": "fhdod" } })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || "Erro " + r.status); return j; }); })
    .then(paint)
    .catch(function (e) { if (!tv.querySelector(".k")) tv.innerHTML = '<p class="err">' + esc(e.message) + "</p>"; });
}
load(); setInterval(load, 30000); relogio(); setInterval(relogio, 15000);
