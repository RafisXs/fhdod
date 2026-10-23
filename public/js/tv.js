/* TV Wall: indicadores agregados, atualizados sozinhos. Nunca mostra dados de pacientes. */
var tv = document.getElementById("tv"), rel = document.getElementById("rel");
var TOKEN = ""; try { TOKEN = new URLSearchParams(location.search).get("token") || ""; } catch (e) {}
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function f1(x) { return x == null ? "—" : x.toFixed(1).replace(".", ","); }
function k(l, v, s) { return '<div class="k"><small>' + l + "</small><b>" + v + "</b><span>" + s + "</span></div>"; }
function serie(d) {
  var mx = Math.max.apply(null, d.map(function (x) { return x.n; }).concat([1])), dias = [], n = 14, hoje = new Date();
  var m = {}; d.forEach(function (x) { m[x.dia] = x.n; });
  for (var i = n - 1; i >= 0; i--) { var t = new Date(hoje); t.setDate(t.getDate() - i); dias.push(t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2)); }
  var bw = 600 / n;
  return '<svg class="sv" viewBox="0 0 600 150" role="img" aria-label="Avaliações por dia nos últimos 14 dias, máximo ' + mx + '">' + dias.map(function (k2, i2) { var v = m[k2] || 0, h = Math.round(105 * v / mx); return '<rect x="' + (i2 * bw + 2).toFixed(1) + '" y="' + (115 - h) + '" width="' + (bw - 4).toFixed(1) + '" height="' + h + '" rx="3"><title>' + k2.slice(8) + "/" + k2.slice(5, 7) + ": " + v + "</title></rect>"; }).join("") + '<line x1="0" y1="115.5" x2="600" y2="115.5" stroke="currentColor" opacity=".3"/><text x="0" y="138" font-size="13">' + dias[0].slice(8) + "/" + dias[0].slice(5, 7) + '</text><text x="600" y="138" font-size="13" text-anchor="end">hoje</text><text x="0" y="12" font-size="13">máx. ' + mx + "</text></svg>";
}
function paint(j) {
  var ord = j.setores.slice().sort(function (a, b) { return (b.nota == null ? -1 : b.nota) - (a.nota == null ? -1 : a.nota); });
  tv.innerHTML = k("Avaliações", j.total, "nos últimos 30 dias") + k("Hoje", j.hoje, "nas últimas 24 horas") + k("Nota média", j.nota == null ? "—" : f1(j.nota) + "/5", "perguntas de nota") + k("NPS", j.nps == null ? "—" : j.nps, "de -100 a 100") + k("Satisfeitos", j.satisfeitos == null ? "—" : j.satisfeitos + "%", "notas 4 e 5") +
    '<section class="p rk"><h2>Nota média por setor</h2>' + ord.map(function (s) { return '<div class="hb"><span>' + esc(s.nome) + (s.nota != null && s.nota < 3 ? '<span class="bdg">Atenção</span>' : "") + '</span><span class="tr"><i style="width:' + (s.nota == null ? 0 : Math.round(s.nota / 5 * 100)) + '%"></i></span><b>' + (s.nota == null ? "sem respostas" : f1(s.nota) + " · " + s.respostas) + "</b></div>"; }).join("") + '</section><section class="p sr"><h2>Avaliações por dia (14 dias)</h2>' + serie(j.serie) + '<p style="margin:12px 0 0;color:var(--mut)">Abaixo da média no período: <b>' + j.abaixoMedia + "</b></p></section>";
  var d = new Date(j.atualizadoEm);
  rel.textContent = d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function load() {
  fetch("/api/tv" + (TOKEN ? "?token=" + encodeURIComponent(TOKEN) : ""), { headers: { "X-Requested-With": "fhdod" } })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || "Erro " + r.status); return j; }); })
    .then(paint)
    .catch(function (e) { if (!tv.querySelector(".k")) tv.innerHTML = '<p class="err">' + esc(e.message) + "</p>"; });
}
load(); setInterval(load, 30000);
