function fld(id, l, t, x) { return '<div class="fld"><label for="' + id + '">' + l + '</label><input id="' + id + '" name="' + id + '" type="' + t + '" ' + (x || "") + "></div>"; }
function showPw(ids) { var c = document.getElementById("sp"); c.onchange = function () { ids.forEach(function (i) { document.getElementById(i).type = c.checked ? "text" : "password"; }); }; }
