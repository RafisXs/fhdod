/* Área restrita: gerente, administrador de setor e visualizador. */
var ME = null, TAB = "res", F = { p: "30", s: "", t: "", u: "" }, DATA = [], LOADERR = null, UPDT = null, CT = { st: "pendente", s: "" }, QS = "";
var STL = { pendente: "Pendente", contatado: "Contatado", resolvido: "Resolvido" };
function $(i) { return document.getElementById(i); }
function isG() { return ME && ME.papel === "gerente"; }            // gerente: mexe em tudo
function isV() { return ME && ME.papel === "visualizador"; }       // visualizador: só consulta
function all() { return ME && !ME.setor_id; }                       // vê todos os setores (gerente ou visualizador sem setor)
function mySet() { return all() ? S : S.filter(function (s) { return s.id === ME.setor_id; }); }
function papelTxt(u) {
  if (u.papel === "gerente") return "Gerente (todos os setores)";
  if (u.papel === "admin") return "Administrador do setor: " + sname(u.setor_id);
  return "Visualizador (somente leitura): " + (u.setor_id ? sname(u.setor_id) : "todos os setores");
}
function fmt1(x) { return x.toFixed(1).replace(".", ","); }
function fmtd(k) { return new Date(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
function fmtData(s) { var p = String(s).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
function cnt(rows, fn) { var c = {}; rows.forEach(function (r) { var k = fn(r); if (Array.isArray(k)) k.forEach(function (x) { c[x] = (c[x] || 0) + 1; }); else c[k] = (c[k] || 0) + 1; }); return c; }
function sel(id, l, opts, v) { return '<div><label for="' + id + '">' + l + '</label><select id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>"; }
function hb(o, total, order) {
  var keys = order || Object.keys(o).sort(function (a, b) { return o[b] - o[a]; });
  var mx = Math.max.apply(null, keys.map(function (k) { return o[k] || 0; }).concat([1]));
  return keys.map(function (k) { var v = o[k] || 0; return '<div class="hb"><span>' + esc(k) + '</span><span class="tr"><i style="width:' + Math.round(100 * v / mx) + '%"></i></span><b>' + v + (total ? " (" + pct(v, total) + "%)" : "") + "</b></div>"; }).join("") || '<p class="mut">Sem dados.</p>';
}
function npsOf(r) { return r.length ? Math.round(100 * (r.filter(function (x) { return x.nps >= 9; }).length - r.filter(function (x) { return x.nps <= 6; }).length) / r.length) : null; }
function avgOf(r) { var a = r.filter(function (x) { return x.nota_media != null; }); return a.length ? a.reduce(function (t, x) { return t + x.nota_media; }, 0) / a.length : null; }
function satOf(r) { var n = 0, t = 0; r.forEach(function (x) { x.ns.forEach(function (v) { t++; if (v >= 4) n++; }); }); return t ? Math.round(100 * n / t) : null; }
function top1(rows, key) { var c = cnt(rows, function (r) { return r[key].filter(function (x) { return !none(x); }); }); var k = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0]; return k ? k + " (" + c[k] + ")" : "-"; }

function filt(prev) {
  var N = F.p === "all" ? 0 : +F.p; if (prev && !N) return [];
  var now = Date.now(), hi = prev ? now - N * 864e5 : Infinity, lo = prev ? now - 2 * N * 864e5 : (N ? now - N * 864e5 : 0);
  return DATA.filter(function (r) { var t = new Date(r.criado_em).getTime(); return t >= lo && t < hi && (!F.s || r.setor === F.s) && (!F.t || r.turno === F.t) && (!F.u || r.tipo_atendimento === F.u); });
}
function dl(c, p, dec, suf) {
  if (F.p === "all") return "todo o período";
  if (p == null || c == null) return "sem dados no período anterior";
  var d = c - p; if (Math.abs(d) < (dec ? 0.05 : 0.5)) return "= igual ao período anterior";
  return (d > 0 ? "▲ +" : "▼ −") + (dec ? fmt1(Math.abs(d)) : Math.round(Math.abs(d))) + (suf || "") + " vs período anterior";
}
function series(rows) {
  if (!rows.length) return "";
  var daily = (F.p === "7" || F.p === "30"), step = daily ? 1 : 7;
  function day(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function key(d) { var x = day(d); if (!daily) x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); }
  var c = {}, mn = Infinity, mxk = 0;
  rows.forEach(function (r) { var k = key(r.criado_em); c[k] = (c[k] || 0) + 1; if (k < mn) mn = k; if (k > mxk) mxk = k; });
  var start = mn;
  if (daily) { var s0 = day(Date.now()); s0.setDate(s0.getDate() - (+F.p - 1)); start = s0.getTime(); mxk = day(Date.now()).getTime(); }
  var ks = []; for (var t = start; t <= mxk;) { ks.push(t); var d = new Date(t); d.setDate(d.getDate() + step); t = d.getTime(); }
  var mx = Math.max.apply(null, ks.map(function (k) { return c[k] || 0; }).concat([1])), bw = 600 / ks.length;
  var bars = ks.map(function (k, i) { var v = c[k] || 0, h = Math.round(105 * v / mx); return '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (115 - h) + '" width="' + Math.max(bw - 2, 1).toFixed(1) + '" height="' + h + '" rx="2"><title>' + (daily ? "" : "Semana de ") + fmtd(k) + ": " + v + " avaliações</title></rect>"; }).join("");
  var l1 = fmtd(ks[0]), l2 = fmtd(ks[ks.length - 1]);
  return '<svg class="sv" viewBox="0 0 600 150" role="img" aria-label="Avaliações por ' + (daily ? "dia" : "semana") + ", de " + l1 + " a " + l2 + ", máximo " + mx + '">' + bars + '<line x1="0" y1="115.5" x2="600" y2="115.5" stroke="currentColor" opacity=".3"/><text x="0" y="135" font-size="12">' + l1 + '</text><text x="600" y="135" font-size="12" text-anchor="end">' + l2 + '</text><text x="0" y="10" font-size="12">máx. ' + mx + "</text></svg>";
}
function kpi(l, v, s) { return '<div class="kpi"><small>' + l + "</small><b>" + v + "</b><span>" + s + "</span></div>"; }

function body(rows) {
  if (!rows.length) return '<div class="note">' + (LOADERR ? esc(LOADERR.message) : (DATA.length ? "Nenhuma avaliação com estes filtros." : "Ainda não há avaliações para mostrar.")) + "</div>";
  var pr = filt(true), n = rows.length, nps = npsOf(rows), av = avgOf(rows), sat = satOf(rows);
  var ab = rows.filter(function (x) { return x.abaixo_media; }).length, pend = rows.filter(function (x) { return x.telefone && x.contato_status === "pendente"; }).length;
  var det = rows.filter(function (x) { return x.nps <= 6; }).length, neu = rows.filter(function (x) { return x.nps === 7 || x.nps === 8; }).length, pro = rows.filter(function (x) { return x.nps >= 9; }).length;
  var cn = cnt(rows, function (x) { return x.nps; }), mxn = Math.max.apply(null, Object.keys(cn).map(function (k) { return cn[k]; }).concat([1]));
  var hist = ""; for (var i = 1; i <= 10; i++) { var v = cn[i] || 0; hist += '<div class="hc"><span>' + v + '</span><i style="height:' + Math.round(100 * v / mxn) + "%;background:hsl(" + Math.round((i - 1) / 9 * 125) + ',70%,50%)"></i><em>' + i + "</em></div>"; }
  var ids = S.map(function (s) { return s.id; }).filter(function (id) { return rows.some(function (r) { return r.setor === id; }); });
  ids.sort(function (a, b) { return (avgOf(rows.filter(function (x) { return x.setor === a; })) || 9) - (avgOf(rows.filter(function (x) { return x.setor === b; })) || 9); });
  var trs = ids.map(function (id) { var r = rows.filter(function (x) { return x.setor === id; }), a = avgOf(r); return "<tr><td>" + esc(sname(id)) + (a != null && a < 3 ? '<span class="bdg">Atenção</span>' : "") + "</td><td>" + r.length + "</td><td>" + (a == null ? "-" : fmt1(a) + '/5<span class="tr mini"><i style="width:' + Math.round(a / 5 * 100) + '%"></i></span>') + "</td><td>" + npsOf(r) + "</td><td>" + (satOf(r) == null ? "-" : satOf(r) + "%") + "</td><td>" + r.filter(function (x) { return x.abaixo_media; }).length + "</td><td>" + esc(top1(r, "pos")) + "</td><td>" + esc(top1(r, "neg")) + "</td></tr>"; }).join("");
  var semM = rows.filter(function (x) { return x.neg.some(none); }).length;
  return '<div class="kpis">' + kpi("Avaliações", n, dl(n, pr.length || null, 0)) + kpi("Nota média", av == null ? "-" : fmt1(av) + "/5", dl(av, avgOf(pr), 1)) + kpi("NPS", nps, dl(nps, npsOf(pr), 0)) + kpi("Satisfeitos", sat == null ? "-" : sat + "%", dl(sat, satOf(pr), 0, " p.p.")) + kpi("Abaixo da média", ab + " (" + pct(ab, n) + "%)", isV() ? "notas baixas no período" : "contatos pendentes: " + pend) + "</div>" +
    '<div class="pn"><section class="pnl w2"><h3>Avaliações ao longo do tempo</h3>' + series(rows) + "</section>" +
    '<section class="pnl"><h3>Recomendação (1 a 10)</h3><div class="hist" role="img" aria-label="Distribuição das notas de recomendação">' + hist + '</div><div class="stk" aria-hidden="true"><i style="width:' + pct(det, n) + '%;background:hsl(0,70%,50%)"></i><i style="width:' + pct(neu, n) + '%;background:hsl(50,80%,50%)"></i><i style="width:' + pct(pro, n) + '%;background:hsl(125,60%,42%)"></i></div><div class="lg"><span><i style="background:hsl(0,70%,50%)"></i>Detratores (1-6): ' + pct(det, n) + '%</span><span><i style="background:hsl(50,80%,50%)"></i>Neutros (7-8): ' + pct(neu, n) + '%</span><span><i style="background:hsl(125,60%,42%)"></i>Promotores (9-10): ' + pct(pro, n) + "%</span></div></section>" +
    '<section class="pnl"><h3>Perfil de quem avaliou</h3><h4>Tipo de atendimento</h4>' + hb(cnt(rows, function (x) { return x.tipo_atendimento; }), n, ["SUS", "Plano de Saúde", "Particular"]) + "<h4>Turno</h4>" + hb(cnt(rows, function (x) { return x.turno; }), n, ["Dia", "Noite"]) + "<h4>Respondente</h4>" + hb(cnt(rows, function (x) { return x.respondente; }), n, ["Paciente", "Familiar"]) + "</section>" +
    '<section class="pnl"><h3>O que foi bom</h3>' + hb(cnt(rows, function (x) { return x.pos; }), n) + "</section>" +
    '<section class="pnl"><h3>O que pode melhorar</h3>' + hb(cnt(rows, function (x) { return x.neg.filter(function (y) { return !none(y); }); }), n) + '<p class="mut" style="margin:8px 0 0">Responderam "Nada a melhorar": ' + semM + " (" + pct(semM, n) + "%)</p></section>" +
    '<section class="pnl w2"><h3>Resultado por setor</h3><div class="tbl-wrap"><table class="tbl"><caption class="sr">Resultado por setor</caption><thead><tr><th>Setor</th><th>Resp.</th><th>Nota</th><th>NPS</th><th>Satisf.</th><th>Abaixo da média</th><th>Mais elogiado</th><th>Mais a melhorar</th></tr></thead><tbody>' + trs + '</tbody></table></div><p class="mut" style="margin:8px 0 0">Ordenado da menor para a maior nota. "Atenção" aparece nos setores com nota média abaixo de 3.</p></section></div>';
}

function falhou(e) { if (e.status === 401) { pararVivo(); ME = null; DATA = []; UPDT = null; loginView("Sessão expirada. Entre novamente."); return true; } return false; }
function loadData(cb) {
  api("GET", "/api/admin/avaliacoes").then(function (rows) { DATA = rows; LOADERR = null; UPDT = new Date(); cb(); })
    .catch(function (e) { if (falhou(e)) return; DATA = []; LOADERR = e; UPDT = new Date(); cb(); });
}
function updBadge() { var n = DATA.filter(function (r) { return r.telefone && r.contato_status === "pendente"; }).length, b = $("t-ctt"); if (b) b.textContent = "Contatos" + (n ? " (" + n + ")" : ""); }

/* ---------- Login e estrutura ---------- */
function boot() {
  api("GET", "/api/me").then(function (me) { entrou(me); })
    .catch(function (e) { if (e.status === 401) loginView(); else erroTela(e); });
}
function erroTela(e) { draw('<h1>Não foi possível abrir</h1><div class="note">' + esc(e.message) + (e.dica ? "<br>" + esc(e.dica) : "") + '</div><button class="cta" id="rt">Tentar de novo</button>'); $("rt").onclick = boot; }
function carregarSetores() { return api("GET", "/api/admin/setores").then(function (l) { S = l; }); }
function setOpts() { return S.map(function (s) { return [s.id, s.nome + (s.ativo === false ? " (desativado)" : "")]; }); }
function entrou(me) {
  ME = me; DATA = []; UPDT = null; TAB = "res";
  carregarSetores().then(function () { F.s = all() ? "" : ME.setor_id; shell(); }).catch(function (e) { if (!falhou(e)) erroTela(e); });
}

function loginView(aviso) {
  draw('<h1>Área restrita</h1><p class="mut">Acesso somente para a equipe autorizada: gerente, administradores de setor e visualizadores.</p><form id="f" novalidate>' + fld("em", "E-mail", "email", 'autocomplete="username" required') + fld("pw", "Senha", "password", 'autocomplete="current-password" required') + '<label class="sh"><input type="checkbox" id="sp"> Mostrar senha</label><p class="err" id="er" role="alert">' + esc(aviso || "") + '</p><button class="cta" type="submit">Entrar</button></form>');
  showPw(["pw"]);
  $("f").onsubmit = function (e) {
    e.preventDefault();
    var er = $("er"), em = $("em").value.trim(), pw = $("pw").value;
    if (!em || !pw) { er.textContent = "Preencha e-mail e senha."; return; }
    er.textContent = "Entrando...";
    api("POST", "/api/login", { email: em, senha: pw })
      .then(function (me) { return me; })
      .then(entrou)
      .catch(function (x) { er.textContent = x.message; });
  };
}

function shell() {
  var tabs = [["res", "Resultados"]].concat(isV() ? [] : [["ctt", "Contatos"], ["per", "Perguntas"]].concat(isG() ? [["set", "Setores"]] : []).concat([["eq", "Equipe"]]));
  draw('<div class="dtop"><p class="who"><strong>' + esc(ME.nome) + '</strong><br><span class="mut">' + esc(papelTxt(ME)) + '</span></p><span class="sp"></span>' + (isG() ? '<a class="ghost" href="/tv.html" target="_blank" rel="noopener">TV Wall</a>' : "") + '<button class="ghost" id="out">Sair</button></div><nav class="tabs" aria-label="Seções">' + tabs.map(function (t) { return '<button id="t-' + t[0] + '" data-t="' + t[0] + '">' + t[1] + "</button>"; }).join("") + '</nav><div id="tab"><p class="mut">Carregando…</p></div>');
  app.classList.add("wide");
  $("out").onclick = function () { pararVivo(); api("POST", "/api/logout").then(function () { ME = null; DATA = []; UPDT = null; loginView(); }, function () { loginView(); }); };
  document.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () { setTab(b.dataset.t); }; });
  loadData(function () { updBadge(); setTab(TAB); });
}
function setTab(t) {
  TAB = t;
  pararVivo();
  document.querySelectorAll(".tabs button").forEach(function (b) { if (b.dataset.t === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  ({ res: viewRes, ctt: viewCtt, per: viewPer, set: viewSet, eq: viewEq })[t]();
  if (t === "res") iniciarVivo();
}

/* ---------- Resultados ---------- */
function exportUrl() { var q = ["p=" + F.p]; if (F.s) q.push("s=" + F.s); if (F.t) q.push("t=" + encodeURIComponent(F.t)); if (F.u) q.push("u=" + encodeURIComponent(F.u)); return "/api/admin/export.xlsx?" + q.join("&"); }
function viewRes() {
  $("tab").innerHTML = '<div class="dtop"><p class="mut" id="upd" style="margin:0"></p><span class="sp"></span><button class="ghost" id="rf">Atualizar</button><button class="ghost" id="pt">Imprimir</button><a class="ghost" id="ex" href="#">Exportar Excel</a></div><p class="prn" id="prn"></p><div id="vivo"></div><div class="filters">' +
    sel("fp", "Período", [["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["all", "Todo o período"]], F.p) +
    (all() ? sel("fs", "Setor", [["", "Todos os setores"]].concat(setOpts()), F.s) : "") +
    sel("ft", "Turno", [["", "Todos"], ["Dia", "Dia"], ["Noite", "Noite"]], F.t) + sel("fu", "Tipo de atendimento", [["", "Todos"], ["SUS", "SUS"], ["Plano de Saúde", "Plano de Saúde"], ["Particular", "Particular"]], F.u) + '</div><div id="dbody"></div>';
  $("rf").onclick = function () { $("dbody").innerHTML = '<p class="mut">Atualizando…</p>'; loadData(function () { updBadge(); updRes(); }); };
  $("pt").onclick = function () { window.print(); };
  $("ex").onclick = function () { $("ex").href = exportUrl(); };
  [["fp", "p"], ["fs", "s"], ["ft", "t"], ["fu", "u"]].forEach(function (f) { var el = $(f[0]); if (el) el.onchange = function () { F[f[1]] = this.value; updRes(); }; });
  updRes();
}
function updRes() {
  var rows = filt(), pl = { 7: "últimos 7 dias", 30: "últimos 30 dias", 90: "últimos 90 dias", all: "todo o período" };
  $("dbody").innerHTML = body(rows) + (rows.length ? '<div id="rpq"></div>' : "");
  if (rows.length) carregarRPQ();
  $("upd").textContent = UPDT ? "Atualizado às " + UPDT.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + (DATA.length >= 5000 ? " (mostrando as 5000 mais recentes)" : "") : "";
  $("prn").textContent = "Fundação Hospitalar Dr. Oswaldo Diesel - Avaliação do atendimento. Período: " + pl[F.p] + ". Gerado em " + new Date().toLocaleString("pt-BR") + ".";
}



/* ---------- Resultado por pergunta (período e setor do filtro) ---------- */
var RPQ_ABERTO = false;
var TIPO_TXT = { escala: "Nota (1 a 5)", nps: "Recomendação (1 a 10)", positivos: "O que foi bom", negativos: "O que melhorar" };
function carregarRPQ() {
  api("GET", "/api/admin/resultado-perguntas?p=" + encodeURIComponent(F.p) + (all() && F.s ? "&s=" + encodeURIComponent(F.s) : "")).then(function (j) {
    var el = $("rpq"); if (!el) return;
    var ultimo = null, linhas = j.itens.map(function (x) {
      var cab = x.setor !== ultimo ? '<tr class="grp"><td colspan="4"><strong>' + esc(sname(x.setor)) + "</strong></td></tr>" : ""; ultimo = x.setor;
      var res = x.tipo === "escala" ? "<b>" + fmt1(x.media) + "</b>/5 · " + x.satisfeitos + "% satisfeitos"
        : x.tipo === "nps" ? "<b>" + fmt1(x.media) + "</b>/10 · NPS " + x.nps
        : (x.opcoes.length ? esc(x.opcoes.map(function (o) { return o[0] + " (" + o[1] + ")"; }).join(", ")) : "<em>sem escolhas</em>");
      return cab + "<tr><td>" + esc(x.texto) + '</td><td class="mut">' + TIPO_TXT[x.tipo] + "</td><td>" + x.total + "</td><td>" + res + "</td></tr>";
    }).join("");
    el.innerHTML = '<details class="pnl rpq"' + (RPQ_ABERTO ? " open" : "") + '><summary><h3>Resultado por pergunta</h3></summary><p class="mut" style="margin:8px 0">Mostra cada pergunta, inclusive as que você adicionou. Respeita o período e o setor escolhidos acima. Perguntas excluídas aparecem enquanto houver respostas no período.</p><div class="tbl-wrap"><table class="tbl"><caption class="sr">Resultado por pergunta</caption><thead><tr><th>Pergunta</th><th>Tipo</th><th>Respostas</th><th>Resultado</th></tr></thead><tbody>' + (linhas || '<tr><td colspan="4" class="mut">Sem respostas no período.</td></tr>') + "</tbody></table></div></details>";
    el.querySelector("details").ontoggle = function () { RPQ_ABERTO = this.open; };
  }).catch(function (e) { falhou(e); });
}

/* ---------- Ao vivo: respostas já gravadas, mesmo de quem ainda não terminou ---------- */
var VIVO = null;
function pararVivo() { if (VIVO) { clearInterval(VIVO); VIVO = null; } }
function iniciarVivo() { pararVivo(); carregarVivo(); VIVO = setInterval(function () { if (!document.hidden) carregarVivo(); }, 8000); }
function ha(seg) { return seg < 60 ? "agora" : seg < 3600 ? "há " + Math.floor(seg / 60) + " min" : seg < 86400 ? "há " + Math.floor(seg / 3600) + " h" : "há " + Math.floor(seg / 86400) + " d"; }
function resumoResp(rs) {
  return rs.map(function (r) {
    if (r.tipo === "escala") return '<span class="rsp" title="' + esc(r.texto) + '">P' + r.ordem + ": <b>" + r.n + "</b>/5</span>";
    if (r.tipo === "nps") return '<span class="rsp" title="' + esc(r.texto) + '">Recomenda: <b>' + r.n + "</b>/10</span>";
    var v = (r.v || []).filter(function (x) { return !none(x) || r.tipo === "negativos"; });
    return '<span class="rsp" title="' + esc(r.texto) + '">' + (r.tipo === "positivos" ? "Bom" : "Melhorar") + ": " + (v.length ? esc(v.join(", ")) : "<em>nenhum</em>") + "</span>";
  }).join("");
}
function paintVivo(j) {
  var el = $("vivo"); if (!el) return;
  var it = j.itens, ag = it.filter(function (x) { return x.ao_vivo; }), ab = it.length - ag.length;
  if (!it.length) { el.innerHTML = '<section class="pnl vivo"><h3><i class="dot off" aria-hidden="true"></i>Ao vivo</h3><p class="mut" style="margin:0">Ninguém está respondendo agora. Cada resposta aparece aqui no instante em que o paciente avança, mesmo que ele não termine o formulário.</p></section>'; return; }
  var linhas = it.slice(0, 12).map(function (x) {
    return "<tr><td>" + esc(sname(x.setor)) + '</td><td>' + (x.ao_vivo ? '<span class="bdg live">Respondendo agora</span>' : '<span class="bdg">Não terminou</span>') + '<br><span class="mut">' + ha(x.ha_seg) + '</span></td><td><span class="prog" role="img" aria-label="' + x.respondidas + " de " + x.total + ' perguntas respondidas">' + (function () { var h = ""; for (var i = 0; i < x.total; i++) h += "<i" + (i < x.respondidas ? ' class="on"' : "") + "></i>"; return h; })() + "</span> " + x.respondidas + "/" + x.total + "</td><td>" + resumoResp(x.respostas) + "</td></tr>";
  }).join("");
  el.innerHTML = '<section class="pnl vivo"><h3><i class="dot' + (ag.length ? "" : " off") + '" aria-hidden="true"></i>Ao vivo: <span>' + ag.length + " respondendo agora</span>, <span>" + ab + ' não terminaram</span> <small class="mut">(últimos 7 dias)</small></h3><p class="mut" style="margin:0 0 8px">Cada resposta é gravada no instante em que o paciente avança. Estas avaliações ainda não entram nos indicadores abaixo, que contam só as enviadas. Atualiza sozinho a cada 8 segundos.</p><div class="tbl-wrap"><table class="tbl"><caption class="sr">Avaliações em andamento</caption><thead><tr><th>Setor</th><th>Situação</th><th>Progresso</th><th>Respostas até agora</th></tr></thead><tbody>' + linhas + "</tbody></table></div>" + (it.length > 12 ? '<p class="mut" style="margin:8px 0 0">Mostrando as 12 mais recentes de ' + it.length + ".</p>" : "") + "</section>";
}
function carregarVivo() {
  api("GET", "/api/admin/andamento").then(function (j) {
    if (TAB !== "res") return;
    paintVivo(j);
    // Alguém terminou uma avaliação: atualiza os indicadores sozinho (sem mexer nos filtros)
    if (DATA.length < 5000 && j.concluidas !== DATA.length) loadData(function () { updBadge(); if (TAB === "res") updRes(); });
  }).catch(function (e) { if (falhou(e)) pararVivo(); });
}

/* ---------- Contatos (telefones de avaliações abaixo da média) ---------- */
function viewCtt() {
  var rows = DATA.filter(function (r) { return r.telefone && (!CT.st || r.contato_status === CT.st) && (!CT.s || r.setor === CT.s); });
  $("tab").innerHTML = '<p class="mut">Pessoas que deram nota abaixo da média e autorizaram o contato. Ligue para entender o que houve e registre o resultado. Use o telefone somente para este fim.</p><div class="filters">' +
    sel("cs", "Situação", [["", "Todas"], ["pendente", "Pendentes"], ["contatado", "Contatadas"], ["resolvido", "Resolvidas"]], CT.st) +
    (all() ? sel("cx", "Setor", [["", "Todos os setores"]].concat(setOpts()), CT.s) : "") + '</div><div class="cards">' +
    (rows.length ? rows.map(function (r) {
      var neg = r.neg.filter(function (x) { return !none(x); });
      return '<article class="pnl" data-id="' + r.id + '"><h3>' + esc(sname(r.setor)) + ' <span class="bdg" style="margin-left:6px">' + STL[r.contato_status] + '</span></h3><p class="mut">Atendimento em ' + fmtData(r.data_atendimento) + " · " + esc(r.turno) + " · " + esc(r.respondente) + " · " + esc(r.tipo_atendimento) + "</p><p>Nota média: <strong>" + (r.nota_media == null ? "-" : fmt1(r.nota_media) + "/5") + "</strong> · Recomendação: <strong>" + r.nps + "/10</strong></p>" + (neg.length ? "<p>Pontos a melhorar: " + esc(neg.join(", ")) + "</p>" : "") +
        '<p><a class="lk" href="tel:+55' + r.telefone + '">' + IT + '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>' + fmtTel(r.telefone) + "</a></p>" +
        '<div class="fld">' + sel("st" + r.id, "Situação", [["pendente", "Pendente"], ["contatado", "Contatado"], ["resolvido", "Resolvido"]], r.contato_status) + '</div><div class="fld"><label for="ob' + r.id + '">Observações (até 500 caracteres)</label><textarea id="ob' + r.id + '" maxlength="500" rows="3">' + esc(r.contato_obs || "") + '</textarea></div><div class="row"><button class="btn" data-a="save">Salvar</button><button class="btn o" data-a="del">Apagar telefone</button></div><p class="msg" role="status"></p></article>';
    }).join("") : '<p class="mut">Nenhum contato com estes filtros.</p>') + "</div>";
  $("cs").onchange = function () { CT.st = this.value; viewCtt(); };
  if ($("cx")) $("cx").onchange = function () { CT.s = this.value; viewCtt(); };
  document.querySelectorAll("article[data-id] button").forEach(function (b) {
    b.onclick = function () {
      var art = b.closest("article"), id = +art.dataset.id, msg = art.querySelector(".msg"), apagar = b.dataset.a === "del";
      if (apagar && !confirm("Apagar o telefone desta pessoa? Isso não pode ser desfeito.")) return;
      var st = art.querySelector("select").value, ob = art.querySelector("textarea").value;
      b.disabled = true; msg.className = "msg"; msg.textContent = "Salvando...";
      api("PATCH", "/api/admin/avaliacoes/" + id + "/contato", { status: st, obs: ob, apagar: apagar }).then(function () {
        var r = DATA.filter(function (x) { return x.id === id; })[0]; r.contato_status = st; r.contato_obs = ob || null; if (apagar) r.telefone = null;
        updBadge(); if (apagar || (CT.st && CT.st !== st)) viewCtt(); else { msg.className = "msg ok"; msg.textContent = "Salvo."; b.disabled = false; art.querySelector("h3 .bdg").textContent = STL[st]; }
      }).catch(function (e) { if (falhou(e)) return; b.disabled = false; msg.textContent = e.message; });
    };
  });
}

/* ---------- Perguntas (gerente: todos os setores; administrador: o seu setor) ---------- */
var TIPOS = [["escala", "Nota de satisfação (5 níveis)"], ["positivos", "O que foi bom (escolha várias)"], ["negativos", "O que pode melhorar (escolha várias)"]];
var QL = [], QREM = [], MAXQ = 30;
function viewPer() {
  var ss = mySet(); if (!QS || !ss.some(function (s) { return s.id === QS; })) QS = ss[0].id;
  $("tab").innerHTML = '<p class="mut">Cada setor pode ter até ' + MAXQ + ' perguntas. Adicione, exclua e mude a ordem com os botões de cada pergunta e clique em <strong>Salvar alterações</strong> no fim. A pergunta de <strong>recomendação de 1 a 10</strong> é obrigatória em todo setor: dá para mudar o texto e a posição, mas não excluir. Perguntas de nota são obrigatórias para o paciente; as de escolha são opcionais. Formulários curtos (5 a 8 perguntas) costumam ter mais respostas. As mudanças valem para as próximas avaliações; as respostas antigas guardam o texto da época.</p>' +
    (all() ? '<div class="filters">' + sel("qs", "Setor", setOpts(), QS) + "</div>" : "<h2>" + esc(sname(QS)) + "</h2>") + '<div id="qed"><p class="mut">Carregando…</p></div>';
  if ($("qs")) $("qs").onchange = function () { QS = this.value; loadQ(); };
  loadQ();
}
function loadQ(depois) {
  api("GET", "/api/admin/perguntas/" + QS).then(function (qs) {
    QL = qs.map(function (q) { return { id: q.id, texto: q.texto, tipo: q.tipo, opcoesTxt: (q.opcoes || []).join("\n"), ativa: q.ativa }; });
    QREM = []; drawQ(); if (depois) depois();
  }).catch(function (e) { if (!falhou(e)) $("qed").innerHTML = '<div class="note">' + esc(e.message) + "</div>"; });
}
function qmsg(t, ok) { var m = $("qmsg"); if (m) { m.className = "msg" + (ok ? " ok" : ""); m.textContent = t; } }
function drawQ() {
  var n = QL.length;
  $("qed").innerHTML = QL.map(function (q, i) {
    var nps = q.tipo === "nps", ch = q.tipo === "positivos" || q.tipo === "negativos";
    return '<fieldset class="pnl qe" data-i="' + i + '" style="margin-bottom:12px"><legend><strong>Pergunta ' + (i + 1) + (nps ? " (recomendação de 1 a 10)" : "") + (q.id ? "" : " (nova)") + '</strong></legend>' +
      '<div class="row qtools"><button type="button" class="ghost" data-a="up"' + (i === 0 ? " disabled" : "") + ' aria-label="Subir a pergunta ' + (i + 1) + '">↑ Subir</button><button type="button" class="ghost" data-a="down"' + (i === n - 1 ? " disabled" : "") + ' aria-label="Descer a pergunta ' + (i + 1) + '">↓ Descer</button>' + (nps ? "" : '<button type="button" class="ghost danger" data-a="del" aria-label="Excluir a pergunta ' + (i + 1) + '">Excluir</button>') + "</div>" +
      '<div class="fld"><label for="qt' + i + '">Texto da pergunta</label><input id="qt' + i + '" class="qt" maxlength="160" value="' + esc(q.texto) + '"></div>' +
      (nps ? '<p class="mut" style="margin:0">Carinhas de 1 a 10. Sempre presente, não pode ser desativada.</p>'
        : '<div class="fld">' + sel("qk" + i, "Tipo de resposta", TIPOS, q.tipo) + '</div><div class="fld qo-w"' + (ch ? "" : " hidden") + '><label for="qo' + i + '">Opções (uma por linha, de 2 a 10)</label><textarea id="qo' + i + '" class="qo" rows="5">' + esc(q.opcoesTxt) + '</textarea></div><label class="sh"><input type="checkbox" class="qa"' + (q.ativa ? " checked" : "") + "> Mostrar esta pergunta na pesquisa</label>") + "</fieldset>";
  }).join("") + '<section class="pnl qadd"><h3>Adicionar pergunta</h3><div class="row" style="align-items:end">' + sel("qnt", "Tipo da nova pergunta", TIPOS, "escala") + '<button type="button" class="btn o" id="qadd"' + (n >= MAXQ ? " disabled" : "") + '>+ Adicionar</button></div><p class="mut" style="margin:8px 0 0">' + n + " de " + MAXQ + ' perguntas.</p></section><div class="row"><button class="btn" id="qsave">Salvar alterações</button></div><p class="msg" id="qmsg" role="status"></p>';
  var box = $("qed");
  box.oninput = function (e) {
    var f = e.target.closest(".qe"); if (!f) return; var q = QL[+f.dataset.i];
    if (e.target.classList.contains("qt")) q.texto = e.target.value; else if (e.target.classList.contains("qo")) q.opcoesTxt = e.target.value;
  };
  box.onchange = function (e) {
    var f = e.target.closest(".qe"); if (!f) return; var q = QL[+f.dataset.i];
    if (e.target.tagName === "SELECT") { q.tipo = e.target.value; f.querySelector(".qo-w").hidden = !(q.tipo === "positivos" || q.tipo === "negativos"); }
    else if (e.target.classList.contains("qa")) q.ativa = e.target.checked;
  };
  box.onclick = function (e) {
    var b = e.target.closest("button"); if (!b || b.disabled) return;
    if (b.id === "qadd") {
      if (QL.length >= MAXQ) return;
      var t = $("qnt").value; QL.push({ id: null, texto: "", tipo: t, opcoesTxt: t === "escala" ? "" : "", ativa: true }); drawQ();
      var ni = $("qt" + (QL.length - 1)); if (ni) ni.focus(); return;
    }
    if (b.id === "qsave") return salvarQ();
    var f = b.closest(".qe"); if (!f) return; var i = +f.dataset.i, a = b.dataset.a;
    if (a === "up" && i > 0) { var x = QL[i]; QL[i] = QL[i - 1]; QL[i - 1] = x; drawQ(); }
    else if (a === "down" && i < QL.length - 1) { var y = QL[i]; QL[i] = QL[i + 1]; QL[i + 1] = y; drawQ(); }
    else if (a === "del") {
      if (!window.confirm("Excluir esta pergunta? As respostas que ela já recebeu continuam guardadas nos resultados.")) return;
      if (QL[i].id) QREM.push(QL[i].id);
      QL.splice(i, 1); drawQ();
    }
  };
}
function salvarQ() {
  var out = QL.map(function (q) {
    var ch = q.tipo === "positivos" || q.tipo === "negativos";
    return { id: q.id || undefined, texto: q.texto, tipo: q.tipo, opcoes: ch ? q.opcoesTxt.split("\n").map(function (x) { return x.trim(); }).filter(Boolean) : null, ativa: q.tipo === "nps" ? true : q.ativa };
  }).concat(QREM.map(function (id) { return { id: id, remover: true }; }));
  $("qsave").disabled = true; qmsg("Salvando...");
  api("PUT", "/api/admin/perguntas/" + QS, { perguntas: out })
    .then(function () { loadQ(function () { qmsg("Perguntas salvas. Já valem para as próximas avaliações.", true); }); carregarSetores().catch(function () {}); })
    .catch(function (e) { if (falhou(e)) return; qmsg(e.message); if ($("qsave")) $("qsave").disabled = false; });
}

/* ---------- Setores (só o gerente): criar, renomear, ordenar, ativar e desativar ---------- */
function viewSet() {
  $("tab").innerHTML = '<p class="mut">Cadastre os departamentos do hospital. Cada setor novo nasce com 5 perguntas padrão (você ou o administrador do setor edita depois) e ganha o seu próprio link da pesquisa, que pode virar QR Code. Depois de criar, cadastre o administrador do setor na aba <strong>Equipe</strong>. Um setor <strong>desativado</strong> some da pesquisa e da TV, mas o histórico de avaliações fica guardado.</p>' +
    '<section class="pnl" style="margin-bottom:14px"><h3>Novo setor</h3><form id="sf" novalidate class="cards" style="align-items:end">' + fld("sn", "Nome do setor", "text", 'maxlength="60" autocomplete="off" required') + '<div class="fld"><button class="btn" type="submit">Adicionar setor</button></div></form><p class="msg" id="smsg" role="status"></p></section><div id="slist"></div>';
  $("sf").onsubmit = function (e) {
    e.preventDefault(); var m = $("smsg"); m.className = "msg"; m.textContent = "Criando...";
    api("POST", "/api/admin/setores", { nome: $("sn").value }).then(function (j) {
      m.className = "msg ok"; m.textContent = "Setor criado: " + j.nome + ". Link da pesquisa: " + location.origin + "/?setor=" + j.id; $("sn").value = "";
      return carregarSetores().then(drawSet);
    }).catch(function (x) { if (!falhou(x)) m.textContent = x.message; });
  };
  carregarSetores().then(drawSet).catch(function (e) { if (!falhou(e)) $("slist").innerHTML = '<div class="note">' + esc(e.message) + "</div>"; });
}
function drawSet() {
  var el = $("slist"); if (!el) return;
  el.innerHTML = '<div class="tbl-wrap"><table class="tbl"><caption class="sr">Setores do hospital</caption><thead><tr><th>Setor</th><th>Situação</th><th>Perguntas</th><th>Avaliações</th><th>Link da pesquisa</th><th>Ações</th></tr></thead><tbody>' +
    S.map(function (s, i) {
      return '<tr data-id="' + esc(s.id) + '"><td><strong>' + esc(s.nome) + "</strong></td><td>" + (s.ativo ? '<span class="bdg live">Ativo</span>' : '<span class="bdg">Desativado</span>') + "</td><td>" + s.perguntas + "</td><td>" + s.avaliacoes + '</td><td class="slink"><code>/?setor=' + esc(s.id) + '</code> <button class="ghost" data-a="cp">Copiar link</button></td><td><div class="row">' +
        '<button class="ghost" data-a="up"' + (i === 0 ? " disabled" : "") + ' aria-label="Subir ' + esc(s.nome) + '">↑</button><button class="ghost" data-a="down"' + (i === S.length - 1 ? " disabled" : "") + ' aria-label="Descer ' + esc(s.nome) + '">↓</button>' +
        '<button class="ghost" data-a="rn">Renomear</button><button class="ghost" data-a="pq">Perguntas</button><button class="btn o" data-a="tg">' + (s.ativo ? "Desativar" : "Ativar") + "</button></div></td></tr>";
    }).join("") + "</tbody></table></div>";
  el.onclick = function (e) {
    var b = e.target.closest("button"); if (!b) return; var tr = b.closest("tr"), id = tr.dataset.id, a = b.dataset.a, s = S.filter(function (x) { return x.id === id; })[0];
    function patch(corpo) { api("PATCH", "/api/admin/setores/" + id, corpo).then(carregarSetores).then(drawSet).catch(function (x) { if (!falhou(x)) { var m = $("smsg"); m.className = "msg"; m.textContent = x.message; window.scrollTo(0, 0); } }); }
    if (a === "up") patch({ mover: "cima" }); else if (a === "down") patch({ mover: "baixo" });
    else if (a === "rn") { var n = window.prompt("Novo nome do setor:", s.nome); if (n && n.trim() !== s.nome) patch({ nome: n }); }
    else if (a === "tg") { if (s.ativo && !window.confirm("Desativar " + s.nome + "? Ele some da pesquisa e da TV. O histórico continua guardado.")) return; patch({ ativo: !s.ativo }); }
    else if (a === "pq") { QS = id; setTab("per"); }
    else if (a === "cp") { var url = location.origin + "/?setor=" + id; try { navigator.clipboard.writeText(url).then(function () { b.textContent = "Copiado"; }, function () { window.prompt("Copie o link:", url); }); } catch (x) { window.prompt("Copie o link:", url); } }
  };
}

/* ---------- Equipe (gerente: todas as contas; administrador: visualizadores do seu setor) ---------- */
function viewEq() {
  api("GET", "/api/admin/usuarios").then(function (us) {
    var opts = isG() ? [["admin", "Administrador de setor"], ["visualizador", "Visualizador (somente leitura)"], ["gerente", "Gerente (todos os setores)"]] : [["visualizador", "Visualizador do meu setor"]];
    $("tab").innerHTML = '<p class="mut">' + (isG()
      ? "O <strong>gerente</strong> mexe em tudo. O <strong>administrador</strong> cuida de um setor (cada setor tem no máximo 1 administrador ativo). O <strong>visualizador</strong> só consulta os resultados e nunca vê telefones."
      : "Crie contas de <strong>visualizador</strong> para o seu setor. Elas só consultam os resultados e nunca veem telefones. Apenas o gerente pode criar administradores.") + ' A senha tem de 8 a 72 caracteres.</p><section class="pnl" style="margin-bottom:14px"><h3>Nova conta</h3><form id="nf" novalidate class="cards" style="align-items:end">' +
      fld("nn", "Nome completo", "text", 'maxlength="100" autocomplete="off" required') + fld("ne", "E-mail", "email", 'maxlength="150" autocomplete="off" required') + fld("np", "Senha provisória", "password", 'autocomplete="new-password" required') +
      '<div class="fld"><label for="nr">Perfil</label><select id="nr">' + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("") + '</select></div><div class="fld" id="nsw"><label for="ns">Setor</label><select id="ns"></select></div><div class="fld"><button class="btn" type="submit">Criar conta</button></div></form><p class="msg" id="nmsg" role="status"></p></section>' +
      '<div class="box tbl-wrap"><table class="tbl"><caption class="sr">Contas da equipe</caption><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ações</th></tr></thead><tbody>' + (us.length ? us.map(function (u) {
        return '<tr data-id="' + u.id + '"><td>' + esc(u.nome) + "</td><td>" + esc(u.email) + "</td><td>" + esc(papelTxt(u)) + "</td><td>" + (u.ativo ? "Ativa" : "Desativada") + "</td><td>" + (u.email === ME.email ? '<span class="mut">Sua conta</span>' : '<div class="row"><button class="btn o" data-a="tog">' + (u.ativo ? "Desativar" : "Ativar") + '</button><button class="btn o" data-a="pw">Nova senha</button></div>') + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="mut">Nenhuma conta ainda.</td></tr>') + '</tbody></table></div><p class="msg" id="emsg" role="status"></p>';
    var tg = function () {
      var r = $("nr").value, w = $("nsw");
      if (!isG() || r === "gerente") { w.hidden = true; return; }
      w.hidden = false;
      var o = (r === "visualizador" ? [["", "Todos os setores"]] : []).concat(setOpts());
      $("ns").innerHTML = o.map(function (x) { return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + "</option>"; }).join("");
    };
    $("nr").onchange = tg; tg();
    $("nf").onsubmit = function (e) {
      e.preventDefault(); var m = $("nmsg"), r = $("nr").value; m.className = "msg"; m.textContent = "Criando...";
      api("POST", "/api/admin/usuarios", { nome: $("nn").value, email: $("ne").value, senha: $("np").value, papel: r, setor_id: !isG() ? ME.setor_id : (r === "gerente" ? null : ($("ns").value || null)) })
        .then(function () { viewEq(); }).catch(function (x) { if (!falhou(x)) m.textContent = x.message; });
    };
    document.querySelectorAll("tr[data-id] button").forEach(function (b) {
      b.onclick = function () {
        var id = +b.closest("tr").dataset.id, m = $("emsg"), corpo;
        if (b.dataset.a === "tog") corpo = { ativo: b.textContent === "Ativar" };
        else { var s = prompt("Digite a nova senha (8 a 72 caracteres):"); if (!s) return; corpo = { senha: s }; }
        m.className = "msg"; m.textContent = "Salvando...";
        api("PATCH", "/api/admin/usuarios/" + id, corpo).then(function () { if (corpo.senha) { m.className = "msg ok"; m.textContent = "Senha alterada."; } else viewEq(); }).catch(function (x) { if (!falhou(x)) m.textContent = x.message; });
      };
    });
  }).catch(function (e) { if (!falhou(e)) $("tab").innerHTML = '<div class="note">' + esc(e.message) + "</div>"; });
}

// Sessão sem uso por 15 minutos: sai sozinho
var LASTACT = Date.now();
["click", "keydown", "touchstart"].forEach(function (ev) { document.addEventListener(ev, function () { LASTACT = Date.now(); }, true); });
setInterval(function () { if (ME && Date.now() - LASTACT > 9e5) api("POST", "/api/logout").then(function () { ME = null; loginView("Sessão encerrada por inatividade."); }, function () {}); }, 30000);

boot();
