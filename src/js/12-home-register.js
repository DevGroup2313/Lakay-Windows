/* EMPORIUM | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Home (the day at a glance) and the Register (search or scan, the ticket, cash, the receipt). */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui, money = U.money;

  /* A figure in the ledger: a small caps label (with its emoji) over a serif number. */
  function stat(label, value, tone, id, emoji) {
    return h("div.stat" + (tone ? "." + tone : ""), id ? { id: id } : null, [h("span.stat-label", null, [emoji ? ui.emo(emoji) : null, label]), h("span.stat-value", null, value)]);
  }
  ui.stat = stat;
  ui.capsLabel = function (emoji, text) { return h("p.label-caps", null, [emoji ? ui.emo(emoji) : null, text]); };

  /* ---------- Home (Builds 12 to 14): the shell's own colours, worn as Ingenium and Carpe Diem wear theirs ----------
     The Home is made of the colours of Lakay's mark, on white slabs: the welcome, with the mark standing alone in its
     own depth and motion and the shell's spiral engraved faintly around it; the day's figures rolling into place on
     pearl drums in a pearl card touched with periwinkle; the counter's three keys, which travel down when pressed; the
     day's ledger on ruled paper; what needs seeing to; the latest sales on a receipt roll; and the rooms as drawers with
     enamel jewels. Calm and "reduce motion" hold all of it still (room-home.css). */
  function hourLabel(hr) {
    try { return new Date(2000, 0, 1, hr).toLocaleTimeString(E.lang === "ht" ? "fr" : E.lang, { hour: "numeric" }); } catch (e) { return String(hr); }
  }
  ui.rooms.home = function (main) {
    var st = B.state(), today = U.dayKey(), r = B.report(today, today), stock = B.stockSummary(), practice = B.mode === "practice";
    var hr = new Date().getHours(), greet = hr < 12 ? "home.morning" : hr < 18 ? "home.afternoon" : "home.evening";
    var me = B.user, staff = !B.isOwner();
    var sealKey = ui.crestKey(88, { cls: "hx-seal-key", id: "heroCrest", rise: true, title: t("crest.press") });
    main.appendChild(h("section.hm.ct", { "aria-label": t("room.home") }, [
      hero(st, r, stock, me, staff, practice, greet, sealKey),
      keysRow(staff),
      strip(st, me, staff, practice),
      ledger(r),
      h("div.hm-pair", null, [needs(stock, staff, practice), latest(st)]),
      rooms(st, r, stock)]));
    /* the drums roll to the day's figures, the columns rise to the hours' takings (both stay still in Calm) */
    var strips = main.querySelectorAll(".ct-strip[data-d]"), bars = main.querySelectorAll(".hm-bar[data-pct]");
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      Array.prototype.forEach.call(strips, function (x, i) { x.style.transitionDelay = (i % 9) * 70 + "ms"; x.style.transform = "translateY(" + (-10 * Number(x.getAttribute("data-d"))) + "%)"; });
      Array.prototype.forEach.call(bars, function (b) { b.style.height = b.getAttribute("data-pct") + "%"; });
    }); });
  };

  /* The engraving across the hero: the shell's own spiral (r = a·e^(b·θ), the curve a nautilus grows along), drawn
     eighteen times each way around the mark so that the lines cross as a guilloche does, with three fine rings. */
  function engraving() {
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "-150 -150 300 300"); svg.setAttribute("class", "ct-engr");
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    function el(name, attrs) { var n = document.createElementNS(ns, name); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; }
    for (var turn = -1; turn <= 1; turn += 2) for (var k = 0; k < 18; k++) {
      var d = "", start = k * Math.PI / 9;
      for (var i = 0; i <= 160; i++) {
        var th = i * 0.1, r = 3 * Math.exp(0.17 * th), a = start + turn * th;
        if (r > 212) break;
        d += (i ? "L" : "M") + (r * Math.cos(a)).toFixed(1) + " " + (r * Math.sin(a)).toFixed(1);
      }
      svg.appendChild(el("path", { d: d }));
    }
    [46, 74, 108].forEach(function (r) { svg.appendChild(el("circle", { r: r, "class": "ring" })); });
    return svg;
  }

  /* a figure on the register's drums: each digit on its own drum, which rolls from 0 to its digit */
  function drums(text) {
    var n = String(text).replace(/[^0-9]/g, "").length;
    var box = h("span.ct-drums" + (n > 9 ? ".longer" : n > 7 ? ".long" : ""), { "aria-hidden": "true" });
    String(text).split("").forEach(function (ch) {
      if (/[0-9]/.test(ch)) {
        var strip = h("span.ct-strip", { "data-d": ch });
        for (var d = 0; d <= 9; d++) strip.appendChild(h("span", null, String(d)));
        box.appendChild(h("span.ct-cell", null, strip));
      } else box.appendChild(h("span.ct-sep", null, ch));
    });
    return box;
  }
  function readout(id, emoji, label, value, text, tone, big) {
    return h("div.ct-read.hx-gauge" + (tone ? "." + tone : "") + (big ? ".big" : ""), { id: id, "data-value": String(value) }, [
      h("span.g-label", null, [ui.emo(emoji), label]),
      h("span.g-value", null, [drums(text), h("span.sr-only", null, text)])]);
  }

  /* the register: the mark, the greeting, a few live facts, and the window of drums */
  function chip(tone, emoji, text) { return h("li.hm-chip" + (tone ? "." + tone : ""), null, [ui.emo(emoji), h("span", null, text)]); }
  function hero(st, r, stock, me, staff, practice, greet, sealKey) {
    var now = new Date(), onClock = B.onClock(), todayKey = U.dayKey();
    var last = st.sales.filter(function (s) { return s.status === "completed" && s.day === todayKey; }).slice(-1)[0];
    var chips = [
      last ? chip(null, "🕰️", t("home.chipLast", { t: ui.time(last.at) })) : chip(null, "🧾", t("home.chipNoSale")),
      !staff || B.can("team") ? chip(onClock.length ? "on" : null, "👥", t("home.chipClock", { n: onClock.length })) : null];
    var window_ = h("div.ct-window", { "aria-label": t("home.today") }, [
      readout("hxTaken", "💵", t("home.takenToday"), r.gross, money(r.gross), null, true),
      h("div.ct-reads", null, [
        readout("hxSales", "🧾", t("home.salesToday"), r.count, String(r.count)),
        B.can("costs") ? readout("hxProfit", "📈", t("home.profitToday"), r.profit, money(r.profit), r.profit < 0 ? "bad" : "good") : readout("hxOnClock", "🕘", t("clock.nowH"), onClock.length, String(onClock.length)),
        readout("hxLow", "📦", t("home.lowStock"), stock.low.length, String(stock.low.length), stock.low.length ? "warn" : null)])]);
    return h("header.hm-hero.ct-hero", null, [
      engraving(),
      h("span.ct-nacre", { "aria-hidden": "true" }),
      h("div.ct-intro", null, [
        h("div.ct-mark", null, sealKey),
        h("div.ct-words", null, [
          h("div.hx-eyebrow", null, [h("h1", null, E.appName()), h("span.hx-date", null, E.fmtDate(now, "long"))]),
          h("p.hm-hello", null, practice && !staff ? t("home.helloPractice") : t(greet, { name: me.name || "" })),
          h("p.hm-lede", null, practice ? t("home.ledePractice") : t("home.ledeReal")),
          h("ul.hm-chips", { "aria-label": t("home.chipsH") }, chips)])]),
      window_]);
  }

  /* the counter's three keys: enamel, pearl and blush pearl, each in a champagne rim */
  function act(id, emoji, title, hint, fn, tone) {
    return h("button.ct-key." + tone, { type: "button", id: id, onclick: fn }, [
      h("span.ct-key-face", null, [h("span.ct-key-emo", { "aria-hidden": "true" }, emoji), h("span.ct-key-t", null, [h("b", null, title), h("small", null, hint)])])]);
  }
  function keysRow(staff) {
    return h("nav.ct-keys", { "aria-label": t("home.actsH") }, [
      B.can("sell") ? act("homeSale", "🛒", t("home.newSale"), t("home.saleHint"), function () { if (E.rail && E.rail.toSale) E.rail.toSale(); else ui.go("register"); }, "enamel") : null,
      B.can("receive") ? act("homeReceive", "🚚", t("home.receive"), t("home.receiveHint"), function () { ui.inventoryMode = "receive"; ui.go("inventory"); }, "pearl") : null,
      act("homeFind", "🔎", t("home.find"), t("home.findHint"), function () { var b = document.getElementById("rail-find"); if (E.rail && b) E.rail.press("find", b); else ui.go("inventory"); }, "blush")]);
  }

  /* one slim strip for what comes next: the first steps, your shift, or the practice store */
  function strip(st, me, staff, practice) {
    if (staff) {
      var sh = B.openShift(me.id);
      return h("section.hm-strip.ct-strip-bar", { "aria-label": t("home.yourShift") }, [
        h("span.hm-strip-emo", { "aria-hidden": "true" }, sh ? (B.onBreak(sh) ? "☕" : "🟢") : "🕘"),
        h("div.hm-strip-t", null, [h("b", null, t("home.yourShift")), h("span#heroStepNote", null, sh ? (B.onBreak(sh) ? t("clock.onBreak", { t: E.fmtTime(new Date(sh.breaks[sh.breaks.length - 1].from)) }) : t("clock.onSince", { t: E.fmtTime(new Date(sh.in)), d: ui.dur(B.shiftMs(sh)) })) : t("clock.off"))]),
        h("div.hm-strip-k", null, [h("button.hx-btn", { type: "button", onclick: ui.statusPanel }, [ui.emo(sh ? "☕" : "🕘"), sh ? t("home.clockKeys") : t("clock.in")]),
          h("button.hx-btn", { type: "button", onclick: function () { ui.go("team"); } }, [ui.emo("🗓️"), t("team.mine")])])]);
    }
    if (practice) {
      return h("section.hm-strip.ct-strip-bar.practice", { "aria-label": t("practice.pill") }, [
        h("span.hm-strip-emo", { "aria-hidden": "true" }, "🧪"),
        h("div.hm-strip-t", null, [h("b", null, t("practice.pill")), h("span#heroStepNote", null, t("home.practiceNext"))]),
        h("div.hm-strip-k", null, [h("button.hx-btn.pri#heroNext", { type: "button", onclick: function () { E.door.startReal("app"); } }, [ui.emo("🏠"), t("practice.real")]),
          h("button.hx-btn", { type: "button", onclick: function () { ui.go("guide"); } }, [ui.emo("📖"), t("home.readGuide")])])]);
    }
    var steps = firstStepList(st), done = steps.filter(function (x) { return x[1]; }).length, next = steps.filter(function (x) { return !x[1]; })[0];
    if (!next) return null;
    return h("section.hm-strip.ct-strip-bar", { "aria-label": t("home.stepsH") }, [
      h("span.hm-strip-emo", { "aria-hidden": "true" }, "🧭"),
      h("div.hm-strip-t", null, [h("b", null, t("home.stepsH")), h("span#heroStepNote", null, t("home.stepOf", { n: done + 1, of: steps.length, what: t(next[0]) }))]),
      h("ol.hm-steps", { "aria-label": t("home.stepsN", { n: done, of: steps.length }) }, steps.map(function (x, i) {
        return h("li" + (x[1] ? ".done" : x === next ? ".now" : ""), { title: t(x[0]) }, [h("span.hm-step-dot", { "aria-hidden": "true" }, x[1] ? "✓" : String(i + 1)), h("span.hm-step-l", null, t(x[0]))]);
      })),
      h("div.hm-strip-k", null, [h("button.hx-btn.pri#heroNext", { type: "button", onclick: next[2] }, [ui.emo("➡️"), t(next[0])])])]);
  }

  /* the day's ledger: the takings of each hour on ruled paper, and three lines of the day in brief */
  function ledger(r) {
    var avg = r.count ? Math.round(r.gross / r.count) : 0;
    return h("section.ct-ledger", { "aria-label": t("home.today") }, [
      h("div.hx-sech", null, [h("h2", null, t("home.ledgerH")), h("p", null, t("home.todayP")),
        B.can("reports") ? h("button.hx-btn.quiet", { type: "button", onclick: function () { E.reports.period = "today"; ui.go("reports"); } }, t("home.seeAll")) : null]),
      h("div.ct-ledger-body", null, [hours(r),
        h("dl.ct-brief", null, [
          h("div", null, [h("dt", null, t("home.itemsSold")), h("dd", null, String(r.items))]),
          h("div", null, [h("dt", null, t("home.avgSale")), h("dd", null, money(avg))]),
          h("div", null, [h("dt", null, t("home.hoursOpen")), h("dd", null, String(r.byHour.filter(function (x) { return x.count; }).length))])])])]);
  }
  /* A single series of columns, one per hour of the store's day, from 8 in the morning (or the first sale) to 7 in the
     evening (or the last sale, or now). Each column answers a hover, a press or the keyboard with its takings and its
     number of sales; the busiest hour is named above; a table carries the same figures for screen readers. */
  function hours(r) {
    var nowH = new Date().getHours(), first = 24, lastH = -1, i;
    for (i = 0; i < 24; i++) if (r.byHour[i].count) { if (i < first) first = i; lastH = i; }
    var from = Math.min(8, first), to = Math.min(23, Math.max(19, lastH, nowH)), max = 0, peak = -1;
    for (i = from; i <= to; i++) if (r.byHour[i].gross > max) { max = r.byHour[i].gross; peak = i; }
    var fig = h("figure.hm-hours", { "aria-label": t("home.hoursH") });
    var tip = h("div.hm-tip", { "aria-hidden": "true", hidden: true });
    var bars = h("div.hm-bars");
    function hide() { tip.hidden = true; }
    for (i = from; i <= to; i++) (function (hh) {
      var x = r.byHour[hh], pct = max ? Math.max(x.gross ? 3 : 0, Math.round(x.gross / max * 100)) : 0, n = hh - from;
      var said = x.count === 1 ? t("home.oneSale") : t("home.nSales", { n: x.count });
      var bar = h("span.hm-bar", { "data-pct": String(pct) });
      var col = h("button.hm-col" + (hh === nowH ? ".now" : "") + (hh === peak ? ".peak" : ""), { type: "button", "aria-label": t("home.hoursTip", { h: hourLabel(hh), m: money(x.gross), n: x.count }) },
        [h("span.hm-plot", null, bar), h("span.hm-hl" + (n % 2 === 0 ? ".k2" : "") + (n % 3 === 0 ? ".k3" : "") + (Math.abs(hh - nowH) === 1 ? ".near" : ""), { "aria-hidden": "true" }, hourLabel(hh))]);
      function show() {
        U.clear(tip); tip.appendChild(h("b", null, money(x.gross))); tip.appendChild(h("span", null, said + " · " + hourLabel(hh))); tip.hidden = false;
        var cb = col.getBoundingClientRect(), fb = fig.getBoundingClientRect(), half = tip.offsetWidth / 2, left = cb.left - fb.left + cb.width / 2;
        tip.style.left = Math.max(half + 4, Math.min(fb.width - half - 4, left)) + "px";
      }
      col.addEventListener("pointerenter", show); col.addEventListener("focus", show); col.addEventListener("click", show);
      col.addEventListener("pointerleave", hide); col.addEventListener("blur", hide);
      bars.appendChild(col);
    })(i);
    fig.appendChild(h("figcaption", null, [h("span", null, t("home.hoursH")),
      peak >= 0 ? h("span.hm-peak", null, t("home.peak", { h: hourLabel(peak), m: money(max) })) : h("span.hm-peak", null, t("home.hoursNone"))]));
    fig.appendChild(bars); fig.appendChild(tip);
    var rows = [];
    for (i = from; i <= to; i++) if (r.byHour[i].count) rows.push(h("tr", null, [h("th", { scope: "row" }, hourLabel(i)), h("td", null, money(r.byHour[i].gross)), h("td", null, String(r.byHour[i].count))]));
    fig.appendChild(h("table.sr-only", null, [h("caption", null, t("home.hoursH")),
      h("thead", null, h("tr", null, [h("th", { scope: "col" }, t("home.hourCol")), h("th", { scope: "col" }, t("home.takenCol")), h("th", { scope: "col" }, t("home.salesCol"))])),
      h("tbody", null, rows)]));
    return fig;
  }

  /* what needs seeing to now, as ledger entries, each with its key */
  function need(emoji, title, sub, tone, key) {
    return h("li.hm-need" + (tone ? "." + tone : ""), null, [h("span.hm-need-emo", { "aria-hidden": "true" }, emoji), h("div.hm-need-t", null, [h("b", null, title), h("small", null, sub)]),
      key ? h("button.hx-btn.hm-need-k", { type: "button", onclick: key[1] }, key[0]) : null]);
  }
  function needs(stock, staff, practice) {
    var list = [], seen = {};
    stock.low.concat(stock.negative || []).filter(function (it) { if (seen[it.id] || it.archived) return false; seen[it.id] = 1; return true; })
      .sort(function (a, b) { return a.stock - b.stock; }).slice(0, 4).forEach(function (it) {
        list.push(need(ui.catEmo(it.cat), it.name, it.stock <= 0 ? t("home.attnOut") : t("home.attnLow", { n: it.stock, r: it.reorderAt }), it.stock <= 0 ? "bad" : "warn",
          B.can("receive") ? [t("home.receiveShort"), function () { E.inventory.receive(it.id); }] : [t("home.open"), function () { ui.go("inventory"); }]));
      });
    var end = new Date(); end.setHours(23, 59, 59, 999);
    var pad = B.pad ? B.pad() : { reminders: [] };
    (pad.reminders || []).filter(function (x) { return !x.done && Date.parse(x.at) <= end.getTime(); }).sort(function (a, b) { return a.at < b.at ? -1 : 1; }).slice(0, 3).forEach(function (x) {
      list.push(need("🔔", x.text, t("home.attnRem", { t: ui.time(x.at) }), Date.parse(x.at) <= Date.now() ? "warn" : null,
        [t("home.open"), function () { ui.alertsPanel(); }]));
    });
    if (!staff && !practice) {
      var lastB = U.prefGet("lastBackup", ""), days = lastB ? Math.floor((Date.now() - Date.parse(lastB)) / 86400000) : null;
      if (days === null || days >= 7) list.push(need("💾", days === null ? t("home.attnBackupNone") : t("home.attnBackupOld", { n: days }), t("home.attnBackupSub"), days === null ? "warn" : null,
        [t("home.backupKey"), function () { ui.go("settings"); }]));
    }
    return h("section.hm-needs", { "aria-label": t("home.attnH") }, [
      h("div.hx-sech", null, [h("h2", null, [ui.emo("📌"), t("home.attnH")]), h("p", null, t("home.attnP"))]),
      list.length ? h("ul.hm-list", null, list) : h("div.hm-calm", null, [h("span.hm-calm-emo", { "aria-hidden": "true" }, "🌤️"), h("p", null, t("home.attnNone"))])]);
  }

  /* the latest sales on a receipt roll; a press shows the receipt */
  function latest(st) {
    var recent = st.sales.filter(function (s) { return s.status === "completed"; }).slice(-5).reverse();
    return h("section.hm-sales", { "aria-label": t("home.recentTitle") }, [
      h("div.hx-sech", null, [h("h2", null, [ui.emo("🧾"), t("home.recentTitle")]),
        B.can("reports") ? h("button.hx-btn.quiet", { type: "button", onclick: function () { ui.go("reports"); } }, t("home.seeAll")) : null]),
      h("div.ct-tape", null, [
        h("p.ct-tape-head", { "aria-hidden": "true" }, [h("b", null, E.appName().toUpperCase()), h("span", null, E.fmtDate(new Date(), "long"))]),
        recent.length ? h("ul.hm-list.ct-tape-lines", null, recent.map(function (x) {
          var who = st.users[x.by];
          return h("li", null, h("button.hm-sale", { type: "button", onclick: function () { E.register.showReceipt(x); } }, [
            h("span.hm-sale-no", null, x.no), h("span.hm-sale-t", null, [h("span", null, ui.time(x.at)), who ? h("small", null, who.name) : null]),
            h("span.ct-lead", { "aria-hidden": "true" }), h("span.hm-sale-m.num", null, money(x.total))]));
        })) : h("div.hm-calm", null, [h("span.hm-calm-emo", { "aria-hidden": "true" }, "🧾"), h("p", null, t("home.recentNone")),
          B.can("sell") ? h("button.hx-btn", { type: "button", onclick: function () { ui.go("register"); } }, t("home.newSale")) : null])])]);
  }

  /* the rooms, as a cabinet of drawers with champagne label plates */
  function rooms(st, r, stock) {
    var items = Object.keys(st.items).filter(function (k) { return !st.items[k].archived; }).length, last = U.prefGet("lastBackup", "");
    var keys = [
      ["register", "register", t("km.salesToday", { n: r.count }), null],
      ["inventory", "box", t("km.items", { n: items, low: stock.low.length }), stock.low.length ? "warn" : null],
      ["reports", "chart", t("km.taken", { m: money(r.gross) }), null],
      ["team", "people", t("km.onClock", { n: B.onClock().length }), null],
      ["guide", "book", t("km.chapters", { n: E.guideCount ? E.guideCount() : 15 }), null],
      ["settings", "gear", last ? t("km.backup", { d: E.fmtDate(new Date(last), "short") }) : t("km.noBackup"), last ? null : "warn"],
      ["studio", "edit", t("km.studio"), null]];
    return h("section.hm-rooms", { "aria-label": t("home.roomsH") }, [
      h("div.hx-sech", null, [h("h2", null, t("home.roomsH")), h("p", null, t("home.roomsP"))]),
      h("div.hm-tiles.ct-cabinet", null, keys.filter(function (k) { return ui.allowed(k[0]); }).map(function (k) {
        return h("button.hm-tile.ct-drawer", { type: "button", "data-room": k[0], onclick: function () { ui.go(k[0]); } }, [
          h("span.ct-plate", null, [h("span.ct-plate-ico", null, U.icon(k[1])), h("span.hm-tile-t", null, [h("b", null, t("room." + k[0])), h("small" + (k[3] ? "." + k[3] : ""), null, k[2])])]),
          h("span.ct-pull", { "aria-hidden": "true" })]);
      }))]);
  }
  function quickKey(emoji, key, fn, kind) { return h("button.key" + (kind ? "." + kind : ""), { type: "button", onclick: fn }, [ui.emo(emoji), t(key)]); }
  ui.quickKey = quickKey;



  function firstStepList(st) {
    var items = Object.keys(st.items).length;
    return [
      ["first.tax", (st.settings.taxes || []).length > 0 || U.prefGet("taxSkipped", "0") === "1", function () { ui.go("settings"); }],
      ["first.items", items > 0, function () { ui.go("inventory"); setTimeout(function () { E.inventory.add(); }, 30); }],
      ["first.receive", st.moves.some(function (m) { return m.kind === "receive"; }) || Object.keys(st.items).some(function (k) { return st.items[k].stock > 0; }), function () { ui.inventoryMode = "receive"; ui.go("inventory"); }],
      ["first.sale", st.sales.length > 0, function () { ui.go("register"); }],
      ["first.backup", !!U.prefGet("lastBackup", ""), function () { ui.go("settings"); }]];
  }

  /* ---------- the Register ---------- */
  var R = E.register = {};
  var ticket = { lines: [] };
  R.ticket = ticket;
  var view = null, fresh = null, lastTotal = null;

  ui.rooms.register = function (main) {
    var st = B.state();
    var cat = "all";
    var search = ui.input({ id: "regSearch", type: "search", placeholder: t("reg.searchPh"), "aria-label": t("reg.search"), enterkeyhint: "enter" });
    var chips = h("div.chips", { role: "group", "aria-label": t("inv.category") });
    var results = h("div.products", { id: "regResults" });
    var lines = h("ul.ticket-lines", { id: "ticketLines", "aria-live": "polite" });
    var totals = h("div.totals", { id: "ticketTotals" });
    var payKey = h("button.key.primary.lg", { type: "button", id: "takeCash", onclick: takeCash }, [ui.emo("💵"), t("reg.takeCash")]);
    view = { search: search, results: results, lines: lines, totals: totals, payKey: payKey };

    [["all", t("all")]].concat(ui.cats().map(function (c) { return [c.id, ui.catName(c)]; })).forEach(function (c) {
      chips.appendChild(h("button.chip", { type: "button", "aria-pressed": String(c[0] === cat), "data-dept": c[0], onclick: function (e) {
        cat = c[0]; Array.prototype.forEach.call(chips.children, function (x) { x.setAttribute("aria-pressed", String(x === e.currentTarget)); }); draw();
      } }, [c[0] === "all" ? h("span.dept-jewel.xs", { "aria-hidden": "true" }, U.icon("box")) : ui.deptIcon(c[0], "xs"), c[1]]));
    });
    /* the finder (05-find.js) answers at once however many items there are; the first 80 are drawn */
    function matches() { return E.find.search({ q: search.value, cat: cat, show: "active" }); }
    function draw() {
      U.clear(results);
      var ids = matches();
      /* the department of money transfers and top-ups records one here, at the counter, apart from the sale */
      if (cat === "services" && B.can("sell")) results.appendChild(h("button.product.svc-product#regRecordSvc", { type: "button", onclick: function () { E.inventory.recordService(); } }, [
        h("span.p-emo", { "aria-hidden": "true" }, ui.deptIcon("services", "sm")), h("span.p-name", null, t("svc.recordHere")), h("span.p-stock", null, t("svc.recordHereHint"))]));
      if (!ids.length) { if (cat !== "services") results.appendChild(h("p.muted.empty", null, Object.keys(st.items).length ? t("reg.noMatch") : t("reg.noItems"))); return; }
      ids.slice(0, 80).forEach(function (id) {
        var it = st.items[id], low = E.find.low(it);
        results.appendChild(h("button.product", { type: "button", "data-id": it.id, onclick: function (e) { add(it.id); ui.plusOne(e.currentTarget); search.focus(); } }, [
          h("span.p-emo", { "aria-hidden": "true" }, ui.deptIcon(it.cat, "sm")),
          h("span.p-name", null, it.name), h("span.p-price", null, money(it.price)),
          h("span.p-stock" + (it.stock <= 0 ? ".bad" : low ? ".warn" : ""), null, t("inv.inStock", { n: it.stock }))]));
      });
      if (ids.length > 80) results.appendChild(h("p.muted", null, t("reg.more", { n: ids.length - 80 })));
    }
    /* a code, typed or scanned into the search: its item goes onto the ticket; a code no item has offers to add it */
    function byCode(code) {
      var ids = E.find.byCode(code).filter(function (id) { return !st.items[id].archived; });
      if (ids.length) { add(ids[0]); if (E.sound) E.sound.play("scan"); return true; }
      return false;
    }
    search.addEventListener("input", U.debounce(draw, 70));
    search.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var raw = search.value.trim(); if (!raw) return;
      if (byCode(raw)) { search.value = ""; draw(); return; }
      var list = matches();
      if (list.length === 1) { add(list[0]); search.value = ""; draw(); }
      else if (!list.length) { if (/^[0-9A-Za-z-]{4,}$/.test(raw) && /\d/.test(raw)) { E.scan.unknown(raw); search.value = ""; draw(); } else ui.toast(t("reg.notFound", { q: raw }), "bad"); }
    });
    var cam = E.scan.cameraKey(function (code) { if (!byCode(code)) E.scan.unknown(code); });
    /* a scanner that types, with no field in focus: the item goes onto the ticket */
    ui.onScan = function (code) { if (!B.can("sell")) return false; if (!byCode(code)) E.scan.unknown(code); return true; };

    main.appendChild(ui.roomHead("room.register", "tip.register", [h("span.kbd-hint", null, t("reg.keys"))]));
    if (B.mode === "practice") main.appendChild(h("div.banner.practice", null, [ui.emo("🧪"), h("span", null, t("reg.practiceBanner")),
      h("button.key.sm", { type: "button", onclick: function () { E.door.startReal("app"); } }, t("practice.real"))]));
    main.appendChild(h("div.register", null, [
      h("section.reg-pick.card", { "aria-label": t("reg.pick") }, [h("div.search-row", null, [U.icon("search"), search, cam]), chips, results]),
      h("aside.reg-ticket.card", { "aria-label": t("reg.ticket") }, [
        h("div.card-head", null, [h("h2", null, [ui.emo("🧾"), t("reg.ticket")]), h("span.kbd-hint", null, ui.dateLong(new Date()))]),
        lines, totals, h("div.pay-row", null, [h("button.key.sm", { type: "button", id: "clearTicket", onclick: clearTicket }, [ui.emo("🧹"), t("reg.clear")]), payKey])])]));
    draw(); drawTicket();
    setTimeout(function () { search.focus(); }, 50);
  };

  function add(id, n) {
    var st = B.state(), it = st.items[id]; if (!it) return;
    var l = ticket.lines.find(function (x) { return x.itemId === id; });
    if (l) l.qty += (n || 1); else ticket.lines.push({ itemId: id, qty: n || 1 });
    var inTicket = (l ? l.qty : (n || 1));
    fresh = l ? null : id;
    if (it.stock - inTicket < 0) ui.toast(t("reg.overStock", { name: it.name, n: Math.max(0, it.stock) }), "warn");
    drawTicket();
  }
  R.add = add;
  function setQty(id, q) {
    var l = ticket.lines.find(function (x) { return x.itemId === id; }); if (!l) return;
    if (!(q >= 1)) ticket.lines = ticket.lines.filter(function (x) { return x !== l; }); else l.qty = Math.min(9999, Math.floor(q));
    drawTicket();
  }
  function drawTicket() {
    if (!view || !document.body.contains(view.lines)) return;
    var st = B.state(), tk = B.priceTicket(ticket.lines);
    U.clear(view.lines); U.clear(view.totals);
    if (!tk.lines.length) view.lines.appendChild(h("li.empty.muted", null, t("reg.emptyTicket")));
    tk.lines.forEach(function (l) {
      var it = st.items[l.itemId];
      var qty = h("input.qty", { type: "number", min: "1", max: "9999", value: String(l.qty), "aria-label": t("reg.qtyOf", { name: l.name }), inputmode: "numeric" });
      qty.addEventListener("change", function () { setQty(l.itemId, parseInt(qty.value, 10)); });
      view.lines.appendChild(h("li.tline" + (l.itemId === fresh ? ".fresh" : ""), null, [
        h("div.t-main", null, [h("span.t-name", null, l.name), h("span.t-unit.muted", null, money(l.price) + (l.taxId ? " · " + t("reg.taxed") : "")),
          it && it.stock - l.qty < 0 ? h("span.t-warn", null, [U.icon("warn"), t("reg.onlyN", { n: Math.max(0, it.stock) })]) : null]),
        h("div.t-qty", null, [
          h("button.icon-key", { type: "button", "aria-label": t("reg.less", { name: l.name }), onclick: function () { setQty(l.itemId, l.qty - 1); } }, U.icon("minus")),
          qty,
          h("button.icon-key", { type: "button", "aria-label": t("reg.more1", { name: l.name }), onclick: function () { setQty(l.itemId, l.qty + 1); } }, U.icon("plus"))]),
        h("span.t-amount.num", null, money(l.amount)),
        h("button.icon-key.danger", { type: "button", "aria-label": t("reg.remove", { name: l.name }), onclick: function () { setQty(l.itemId, 0); } }, U.icon("x"))]));
    });
    view.totals.appendChild(h("div.trow", null, [h("span", null, t("reg.subtotal")), h("span.num", { id: "tSubtotal" }, money(tk.subtotal))]));
    tk.taxes.forEach(function (x) { view.totals.appendChild(h("div.trow", null, [h("span", null, x.name + " (" + U.rateText(x.rate) + ")"), h("span.num", null, money(x.tax))])); });
    var tot = h("span.num", { id: "tTotal" }, money(tk.total));
    view.totals.appendChild(h("div.trow.total", null, [h("span", null, t("reg.total")), tot]));
    if (lastTotal !== null && lastTotal !== tk.total && !ui.still()) tot.classList.add("bump");
    lastTotal = tk.total; fresh = null;
    view.payKey.disabled = !tk.lines.length;
  }
  function clearTicket() {
    if (!ticket.lines.length) return;
    ui.confirm(t("reg.clearT"), t("reg.clearP"), t("reg.clearYes"), "danger").then(function (ok) { if (ok) { ticket.lines = []; R.ticket = ticket; drawTicket(); view.search.focus(); } });
  }

  /* ---------- taking payment (Build 16): cash, a card, Apple Pay, Google Pay, another way the owner accepts, or in parts ----------
     The store's own card machine charges the card; Lakay says how much to charge and records what was taken. Cash is
     chosen first, so a cash sale is as quick as ever: the amount received, the change, done. */
  R.payName = function (p) {
    if (p.method === "other") return p.name || t("pay.m.other");
    return t("pay.m." + p.method) + (p.last4 ? " ···· " + p.last4 : "");
  };
  var PAY_EMO = { cash: "💵", card: "💳", applepay: "📱", googlepay: "📱", other: "🔁" };
  function takeCash() {
    var tk = B.priceTicket(ticket.lines); if (!tk.lines.length) return;
    var prefs = B.payPrefs(), parts = [], method = "cash", d;
    var ways = prefs.methods.filter(function (m) { return m !== "other" && B.PAY_METHODS.indexOf(m) >= 0; }).concat(prefs.others.length ? ["other"] : []);
    function paid() { return parts.reduce(function (a, p) { return a + (p.method === "cash" ? p.applied : p.amount); }, 0); }
    function left() { return tk.total - paid(); }
    /* what is left to pay, shown once a part has been taken */
    var leftN = h("strong.num#payLeftN"), leftRow = h("p.due.pay-left#payLeft", null, [h("span", null, t("pay.left")), leftN]);
    var partsList = h("ul.pay-parts#payParts", { "aria-live": "polite" });
    var keys = h("div.pay-ways#payWays", { role: "radiogroup", "aria-label": t("pay.how") });
    ways.forEach(function (m) {
      keys.appendChild(h("button.pay-way", { type: "button", role: "radio", "aria-checked": String(m === method), "data-m": m, id: "payWay-" + m, onclick: function () { choose(m); } },
        [ui.emo(PAY_EMO[m]), h("span", null, t("pay.m." + m))]));
    });
    /* cash */
    var input = ui.input({ id: "cashIn", inputmode: "decimal", class: "money-in", "aria-label": t("cash.received") });
    var changeN = h("p.change", { id: "cashChange", "aria-live": "polite" });
    var quick = h("div.quick-cash", { role: "group", "aria-label": t("cash.quick") });
    function quickKeys() {
      U.clear(quick);
      var due = left(), amounts = [due], whole = Math.ceil(due / 100) * 100;
      if (whole !== due) amounts.push(whole);
      [500, 1000, 2000, 5000, 10000].forEach(function (b) { if (b > whole) amounts.push(b); });
      amounts.filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 6).forEach(function (v, i) {
        quick.appendChild(h("button.key.sm", { type: "button", onclick: function () { input.value = U.moneyPlain(v); update(); } }, i === 0 ? t("cash.exact") + " " + money(v) : money(v)));
      });
    }
    var cashPane = h("div.pay-pane#payCash", null, [quick, ui.field("cash.received", input), changeN]);
    /* a card, a phone, another way */
    var amount = ui.input({ id: "payAmount", inputmode: "decimal", class: "money-in" });
    var code = ui.input({ id: "payCode", maxlength: "40" }), last4 = ui.input({ id: "payLast4", inputmode: "numeric", maxlength: "4" });
    var name = ui.select(prefs.others.map(function (n) { return [n, n]; }), prefs.others[0] || "", { id: "payName" });
    var how = h("p.pay-how#payHow", { "aria-live": "polite" }), warnN = h("p.err#payWarn", { role: "alert" });
    var nameF = ui.field("pay.name", name), codeF = ui.field("pay.code", code, { required: prefs.askCode === "required", hint: t("pay.codeHint") }), last4F = ui.field("pay.last4", last4, { hint: t("pay.last4Hint") });
    var otherPane = h("div.pay-pane#payOther", null, [how, h("div.form-grid", null, [nameF, ui.field("pay.amount", amount, { required: true }), codeF, last4F]), warnN]);
    function choose(m) {
      method = m;
      Array.prototype.forEach.call(keys.children, function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-m") === m)); });
      cashPane.hidden = m !== "cash"; otherPane.hidden = m === "cash";
      nameF.hidden = m !== "other"; last4F.hidden = m !== "card" || prefs.askLast4 === "no"; codeF.hidden = m === "other" ? false : prefs.askCode === "no";
      codeF.querySelector("label").firstChild.textContent = t(m === "other" ? "pay.ref" : "pay.code");
      if (m === "cash") { quickKeys(); setTimeout(function () { try { input.focus(); } catch (e) { } }, 30); }
      else { amount.value = U.moneyPlain(left()); setTimeout(function () { try { amount.select(); } catch (e) { } }, 30); }
      update();
    }
    function current() {
      if (method === "cash") { var c = U.parseMoney(input.value); return c === null || c <= 0 ? null : { method: "cash", tendered: c }; }
      var a = U.parseMoney(amount.value); if (a === null || a <= 0) return null;
      var p = { method: method, amount: a, ref: code.value.trim() };
      if (method === "card" && last4.value.trim()) p.last4 = last4.value.trim();
      if (method === "other") p.name = name.value;
      return p;
    }
    function buttons(done, part) { var a = document.getElementById("cashDone"), b = document.getElementById("payPart"); if (a) a.disabled = !done; if (b) { b.disabled = !part; b.hidden = !part; } }
    function update() {
      var due = left(), p = current();
      leftN.textContent = money(due); leftRow.hidden = !parts.length;
      warnN.textContent = "";
      if (method === "cash") {
        var c = U.parseMoney(input.value);
        if (c === null) { changeN.textContent = input.value ? t("cash.notAmount") : ""; changeN.className = "change"; buttons(false, false); return; }
        if (c < due) { changeN.textContent = t("cash.short", { m: money(due - c) }); changeN.className = "change bad"; buttons(false, c > 0 && ways.length > 1); return; }
        changeN.textContent = t("cash.change", { m: money(c - due) }); changeN.className = "change good"; buttons(true, false); return;
      }
      how.textContent = method === "other" ? t("pay.howOther", { m: money(p ? p.amount : due), name: name.value }) : t("pay.howCard", { m: money(p ? p.amount : due), on: prefs.machine ? prefs.machine : t("pay.theMachine") });
      if (!p) { buttons(false, false); return; }
      if (B.cardNumberIn(code.value)) { warnN.textContent = t("pay.noCardNumber"); buttons(false, false); return; }
      if (p.last4 && !/^\d{4}$/.test(p.last4)) { warnN.textContent = t("pay.err.last4"); buttons(false, false); return; }
      if (method !== "other" && prefs.askCode === "required" && !p.ref) { buttons(false, false); return; }
      if (p.amount > due) { warnN.textContent = t("pay.err.over", { m: money(due) }); buttons(false, false); return; }
      buttons(p.amount === due, p.amount < due);
    }
    function drawParts() {
      U.clear(partsList);
      parts.forEach(function (p, i) {
        partsList.appendChild(h("li", null, [ui.emo(PAY_EMO[p.method]), h("span.pay-part-n", null, R.payName(p)), p.ref ? h("small.muted", null, t("pay.codeIs", { c: p.ref })) : null,
          h("span.num", null, money(p.method === "cash" ? p.applied : p.amount)),
          h("button.icon-key", { type: "button", "aria-label": t("pay.removePart"), title: t("pay.removePart"), onclick: function () { parts.splice(i, 1); drawParts(); choose(method); } }, U.icon("x"))]));
      });
      partsList.hidden = !parts.length;
    }
    /* one part now, the rest another way */
    function addPart() {
      var p = current(); if (!p) return false;
      if (p.method === "cash") { if (p.tendered >= left()) return false; p.applied = p.tendered; input.value = ""; }
      else { if (p.amount >= left()) return false; amount.value = ""; code.value = ""; last4.value = ""; }
      parts.push(p); drawParts();
      choose(p.method === "cash" ? (ways.indexOf("card") >= 0 ? "card" : ways.filter(function (w) { return w !== "cash"; })[0] || "cash") : "cash");
      return false;
    }
    function finish(btn) {
      var p = current(); if (!p) return false;
      var pays = parts.map(function (x) { var y = Object.assign({}, x); delete y.applied; return y; }).concat([p]);
      btn.disabled = true;
      B.completeSale(ticket.lines, pays).then(function (sale) {
        ticket.lines = []; d.close(); drawTicket(); ui.celebrate(); R.showReceipt(sale, true);
      }, function (e) {
        btn.disabled = false;
        var k = e && e.code;
        ui.toast(t(k === "short" ? "cash.shortErr" : k === "cardNumber" ? "pay.noCardNumber" : k === "code" ? "pay.err.code" : k === "over" ? "pay.err.overAll" : "door.problem"), "bad"); console.error(e);
      });
      return false;
    }
    input.addEventListener("input", update); amount.addEventListener("input", update); code.addEventListener("input", update); last4.addEventListener("input", update); name.addEventListener("change", update);
    [input, amount, code, last4].forEach(function (f) { f.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return; e.preventDefault();
      var a = document.getElementById("cashDone"), b = document.getElementById("payPart");
      if (a && !a.disabled) a.click(); else if (b && !b.disabled) b.click();
    }); });
    d = ui.dialog({ title: t("pay.title"), emoji: "💳", focus: "#cashIn", wide: ways.length > 1,
      body: [h("p.due", null, [h("span", null, t("cash.due")), h("strong.num", { id: "cashDue" }, money(tk.total))]), ways.length > 1 ? keys : null, partsList, leftRow, cashPane, otherPane],
      actions: [{ label: t("cancel") }, { label: t("pay.part"), id: "payPart", onClick: function () { return addPart(); } },
        { label: t("cash.complete"), kind: "primary", id: "cashDone", disabled: true, emoji: "✅", onClick: function (close, btn) { return finish(btn); } }] });
    drawParts(); choose("cash");
  }

  /* ---------- the receipt ---------- */
  R.receiptNode = function (s) {
    var st = B.state(), set = st.settings;
    return h("div.receipt", null, [
      h("div.r-head", null, [h("strong", null, set.storeName)].concat(E.receiptLines().map(function (x) { return h("span", null, x); }),
        [h("span", null, E.fmtDate(new Date(s.at), "short") + " " + E.fmtTime(new Date(s.at))), h("span", null, t("receipt.no") + " " + s.no)])),
      h("table.r-lines", null, h("tbody", null, s.lines.map(function (l) {
        return h("tr", null, [h("td", null, l.qty + " × " + l.name), h("td.num", null, money(l.amount))]);
      }))),
      h("table.r-totals", null, h("tbody", null, [
        h("tr", null, [h("td", null, t("reg.subtotal")), h("td.num", null, money(s.subtotal))])].concat(
        s.taxes.map(function (x) { return h("tr", null, [h("td", null, x.name + " (" + U.rateText(x.rate) + ")"), h("td.num", null, money(x.tax))]); }), [
        h("tr.r-total", null, [h("td", null, t("reg.total")), h("td.num", null, money(s.total))])].concat(
        /* each payment (Build 16): the card machine's approval code under a card or a phone; the cash received, then the change */
        [].concat.apply([], s.pay.map(function (p) {
          if (p.method === "cash") return [h("tr", null, [h("td", null, t("receipt.cash")), h("td.num", null, money(p.tendered))]), h("tr", null, [h("td", null, t("receipt.change")), h("td.num", null, money(p.change))])];
          return [h("tr.r-pay", null, [h("td", null, [R.payName(p), p.ref ? h("small.r-code", null, t("pay.codeIs", { c: p.ref })) : null]), h("td.num", null, money(p.amount))])];
        })))))),
      h("p.r-by", null, t("receipt.servedBy", { name: ui.userTag(s.by) })),
      set.receiptNote ? h("p.r-note", null, set.receiptNote) : null,
      h("p.r-thanks", null, E.thanks()),
      h("p.r-build", null, E.made())]);
  };
  R.showReceipt = function (s, fresh) {
    var cash = s.pay.filter(function (p) { return p.method === "cash"; })[0];
    ui.dialog({ title: fresh ? t("receipt.doneTitle") : t("receipt.title"), emoji: fresh ? "🎉" : "🧾", body: [fresh ? h("p.change.good#receiptChange", null, cash ? t("cash.change", { m: money(cash.change) }) : t("pay.paidBy", { how: s.pay.map(R.payName).join(" + ") })) : null, R.receiptNode(s)],
      actions: [{ label: t("receipt.print"), emoji: "🖨️", onClick: function () { ui.print(R.receiptNode(s)); return false; } },
                { label: fresh ? t("receipt.newSale") : t("close"), kind: "primary", id: "receiptDone", onClick: function (c) { c(); if (view && document.body.contains(view.search)) view.search.focus(); } }] });
  };

  /* keys at the register: F2 finds, F9 takes payment */
  document.addEventListener("keydown", function (e) {
    if (!B.isOpen || ui.current !== "register" || document.querySelector(".layer")) return;
    if (e.key === "F2") { e.preventDefault(); view && view.search.focus(); }
    if (e.key === "F9") { e.preventDefault(); takeCash(); }
  });
  B.on("lock", function () { view = null; });
})();
