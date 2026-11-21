/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Ownership, terms and privacy (Build 26), in parity with Ingenium 7.58, made for Lakay. The owner's request (21 November 2026):
   "I want Lakay to have a Terms and Conditions policy and also have a clear copyrights declaration the same way that Ingenium
   does. I want full and exact parity with Ingenium's Terms and Conditions implementations system and prompting. Please make the
   necessary changes and please make sure that it is all customised and curated specifically for the Lakay app."
   What Ingenium has, and Lakay now has in the same way:
   - Ownership, licence and permissions (Ingenium's PermitCore card, 6.2 to 6.46): who owns the app, a permission's rules, this
     copy's build, the whole licence to read as a document (its contents, its plain words, parts, sections, clauses and lists:
     the same reading of the same regular text, release/licence/make_licence.py), and Save the licence. Lakay's permissions are
     the licence's own (a file signed with the owner's key, or a written message from the owner); Lakay keeps no signed
     permission files, so the card has no part for them.
   - Terms and privacy (Ingenium's module r320, 7.37): In short, the Privacy notice, the Terms of use and, for the owner of the
     real store, Your contact and the Draft chip (a lawyer reads it before it is final).
   - Before you begin (Ingenium's module r326, 7.41): once the welcome door has opened, a device that has not agreed to this
     version of the terms shows the sheet over everything: In short, the full Terms of use, the full Privacy notice, a tick,
     Decline and I agree. Nothing behind it can be reached. Agreed: the version, the date and the build are kept on this device
     (never sent) and shown with the terms; a new version asks again. Declined: Lakay stays closed, says why, and the terms can
     be read again.
   Made for Lakay: the texts are the store's (its books, its people, payments and bookings, its devices and relays), in
   English, French and Kreyòl (the English applies); the terms are also in About for everyone, since the staff and the
   website's visitors never open Settings; Lakay has one edition, so every device asks (Ingenium's master copy does not ask
   its maker); and the declined sheet has a second key, Back to the welcome door, where Refresh and Reset stay, because Lakay
   never locks anyone out (Build 7). The texts are src/terms/terms.json, from which build.py also writes TERMS.txt and
   PRIVACY.txt. Not legal advice: a lawyer in the United States and in the United Kingdom should read the final wording. */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t;
  var DATA = "@@TERMS@@", LICENCE = "@@LICENCE@@", NOTICES = "@@NOTICES@@";
  var T = E.terms = {};
  var VIEW = "short", V = null, ST = "ask", GV = "short", TICK = false, seenDoor = false, MEMO = null;
  function lang() { return E.lang === "fr" || E.lang === "ht" ? E.lang : "en"; }
  function L(o) { return (o && (o[lang()] || o.en)) || ""; }
  /* a day in words, without its weekday: "20 November 2026" */
  function dayWords(d) { return E.fmtDate(d, "long").replace(/^\S+ /, ""); }
  T.version = function () { return L(DATA.version); };
  T.versionEn = DATA.version.en;
  T.contact = function () { return String(U.prefGet("termsContact", "") || DATA.contact || "").trim(); };
  /* the owner of the real store: the one who adds the contact, and who is told the texts are a draft */
  function ownerHere() { var B = E.books; return !!(B && B.isOpen && B.mode !== "practice" && B.isOwner && B.isOwner()); }

  /* ---------- the texts, in the reader's language ---------- */
  function rich(s) {
    return String(s).split(/(\{contact\}|\{age\})/).filter(Boolean).map(function (p) {
      if (p === "{contact}") { var c = T.contact(); return c ? h("b.tp-contact", null, c) : h("span.tp-blank", null, t("terms.blankContact")); }
      if (p === "{age}") return h("span.tp-blank", null, t("terms.blankAge"));
      return p;
    });
  }
  function doc(kind) {
    return h("div.tp-doc", null, DATA[kind].map(function (x) { return h("div.tp-sec", null, [h("h3", null, L(x.h)), h("p", null, rich(L(x.b)))]); })
      .concat(lang() !== "en" ? [h("p.tp-governs", null, t("terms.governs"))] : []));
  }
  function shorts(cls) { return h("div." + cls + "s", null, DATA.short.map(function (x) { return h("div." + cls, null, [h("b", null, L(x.t)), h("span", null, L(x.b))]); })); }
  function shield() {
    var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    ["M12 2.8l7.5 3v5.6c0 4.6-3.2 8.4-7.5 9.8-4.3-1.4-7.5-5.2-7.5-9.8V5.8z", "M9 11.5h6M9 14.5h4"].forEach(function (d) {
      var p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.appendChild(p);
    });
    return svg;
  }
  function rec() { try { var r = JSON.parse(U.prefGet("terms", "") || "null"); return r && typeof r === "object" && r.v ? r : null; } catch (e) { return null; } }
  T.record = rec;
  /* MEMO: agreed in this session, even where the browser keeps nothing (a private window, storage refused): asked once, not again every few seconds */
  T.agreed = function () { var r = rec(); return MEMO === DATA.version.en || !!(r && r.v === DATA.version.en); };
  T.need = function () { return !T.agreed(); };
  function agreedLine() {
    var r = rec(); if (!r || !r.at) return null;
    var d = new Date(r.at);
    return h("p.tp-agreed", null, t("terms.agreed", { v: r.v === DATA.version.en ? T.version() : r.v, d: dayWords(d), t: E.fmtTime(d) }));
  }

  /* ---------- Terms and privacy: in Settings, Ownership, and from About ---------- */
  T.card = function (inSettings) {
    var c = h("div.tp-card", { id: inSettings ? "termsCard" : "termsRead" });
    function paint() {
      var mine = !!inSettings && ownerHere();
      if (VIEW === "contact" && !mine) VIEW = "short";
      U.clear(c);
      c.appendChild(h("div.tp-head", null, [h("span.tp-coin", { "aria-hidden": "true" }, shield()),
        h("div", null, [h("h3.tp-title", null, t("terms.h")), h("p.tp-sub", null, t("terms.sub", { v: T.version() }))])]));
      c.appendChild(h("div.tp-chips", null, [h("span.tp-chip.ok", null, t("terms.chip.maker")), h("span.tp-chip.sky", null, t("terms.chip.offline")),
        h("span.tp-chip.lav", null, t("terms.chip.sealed")), mine ? h("span.tp-chip.amb#termsDraft", null, t("terms.chip.draft")) : null]));
      var parts = [["short", "terms.p.short"], ["privacy", "terms.p.privacy"], ["terms", "terms.p.terms"]].concat(mine ? [["contact", "terms.p.contact"]] : []);
      c.appendChild(h("div.inv-tabs.tp-parts", { role: "tablist", "aria-label": t("terms.h") }, parts.map(function (p) {
        return h("button.inv-tab.tp-part", { type: "button", role: "tab", "aria-selected": String(VIEW === p[0]), "data-p": p[0], onclick: function () { VIEW = p[0]; paint(); } }, t(p[1]));
      })));
      if (VIEW === "short") c.appendChild(shorts("tp-short"));
      else if (VIEW === "privacy") c.appendChild(doc("privacy"));
      else if (VIEW === "terms") c.appendChild(doc("terms"));
      else {
        var inp = E.ui.input({ id: "tpContact", maxlength: "200", placeholder: t("terms.contactPh"), value: U.prefGet("termsContact", "") });
        c.appendChild(E.ui.field("terms.contactL", inp));
        c.appendChild(h("p.hint", null, t("terms.contactFine")));
        c.appendChild(h("div.row-keys", null, [
          h("button.key.primary#tpSave", { type: "button", "data-a": "save", onclick: function () { var v = String(inp.value || "").trim().slice(0, 200); U.prefSet("termsContact", v); E.ui.toast(t(v ? "terms.saved" : "terms.cleared"), "good"); paint(); } }, t("save")),
          h("button.key#tpClear", { type: "button", "data-a": "clear", onclick: function () { U.prefSet("termsContact", ""); E.ui.toast(t("terms.cleared"), "good"); paint(); } }, t("terms.clear"))]));
      }
      var al = agreedLine(); if (al) c.appendChild(al);
    }
    paint();
    c.__paint = paint;
    return c;
  };

  /* ---------- the licence, as a document: the reading Ingenium's PermitCore gives its own licence (6.7). The text stays plain (the
     repositories carry the same file, and Save keeps it as it is); its regular shape is read here: the title block, IN PLAIN
     WORDS with its bullets, PART headings between rules, numbered section headings in capitals, clauses "4.1", lists "(a)",
     wrapped lines indented under their first line. Lakay's reading counts a list item only at the margin, so that a wrapped
     line that begins with "(f)" stays in its clause. ---------- */
  var ITEM = /^ {0,2}(•|\([a-z]\))\s/;
  function licenceDoc(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n"), i = 0, n = lines.length, toc = [], secN = 0, tag = Math.random().toString(36).slice(2, 7);
    var ver = (/Version (\d+)/.exec(text) || [])[1] || "";
    var box = h("div.lic-doc", { role: "region", tabindex: "0", "aria-label": t("lic.readH") + (ver ? ", " + t("lic.versionN", { n: ver }) : "") });
    function rule(l) { return /^={10,}$/.test(l); }
    function blank(l) { return !/\S/.test(l); }
    /* a block: the first line and the indented lines that continue it */
    function take(first, indent) {
      var s = first.trim();
      while (i < n && !blank(lines[i]) && /^\s/.test(lines[i]) && lines[i].length - lines[i].replace(/^\s+/, "").length >= indent && !ITEM.test(lines[i])) { s += " " + lines[i].trim(); i++; }
      return s;
    }
    /* a plain paragraph: its wrapped lines are not indented, so it runs to the next blank line or the next structural line */
    function para(first) {
      var s = first.trim();
      while (i < n && !blank(lines[i]) && !rule(lines[i]) && !ITEM.test(lines[i]) && !/^\d+\.\d+ /.test(lines[i]) && !/^\d+\. [^a-z]+$/.test(lines[i].trim())) { s += " " + lines[i].trim(); i++; }
      return s;
    }
    /* the title block: the name, the copyright, then the notice's title and its version (its wrapped lines read as one) */
    function metas(into) {
      var run = [];
      function put() { if (run.length) into.appendChild(h("p.lcd-meta", null, run.join(" "))); run = []; }
      while (i < n && !rule(lines[i])) { if (blank(lines[i])) put(); else run.push(lines[i].trim()); i++; }
      put();
    }
    var head = h("div.lcd-head"), app = h("p.lcd-app", null, (lines[0] || "Lakay").trim()); head.appendChild(app); i = 1;
    metas(head);
    if (rule(lines[i] || "")) {
      i++; var tt = (lines[i] || "").trim(); i++;
      if (!/^ownership,? licen[cs]e and permissions$/i.test(tt)) head.insertBefore(h("h3.lcd-title", null, tt.charAt(0) + tt.slice(1).toLowerCase()), app.nextSibling);  /* not the card's own heading a second time */
      metas(head); i++;
    }
    box.appendChild(head);
    var tocList = h("ol"), tocBox = h("details.lcd-toc", null, [h("summary", null, t("lic.contents")), tocList]);
    var plain = null, list = null;
    while (i < n) {
      var l = lines[i];
      if (blank(l)) { i++; list = null; continue; }
      if (rule(l)) {
        i++; var nx = (lines[i] || "").trim(), last = true;
        for (var q = i + 2; q < n; q++) if (!blank(lines[q])) { last = false; break; }
        if (nx && rule(lines[i + 1] || "") && last) { i += 2; box.appendChild(h("p.lcd-foot", null, nx)); continue; }
        if (nx && rule(lines[i + 1] || "")) { i += 2; if (plain) { plain = null; box.appendChild(tocBox); } box.appendChild(h("h4.lcd-part", null, nx)); continue; }
        if (nx) { i++; var ft = take(nx, 0); while (i < n && !rule(lines[i])) { if (!blank(lines[i])) ft += " " + lines[i].trim(); i++; } i++; box.appendChild(h("p.lcd-foot", null, ft)); }
        continue;
      }
      if (/^IN PLAIN WORDS$/.test(l.trim())) { plain = h("div.lcd-plain", null, [h("h4", null, "In plain words"), h("ul")]); box.appendChild(plain); i++; continue; }
      if (plain && /^ {0,2}•\s/.test(l)) { i++; plain.children[1].appendChild(h("li", null, take(l.replace(/^\s*•\s/, ""), 4))); continue; }
      if (plain) { i++; plain.appendChild(h("p.lcd-note", null, para(l))); continue; }
      var mh = /^(\d+)\. ([^a-z]+)$/.exec(l.trim());
      if (mh) {
        i++; secN++;
        var hd = h("h4.lcd-h", { id: "lcd-" + tag + "-" + secN, tabindex: "-1" }, mh[1] + ". " + mh[2].charAt(0) + mh[2].slice(1).toLowerCase().replace(/\blakay\b/g, "Lakay"));
        box.appendChild(hd); toc.push(hd); list = null; continue;
      }
      var mc = /^(\d+\.\d+) (.*)$/.exec(l);
      if (mc) { i++; box.appendChild(h("div.lcd-cl", null, [h("b", null, mc[1]), h("span", null, take(mc[2], mc[1].length + 1))])); list = null; continue; }
      var ml = /^ {0,2}\(([a-z])\) (.*)$/.exec(l);
      if (ml) { i++; if (!list) { list = h("ol.lcd-list"); box.appendChild(list); } list.appendChild(h("li", null, [h("span", null, "(" + ml[1] + ")"), h("span", null, take(ml[2], 6))])); continue; }
      i++; box.appendChild(h("p", null, para(l))); list = null;
    }
    toc.forEach(function (hd) {
      tocList.appendChild(h("li", null, h("button", { type: "button", onclick: function () { try { hd.scrollIntoView({ block: "start", behavior: "auto" }); } catch (e) { } try { hd.focus({ preventScroll: true }); } catch (e) { } } }, hd.textContent)));
    });
    if (!tocBox.parentNode) box.insertBefore(tocBox, box.children[1] || null);
    return box;
  }
  T.licenceDoc = function () { return licenceDoc(LICENCE); };

  /* ---------- Ownership, licence and permissions ---------- */
  T.licenceCard = function (inSettings) {
    var built = new Date(String(E.BUILD.date) + "T12:00:00"), when = isNaN(built.getTime()) ? String(E.BUILD.date) : dayWords(built);
    var ver = (/Version (\d+)/.exec(LICENCE) || [])[1] || "";
    var dt = h("details.lic-text", null, [h("summary", null, t("lic.read") + (ver ? " (" + t("lic.versionN", { n: ver }) + ")" : "")), licenceDoc(LICENCE)]);
    return h("div.lic-card", { id: inSettings ? "licenceCard" : "licenceRead" }, [
      h("div.tp-head", null, [h("span.tp-coin.lic-coin", { "aria-hidden": "true" }, "©"),
        h("div", null, [h("h3.tp-title", null, t("lic.h")), h("p.lic-copy", null, t("lic.copy"))])]),
      h("p.lic-line", null, t("lic.sole")),
      h("p.lic-line.lic-note", null, t("lic.permit")),
      h("p.lic-line.lic-note.lic-this", null, t("lic.this", { b: E.BUILD.number, d: when })),
      lang() !== "en" ? h("div.lic-plainbox", null, [h("h4", null, t("lic.plain")), h("ul.lic-plain", null, DATA.licence.map(function (x) { return h("li", null, L(x)); })), h("p.hint", null, t("lic.english"))]) : null,
      dt,
      h("div.row-keys", null, [
        h("button.key.lic-save", { type: "button", onclick: function () { E.ui.saveFile("LICENCE.txt", "text/plain", LICENCE).then(function () { E.ui.toast(t("lic.saved"), "good"); }); } }, [E.ui.emo("📜"), t("lic.save")]),
        h("button.key.lic-notices", { type: "button", onclick: function () { T.readNotices(); } }, [E.ui.emo("🧩"), t("lic.notices")])])]);
  };
  T.readNotices = function () {
    E.ui.dialog({ title: t("lic.noticesH"), emoji: "🧩", wide: true, body: [h("p.hint", null, t("lic.noticesP")), h("pre.lic-pre#licNoticesText", null, NOTICES)], actions: [{ label: t("close"), kind: "primary" }] });
  };
  /* from About: anyone reads them, the staff and the website's visitors too */
  T.readLicence = function () {
    E.ui.dialog({ title: t("lic.h"), emoji: "📜", wide: true, body: [T.licenceCard(false)], actions: [{ label: t("close"), kind: "primary" }] });
  };
  T.read = function (view) {
    VIEW = view || "short";
    E.ui.dialog({ title: t("terms.h"), emoji: "🛡️", wide: true, body: [T.card(false)], actions: [{ label: t("close"), kind: "primary" }] });
  };
  /* to Settings, Ownership, at the card (whoever may open Settings), or the same card from About (anyone else) */
  T.show = function (view) {
    VIEW = view || "privacy";
    var ui = E.ui;
    if (E.books && E.books.isOpen && ui.allowed && ui.allowed("settings")) {
      if (ui.current !== "settings") ui.go("settings");
      setTimeout(function () { var c = document.getElementById("termsCard"); if (c) { if (c.__paint) c.__paint(); try { c.scrollIntoView({ block: "start", behavior: ui.still && ui.still() ? "auto" : "smooth" }); } catch (e) { } } }, 150);
    } else T.read(VIEW);
  };
  T.repaint = function () { ["termsCard", "termsRead"].forEach(function (id) { var c = document.getElementById(id); if (c && c.__paint) c.__paint(); }); };

  /* ---------- before you begin: agreeing to the terms ---------- */
  function atDoor() { return !!document.getElementById("introDoor") && !document.getElementById("lockDoor"); }
  function key(label, cls, fn, id) { return h("button.key.tg-key" + (cls ? "." + cls : "") + (id ? "#" + id : ""), { type: "button", onclick: fn }, label); }
  function openSheet() {
    if (V) return;
    V = h("div.tg-veil#termsGate");
    V.appendChild(h("div.tg", { role: "dialog", "aria-modal": "true", "aria-label": t("gate.h") }));
    document.body.appendChild(V);
    window.addEventListener("keydown", trap, true);
    paintSheet();
  }
  function closeSheet() { if (!V) return; V.remove(); V = null; window.removeEventListener("keydown", trap, true); }
  /* the keyboard stays in the sheet: Tab goes round its own keys, and Escape does not close it. Lakay listens first (on the
     window), so that no key reaches the rooms behind the sheet: the register's keys, the scanner, the rail's shortcuts. */
  function trap(e) {
    if (!V) return;
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); return; }
    if (!V.contains(e.target) && e.key !== "Tab") { e.preventDefault(); return; }
    if (e.key !== "Tab") return;
    var f = Array.prototype.filter.call(V.querySelectorAll("button,input,[tabindex='0']"), function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    var i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  }
  function paintSheet() {
    var s = V && V.firstChild; if (!s) return;
    U.clear(s);
    if (ST === "no") {
      s.appendChild(h("span.tg-chip.no", null, t("gate.noChip")));
      s.appendChild(h("h2", null, t("gate.noH")));
      s.appendChild(h("p.tg-said#tgSaid", null, t("gate.noP")));
      s.appendChild(h("div.tg-row", null, [key(t("gate.back"), "", back, "tgBack"), key(t("gate.again"), "primary", function () { ST = "ask"; GV = "terms"; paintSheet(); }, "tgAgain")]));
      try { s.querySelector("#tgAgain").focus({ preventScroll: true }); } catch (e) { }
      return;
    }
    s.appendChild(h("span.tg-chip", null, t("gate.chip")));
    s.appendChild(h("h2", null, t("gate.h")));
    s.appendChild(h("div.inv-tabs.tg-tabs", { role: "tablist", "aria-label": t("gate.h") }, [["short", "terms.p.short"], ["terms", "terms.p.terms"], ["privacy", "terms.p.privacy"]].map(function (x) {
      return h("button.inv-tab.tg-tab", { type: "button", role: "tab", "aria-selected": String(GV === x[0]), "data-g": x[0], onclick: function () {
        GV = x[0]; paintSheet(); try { V.querySelector('.tg-tab[aria-selected="true"]').focus({ preventScroll: true }); } catch (e) { }
      } }, t(x[1]));
    })));
    var rd = h("div.tg-read", { role: "tabpanel", tabindex: "0" });
    if (GV === "short") { rd.appendChild(shorts("tg-short")); rd.appendChild(h("p.tg-more.tg-moreIn", null, t("gate.more"))); }
    else rd.appendChild(doc(GV));
    s.appendChild(rd);
    s.appendChild(h("p.tg-more", null, t("gate.kept", { v: T.version() })));
    var cb = h("input#tgTick", { type: "checkbox" }); cb.checked = TICK;
    s.appendChild(h("label.tg-tick", { for: "tgTick" }, [cb, h("span", null, t("gate.tick"))]));
    var agr = key(t("gate.agree"), "primary", agree, "tgAgree"); agr.disabled = !TICK;
    cb.addEventListener("change", function () { TICK = cb.checked; agr.disabled = !TICK; });
    s.appendChild(h("div.tg-row", null, [key(t("gate.decline"), "", function () { ST = "no"; paintSheet(); }, "tgDecline"), agr]));
    try { (V.querySelector('.tg-tab[aria-selected="true"]') || rd).focus({ preventScroll: true }); } catch (e) { }
  }
  function agree() {
    if (!TICK) return;
    MEMO = DATA.version.en;
    U.prefSet("terms", JSON.stringify({ v: DATA.version.en, at: Date.now(), build: E.BUILD && E.BUILD.number }));
    closeSheet(); T.repaint();
  }
  /* back to the welcome door: the books close if they were open; the door's Refresh and Reset are there (Build 7) */
  function back() {
    closeSheet(); seenDoor = true;
    if (E.books && E.books.isOpen) E.books.lock("terms");
    else if (E.door && E.door.show) E.door.show("").catch(function (e) { console.error(e); });
  }
  /* asked once the welcome door has opened: over the sign-in, the set-up, the practice store, joining or restoring */
  function check() {
    var app = document.getElementById("app");
    if (!app) return;
    if (atDoor()) { seenDoor = true; return; }
    if (V || !seenDoor || !app.firstChild || !T.need()) return;
    ST = "ask"; GV = "short"; TICK = false; openSheet();
  }
  T.check = check;
  T.gate = { need: T.need, agreed: T.agreed, record: rec, open: function () { ST = "ask"; GV = "short"; TICK = false; openSheet(); }, close: closeSheet };
  function watch() {
    var app = document.getElementById("app");
    if (!app) { setTimeout(watch, 200); return; }
    try { new MutationObserver(function () { setTimeout(check, 0); }).observe(app, { childList: true }); } catch (e) { }
    setInterval(function () { if (!V) check(); }, 3000);
    check();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
})();
