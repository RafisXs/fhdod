// Carinha em SVG: t vai de 0 (triste, vermelha) até 1 (feliz, verde)
function face(t) {
  var hue = Math.round(t * 125), c = (t - 0.5) * 2, my = 27 + c * 8;
  return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="hsl(' + hue + ',78%,56%)" stroke="#20232A" stroke-width="1.6"/><circle cx="14" cy="16" r="2.2" fill="#20232A"/><circle cx="26" cy="16" r="2.2" fill="#20232A"/><path d="M12 27Q20 ' + my.toFixed(1) + ' 28 27" fill="none" stroke="#20232A" stroke-width="2.2" stroke-linecap="round"/></svg>';
}
