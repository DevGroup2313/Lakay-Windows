/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   The Author Studio, made new in Build 18 at the owner's request. The owner's workshop: the app's name and the store's,
   every phrase in the three languages, the colours, and the receipt, each beside a live picture of where it shows.
   Tabs as Inventory's. On a wide screen the tools are on the left and the stage on the right, kept in view. The phrase
   book reads as the screens read: by place, with what each phrase says (never its internal name); changed phrases wait
   apart until they are saved, and the blanks Lakay fills in ({n}, {name}) cannot be lost. Every choice is data, never
   code: it is checked field by field (E.cleanCustom), kept beside the envelopes so that the door can wear it, written in
   the ledger, and carried in backups. */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui, money = U.money;
  var S = E.studio = { room: "overview", dirty: false };
  var LANGS = ["en", "fr", "ht"];
  var PALETTES = ["dawn", "amethyst", "indigo", "royal", "burgundy", "graphite"];
  /* each set's colours for its small pictures: the colour, its pale, the night's ground, the colour by night */
  var SWATCH = { dawn: ["#5f67cc", "#e7e6f5", "#12121c", "#b0b5f5"], amethyst: ["#5b3fa8", "#e8e0f6", "#110f17", "#c4b0f0"], indigo: ["#3f4797", "#e6e3f5", "#0f1018", "#aab2ee"],
    royal: ["#1b5e8c", "#dde9f2", "#0d1217", "#8fc3ea"], burgundy: ["#7a2e3b", "#eedfdd", "#130f10", "#eaa3b0"], graphite: ["#3a4150", "#e3e4e8", "#101113", "#c3cad8"] };
  var LIMIT = { app: 40, tagline: 70, word: 2000, lines: 300, thanks: 80 };

  function blank() { return { v: 2, names: { app: "", tagline: { en: "", fr: "", ht: "" } }, words: { en: {}, fr: {}, ht: {} }, look: { palette: "dawn", density: "compact" }, receipt: { lines: "", thanks: { en: "", fr: "", ht: "" } } }; }
  function clip(s, n) { return (typeof s === "string" ? s : "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, n); }
  /* Only what the Studio knows, only text, within limits: anything else in a file is left out. */
  E.cleanCustom = function (c) {
    var o = blank(); if (!c || typeof c !== "object") return o;
    if (c.names && typeof c.names === "object") {
      o.names.app = clip(c.names.app, LIMIT.app).trim();
      LANGS.forEach(function (l) { o.names.tagline[l] = clip(c.names.tagline && c.names.tagline[l], LIMIT.tagline).trim(); });
    }
    if (c.words && typeof c.words === "object") LANGS.forEach(function (l) {
      var w = c.words[l]; if (!w || typeof w !== "object") return;
      Object.keys(w).forEach(function (k) { if (E.has(k) && typeof w[k] === "string" && w[k].trim()) o.words[l][k] = clip(w[k], LIMIT.word); });
    });
    if (c.look && typeof c.look === "object") {
      if (PALETTES.indexOf(c.look.palette) >= 0) o.look.palette = c.look.palette;
      /* a set saved before Lakay (build 2 or earlier) was the old default, not a choice: Lakay's own Dawn takes its place */
      if (c.v !== 2 && (c.look.palette === "indigo" || c.look.palette === "amethyst")) o.look.palette = "dawn";
      if (c.look.density === "comfortable") o.look.density = "comfortable";
    }
    if (c.receipt && typeof c.receipt === "object") {
      o.receipt.lines = clip(c.receipt.lines, LIMIT.lines);
      LANGS.forEach(function (l) { o.receipt.thanks[l] = clip(c.receipt.thanks && c.receipt.thanks[l], LIMIT.thanks).trim(); });
    }
    return o;
  };
  function cur() { return JSON.parse(JSON.stringify(E.custom || blank())); }
  E.appName = function () { var n = E.custom && E.custom.names && E.custom.names.app; return n || "Lakay"; };
  E.tagline = function () { var c = E.custom && E.custom.names && E.custom.names.tagline; return (c && c[E.lang]) || t("door.tag"); };
  E.thanks = function () { var c = E.custom && E.custom.receipt && E.custom.receipt.thanks; return (c && c[E.lang]) || t("receipt.thanks"); };
  /* The software's own identity stays on receipts, reports and About, whatever the app is called: it is what an auditor
     checks against the release. */
  E.made = function () { var n = E.appName(); return (n === "Lakay" ? "Lakay " : n + " · Lakay ") + t("build") + " " + E.BUILD.number; };
  E.receiptLines = function () { return E.custom && E.custom.receipt && E.custom.receipt.lines ? E.custom.receipt.lines.split("\n").filter(function (x) { return x.trim(); }) : []; };

  /* Which parts changed, in plain paths, for the ledger line. */
  function diff(a, b, path, out) {
    out = out || [];
    if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
      Object.keys(Object.assign({}, a, b)).forEach(function (k) { diff(a[k], b[k], path ? path + "." + k : k, out); });
    } else if (JSON.stringify(a === undefined ? null : a) !== JSON.stringify(b === undefined ? null : b)) out.push(path);
    return out;
  }
  function save(next, quiet) {
    next = E.cleanCustom(next);
    var changed = diff(E.custom || blank(), next, "");
    if (!changed.length) { if (!quiet) ui.toast(t("studio.nothing")); return Promise.resolve(false); }
    return B.saveCustom(next, changed.slice(0, 50)).then(function () { ui.applyLook(); dirty(false); if (!quiet) ui.toast(t("studio.saved"), "good"); return true; },
      function (e) { ui.toast(t("door.problem"), "bad"); console.error(e); return false; });
  }
  S.save = save;

  /* ---------- the room: its heading, its tabs, and the pane of the tab chosen ---------- */
  var TABS = [["overview", "home"], ["names", "tag"], ["words", "edit"], ["look", "palette"], ["receipt", "receipt"], ["safe", "shield"]];
  var PANES = {}, view = null;
  /* "All changes kept", or "Not saved yet" while a form holds changes */
  function dirty(on) {
    S.dirty = !!on;
    var c = document.getElementById("studioStatus"); if (!c) return;
    c.classList.toggle("unsaved", S.dirty); c.querySelector(".st-t").textContent = t(S.dirty ? "studio.unsaved" : "studio.status");
  }
  S.go = function (room) {
    if (!PANES[room]) room = "overview";
    if (room === S.room && view && document.body.contains(view.pane)) return;
    function go() { dirty(false); W.pending = {}; W.open = null; S.room = room; draw(true); }
    if (S.dirty) ui.confirm(t("studio.leaveT"), t("studio.leaveP"), t("studio.leaveYes"), "danger").then(function (ok) { if (ok) go(); });
    else go();
  };
  ui.rooms.studio = function (main) {
    if (S.room === "start" || !PANES[S.room]) S.room = "overview";
    var status = h("span.status-chip#studioStatus", { role: "status" }, [h("span.dot", { "aria-hidden": "true" }), h("span.st-t", null, t("studio.status"))]);
    main.appendChild(ui.roomHead("room.studio", "tip.studio", [status]));
    var tabs = h("div.inv-tabs", { role: "tablist", "aria-label": t("room.studio") });
    TABS.forEach(function (x) {
      tabs.appendChild(h("button.inv-tab.std-tab#stdTab-" + x[0], { type: "button", role: "tab", "aria-controls": "studioPane", "data-r": x[0], onclick: function () { S.go(x[0]); } },
        [h("span.dept-jewel.sm", { "aria-hidden": "true" }, U.icon(x[1])), h("span.inv-tab-name", null, t("studio.r." + x[0]))]));
    });
    tabs.addEventListener("keydown", function (e) {
      var ids = TABS.map(function (x) { return x[0]; }), i = ids.indexOf(S.room), to = null;
      if (e.key === "ArrowRight") to = ids[(i + 1) % ids.length]; else if (e.key === "ArrowLeft") to = ids[(i - 1 + ids.length) % ids.length];
      else if (e.key === "Home") to = ids[0]; else if (e.key === "End") to = ids[ids.length - 1];
      if (to) { e.preventDefault(); S.go(to); }
    });
    var wrap = h("div.inv-tabs-wrap.std-tabs", null, tabs);
    function fades() { var m = tabs.scrollWidth - tabs.clientWidth; wrap.classList.toggle("more-l", tabs.scrollLeft > 4); wrap.classList.toggle("more-r", m > 4 && tabs.scrollLeft < m - 4); }
    tabs.addEventListener("scroll", fades, { passive: true });
    var pane = h("div.std-pane#studioPane", { role: "tabpanel" });
    main.appendChild(wrap); main.appendChild(pane);
    view = { tabs: tabs, wrap: wrap, pane: pane };
    draw(false);
    setTimeout(fades, 0);
  };
  function draw(fromTab) {
    if (!view || !document.body.contains(view.pane)) return;
    Array.prototype.forEach.call(view.tabs.children, function (b) {
      var on = b.getAttribute("data-r") === S.room;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      if (on) { view.pane.setAttribute("aria-labelledby", b.id); if (fromTab) try { b.focus({ preventScroll: true }); b.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { } }
    });
    U.clear(view.pane);
    PANES[S.room](view.pane);
    dirty(S.room === "words" && Object.keys(W.pending).length > 0);
    if (fromTab && view.wrap.getBoundingClientRect().top < 0) try { view.wrap.scrollIntoView({ block: "start", behavior: ui.still() ? "auto" : "smooth" }); } catch (e) { }
  }

  /* ---------- pieces the panes share ---------- */
  /* a white slab with its heading, a line of explanation, and what it holds */
  function block(titleKey, kids, opt) {
    opt = opt || {};
    var hid = U.uid("sb");
    return h("section.std-block" + (opt.cls ? "." + opt.cls : ""), { "aria-labelledby": hid }, [
      h("div.std-block-h", null, [opt.icon ? h("span.dept-jewel.xs", { "aria-hidden": "true" }, U.icon(opt.icon)) : null, h("h3", { id: hid }, t(titleKey)), opt.right || null]),
      opt.intro ? h("p.std-block-p", null, t(opt.intro)) : null].concat(kids));
  }
  /* how many letters, of how many allowed */
  function counter(input, max) {
    var c = h("span.std-count", { "aria-hidden": "true" });
    function upd() { var n = input.value.length; c.textContent = n + " / " + max; c.classList.toggle("near", n >= max * 0.9); }
    input.addEventListener("input", upd); upd();
    return c;
  }
  /* one language's line: its flag and name, the field, and the count */
  function langRow(l, input, max) {
    return h("div.std-lang", null, [h("label.std-lang-l", { for: input.id }, [ui.flag(l), h("span", null, t("studio.lang." + l))]), input, counter(input, max)]);
  }
  /* the tools on the left, the stage on the right */
  function desk(tools, stage) { return h("div.std-desk", null, [h("div.std-tools", null, tools), h("aside.std-stage", { "aria-label": t("studio.preview") }, stage)]); }
  function stageHead(key) { return h("p.std-stage-h", null, [h("span.std-live", { "aria-hidden": "true" }), t(key)]); }
  function onEdit(inputs, paint) { inputs.forEach(function (x) { x.addEventListener("input", function () { dirty(true); if (paint) paint(); }); }); }

  /* ---------- Your Lakay: how it stands now, with the way into each part ---------- */
  PANES.overview = function (pane) {
    var st = B.state(), c = cur(), n = LANGS.map(function (l) { return Object.keys(c.words[l]).length; }), words = n[0] + n[1] + n[2], lines = E.receiptLines().length;
    function fact(room, icon, main, sub) {
      return h("li", null, h("button.std-fact", { type: "button", "data-go": room, onclick: function () { S.go(room); } }, [h("span.dept-jewel.sm", { "aria-hidden": "true" }, U.icon(icon)),
        h("span.std-fact-t", null, [h("small", null, t("studio.r." + room)), h("b", null, main), h("span", null, sub)]), h("span.std-fact-go", { "aria-hidden": "true" }, U.icon("next"))]));
    }
    pane.appendChild(h("section.std-hero", { "aria-label": t("studio.r.overview") }, [
      h("div.std-calling", null, [ui.crestKey(92, { cls: "std-crest", title: t("crest.press"), rise: true }), h("p.std-name#stdName", null, E.appName()),
        h("div.door-rule", null, [h("span"), h("em#stdTag", null, E.tagline()), h("span")]), h("p.std-store", null, st.settings.storeName)]),
      h("div.std-now", null, [h("p.eyebrow", null, t("studio.ov.now")),
        h("ul.std-facts#stdFacts", null, [
          fact("names", "tag", c.names.app || t("studio.ov.lakay"), st.settings.storeName + " · " + st.settings.ownerName),
          fact("words", "edit", words ? t(words === 1 ? "studio.ov.words1" : "studio.ov.wordsN", { n: words }) : t("studio.ov.wordsNone"),
            words ? LANGS.map(function (l, i) { return t("studio.lang." + l) + " " + n[i]; }).join(" · ") : t("studio.ov.wordsAll")),
          fact("look", "palette", t("studio.pal." + c.look.palette), t("studio.density." + c.look.density)),
          fact("receipt", "receipt", lines ? t(lines === 1 ? "studio.ov.lines1" : "studio.ov.lines", { n: lines }) : t("studio.ov.linesNone"), "“" + E.thanks() + "”")])])]));
    pane.appendChild(h("p.std-foot", null, [U.icon("lock"), h("span", null, t("studio.foot"))]));
  };

  /* ---------- the names: the app's, the store's, the owner's, and the line under the name ---------- */
  PANES.names = function (pane) {
    var st = B.state(), c = cur();
    var app = ui.input({ id: "stApp", maxlength: String(LIMIT.app), value: c.names.app, placeholder: "Lakay", autocomplete: "off" });
    var store = ui.input({ id: "stStore", maxlength: "80", value: st.settings.storeName, autocomplete: "off" });
    var owner = ui.input({ id: "stOwner", maxlength: "80", value: st.settings.ownerName, autocomplete: "off" });
    var tags = {};
    LANGS.forEach(function (l) { tags[l] = ui.input({ id: "stTag-" + l, maxlength: String(LIMIT.tagline), value: c.names.tagline[l], placeholder: E.original("door.tag", l), autocomplete: "off" }); });
    /* the stage: where the names show, at the door, in the menu, on the window */
    var spots = [];
    function spot(kind, cls) { var n = h("span." + cls); n.setAttribute("data-kind", kind); spots.push(n); return n; }
    var door = h("div.std-pv.std-pv-door", null, [ui.crestKey(56, { title: t("crest.press") }), spot("name", "pv-name"), h("div.door-rule", null, [h("span"), spot("tag", "pv-tag"), h("span")]), spot("store", "pv-store")]);
    var menu = h("div.std-pv.std-pv-menu", null, [ui.crest(34), h("span.std-pv-brand", null, [spot("word", "pv-word"), spot("store", "pv-storename")])]);
    var win = h("div.std-pv.std-pv-win", null, [h("span.std-pv-dots", { "aria-hidden": "true" }, [h("i"), h("i"), h("i")]), h("span.std-pv-tab", null, [ui.crest(16), spot("name", "pv-title")])]);
    function paint() {
      var nm = app.value.trim() || "Lakay", tg = tags[E.lang].value.trim() || E.original("door.tag", E.lang), so = store.value.trim() || "…";
      spots.forEach(function (n) { var k = n.getAttribute("data-kind"); n.textContent = k === "name" ? nm : k === "word" ? nm : k === "tag" ? tg : so; });
    }
    onEdit([app, store, owner, tags.en, tags.fr, tags.ht], paint);
    paint();
    var saveKey = h("button.key.primary#stNamesSave", { type: "button", onclick: function () {
      if (!store.value.trim()) return ui.fieldError(store, t("setup.needStore"));
      if (!owner.value.trim()) return ui.fieldError(owner, t("setup.needOwner"));
      var next = cur(); next.names.app = app.value.trim(); LANGS.forEach(function (l) { next.names.tagline[l] = tags[l].value.trim(); });
      saveKey.disabled = true;
      B.updateSettings({ storeName: store.value.trim(), ownerName: owner.value.trim() }).then(function () { return save(next, true); })
        .then(function () { dirty(false); ui.toast(t("studio.saved"), "good"); ui.shell(); }, function (e) { saveKey.disabled = false; ui.failed(e); });
    } }, [U.icon("check"), t("save")]);
    pane.appendChild(desk([
      block("studio.appName", [h("div.std-big", null, [app, counter(app, LIMIT.app)]), h("p.hint", null, t("studio.appNameHint"))], { icon: "tag", intro: "studio.names.intro" }),
      block("studio.names.storeH", [h("div.form-grid", null, [ui.field("setup.storeName", store, { required: true }), ui.field("setup.ownerName", owner, { required: true })])], { icon: "home" }),
      block("studio.tagline", [h("div.std-langs", null, LANGS.map(function (l) { return langRow(l, tags[l], LIMIT.tagline); })), h("p.hint", null, t("studio.taglineHint"))], { icon: "globe" }),
      h("div.std-actions", null, [saveKey, h("button.key", { type: "button", id: "stNamesBack", onclick: function () { app.value = ""; LANGS.forEach(function (l) { tags[l].value = ""; tags[l].dispatchEvent(new Event("input")); }); app.dispatchEvent(new Event("input")); } }, [U.icon("back"), t("studio.original")])])],
      [stageHead("studio.names.whereH"), h("p.std-pv-l", null, t("studio.pv.door")), door, h("p.std-pv-l", null, t("studio.pv.menu")), menu, h("p.std-pv-l", null, t("studio.pv.window")), win]));
  };

  /* ---------- the phrase book ---------- */
  /* the places a phrase belongs to, by the first part of its name; a name without a dot is a word used everywhere */
  var AREAS = [["all", null], ["common", null],
    ["door", ["door.", "setup.", "master.", "restore.", "pw.", "ld.", "intro.", "reset.", "practice.", "own.", "crest."]],
    ["menu", ["room.", "short.", "nav.", "menu.", "top.", "lang.", "status.", "alerts.", "rail.", "disp.", "calc.", "find.", "rem.", "sn.", "ctx.", "signout.", "dur.", "foot.", "low."]],
    ["home", ["home.", "first.", "prov.", "app.", "km.", "lede."]],
    ["register", ["reg.", "cash.", "receipt.", "pay."]],
    ["inventory", ["inv.", "rc.", "ad.", "reason.", "cat.", "line.", "field.", "dept.", "svc.", "scan.", "key."]],
    ["reports", ["rep."]],
    ["team", ["team.", "people.", "clock.", "access.", "level."]],
    ["learn", ["learn.", "tour.", "quiz.", "tips."]],
    ["settings", ["set.", "about.", "problem.", "type.", "cur.", "theme."]],
    ["guide", ["guide."]], ["tips", ["tip."]], ["studio", ["studio."]]];
  function areaOf(k) {
    if (k.indexOf(".") < 0) return "common";
    for (var i = 2; i < AREAS.length; i++) if (AREAS[i][1].some(function (p) { return k.indexOf(p) === 0; })) return AREAS[i][0];
    return "other";
  }
  S.areaOf = areaOf;
  /* the blanks Lakay fills in a phrase: {n}, {name} ... */
  function blanks(s) { var out = []; (String(s).match(/\{\w+\}/g) || []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); return out; }
  S.blanks = blanks;
  var W = { lang: null, area: "all", q: "", only: "all", page: 0, pending: {}, open: null }, WPAGE = 25;
  S.words = W;
  PANES.words = function (pane) {
    W.lang = W.lang || E.lang;
    var c = cur(), over = c.words[W.lang];
    var list = h("ol.std-words#wordList", { "aria-live": "polite" }), pager = h("nav.inv-pager#wordPager", { "aria-label": t("inv.pages") });
    var count = h("span.badge#wordCount");
    var q = ui.input({ id: "wordSearch", type: "search", placeholder: t("studio.words.search"), "aria-label": t("studio.words.search"), value: W.q });
    var langSeg = ui.seg(LANGS.map(function (l) { return [l, t("studio.lang." + l)]; }), W.lang, function (l) { W.lang = l; W.page = 0; W.open = null; draw(false); }, t("studio.words.lang"));
    langSeg.id = "wordLang";
    Array.prototype.forEach.call(langSeg.children, function (b) { b.insertBefore(ui.flag(b.getAttribute("data-v")), b.firstChild); });
    var onlySeg = ui.seg([["all", t("studio.words.all")], ["changed", t("studio.words.only")]], W.only, function (v) { W.only = v; W.page = 0; fill(); }, t("studio.words.show"));
    onlySeg.id = "wordOnly";
    var chips = h("div.chips.std-areas", { role: "group", "aria-label": t("studio.words.places") });
    AREAS.forEach(function (a) {
      chips.appendChild(h("button.chip", { type: "button", "aria-pressed": String(W.area === a[0]), "data-area": a[0], onclick: function (e) {
        W.area = a[0]; W.page = 0; Array.prototype.forEach.call(chips.children, function (x) { x.setAttribute("aria-pressed", String(x === e.currentTarget)); }); fill();
      } }, t("studio.area." + a[0])));
    });
    var pendN = h("span#wordPending"), bar = h("div.std-savebar#wordBar", { role: "region", "aria-label": t("studio.words.saveAll") }, [U.icon("edit"), pendN,
      h("button.key.sm#wordsUndo", { type: "button", onclick: function () { W.pending = {}; W.open = null; dirty(false); fill(); } }, [U.icon("back"), t("studio.words.undo")]),
      h("button.key.primary#wordsSave", { type: "button", onclick: saveWords }, [U.icon("check"), t("studio.words.saveAll")])]);
    function pendingCount() { return Object.keys(W.pending).length; }
    function mineOf(k) { var pk = W.lang + "|" + k; return W.pending[pk] !== undefined ? W.pending[pk] : (over[k] || ""); }
    /* every word typed must be in the phrase (as it reads here or in English, or as the owner wrote it) */
    function matches() {
      var ws = U.norm(W.q).split(/\s+/).filter(Boolean);
      return Object.keys(E.dict.en).filter(function (k) {
        if (W.area !== "all" && areaOf(k) !== W.area) return false;
        if (W.only === "changed" && !over[k] && W.pending[W.lang + "|" + k] === undefined) return false;
        if (!ws.length) return true;
        var hay = U.norm(E.original(k, W.lang) + " " + E.original(k, "en") + " " + mineOf(k) + " " + k);
        return ws.every(function (w) { return hay.indexOf(w) >= 0; });
      });
    }
    function row(k) {
      var orig = E.original(k, W.lang), pk = W.lang + "|" + k, pend = W.pending[pk], mine = mineOf(k), changed = !!mine && mine !== orig;
      var li = h("li.std-word" + (changed ? ".changed" : "") + (pend !== undefined ? ".pending" : "") + (W.open === k ? ".open" : ""), { "data-k": k });
      li.appendChild(h("div.std-word-h", null, [h("span.std-word-place", null, t("studio.area." + areaOf(k))),
        pend !== undefined ? h("span.badge.warn", null, t("studio.words.notSaved")) : changed ? h("span.badge.ok", null, [U.icon("check"), t("studio.words.isChanged")]) : null]));
      if (W.open !== k) {
        li.appendChild(h("p.std-word-orig" + (changed ? ".was" : "") + (orig.length > 180 ? ".long" : ""), null, orig));
        if (changed) li.appendChild(h("p.std-word-mine", null, [U.icon("next"), h("span", null, mine)]));
        li.appendChild(h("div.std-word-k", null, [
          h("button.key.sm", { type: "button", "data-act": "edit", onclick: function () { W.open = k; fill(); } }, [U.icon("edit"), t("edit")]),
          changed ? h("button.key.sm.quiet", { type: "button", "data-act": "back", onclick: function () { if (over[k]) W.pending[pk] = ""; else delete W.pending[pk]; dirty(pendingCount() > 0); fill(); } }, [U.icon("back"), t("studio.words.reset")]) : null]));
        return li;
      }
      /* the phrase open for writing: Lakay's own above, the owner's below, and the blanks it must keep */
      var need = blanks(orig), warn = h("p.std-word-warn", { role: "alert" });
      var ta = h("textarea.std-word-in", { rows: String(Math.min(8, Math.max(2, Math.ceil((mine || orig).length / 70) + (orig.split("\n").length - 1)))), maxlength: String(LIMIT.word), "aria-label": t("studio.words.yours") });
      ta.value = mine || orig;
      function keep() {
        var v = ta.value, miss = need.filter(function (b) { return v.indexOf(b) < 0; });
        if (!v.trim()) { v = ""; miss = []; }
        if (miss.length) { warn.textContent = t("studio.words.keepBlanks", { list: miss.join(" ") }); ta.focus(); return; }
        if (!v || v === orig) { if (over[k]) W.pending[pk] = ""; else delete W.pending[pk]; } else W.pending[pk] = v;
        W.open = null; dirty(pendingCount() > 0); fill();
      }
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); keep(); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); W.open = null; fill(); } });
      li.appendChild(h("p.std-word-orig.ref", null, [h("small", null, t("studio.words.lakays")), h("span", null, orig)]));
      li.appendChild(h("label.std-word-l", { for: "wordEdit" }, t("studio.words.yours")));
      ta.id = "wordEdit";
      li.appendChild(ta);
      if (need.length) li.appendChild(h("p.hint.std-word-blanks", null, t("studio.words.blanks", { list: need.join(" ") })));
      li.appendChild(warn);
      li.appendChild(h("div.std-word-k", null, [h("button.key.sm.primary#wordKeep", { type: "button", onclick: keep }, [U.icon("check"), t("studio.words.keep")]),
        h("button.key.sm", { type: "button", onclick: function () { W.open = null; fill(); } }, t("cancel")),
        h("button.key.sm.quiet", { type: "button", onclick: function () { ta.value = orig; warn.textContent = ""; ta.focus(); } }, [U.icon("back"), t("studio.words.reset")])]));
      setTimeout(function () { try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { } }, 30);
      return li;
    }
    function fill() {
      var keys = matches(), n = keys.length, pages = Math.max(1, Math.ceil(n / WPAGE));
      if (W.open && keys.indexOf(W.open) >= 0) W.page = Math.floor(keys.indexOf(W.open) / WPAGE);
      if (W.page >= pages) W.page = pages - 1;
      var from = W.page * WPAGE;
      U.clear(list);
      keys.slice(from, from + WPAGE).forEach(function (k) { list.appendChild(row(k)); });
      if (!n) list.appendChild(h("li.std-words-none.muted", null, t("studio.words.none")));
      U.clear(pager);
      if (pages > 1) {
        pager.appendChild(h("button.key.sm#wordPrev", { type: "button", disabled: W.page === 0 ? "" : null, onclick: function () { W.page--; W.open = null; fill(); list.scrollIntoView({ block: "start" }); } }, ["‹ ", t("inv.prev")]));
        pager.appendChild(h("span.inv-page", { "aria-live": "polite" }, t("inv.pageOf", { a: from + 1, b: Math.min(n, from + WPAGE), n: n })));
        pager.appendChild(h("button.key.sm#wordNext", { type: "button", disabled: W.page >= pages - 1 ? "" : null, onclick: function () { W.page++; W.open = null; fill(); list.scrollIntoView({ block: "start" }); } }, [t("inv.next"), " ›"]));
      }
      var changedHere = Object.keys(over).length;
      count.textContent = t("studio.words.changed", { n: changedHere });
      var p = pendingCount();
      bar.hidden = !p; pendN.textContent = t(p === 1 ? "studio.words.pending1" : "studio.words.pending", { n: p });
    }
    function saveWords() {
      var next = cur();
      Object.keys(W.pending).forEach(function (pk) {
        var i = pk.indexOf("|"), l = pk.slice(0, i), k = pk.slice(i + 1), v = W.pending[pk];
        if (v && v.trim() && v !== E.original(k, l)) next.words[l][k] = v; else delete next.words[l][k];
      });
      if (!diff(E.custom || blank(), E.cleanCustom(next), "").length) { W.pending = {}; dirty(false); fill(); ui.toast(t("studio.nothing")); return; }
      save(next).then(function (ok) { if (ok) { W.pending = {}; W.open = null; dirty(false); ui.shell(); } });
    }
    q.addEventListener("input", U.debounce(function () { W.q = q.value; W.page = 0; W.open = null; fill(); }, 120));
    pane.appendChild(h("section.std-block.std-book", { "aria-labelledby": "wordsH" }, [
      h("div.std-block-h", null, [h("span.dept-jewel.xs", { "aria-hidden": "true" }, U.icon("edit")), h("h3#wordsH", null, t("studio.words.h")), count]),
      h("p.std-block-p", null, t("studio.words.intro")),
      h("div.std-words-tools", null, [h("div.std-words-lang", null, [h("span.label", null, t("studio.words.lang")), langSeg]), onlySeg]),
      h("div.search-row", null, [U.icon("search"), q]),
      chips, list, h("div.inv-under", null, [h("span"), pager])]));
    pane.appendChild(bar);
    fill();
  };

  /* ---------- the look: the colours, by day and by night, and the spacing ---------- */
  PANES.look = function (pane) {
    var c = cur();
    function mini(kind) { return h("span.pm.pm-" + kind, null, [h("i.pm-side"), h("i.pm-title"), h("i.pm-line"), h("i.pm-line.short"), h("i.pm-key"), h("i.pm-chip")]); }
    var grid = h("div.std-pals", { role: "radiogroup", "aria-label": t("studio.look.colours") }, PALETTES.map(function (p) {
      var on = c.look.palette === p, sw = SWATCH[p], m = h("span.pal-mini", { "aria-hidden": "true" }, [mini("day"), mini("night")]);
      m.style.setProperty("--m-pri", sw[0]); m.style.setProperty("--m-soft", sw[1]); m.style.setProperty("--m-night", sw[2]); m.style.setProperty("--m-lit", sw[3]);
      return h("button.palette-card", { type: "button", role: "radio", "aria-checked": String(on), "data-p": p, onclick: function () {
        if (cur().look.palette === p) return;
        var next = cur(); next.look.palette = p; save(next).then(function () { draw(false); });
      } }, [m, h("span.pal-t", null, [h("b", null, t("studio.pal." + p)), h("small", null, t("studio.pal." + p + ".d"))]), h("span.pal-check", { "aria-hidden": "true" }, U.icon("check"))]);
    }));
    var space = h("div.std-space", { role: "radiogroup", "aria-label": t("studio.density") }, ["compact", "comfortable"].map(function (d) {
      return h("button.std-space-k", { type: "button", role: "radio", "aria-checked": String(c.look.density === d), "data-d": d, onclick: function () {
        if (cur().look.density === d) return;
        var next = cur(); next.look.density = d; save(next).then(function () { draw(false); });
      } }, [h("span.sp-mini.sp-" + d, { "aria-hidden": "true" }, [h("i"), h("i"), h("i")]), h("span.sp-t", null, [h("b", null, t("studio.density." + d)), h("small", null, t("studio.density." + d + ".d"))])]);
    }));
    /* the stage: a piece of the counter in the colours chosen, drawn with Lakay's own keys */
    var sample = h("div.std-sample", { "aria-hidden": "true" }, [
      h("div.std-sample-top", null, [h("b", null, t("room.register")), h("span.badge.ok", null, [U.icon("check"), t("learn.done")])]),
      h("div.chips", null, ["music", "drinks", "food"].map(function (k, i) { return h("span.chip", { "aria-pressed": String(i === 0) }, [ui.deptIcon(k, "xs"), t("cat." + k)]); })),
      h("div.std-sample-row", null, [h("span", null, t("reg.total")), h("b.num", null, money(1298))]),
      h("div.std-sample-keys", null, [h("span.key", null, t("reg.clear")), h("span.key.primary", null, t("reg.takeCash"))])]);
    pane.appendChild(desk([
      block("studio.look.colours", [grid], { icon: "palette", intro: "studio.look.intro" }),
      block("studio.density", [space], { icon: "list" }),
      h("p.hint.std-look-hint", null, [U.icon("info"), h("span", null, t("studio.look.hint"))])],
      [stageHead("studio.look.stageH"), sample, h("p.hint", null, t("studio.look.stageP"))]));
  };

  /* ---------- the receipt: the lines under the store's name, the thank you, the note at the foot ---------- */
  PANES.receipt = function (pane) {
    var st = B.state(), c = cur();
    var lines = h("textarea#stLines", { rows: "4", maxlength: String(LIMIT.lines), placeholder: t("studio.receipt.linesPh") }); lines.value = c.receipt.lines;
    var note = ui.input({ id: "stNote", maxlength: "160", value: st.settings.receiptNote || "" });
    var thanks = {};
    LANGS.forEach(function (l) { thanks[l] = ui.input({ id: "stThanks-" + l, maxlength: String(LIMIT.thanks), value: c.receipt.thanks[l], placeholder: E.original("receipt.thanks", l) }); });
    var paper = h("div.std-paper#receiptPreview");
    function sample() {
      var last = st.sales[st.sales.length - 1];
      return last || { no: "A-000000", at: new Date().toISOString(), by: B.user ? B.user.id : "owner", lines: [{ qty: 1, name: t("studio.sampleItem"), amount: 250 }], subtotal: 250, taxes: [], tax: 0, total: 250,
        pay: [{ method: "cash", amount: 250, tendered: 500, change: 250 }] };
    }
    /* the receipt as it would print with what is typed now (nothing is kept until Save) */
    function node() {
      var keep = E.custom, keepNote = st.settings.receiptNote, out;
      E.custom = E.cleanCustom({ v: 2, names: cur().names, words: cur().words, look: cur().look, receipt: { lines: lines.value, thanks: { en: thanks.en.value, fr: thanks.fr.value, ht: thanks.ht.value } } });
      st.settings.receiptNote = note.value.trim();
      try { out = E.register.receiptNode(sample()); } finally { E.custom = keep; st.settings.receiptNote = keepNote; }
      return out;
    }
    function paint() { U.clear(paper); paper.appendChild(node()); }
    onEdit([lines, note, thanks.en, thanks.fr, thanks.ht], paint);
    var saveKey = h("button.key.primary#stReceiptSave", { type: "button", onclick: function () {
      var next = cur(); next.receipt.lines = lines.value; LANGS.forEach(function (l) { next.receipt.thanks[l] = thanks[l].value.trim(); });
      saveKey.disabled = true;
      B.updateSettings({ receiptNote: note.value.trim() }).then(function () { return save(next, true); })
        .then(function () { dirty(false); ui.toast(t("studio.saved"), "good"); draw(false); }, function (e) { saveKey.disabled = false; ui.failed(e); });
    } }, [U.icon("check"), t("save")]);
    pane.appendChild(desk([
      block("studio.receipt.lines", [h("div.std-big", null, [lines, counter(lines, LIMIT.lines)]), h("p.hint", null, t("studio.receipt.linesHint"))], { icon: "receipt", intro: "studio.receipt.intro" }),
      block("studio.receipt.thanks", [h("div.std-langs", null, LANGS.map(function (l) { return langRow(l, thanks[l], LIMIT.thanks); }))], { icon: "globe" }),
      block("set.receiptNote", [h("div.std-big", null, [note, counter(note, 160)]), h("p.hint", null, t("set.receiptNoteHint"))], { icon: "info" }),
      h("div.std-actions", null, [saveKey, h("button.key#stPrintTest", { type: "button", onclick: function () { ui.print(node()); } }, [U.icon("print"), t("studio.receipt.print")])])],
      [stageHead("studio.receipt.paperH"), h("div.std-paper-wrap", null, paper), h("p.hint", null, t("studio.receipt.paperP"))]));
    paint();
  };

  /* ---------- safekeeping: a copy of the choices, bringing them back, every original, and what was changed ---------- */
  function exportAll() {
    var body = { format: "emporium-author", v: 1, build: E.BUILD.number, at: new Date().toISOString(), custom: cur() };
    ui.saveFile("Lakay Author Studio " + U.dayKey() + ".json", "application/json", JSON.stringify(body, null, 1)).then(function () { ui.toast(t("studio.exported"), "good"); });
  }
  function resetAll() {
    ui.confirm(t("studio.resetT"), t("studio.resetP"), t("studio.resetYes"), "danger").then(function (ok) {
      if (ok) save(blank(), true).then(function (did) { W.pending = {}; ui.toast(t(did ? "studio.resetDone" : "studio.nothing"), did ? "good" : null); ui.shell(); });
    });
  }
  /* what one ledger line of the Studio changed, in plain words */
  function whatChanged(l) {
    var d = l.data || {};
    if (l.type === "settings.updated") return Object.keys(d.changes || {}).filter(function (k) { return ["storeName", "ownerName", "receiptNote"].indexOf(k) >= 0; }).map(function (k) { return t("studio.h." + k); }).join(" · ");
    var parts = [], words = {};
    (d.changed || []).forEach(function (p) {
      var seg = p.split("."), key = null;
      if (seg[0] === "words") { words[seg[1]] = (words[seg[1]] || 0) + 1; return; }
      if (seg[0] === "names") key = seg[1] === "app" ? "studio.h.app" : "studio.h.tagline";
      else if (seg[0] === "look") key = seg[1] === "palette" ? "studio.h.palette" : "studio.h.density";
      else if (seg[0] === "receipt") key = seg[1] === "lines" ? "studio.h.lines" : "studio.h.thanks";
      if (!key) return;
      var text = t(key, { lang: seg[2] && E.has("studio.lang." + seg[2]) ? t("studio.lang." + seg[2]) : "" });
      if (parts.indexOf(text) < 0) parts.push(text);
    });
    Object.keys(words).forEach(function (lg) { parts.push(t(words[lg] === 1 ? "studio.h.word1" : "studio.h.words", { n: words[lg], lang: E.has("studio.lang." + lg) ? t("studio.lang." + lg) : lg })); });
    return parts.join(" · ") || t("studio.h.some");
  }
  S.whatChanged = whatChanged;
  function history(box) {
    U.clear(box); box.appendChild(h("p.muted", null, t("loading")));
    B.lines(function (l) {
      if (l.type === "author.changed") return true;
      var ch = l.type === "settings.updated" && l.data && l.data.changes;
      return !!(ch && (ch.storeName || ch.ownerName || ch.receiptNote));
    }).then(function (ls) {
      U.clear(box);
      if (!ls.length) { box.appendChild(h("p.muted", null, t("studio.safe.historyNone"))); return; }
      box.appendChild(h("ol.std-history#studioLog", null, ls.slice(0, 15).map(function (l) {
        return h("li", null, [h("span.std-h-when", null, ui.time(l.at)), h("span.std-h-what", null, whatChanged(l)), h("span.std-h-who", null, ui.userTag(l.by))]);
      })));
      if (ls.length > 15) box.appendChild(h("p.hint", null, t("studio.safe.historyMore", { n: ls.length - 15 })));
    }, function () { U.clear(box); box.appendChild(h("p.muted", null, t("door.problem"))); });
  }
  PANES.safe = function (pane) {
    var msg = h("p.door-msg", { role: "status" });
    var file = ui.filePick({ id: "studioFile", keyId: "studioFileKey", accept: ".json,application/json", label: t("studio.importKey"), none: t("ld.rs.none"), emoji: "📥", onFile: function (f) {
      f.text().then(function (text) {
        var body; try { body = JSON.parse(text); } catch (e) { body = null; }
        if (!body || body.format !== "emporium-author" || body.v !== 1 || !body.custom) { msg.textContent = t("studio.importBad"); return; }
        var next = E.cleanCustom(body.custom);
        ui.confirm(t("studio.importConfirmT"), t("studio.importConfirmP"), t("studio.importYes")).then(function (ok) {
          if (ok) save(next, true).then(function () { W.pending = {}; ui.toast(t("studio.imported"), "good"); ui.shell(); });
        });
      });
    } });
    function action(icon, titleKey, textKey, kids, tone) {
      return h("section.std-act" + (tone ? "." + tone : ""), null, [h("span.dept-jewel.sm", { "aria-hidden": "true" }, U.icon(icon)), h("h3", null, t(titleKey)), h("p", null, t(textKey)), h("div.std-act-k", null, kids)]);
    }
    var log = h("div.std-log#studioHistoryBox");
    pane.appendChild(h("p.std-block-p.std-safe-p", null, t("studio.safe.intro")));
    pane.appendChild(h("div.std-acts", null, [
      action("download", "studio.export", "studio.safe.export", [h("button.key.primary#studioExport", { type: "button", onclick: exportAll }, [U.icon("download"), t("studio.export")])]),
      action("upload", "studio.import", "studio.safe.import", [file, msg]),
      action("back", "studio.reset", "studio.resetP", [h("button.key.danger#studioReset", { type: "button", onclick: resetAll }, [U.icon("back"), t("studio.reset")])], "warn")]));
    pane.appendChild(block("studio.safe.historyH", [h("p.std-block-p", null, t("studio.safe.historyP")), log], { icon: "clock",
      right: h("button.key.sm#studioHistory", { type: "button", onclick: function () { history(log); } }, [U.icon("list"), t("studio.safe.historyKey")]) }));
  };
})();
