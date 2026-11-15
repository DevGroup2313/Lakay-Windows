/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   The name tip (Build 24), as Carpe Diem and the other apps of the Offline Project have it: when the pointer rests on a
   key that shows no words of its own (an emoji, a mark, a swatch), its name appears just above it, in a small label
   dressed in the colours of the surface beneath the key, with a pointer to the key. A paper's swatch shows a chip of its
   colour, its name, and its colour by day or by night. The label also appears when a key is reached with the keyboard,
   and for a moment when a swatch is touched. It takes the place of the browser's own small tooltip, which it keeps aside
   while it shows and gives back after.
   A key gives its name by data-tip-name (with data-tip-day and data-tip-night), or by its title or its aria-label: a
   title such as "Day or night: the lamp of the whole store" shows "Day or night" with the rest on a second line. */
"use strict";
(function () {
  var doc = document, tip = null, cur = null, touchWait = null;
  var KEYS = '[data-tip-name],button,[role="button"],a.key,summary';
  function night() { return doc.documentElement.getAttribute("data-theme") === "night"; }

  /* ---------- colours: the surface beneath a key, as the eye sees it ---------- */
  function rgba(s) { var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(String(s || "")); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; }
  function lum(c) { function f(x) { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); } return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function over(top, under) { var a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; }
  function css(c) { return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")"; }
  function pageColour() {
    var c = null;
    try { c = rgba(getComputedStyle(doc.body).backgroundColor); if (!c || c[3] < .5) c = rgba(getComputedStyle(doc.documentElement).backgroundColor); } catch (e) { }
    if (!c || c[3] < .5) c = night() ? [22, 21, 34, 1] : [255, 255, 255, 1];
    return [c[0], c[1], c[2], 1];
  }
  function surface(el) {
    var base = pageColour(), layers = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = null; try { c = rgba(getComputedStyle(n).backgroundColor); } catch (e) { }
      if (c && c[3] > .04) { layers.push(c); if (c[3] >= .98) break; }
    }
    var out = base;
    for (var i = layers.length - 1; i >= 0; i--) out = over(layers[i], out);
    return out;
  }
  function dress(el) {
    var named = el.hasAttribute("data-tip-name"), st = null, own = null;
    try { st = getComputedStyle(el); } catch (e) { }
    if (st && !named) { var o = rgba(st.backgroundColor); if (o && o[3] >= .55) own = over(o, surface(el.parentElement || el)); }
    var bg = own || surface(el.parentElement || el), ink = null;
    try { ink = rgba(getComputedStyle(named && el.parentElement ? el.parentElement : el).color); } catch (e) { }
    if (!ink || contrast(ink, bg) < 3.2) {
      var bodyInk = null; try { bodyInk = rgba(getComputedStyle(doc.body).color); } catch (e) { }
      ink = bodyInk && contrast(bodyInk, bg) >= 3.2 ? bodyInk : lum(bg) > .4 ? [34, 30, 56, 1] : [238, 236, 250, 1];
    }
    var dark = lum(bg) < .35;
    return { bg: css(bg), ink: css(ink), edge: "rgba(" + Math.round(ink[0]) + "," + Math.round(ink[1]) + "," + Math.round(ink[2]) + "," + (dark ? .26 : .18) + ")",
      shadow: dark ? "0 1px 0 rgba(255,255,255,.05),0 12px 26px -10px rgba(0,0,0,.66)" : "0 1px 0 rgba(255,255,255,.6),0 12px 26px -10px rgba(34,28,60,.34)" };
  }

  /* ---------- what a key is called ---------- */
  function words(el) { return /[A-Za-zÀ-ɏ]{2,}/.test((el.textContent || "").replace(/\s+/g, " ")); }
  function nameOf(el) {
    var nm = el.getAttribute("data-tip-name");
    if (nm) {
      var chip = ""; try { var s = getComputedStyle(el); chip = s.backgroundImage && s.backgroundImage !== "none" ? s.backgroundImage : s.backgroundColor; } catch (e) { }
      return { chip: chip, title: nm, line: el.getAttribute(night() ? "data-tip-night" : "data-tip-day") || "" };
    }
    if (words(el)) return null;
    var text = el.getAttribute("title") || (el.__tipTitle != null ? el.__tipTitle : "") || el.getAttribute("aria-label") || "";
    text = String(text).trim(); if (!text) return null;
    var note = "", line = "", m = /^(.+?)\s*\(([^()]{1,24})\)\s*$/.exec(text);
    if (m) { text = m[1]; note = m[2]; }
    var cut = text.search(/\s[—–-]\s|:\s/);
    if (cut > 0 && cut <= 40) { line = text.slice(cut).replace(/^\s*[—–:-]\s*/, ""); text = text.slice(0, cut); }
    else if (text.length > 48) { var dot = text.indexOf(". "); if (dot > 0 && dot < 60) { line = text.slice(dot + 2); text = text.slice(0, dot); } }
    return { title: text, line: line, note: note };
  }
  function keyAt(target) {
    try {
      if (!target || !target.closest) return null;
      if (target.closest("[data-no-tip],#name-tip,.fab")) return null;
      var el = target.closest(KEYS);
      return el && nameOf(el) ? el : null;
    } catch (e) { return null; }
  }

  /* ---------- showing and hiding ---------- */
  function giveBack(el) { try { if (el && el.__tipTitle != null) { if (!el.hasAttribute("title")) el.setAttribute("title", el.__tipTitle); el.__tipTitle = null; } } catch (e) { } }
  function hide() { if (tip) { tip.classList.remove("show"); tip.style.display = "none"; } giveBack(cur); cur = null; }
  function show(el) {
    var n = nameOf(el); if (!n) return;
    if (cur && cur !== el) giveBack(cur);
    if (el.hasAttribute("title")) { el.__tipTitle = el.getAttribute("title"); el.removeAttribute("title"); }
    if (!el.hasAttribute("aria-label")) { try { el.setAttribute("aria-label", n.title + (n.line ? ", " + n.line : "")); } catch (e) { } }
    if (!tip || !doc.contains(tip)) {
      tip = doc.getElementById("name-tip") || doc.createElement("div");
      tip.id = "name-tip"; tip.setAttribute("role", "tooltip"); tip.setAttribute("aria-hidden", "true");
      (doc.body || doc.documentElement).appendChild(tip);
    }
    while (tip.firstChild) tip.removeChild(tip.firstChild);
    var d = dress(el);
    tip.style.background = d.bg; tip.style.setProperty("--nt-bg", d.bg); tip.style.setProperty("--nt-edge", d.edge);
    tip.style.borderColor = d.edge; tip.style.color = d.ink; tip.style.boxShadow = d.shadow;
    var title = doc.createElement("div"); title.className = "nt-title";
    if (n.chip) { var c = doc.createElement("span"); c.className = "nt-chip"; c.style.background = n.chip; c.style.border = "1px solid " + d.edge; title.appendChild(c); }
    title.appendChild(doc.createTextNode(n.title)); tip.appendChild(title);
    var rest = [n.line, n.note].filter(Boolean).join(" · ");
    if (rest) { var l = doc.createElement("div"); l.className = "nt-line"; l.textContent = rest; tip.appendChild(l); }
    tip.classList.remove("below", "show"); tip.style.display = "block";
    var r = el.getBoundingClientRect(), w = tip.offsetWidth, hgt = tip.offsetHeight, vw = window.innerWidth || doc.documentElement.clientWidth;
    var mid = r.left + r.width / 2, left = Math.max(8, Math.min(vw - w - 8, mid - w / 2)), top = r.top - hgt - 11;
    if (top < 8) { top = r.bottom + 11; tip.classList.add("below"); }
    tip.style.left = left + "px"; tip.style.top = top + "px";
    tip.style.setProperty("--nt-x", Math.max(14, Math.min(w - 14, mid - left)) + "px");
    try { requestAnimationFrame(function () { if (tip) tip.classList.add("show"); }); } catch (e) { tip.classList.add("show"); }
    cur = el;
  }
  doc.addEventListener("pointerover", function (e) {
    if (e.pointerType === "touch") return;
    if (cur && !doc.contains(cur)) hide();
    var k = keyAt(e.target);
    if (k) { if (k !== cur) show(k); } else if (cur) hide();
  }, true);
  doc.addEventListener("focusin", function (e) {
    try { if (!e.target.matches(":focus-visible")) return; } catch (x) { }
    var k = keyAt(e.target); if (k) show(k); else if (cur) hide();
  }, true);
  doc.addEventListener("focusout", function () { if (cur) hide(); }, true);
  doc.addEventListener("pointerdown", function (e) {
    var k = keyAt(e.target);
    if (k && e.pointerType === "touch" && k.hasAttribute("data-tip-name")) { show(k); clearTimeout(touchWait); touchWait = setTimeout(hide, 1600); }
    else if (cur) hide();
  }, true);
  doc.addEventListener("pointerout", function (e) { if (!e.relatedTarget && cur) hide(); }, true);
  doc.addEventListener("click", function () { setTimeout(function () { if (cur && !doc.contains(cur)) hide(); }, 0); }, true);
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur) hide(); }, true);
  doc.addEventListener("scroll", function () { if (cur) hide(); }, true);
  try { window.addEventListener("blur", function () { if (cur) hide(); }); } catch (e) { }
  E.nameTip = { show: show, hide: hide, nameOf: function (el) { var n = nameOf(el); return n ? n.title : ""; } };
})();
