
var app = document.getElementById("app");
var S = [];
var ICON = { rec: "🛎️", pa: "🚑", rx: "🩻", endo: "🔬", cc: "⚕️", ic: "🛏️", ip: "🧸", sm: "💙", ob: "🤰", tr: "🦴" };

function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function sname(id) { var s = S.filter(function (x) { return x.id === id; })[0]; return s ? s.nome : id; }

function draw(h) {
  app.classList.remove("wide");
  app.innerHTML = '<div class="in">' + h + "</div>";
  window.scrollTo(0, 0);
  try {
    var hd = app.querySelector("h1,h2");
    if (hd) { hd.setAttribute("tabindex", "-1"); hd.focus({ preventScroll: true }); } else app.focus({ preventScroll: true });
  } catch (e) {}
}


function api(metodo, caminho, corpo) {
  return fetch(caminho, {
    method: metodo,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fhdod" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) { var e = new Error(j.erro || "Erro " + r.status); e.status = r.status; e.dica = j.dica; throw e; }
      return j;
    });
  }, function () { var e = new Error("Sem conexão com o servidor. Confira se ele está ligado."); e.status = 0; throw e; });
}


function face(t) {
  var hue = Math.round(t * 125), c = (t - 0.5) * 2, my = 27 + c * 8;
  return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="hsl(' + hue + ',78%,56%)" stroke="#20232A" stroke-width="1.6"/><circle cx="14" cy="16" r="2.2" fill="#20232A"/><circle cx="26" cy="16" r="2.2" fill="#20232A"/><path d="M12 27Q20 ' + my.toFixed(1) + ' 28 27" fill="none" stroke="#20232A" stroke-width="2.2" stroke-linecap="round"/></svg>';
}

function fld(id, l, t, x) { return '<div class="fld"><label for="' + id + '">' + l + '</label><input id="' + id + '" name="' + id + '" type="' + t + '" ' + (x || "") + "></div>"; }
function showPw(ids) { var c = document.getElementById("sp"); c.onchange = function () { ids.forEach(function (i) { document.getElementById(i).type = c.checked ? "text" : "password"; }); }; }
function fmtTel(v) { var d = String(v).replace(/\D/g, "").slice(0, 11); if (d.length < 3) return d; var r = d.slice(2); if (r.length > 4) r = r.slice(0, r.length - 4) + "-" + r.slice(-4); return "(" + d.slice(0, 2) + ") " + r; }
function none(t) { return /^(nada|nenhum)/i.test(t); }

var IT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
var OUV = '<section class="ouv" aria-labelledby="ot"><h2 id="ot">Ouvidoria</h2><p>Quer registrar um elogio, sugestão ou reclamação com retorno? Fale com a gente.</p><div class="ob"><a class="lk" href="tel:+555135461236">' + IT + '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>Ligar (51) 3546-1236</a><a class="lk" href="mailto:sac@fhdod.com.br">' + IT + '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>sac@fhdod.com.br</a></div></section>';
var ouvEl = document.getElementById("ouv");
if (ouvEl) ouvEl.innerHTML = OUV;
