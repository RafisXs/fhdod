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

function falhou(e) { if (e.status === 401) { ME = null; DATA = []; UPDT = null; loginView("Sessão expirada. Entre novamente."); return true; } return false; }
function loadData(cb) {
  api("GET", "/api/admin/avaliacoes").then(function (rows) { DATA = rows; LOADERR = null; UPDT = new Date(); cb(); })
    .catch(function (e) { if (falhou(e)) return; DATA = []; LOADERR = e; UPDT = new Date(); cb(); });
}
function updBadge() { var n = DATA.filter(function (r) { return r.telefone && r.contato_status === "pendente"; }).length, b = $("t-ctt"); if (b) b.textContent = "Contatos" + (n ? " (" + n + ")" : ""); }

/* ---------- Login e estrutura ---------- */
function boot() {
  api("GET", "/api/perguntas").then(function (j) { S = j.setores; return api("GET", "/api/me"); })
    .then(function (me) { entrou(me); })
    .catch(function (e) { if (e.status === 401) loginView(); else erroTela(e); });
}
function erroTela(e) { draw('<h1>Não foi possível abrir</h1><div class="note">' + esc(e.message) + (e.dica ? "<br>" + esc(e.dica) : "") + '</div><button class="cta" id="rt">Tentar de novo</button>'); $("rt").onclick = boot; }
function entrou(me) { ME = me; F.s = all() ? "" : ME.setor_id; DATA = []; UPDT = null; TAB = "res"; shell(); }

function loginView(aviso) {
  draw('<h1>Área restrita</h1><p class="mut">Acesso somente para a equipe autorizada: gerente, administradores de setor e visualizadores.</p><form id="f" novalidate>' + fld("em", "E-mail", "email", 'autocomplete="username" required') + fld("pw", "Senha", "password", 'autocomplete="current-password" required') + '<label class="sh"><input type="checkbox" id="sp"> Mostrar senha</label><p class="err" id="er" role="alert">' + esc(aviso || "") + '</p><button class="cta" type="submit">Entrar</button></form>');
  showPw(["pw"]);
  $("f").onsubmit = function (e) {
    e.preventDefault();
    var er = $("er"), em = $("em").value.trim(), pw = $("pw").value;
    if (!em || !pw) { er.textContent = "Preencha e-mail e senha."; return; }
    er.textContent = "Entrando...";
    api("POST", "/api/login", { email: em, senha: pw })
      .then(function (me) { return S.length ? me : api("GET", "/api/perguntas").then(function (j) { S = j.setores; return me; }); })
      .then(entrou)
      .catch(function (x) { er.textContent = x.message; });
  };
}

function shell() {
  var tabs = [["res", "Resultados"]].concat(isV() ? [] : [["ctt", "Contatos"], ["per", "Perguntas"], ["eq", "Equipe"]]);
  draw('<div class="dtop"><p class="who"><strong>' + esc(ME.nome) + '</strong><br><span class="mut">' + esc(papelTxt(ME)) + '</span></p><span class="sp"></span>' + (isG() ? '<a class="ghost" href="/tv.html" target="_blank" rel="noopener">TV Wall</a>' : "") + '<button class="ghost" id="out">Sair</button></div><nav class="tabs" aria-label="Seções">' + tabs.map(function (t) { return '<button id="t-' + t[0] + '" data-t="' + t[0] + '">' + t[1] + "</button>"; }).join("") + '</nav><div id="tab"><p class="mut">Carregando…</p></div>');
  app.classList.add("wide");
  $("out").onclick = function () { api("POST", "/api/logout").then(function () { ME = null; DATA = []; UPDT = null; loginView(); }, function () { loginView(); }); };
  document.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () { setTab(b.dataset.t); }; });
  loadData(function () { updBadge(); setTab(TAB); });
}
function setTab(t) {
  TAB = t;
  document.querySelectorAll(".tabs button").forEach(function (b) { if (b.dataset.t === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  ({ res: viewRes, ctt: viewCtt, per: viewPer, eq: viewEq })[t]();
}

/* ---------- Resultados ---------- */
function exportUrl() { var q = ["p=" + F.p]; if (F.s) q.push("s=" + F.s); if (F.t) q.push("t=" + encodeURIComponent(F.t)); if (F.u) q.push("u=" + encodeURIComponent(F.u)); return "/api/admin/export.xlsx?" + q.join("&"); }
function viewRes() {
  $("tab").innerHTML = '<div class="dtop"><p class="mut" id="upd" style="margin:0"></p><span class="sp"></span><button class="ghost" id="rf">Atualizar</button><button class="ghost" id="pt">Imprimir</button><a class="ghost" id="ex" href="#">Exportar Excel</a></div><p class="prn" id="prn"></p><div class="filters">' +
    sel("fp", "Período", [["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["all", "Todo o período"]], F.p) +
    (all() ? sel("fs", "Setor", [["", "Todos os setores"]].concat(S.map(function (s) { return [s.id, s.nome]; })), F.s) : "") +
    sel("ft", "Turno", [["", "Todos"], ["Dia", "Dia"], ["Noite", "Noite"]], F.t) + sel("fu", "Tipo de atendimento", [["", "Todos"], ["SUS", "SUS"], ["Plano de Saúde", "Plano de Saúde"], ["Particular", "Particular"]], F.u) + '</div><div id="dbody"></div>';
  $("rf").onclick = function () { $("dbody").innerHTML = '<p class="mut">Atualizando…</p>'; loadData(function () { updBadge(); updRes(); }); };
  $("pt").onclick = function () { window.print(); };
  $("ex").onclick = function () { $("ex").href = exportUrl(); };
  [["fp", "p"], ["fs", "s"], ["ft", "t"], ["fu", "u"]].forEach(function (f) { var el = $(f[0]); if (el) el.onchange = function () { F[f[1]] = this.value; updRes(); }; });
  updRes();
}
function updRes() {
  var rows = filt(), pl = { 7: "últimos 7 dias", 30: "últimos 30 dias", 90: "últimos 90 dias", all: "todo o período" };
  $("dbody").innerHTML = body(rows);
  $("upd").textContent = UPDT ? "Atualizado às " + UPDT.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + (DATA.length >= 5000 ? " (mostrando as 5000 mais recentes)" : "") : "";
  $("prn").textContent = "Fundação Hospitalar Dr. Oswaldo Diesel - Avaliação do atendimento. Período: " + pl[F.p] + ". Gerado em " + new Date().toLocaleString("pt-BR") + ".";
}

/* ---------- Contatos (telefones de avaliações abaixo da média) ---------- */
function viewCtt() {
  var rows = DATA.filter(function (r) { return r.telefone && (!CT.st || r.contato_status === CT.st) && (!CT.s || r.setor === CT.s); });
  $("tab").innerHTML = '<p class="mut">Pessoas que deram nota abaixo da média e autorizaram o contato. Ligue para entender o que houve e registre o resultado. Use o telefone somente para este fim.</p><div class="filters">' +
    sel("cs", "Situação", [["", "Todas"], ["pendente", "Pendentes"], ["contatado", "Contatadas"], ["resolvido", "Resolvidas"]], CT.st) +
    (all() ? sel("cx", "Setor", [["", "Todos os setores"]].concat(S.map(function (s) { return [s.id, s.nome]; })), CT.s) : "") + '</div><div class="cards">' +
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
function viewPer() {
  var ss = mySet(); if (!QS || !ss.some(function (s) { return s.id === QS; })) QS = ss[0].id;
  $("tab").innerHTML = '<p class="mut">Cada setor tem até 5 perguntas. A última é sempre a recomendação de 1 a 10 (só o texto pode mudar). As mudanças valem para as próximas avaliações; as respostas antigas guardam o texto da época.</p>' +
    (all() ? '<div class="filters">' + sel("qs", "Setor", S.map(function (s) { return [s.id, s.nome]; }), QS) + "</div>" : "<h2>" + esc(sname(QS)) + "</h2>") + '<div id="qed"><p class="mut">Carregando…</p></div>';
  if ($("qs")) $("qs").onchange = function () { QS = this.value; loadQ(); };
  loadQ();
}
function loadQ() {
  api("GET", "/api/admin/perguntas/" + QS).then(function (qs) {
    $("qed").innerHTML = qs.map(function (q) {
      var u = q.ordem === 5, chips = q.tipo === "positivos" || q.tipo === "negativos";
      return '<fieldset class="pnl qe" data-id="' + q.id + '" data-o="' + q.ordem + '" style="margin-bottom:12px"><legend><strong>Pergunta ' + q.ordem + (u ? " (recomendação de 1 a 10)" : "") + '</strong></legend><div class="fld"><label for="qt' + q.id + '">Texto da pergunta</label><input id="qt' + q.id + '" class="qt" maxlength="160" value="' + esc(q.texto) + '"></div>' +
        (u ? "" : '<div class="fld">' + sel("qk" + q.id, "Tipo de resposta", TIPOS, q.tipo) + '</div><div class="fld qo-w"' + (chips ? "" : " hidden") + '><label for="qo' + q.id + '">Opções (uma por linha, de 2 a 10)</label><textarea id="qo' + q.id + '" class="qo" rows="5">' + esc((q.opcoes || []).join("\n")) + '</textarea></div><label class="sh"><input type="checkbox" class="qa"' + (q.ativa ? " checked" : "") + "> Mostrar esta pergunta na pesquisa</label>") + "</fieldset>";
    }).join("") + '<button class="btn" id="qsave">Salvar alterações</button><p class="msg" id="qmsg" role="status"></p>';
    document.querySelectorAll(".qe select").forEach(function (s) { s.onchange = function () { var w = s.closest(".qe").querySelector(".qo-w"); w.hidden = !(s.value === "positivos" || s.value === "negativos"); }; });
    $("qsave").onclick = function () {
      var out = [], msg = $("qmsg");
      document.querySelectorAll(".qe").forEach(function (f) {
        var u = f.dataset.o === "5", k = u ? "nps" : f.querySelector("select").value, o = f.querySelector(".qo");
        out.push({ id: +f.dataset.id, texto: f.querySelector(".qt").value, tipo: k, opcoes: (k === "positivos" || k === "negativos") && o ? o.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean) : null, ativa: u ? true : f.querySelector(".qa").checked });
      });
      $("qsave").disabled = true; msg.className = "msg"; msg.textContent = "Salvando...";
      api("PUT", "/api/admin/perguntas/" + QS, { perguntas: out }).then(function () { msg.className = "msg ok"; msg.textContent = "Perguntas salvas. Já valem para as próximas avaliações."; $("qsave").disabled = false; })
        .catch(function (e) { if (falhou(e)) return; msg.textContent = e.message; $("qsave").disabled = false; });
    };
  }).catch(function (e) { if (!falhou(e)) $("qed").innerHTML = '<div class="note">' + esc(e.message) + "</div>"; });
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
      var o = (r === "visualizador" ? [["", "Todos os setores"]] : []).concat(S.map(function (s) { return [s.id, s.nome]; }));
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
