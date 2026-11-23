function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function sname(id) { var s = S.filter(function (x) { return x.id === id; })[0]; return s ? s.nome : id; }

function fmtTel(v) { var d = String(v).replace(/\D/g, "").slice(0, 11); if (d.length < 3) return d; var r = d.slice(2); if (r.length > 4) r = r.slice(0, r.length - 4) + "-" + r.slice(-4); return "(" + d.slice(0, 2) + ") " + r; }
function none(t) { return /^(nada|nenhum)/i.test(t); }
