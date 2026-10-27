/* Pesquisa de satisfação (pacientes e familiares). */
var LAB = ["Muito insatisfeito", "Insatisfeito", "Regular", "Satisfeito", "Muito satisfeito"];
var BELOW = 3, NPSMAX = 6;
var PQ = {}, cur = null, st = 0, ans = { r: {} }, T0 = Date.now();
// Gravação em tempo real: cada resposta vai para o banco assim que é dada (fila para manter a ordem)
var tok = null, tokP = null, fila = Promise.resolve(), falhas = {};

function Q() { return PQ[cur.id] || []; }

function loadFail(e) {
  draw('<div class="note">' + esc((e && e.message) || "Não foi possível carregar as perguntas agora.") + ' Tente novamente em instantes.</div><button class="cta" id="rt">Tentar de novo</button>');
  document.getElementById("rt").onclick = boot;
}

function boot() {
  draw('<p class="mut">Carregando…</p>');
  api("GET", "/api/perguntas").then(function (j) {
    S = j.setores; PQ = {};
    BELOW = j.limites.abaixoMedia; NPSMAX = j.limites.npsMaxDetrator;
    j.perguntas.forEach(function (q) { (PQ[q.setor_id] = PQ[q.setor_id] || []).push(q); });
    var q0 = "";
    try { q0 = new URLSearchParams(location.search).get("setor") || (location.hash || "").replace("#", ""); } catch (e) {}
    var sx = S.filter(function (s) { return s.id === q0 && PQ[s.id]; })[0];
    if (sx) start(sx); else home();
  }).catch(loadFail);
}

function start(s) { cur = s; st = 0; ans = { r: {} }; T0 = Date.now(); tok = null; tokP = null; falhas = {}; render(); }

// Cria o rascunho no banco na primeira resposta (quem só abre a página não deixa nada gravado)
function token() {
  if (tok) return Promise.resolve(tok);
  if (!tokP) {
    var setor = cur.id;
    tokP = api("POST", "/api/avaliacoes/iniciar", { setor: setor }).then(function (j) { if (cur && cur.id === setor) tok = j.token; return j.token; })
      .catch(function (e) { tokP = null; throw e; });
  }
  return tokP;
}
// Grava uma resposta agora. Se a internet falhar, o envio final manda tudo de novo (nada se perde).
function salvar(q) {
  var v = ans.r[q.id], corpo = q.tipo === "escala" || q.tipo === "nps" ? { p: q.id, n: v } : { p: q.id, v: v || [] }, setor = cur.id;
  fila = fila.then(function () {
    if (!cur || cur.id !== setor) return;
    return token().then(function (t) { return api("PUT", "/api/avaliacoes/" + t + "/resposta", corpo); })
      .then(function () { delete falhas[q.id]; })
      .catch(function () { falhas[q.id] = true; });
  });
}

function home() {
  cur = null;
  draw('<div class="hero"><h1>Como foi o seu atendimento?</h1><p class="mut" style="margin:0">Sua opinião ajuda o hospital a melhorar. São poucas perguntas rápidas, leva cerca de 1 minuto. Escolha o setor onde você foi atendido(a):</p></div><div class="grid">' +
    S.filter(function (s) { return PQ[s.id]; }).map(function (s) { return '<button class="sec" data-s="' + s.id + '"><i aria-hidden="true">' + (ICON[s.id] || "🏥") + "</i>" + esc(s.nome) + "</button>"; }).join("") + "</div>");
  app.querySelectorAll(".sec").forEach(function (b) { b.onclick = function () { start(S.filter(function (s) { return s.id === b.dataset.s; })[0]); }; });
}

function hdr() {
  var n = Q().length, seg = "";
  for (var i = 0; i <= n; i++) seg += '<i class="' + (i <= st ? "on" : "") + '"></i>';
  return '<button class="ghost" id="back">← ' + (st ? "Voltar" : "Trocar de setor") + '</button><div class="step"><span>' + esc(cur.nome) + "</span><span>" + (st < n ? "Pergunta " + (st + 1) + " de " + n : "Último passo") + '</span></div><div class="seg" style="grid-template-columns:repeat(' + (n + 1) + ',1fr)" role="progressbar" aria-valuemin="1" aria-valuemax="' + (n + 1) + '" aria-valuenow="' + (st + 1) + '">' + seg + "</div>";
}
function bind() { document.getElementById("back").onclick = function () { if (st) { st--; render(); } else home(); }; }

function render() {
  var qs = Q(), n = qs.length;
  if (st >= n) return details();
  var q = qs[st], a = ans.r[q.id];
  if (q.tipo === "escala") {
    draw(hdr() + "<h2>" + esc(q.texto) + '</h2><div class="opts">' + [4, 3, 2, 1, 0].map(function (i) { return '<button class="opt" data-v="' + (i + 1) + '" aria-pressed="' + (a === i + 1) + '">' + LAB[i] + "</button>"; }).join("") + "</div>");
    app.querySelectorAll(".opt").forEach(function (b) { b.onclick = function () { ans.r[q.id] = +b.dataset.v; salvar(q); st++; render(); }; });
  } else if (q.tipo === "nps") {
    var btns = ""; for (var k = 1; k <= 10; k++) btns += '<button data-n="' + k + '" aria-label="Nota ' + k + '" aria-pressed="' + (a === k) + '">' + face((k - 1) / 9) + k + "</button>";
    draw(hdr() + "<h2>" + esc(q.texto) + '</h2><div class="nps">' + btns + '</div><div class="ends"><span>1 = nada provável</span><span>10 = extremamente provável</span></div><button class="cta" id="go"' + (a == null ? " disabled" : "") + ">Continuar</button>");
    app.querySelectorAll(".nps button").forEach(function (b) { b.onclick = function () { ans.r[q.id] = +b.dataset.n; salvar(q); render(); }; });
    document.getElementById("go").onclick = function () { st++; render(); };
  } else {
    var arr = ans.r[q.id] = a || [];
    draw(hdr() + "<h2>" + esc(q.texto) + '</h2><p class="mut">Toque em quantos quiser. Você pode pular.</p><div class="chips">' + q.opcoes.map(function (o, i) { return '<button class="chip" data-i="' + i + '" aria-pressed="' + (arr.indexOf(o) >= 0) + '">' + esc(o) + "</button>"; }).join("") + '</div><button class="cta" id="go">Continuar</button>');
    app.querySelectorAll(".chip").forEach(function (b) {
      b.onclick = function () {
        var o = q.opcoes[+b.dataset.i], j = arr.indexOf(o);
        if (j >= 0) arr.splice(j, 1);
        else {
          if (none(o)) arr.length = 0; else for (var x = arr.length - 1; x >= 0; x--) if (none(arr[x])) arr.splice(x, 1);
          arr.push(o);
        }
        salvar(q);
        render();
      };
    });
    document.getElementById("go").onclick = function () { st++; render(); };
  }
  bind();
}

// Nota abaixo da média: média das perguntas de nota < 3, ou recomendação <= 6
function below() {
  var ns = [], nps = null;
  Q().forEach(function (q) { var v = ans.r[q.id]; if (q.tipo === "escala" && v) ns.push(v); if (q.tipo === "nps") nps = v; });
  var m = ns.length ? ns.reduce(function (a, b) { return a + b; }, 0) / ns.length : null;
  return (m != null && m < BELOW) || (nps != null && nps <= NPSMAX);
}

function details() {
  var f2 = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var td = new Date(), iso = f2(td), ty = new Date(td); ty.setFullYear(ty.getFullYear() - 1);
  function grp(k, leg, opts, c) { return '<fieldset class="grp"><legend>' + leg + '</legend><div class="pick ' + c + '">' + opts.map(function (o) { return '<button type="button" class="pk" data-k="' + k + '" data-v="' + o + '" aria-pressed="' + (ans[k] === o) + '">' + o + "</button>"; }).join("") + "</div></fieldset>"; }
  var cb = below();
  var contato = cb ? '<fieldset class="grp"><legend>Quer que o hospital entre em contato?</legend><p class="mut">Sentimos muito que o atendimento não foi bom. Se quiser, deixe seu telefone para a gestão do setor falar com você e entender o que houve. É opcional.</p><div class="fld"><label for="tel">Telefone com DDD</label><input id="tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(51) 99999-9999" maxlength="15"></div><label class="sh" style="align-items:flex-start"><input type="checkbox" id="cs" style="margin-top:3px"><span>Autorizo o hospital a entrar em contato por este telefone para saber se houve algum problema. O número será visto só pela gestão do setor e usado só para isso.</span></label></fieldset>' : "";
  draw(hdr() + '<h2>Só mais alguns detalhes</h2><div class="grp"><label for="dt" style="display:block;font-weight:600;margin-bottom:8px">Em que dia você foi atendido(a)?</label><input type="date" id="dt" min="' + f2(ty) + '" max="' + iso + '" value="' + (ans.d || "") + '"></div>' +
    grp("tu", "Em qual turno?", ["Dia", "Noite"], "c2") + grp("re", "Você é:", ["Paciente", "Familiar"], "c2") + grp("ti", "Tipo de atendimento:", ["SUS", "Plano de Saúde", "Particular"], "c3") + contato +
    '<input class="hp" type="text" id="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><p class="err" id="se" role="alert"></p><button class="cta" id="send">Enviar avaliação</button>');
  var dt = document.getElementById("dt"), sd = document.getElementById("send"), tl = document.getElementById("tel"), cs = document.getElementById("cs");
  function chk() { sd.disabled = !(ans.d && ans.tu && ans.re && ans.ti); }
  dt.onchange = function () { ans.d = dt.value; chk(); };
  app.querySelectorAll(".pk").forEach(function (b) { b.onclick = function () { ans[b.dataset.k] = b.dataset.v; app.querySelectorAll('.pk[data-k="' + b.dataset.k + '"]').forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); chk(); }; });
  if (tl) { tl.value = ans.tel || ""; tl.oninput = function () { tl.value = fmtTel(tl.value); ans.tel = tl.value; }; }
  chk();
  sd.onclick = function () {
    var se = document.getElementById("se");
    if (document.getElementById("hp").value || Date.now() - T0 < 6000) { fin(false); return; }
    var dg = tl ? tl.value.replace(/\D/g, "") : "";
    if (dg) {
      if (dg.length < 10 || dg.length > 11) { se.textContent = "Confira o telefone: informe o DDD e o número."; return; }
      if (!cs.checked) { se.textContent = "Para deixar o telefone, marque a autorização de contato."; return; }
    }
    sd.disabled = true; sd.textContent = "Enviando..."; se.textContent = "";
    var resp = [];
    Q().forEach(function (q) { var v = ans.r[q.id]; if (q.tipo === "nps" || q.tipo === "escala") resp.push({ p: q.id, n: v }); else resp.push({ p: q.id, v: v || [] }); });
    var corpo = { respostas: resp, data_atendimento: ans.d, turno: ans.tu, respondente: ans.re, tipo_atendimento: ans.ti, telefone: dg || null, consentimento: !!dg };
    // As respostas já foram gravando uma a uma; aqui vão de novo só como garantia, junto com os detalhes finais
    function enviar(tentativa) {
      return fila.then(token).then(function (t) { return api("POST", "/api/avaliacoes/" + t + "/concluir", corpo); }).catch(function (e) {
        if (tentativa < 1 && e.status === 400 && /não está mais aberta|não encontrada/.test(e.message)) { tok = null; tokP = null; return enviar(tentativa + 1); }
        throw e;
      });
    }
    enviar(0).then(function () { tok = null; tokP = null; fin(!!dg); })
      .catch(function (e) { se.textContent = e.status === 400 || e.status === 429 ? e.message : "Não foi possível enviar agora. Tente novamente."; sd.textContent = "Enviar avaliação"; chk(); });
  };
  bind();
}

function fin(tel) {
  draw('<div class="hero" style="text-align:center"><div class="ok"><svg width="72" height="72" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#D71E26"/><path d="M11 21l6 6 12-13" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h1>Obrigado pela sua opinião!</h1><p>Ela ajuda o hospital a melhorar o atendimento.</p>' +
    (tel ? '<p class="mut">Anotamos o seu telefone. A gestão do setor poderá entrar em contato.</p>' : "") +
    '<p class="mut" style="margin:0">Se quiser registrar um elogio, sugestão ou reclamação, use a Ouvidoria logo abaixo.</p></div><button class="cta" id="again">Avaliar outro setor</button>');
  document.getElementById("again").onclick = home;
}

boot();
