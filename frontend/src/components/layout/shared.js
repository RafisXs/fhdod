/* Funções compartilhadas pelas páginas. */
var app = document.getElementById("app");
var S = []; // setores: [{id, nome}], vindos da API
var ICON = { rec: "🛎️", pa: "🚑", rx: "🩻", endo: "🔬", cc: "⚕️", ic: "🛏️", ip: "🧸", sm: "💙", ob: "🤰", tr: "🦴" };

function draw(h) {
  app.classList.remove("wide", "login");
  app.innerHTML = '<div class="in">' + h + "</div>";
  window.scrollTo(0, 0);
  try {
    var hd = app.querySelector("h1,h2");
    if (hd) { hd.setAttribute("tabindex", "-1"); hd.focus({ preventScroll: true }); } else app.focus({ preventScroll: true });
  } catch (e) {}
}

var IT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
var OUV = '<section class="ouv" aria-labelledby="ot"><h2 id="ot">Ouvidoria</h2><p>Quer registrar um elogio, sugestão ou reclamação com retorno? Fale com a gente.</p><div class="ob"><a class="lk" href="tel:+555135461236">' + IT + '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>Ligar (51) 3546-1236</a><a class="lk" href="mailto:sac@fhdod.com.br">' + IT + '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>sac@fhdod.com.br</a></div></section>';
var ouvEl = document.getElementById("ouv");
if (ouvEl) ouvEl.innerHTML = OUV;
