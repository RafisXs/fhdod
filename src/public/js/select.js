/* Seletores padronizados; os selects originais mantêm os valores e eventos da aplicação. */
(function () {
  "use strict";
  var controls = new Map(), opened = null, sequence = 0, search = "", searchTimer;
  var menu = document.createElement("div");
  menu.className = "select-menu";
  menu.hidden = true;
  menu.setAttribute("role", "listbox");
  document.body.appendChild(menu);

  function options(control) { return Array.from(control.native.options).filter(function (o) { return !o.hidden; }); }
  function close() {
    if (opened) { opened.button.setAttribute("aria-expanded", "false"); opened.button.removeAttribute("aria-activedescendant"); }
    opened = null; menu.hidden = true; search = "";
  }
  function sync(control) {
    var native = control.native, selected = native.options[native.selectedIndex];
    var text = selected ? selected.textContent : "Selecione uma opção";
    if (control.text.textContent !== text) control.text.textContent = text;
    var disabled = native.disabled || !!native.closest("fieldset:disabled");
    if (control.button.disabled !== disabled) control.button.disabled = disabled;
    var label = native.labels && native.labels[0];
    if (label) {
      if (!label.id) label.id = "select-label-" + (++sequence);
      control.button.setAttribute("aria-labelledby", label.id + " " + control.text.id);
    }
    if (opened === control && control.button.disabled) close();
  }
  function position() {
    if (!opened) return;
    var rect = opened.button.getBoundingClientRect(), gap = 6, margin = 12;
    var below = window.innerHeight - rect.bottom - margin - gap, above = rect.top - margin - gap;
    var up = below < 180 && above > below, space = Math.max(48, up ? above : below);
    menu.style.width = Math.min(rect.width, window.innerWidth - margin * 2) + "px";
    menu.style.left = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin)) + "px";
    menu.style.maxHeight = Math.min(320, space) + "px";
    menu.style.top = (up ? Math.max(margin, rect.top - menu.offsetHeight - gap) : rect.bottom + gap) + "px";
  }
  function highlight(control, index) {
    var list = options(control);
    if (!list.length) return;
    control.index = Math.max(0, Math.min(index, list.length - 1));
    Array.from(menu.children).forEach(function (item, i) {
      item.classList.toggle("active", i === control.index);
    });
    var active = menu.children[control.index];
    control.button.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  }
  function choose(control, index) {
    var option = options(control)[index];
    if (!option || option.disabled || control.button.disabled) return;
    var changed = control.native.value !== option.value;
    control.native.value = option.value;
    close();
    if (changed) {
      control.native.dispatchEvent(new Event("input", { bubbles: true }));
      control.native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (control.native.isConnected) { sync(control); control.button.focus({ preventScroll: true }); }
  }
  function open(control) {
    close(); sync(control);
    if (control.button.disabled) return;
    opened = control;
    menu.id = control.button.id + "-list";
    menu.setAttribute("aria-labelledby", control.button.id);
    menu.replaceChildren();
    var list = options(control);
    list.forEach(function (option, i) {
      var item = document.createElement("div");
      item.id = menu.id + "-" + i;
      item.className = "select-option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected));
      item.setAttribute("aria-disabled", String(option.disabled));
      item.textContent = option.textContent;
      item.addEventListener("pointerdown", function (e) { e.preventDefault(); });
      item.addEventListener("click", function () { choose(control, i); });
      menu.appendChild(item);
    });
    menu.hidden = false;
    control.button.setAttribute("aria-controls", menu.id);
    control.button.setAttribute("aria-expanded", "true");
    position(); highlight(control, Math.max(0, list.findIndex(function (o) { return o.selected; })));
  }
  function enhance(native) {
    if (controls.has(native)) return sync(controls.get(native));
    var wrap = document.createElement("div"), button = document.createElement("button"), text = document.createElement("span");
    wrap.className = "select-control";
    button.type = "button"; button.className = "select-trigger";
    button.id = "select-control-" + (++sequence);
    button.setAttribute("role", "combobox"); button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    text.id = button.id + "-text";
    button.appendChild(text);
    native.before(wrap); wrap.append(native, button);
    native.classList.add("select-native"); native.tabIndex = -1; native.setAttribute("aria-hidden", "true");
    var control = { native: native, button: button, text: text, index: 0 };
    controls.set(native, control);
    button.addEventListener("click", function () { if (opened === control) close(); else open(control); });
    native.addEventListener("change", function () { sync(control); });
    native.addEventListener("focus", function () { button.focus(); });
    button.addEventListener("keydown", function (e) {
      if (e.key === "Tab") { close(); return; }
      if (e.key === "Escape") { close(); e.preventDefault(); return; }
      if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        if (opened !== control) { open(control); return; }
        if (e.key === "Enter" || e.key === " ") return choose(control, control.index);
        var list = options(control), direction = e.key === "ArrowUp" ? -1 : 1;
        var index = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : control.index + direction;
        while (list[index] && list[index].disabled) index += direction;
        highlight(control, index);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); if (opened !== control) open(control);
        clearTimeout(searchTimer); search += e.key.toLocaleLowerCase("pt-BR");
        var found = options(control).findIndex(function (o) { return !o.disabled && o.textContent.toLocaleLowerCase("pt-BR").startsWith(search); });
        if (found >= 0) highlight(control, found);
        searchTimer = setTimeout(function () { search = ""; }, 700);
      }
    });
    sync(control);
  }
  function scan() {
    if (opened && !opened.native.isConnected) close();
    controls.forEach(function (_, native) { if (!native.isConnected) controls.delete(native); });
    document.querySelectorAll("main select:not([multiple])").forEach(enhance);
  }
  new MutationObserver(function (records) {
    if (records.some(function (r) { return r.type === "attributes" || (r.target.nodeType === 1 && !r.target.closest(".select-menu,.select-trigger")); })) scan();
  }).observe(document.querySelector("main"), { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "selected"] });
  document.addEventListener("pointerdown", function (e) { if (opened && !menu.contains(e.target) && !opened.button.contains(e.target)) close(); });
  document.addEventListener("focusin", function (e) { if (opened && e.target !== opened.button && !menu.contains(e.target)) close(); });
  window.addEventListener("resize", close);
  document.addEventListener("scroll", function (e) { if (opened && !menu.contains(e.target)) position(); }, true);
  scan();
})();
