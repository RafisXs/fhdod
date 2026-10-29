/* Cartaz com QR Code de cada setor. Tudo é gerado no próprio navegador (nenhum site externo). */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var params = new URLSearchParams(location.search);
  var SETOR = (params.get("setor") || "").replace(/[^a-z]/g, "").slice(0, 10);
  var NOME = (params.get("nome") || "").slice(0, 80);
  var TODOS = params.get("todos") === "1" || !SETOR;
  var LISTA = []; // setores mostrados: [{id, nome}]

  function baseValida(s) { s = String(s || "").trim().replace(/\/+$/, ""); return /^https?:\/\/[^\s<>"']+$/i.test(s) ? s : ""; }
  function guardada() { try { return localStorage.getItem("fhdod_base") || ""; } catch (e) { return ""; } }
  function guardar(b) { try { localStorage.setItem("fhdod_base", b); } catch (e) {} }
  var BASE = baseValida(params.get("base")) || baseValida(guardada()) || location.origin;

  function link(id) { return BASE + "/?setor=" + id; }

  // Desenha o QR Code como SVG (módulos escuros em um único caminho, com margem de 4 módulos)
  function qrDe(texto) {
    var q = qrcode(0, "M"); q.addData(texto); q.make();
    var n = q.getModuleCount(), m = 4, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    var t = n + m * 2;
    return { n: n, m: m, q: q, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" shape-rendering="crispEdges" role="img" aria-label="QR Code: ' + texto.replace(/"/g, "") + '"><rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>' };
  }

  function cartaz(s) {
    var u = link(s.id), qr = qrDe(u);
    var sec = document.createElement("section"); sec.className = "cartaz"; sec.setAttribute("aria-label", "Cartaz do setor " + s.nome);
    var img = document.createElement("img"); img.className = "logo"; img.src = "img/logo.png"; img.alt = "FHDOD - Fundação Hospitalar Dr. Oswaldo Diesel"; sec.appendChild(img);
    var h = document.createElement("h2"); h.textContent = "Como foi o seu atendimento?"; sec.appendChild(h);
    var st = document.createElement("div"); st.className = "setor"; st.textContent = s.nome; sec.appendChild(st);
    var box = document.createElement("div"); box.className = "qr"; box.innerHTML = qr.svg; sec.appendChild(box);
    var c = document.createElement("p"); c.className = "como"; c.textContent = "Aponte a câmera do celular para o QR Code e conte como foi. Leva cerca de 1 minuto."; sec.appendChild(c);
    var a = document.createElement("p"); a.className = "anon"; a.textContent = "Sua avaliação é anônima e ajuda o hospital a melhorar."; sec.appendChild(a);
    var l = document.createElement("p"); l.className = "url"; l.textContent = u; sec.appendChild(l);
    var p = document.createElement("p"); p.className = "proto"; p.textContent = "Fundação Hospitalar Dr. Oswaldo Diesel · Avaliação do Atendimento"; sec.appendChild(p);
    sec._qr = qr; sec._url = u;
    return sec;
  }

  function aviso() {
    var host = ""; try { host = new URL(BASE).hostname; } catch (e) {}
    var local = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(host) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    var el = $("aviso");
    el.hidden = !local;
    el.textContent = local ? "Atenção: este endereço (" + host + ") só funciona neste computador ou na rede interna. Para o QR Code funcionar no celular dos pacientes, informe o endereço onde o site estiver publicado e clique em Atualizar QR Code antes de imprimir." : "";
  }

  function desenhar() {
    var box = $("cartazes"); box.innerHTML = "";
    LISTA.forEach(function (s) { box.appendChild(cartaz(s)); });
    if (!LISTA.length) box.innerHTML = '<p class="load">Nenhum setor ativo para imprimir.</p>';
    $("base").value = BASE; aviso();
    $("png").hidden = $("svg").hidden = TODOS;
    $("tit").textContent = TODOS ? "Cartazes com QR Code de todos os setores ativos" : "Cartaz do setor: " + LISTA[0].nome;
    document.title = (TODOS ? "Cartazes QR Code" : "QR Code " + LISTA[0].nome) + " | FHDOD";
  }

  function baixar(nome, url) { var a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); }
  function arquivo() { return "qrcode-" + LISTA[0].id; }

  $("apl").onclick = function () {
    var b = baseValida($("base").value);
    if (!b) { var el = $("aviso"); el.hidden = false; el.textContent = "Endereço inválido. Use o formato https://seu-site.com.br"; return; }
    BASE = b; guardar(b); desenhar();
  };
  $("base").onkeydown = function (e) { if (e.key === "Enter") $("apl").onclick(); };
  $("prt").onclick = function () { window.print(); };
  $("svg").onclick = function () { baixar(arquivo() + ".svg", "data:image/svg+xml;charset=utf-8," + encodeURIComponent(document.querySelector(".cartaz")._qr.svg)); };
  $("png").onclick = function () {
    var qr = document.querySelector(".cartaz")._qr, t = qr.n + qr.m * 2, px = Math.max(8, Math.floor(1200 / t)), cv = document.createElement("canvas");
    cv.width = cv.height = px * t; var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = "#000";
    for (var r = 0; r < qr.n; r++) for (var c = 0; c < qr.n; c++) if (qr.q.isDark(r, c)) cx.fillRect((c + qr.m) * px, (r + qr.m) * px, px, px);
    baixar(arquivo() + ".png", cv.toDataURL("image/png"));
  };

  // Monta a lista: um setor (veio do painel) ou todos os ativos
  if (!TODOS) { LISTA = [{ id: SETOR, nome: NOME || SETOR }]; desenhar(); }
  else {
    fetch("/api/perguntas", { headers: { "X-Requested-With": "fhdod" } }).then(function (r) { return r.json(); })
      .then(function (j) { LISTA = j.setores.map(function (s) { return { id: s.id, nome: s.nome }; }); desenhar(); })
      .catch(function () { $("cartazes").innerHTML = '<p class="load">Não foi possível carregar os setores. Volte ao painel e tente de novo.</p>'; });
  }
})();
