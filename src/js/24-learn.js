/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Learning (Build 17): short lessons for everyone who works in the store, a guided tour that shows each room and does
   the work in front of the person, and a tip at the foot of every room.
   Each lesson has its tour, a chapter of the Guidebook to read, and two questions. A person finishes a lesson by
   answering its questions; the mark is kept in the books (B.trainDone), so that the owner, and those with the team
   access, can see who has learnt what.
   The tour lights one part of a room at a time and says what it is for. Where a lesson shows the work, a pointer moves
   to each key and presses it, and types where a person would type: Lakay's own keys, pressed as a person presses them.
   In the practice store it finishes the work (the sale, the delivery, the transfer), since nothing there is real. In
   the store itself it stops before anything would be written in the books, says so, and closes what it opened; the
   ticket at the Register is put back as it was. Calm and "reduce motion" keep the pointer still: it appears at each
   key instead of travelling to it. */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui;
  var L = E.learn = {};

  /* ---------- the lessons ---------- */
  /* id, sign, the access it needs (null: everyone; "owner": the owner only), its Guidebook chapter, minutes */
  var LESSONS = [
    { id: "welcome", emo: "🌟", need: null, guide: "start", min: 3 },
    { id: "clock", emo: "🕘", need: null, guide: "clock", min: 2 },
    { id: "sale", emo: "🛒", need: "sell", guide: "sale", min: 4 },
    { id: "pay", emo: "💳", need: "sell", guide: "pay", min: 4 },
    { id: "svc", emo: "💱", need: "sell", guide: "svc", min: 3 },
    { id: "stock", emo: "🚚", need: "receive", guide: "receive", min: 4 },
    { id: "reports", emo: "📊", need: "reports", guide: "reports", min: 3 },
    { id: "safe", emo: "🔐", need: "owner", guide: "backup", min: 3 }];
  L.LESSONS = LESSONS;
  function lesson(id) { return LESSONS.filter(function (l) { return l.id === id; })[0] || null; }
  L.lesson = lesson;
  /* the lessons a person takes: those their access opens (the owner takes every one) */
  function canTake(u, l) {
    if (!u || !l) return false;
    if (!l.need || u.role === "owner") return true;
    return l.need !== "owner" && (u.access || []).indexOf(l.need) >= 0;
  }
  L.lessonsFor = function (u) { return LESSONS.filter(function (l) { return canTake(u, l); }); };
  L.doneOf = function (u) { return u ? (B.trainingOf(u.id).done || {}) : {}; };
  L.leftFor = function (u) { var d = L.doneOf(u); return L.lessonsFor(u).filter(function (l) { return !d[l.id]; }); };

  /* two questions to each lesson, each with three answers: the right one (a) and two others (b, c), shown in an order
     that differs from one question to the next */
  function questions(id) {
    return [1, 2].map(function (n) {
      var k = "quiz." + id + "." + n, opts = [[k + ".a", true], [k + ".b", false], [k + ".c", false]], r = (n + id.length) % 3;
      return { q: k + ".q", why: k + ".why", opts: opts.slice(r).concat(opts.slice(0, r)) };
    });
  }
  L.questions = questions;

  /* ---------- the guided tour ---------- */
  var T = E.tour = { speed: 1 };
  var run = null, STOP = { stopped: true };
  T.active = function () { return !!run; };
  T.current = function () { return run ? { id: run.id, step: run.i, of: run.steps.length } : null; };
  function still() { return ui.still ? ui.still() : false; }
  function pause(ms) { return new Promise(function (res) { setTimeout(res, Math.round(ms * T.speed)); }); }
  function el(at) { if (!at) return null; var n = typeof at === "function" ? at() : document.querySelector(at); return n && n.nodeType === 1 ? n : null; }
  function shown(n) { if (!n || !document.body.contains(n)) return false; var r = n.getBoundingClientRect(); return r.width > 0 || r.height > 0; }
  /* the element a step points at, once it is there (a room or a window may still be opening) */
  function found(at, tok) {
    if (!at) return Promise.resolve(null);
    var tries = 0;
    return new Promise(function (res) {
      (function look() {
        if (!run || run.token !== tok) return res(null);
        var n = el(at); if (shown(n)) return res(n);
        if (++tries > 30) return res(null);
        setTimeout(look, 60);
      })();
    });
  }
  /* the windows the tour opened, closed again as a person closes them */
  function closeLayers(before) {
    Array.prototype.slice.call(document.querySelectorAll(".layer")).reverse().forEach(function (l) {
      if (before && before.indexOf(l) >= 0) return;
      var x = l.querySelector(".dialog-head .icon-key");
      if (x) x.click(); else l.remove();
    });
  }
  function closePops() {
    var f = document.getElementById("findQ"), k = document.getElementById("rail-find");
    if (f && k) k.click();
  }
  /* the item a lesson sells or receives: the first in name order with a few in stock */
  function demoItem() {
    var st = B.state(); if (!st || !E.find) return null;
    var ids = E.find.search({ show: "active" }), best = null;
    for (var i = 0; i < ids.length; i++) {
      var it = st.items[ids[i]]; if (!it || it.cat === "services") continue;
      if (it.stock >= 3 && it.price >= 300) return it;
      if (!best && it.stock >= 1) best = it;
    }
    return best;
  }
  function word(it) { var w = it.name.split(/[\s,()]+/).filter(function (x) { return x.length >= 3; })[0] || it.name; return w.slice(0, 10); }
  function copyLines(list) { return (list || []).map(function (l) { return { itemId: l.itemId, qty: l.qty }; }); }

  /* the pointer that does the work in a demonstration: it travels to a key, presses it, and types */
  function demo(tok) {
    function live() { if (!run || run.token !== tok) throw STOP; }
    var D = {
      pause: function (ms) { return pause(ms).then(live); },
      to: function (n) {
        live(); if (!n) throw STOP;
        try { n.scrollIntoView({ block: "nearest" }); } catch (e) { }
        var r = n.getBoundingClientRect(), hand = run.hand;
        hand.hidden = false;
        hand.style.transform = "translate(" + Math.round(r.left + Math.min(r.width / 2, 40)) + "px," + Math.round(r.top + r.height / 2) + "px)";
        return pause(still() ? 120 : 560).then(live);
      },
      press: function (n) {
        return D.to(n).then(function () {
          var r = n.getBoundingClientRect(), ring = run.ring;
          ring.style.transform = "translate(" + Math.round(r.left + Math.min(r.width / 2, 40)) + "px," + Math.round(r.top + r.height / 2) + "px)";
          ring.classList.remove("go"); void ring.offsetWidth; ring.classList.add("go");
          run.hand.classList.add("down");
          return pause(200);
        }).then(function () { live(); run.hand.classList.remove("down"); n.click(); return pause(420); }).then(live);
      },
      type: function (n, text) {
        return D.to(n).then(function () {
          try { n.focus({ preventScroll: true }); } catch (e) { }
          n.value = ""; n.dispatchEvent(new Event("input", { bubbles: true }));
          var i = 0;
          return (function next() {
            live();
            if (i >= text.length) return pause(260).then(live);
            n.value += text.charAt(i++); n.dispatchEvent(new Event("input", { bubbles: true }));
            return pause(75).then(next);
          })();
        });
      }
    };
    return D;
  }

  /* ---------- the tours, one to each lesson ----------
     A step: room (opened first), at (what is lit: a selector, or a function that finds it), say (what is said), real
     (what is said instead in the store itself, where a step that would write in the books does not), act (the
     demonstration), writes (the act writes in the books: practice store only), wait (the person's turn: done when it
     answers true), prep (made ready before the step, the first time only), optional (passed over when not there), and
     when (whether the step is part of this tour at all, decided when the tour starts). */
  function press(D, n) { return D.press(n); }
  var TOURS = {};
  TOURS.welcome = function (c) {
    return [
      { room: "home", say: "tour.welcome.1" },
      { at: ".dock", say: "tour.welcome.2" },
      { at: "#statusPill", say: "tour.welcome.3" },
      { at: "#alertsBtn", say: "tour.welcome.4" },
      { at: "#rail-find", say: "tour.welcome.5", act: function (D, n) {
        return D.press(n).then(function () { var f = document.getElementById("findQ"); return f && c.item ? D.type(f, word(c.item)) : null; });
      } },
      { at: "#langBtn", say: "tour.welcome.6", prep: closePops },
      { at: "#displayBtn", say: "tour.welcome.7" },
      { room: "home", at: ".hm-needs", say: "tour.welcome.8" },
      { at: '.nav-btn[data-room="learn"]', say: "tour.welcome.9", wait: function () { return ui.current === "learn"; } }];
  };
  TOURS.clock = function (c) {
    return [
      { at: "#statusPill", say: "tour.clock.1", act: press },
      { at: function () { return document.getElementById("clockInKey") || document.getElementById("breakKey"); }, say: "tour.clock.2", optional: true },
      { at: function () { return document.getElementById("signOutKey") || document.getElementById("clockOutKey"); }, say: "tour.clock.3", when: function () { return !c.practice; }, optional: true },
      { room: "team", at: "#teamMine", say: "tour.clock.4", prep: function () { closeLayers(c.layers); } },
      { room: "team", at: "#teamMine .seg", say: "tour.clock.5" }];
  };
  TOURS.sale = function (c) {
    var it = c.item, has = function () { return !!it; };
    function emptyTicket() { closeLayers(c.layers); if (E.register && E.register.setLines) E.register.setLines([]); }
    return [
      { room: "register", at: "#regSearch", say: "tour.sale.1", prep: emptyTicket, act: it ? function (D, n) { return D.type(n, word(it)); } : null },
      { room: "register", at: function () { return it && document.querySelector('#regResults .product[data-id="' + it.id + '"]'); }, say: "tour.sale.2", when: has, act: press },
      { at: function () { var l = document.querySelector("#ticketLines .tline"); return l && l.querySelectorAll(".t-qty button")[1]; }, say: "tour.sale.3", when: has, act: press },
      { at: "#ticketTotals", say: "tour.sale.4" },
      { at: "#takeCash", say: "tour.sale.5", when: has, act: press },
      { at: ".quick-cash", say: "tour.sale.6", when: has, act: function (D) { var k = document.querySelectorAll(".quick-cash .key"); return D.press(k[1] || k[0]); } },
      { at: "#cashChange", say: "tour.sale.7", when: has },
      { at: "#cashDone", say: "tour.sale.8", real: "tour.sale.8r", writes: true, when: has, act: press },
      { at: ".layer .receipt", say: "tour.sale.9", when: function () { return has() && c.practice; }, optional: true },
      { room: "register", at: "#regSearch", say: "tour.sale.10", prep: emptyTicket, wait: function () { return !!(E.register && E.register.ticket.lines.length); } }];
  };
  TOURS.pay = function (c) {
    var it = c.item, prefs = B.payPrefs(), card = !!it && prefs.methods.indexOf("card") >= 0, has = function () { return !!it; };
    function twoOnTicket() { closeLayers(c.layers); if (it && E.register && E.register.setLines) E.register.setLines([{ itemId: it.id, qty: 2 }]); }
    function part() { var total = B.priceTicket([{ itemId: it.id, qty: 2 }]).total, p = Math.max(100, Math.floor(total / 200) * 100); return U.moneyPlain(Math.min(p, total - 1)); }
    return [
      { room: "register", at: "#takeCash", say: it ? "tour.pay.1" : "tour.pay.1n", prep: twoOnTicket, act: it ? press : null },
      { at: "#payWays", say: "tour.pay.2", when: function () { return card; }, act: function (D) { return D.press(document.getElementById("payWay-card")); } },
      { at: "#payHow", say: "tour.pay.3", when: function () { return card; } },
      { at: "#payCode", say: "tour.pay.4", when: function () { return card && prefs.askCode !== "no"; }, act: function (D, n) { return D.type(n, "482913"); } },
      { at: "#payAmount", say: "tour.pay.5", when: function () { return card; }, act: function (D, n) { return D.type(n, part()); } },
      { at: "#payPart", say: "tour.pay.6", when: function () { return card; }, act: press },
      { at: "#payParts", say: "tour.pay.7", when: function () { return card; } },
      { at: ".quick-cash", say: "tour.pay.8", when: has, act: function (D) { return D.press(document.querySelector(".quick-cash .key")); } },
      { at: "#cashDone", say: "tour.pay.9", real: "tour.pay.9r", writes: true, when: has, act: press },
      { at: ".layer .receipt", say: "tour.pay.10", when: function () { return has() && c.practice; }, optional: true },
      { room: "register", at: "#takeCash", say: "tour.pay.11", prep: twoOnTicket, when: has, wait: function () { return !!document.getElementById("cashDue"); } }];
  };
  TOURS.svc = function (c) {
    return [
      { room: "inventory", at: "#invTab-services", say: "tour.svc.1", prep: function () { if (E.inventory) E.inventory.show("services"); } },
      { room: "inventory", at: "#svcRecord", say: "tour.svc.2", act: press },
      { at: "#svcProviders", say: "tour.svc.3", act: function (D, n) { return D.press(n.querySelector('[data-v="cam"]') || n.querySelector("[data-v]")); } },
      { at: "#svcKinds", say: "tour.svc.4" },
      { at: "#svcAmount", say: "tour.svc.5", act: function (D, n) { return D.type(n, "150.00").then(function () { var f = document.getElementById("svcFee"); return f ? D.type(f, "10.00") : null; }); } },
      { at: "#svcRef", say: "tour.svc.6", act: function (D, n) { return D.type(n, "CA483920"); } },
      { at: "#svcSave", say: "tour.svc.7", real: "tour.svc.7r", writes: true, act: press },
      { room: "inventory", at: "#svcSums", say: "tour.svc.8", prep: function () { closeLayers(c.layers); } }];
  };
  TOURS.stock = function (c) {
    var it = c.item, has = function () { return !!it; };
    return [
      { room: "inventory", at: ".inv-tabs", say: "tour.stock.1", prep: function () { if (E.inventory) E.inventory.show("all"); } },
      { room: "inventory", at: it ? "#invTab-" + it.cat : null, say: "tour.stock.2", when: has, act: press },
      { at: "#invSearch", say: "tour.stock.3", when: has, act: function (D, n) { return D.type(n, word(it)); } },
      { at: "#invRows", say: "tour.stock.4" },
      { at: "#invReceive", say: "tour.stock.5", act: press },
      { at: function () { return it && document.querySelector('#invRows .row-key[data-id="' + it.id + '"]'); }, say: "tour.stock.6", when: has, act: press },
      { at: "#rcQty", say: "tour.stock.7", when: has, act: function (D, n) { return D.type(n, "12"); } },
      { at: "#rcSave", say: "tour.stock.8", real: "tour.stock.8r", writes: true, when: has, act: press }];
  };
  TOURS.reports = function () {
    function sectionOf(id) { return function () { var x = document.getElementById(id); return x && x.closest("section"); }; }
    return [
      { room: "reports", at: ".period-card", say: "tour.reports.1", act: function (D, n) { return D.press(n.querySelector('.chip[data-p="week"]')); } },
      { at: "#repOut .ledger", say: "tour.reports.2" },
      { at: sectionOf("repSplit"), say: "tour.reports.3", optional: true },
      { at: sectionOf("repSvcCash"), say: "tour.reports.4", optional: true },
      { at: "#repPerson", say: "tour.reports.5" },
      { at: "#repCsvReceipts", say: "tour.reports.6" },
      { at: ".period-card", say: "tour.reports.7", wait: function () { var x = document.querySelector('.period-card .chip[data-p="lastweek"]'); return !!x && x.getAttribute("aria-pressed") === "true"; } }];
  };
  TOURS.safe = function () {
    return [
      { room: "settings", at: "#set-backup", say: "tour.safe.1" },
      { room: "settings", at: "#saveBackup", say: "tour.safe.2" },
      { room: "settings", at: function () { return document.getElementById("set-verify") || document.getElementById("verifyKey"); }, say: "tour.safe.3" },
      { room: "settings", at: "#set-security", say: "tour.safe.4" },
      { room: "settings", at: "#setLock", say: "tour.safe.5", optional: true },
      { room: "team", at: "#teamPeople", say: "tour.safe.6" }];
  };
  L.hasTour = function (id) { return !!TOURS[id]; };

  /* ---------- running a tour ---------- */
  T.start = function (id, opt) {
    if (run) T.stop(false, true);
    var l = lesson(id);
    if (!TOURS[id] || !l || !B.isOpen || !canTake(B.user, l)) return false;
    opt = opt || {};
    var ctx = { practice: B.mode === "practice", item: demoItem(), layers: Array.prototype.slice.call(document.querySelectorAll(".layer")),
      ticket: E.register ? copyLines(E.register.ticket.lines) : null, room: ui.current, back: document.activeElement,
      inv: E.inventory ? { dept: E.inventory.dept, filter: E.inventory.filter, q: E.inventory.q, page: E.inventory.page } : null };
    var steps = TOURS[id](ctx).filter(function (s) { return !s.when || s.when(); });
    var spot = h("div.tour-spot", { "aria-hidden": "true" }), hand = h("div.tour-hand", { "aria-hidden": "true" }), ring = h("div.tour-ring", { "aria-hidden": "true" });
    hand.appendChild(pointer()); hand.hidden = true;
    var bubble = h("div.tour-bubble#tourBubble", { role: "dialog", "aria-modal": "false", "aria-labelledby": "tourTitle", "aria-describedby": "tourText" });
    var root = h("div.tour#tour" + (still() ? ".still" : ""), { "data-tour": id }, [spot, ring, hand, bubble]);
    document.body.appendChild(root);
    run = { id: id, lesson: l, steps: steps, i: -1, token: 0, ctx: ctx, seen: {}, skipped: {}, root: root, spot: spot, hand: hand, ring: ring, bubble: bubble,
      el: null, last: "", busy: false, waitOk: false, opt: opt };
    window.addEventListener("keydown", onKey, true);
    frame();
    move(1);
    if (E.sound) E.sound.play("soft");
    return true;
  };
  function pointer() {
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "30"); svg.setAttribute("height", "30"); svg.setAttribute("focusable", "false");
    p.setAttribute("d", "M5 2.8v17.4l4.4-4.3 3 6.3 3.1-1.5-3-6.2h6.3z");
    svg.appendChild(p);
    return svg;
  }
  function move(dir) {
    if (!run || run.busy) return;
    var i = run.i + dir;
    if (i < 0) return;
    if (i >= run.steps.length) return T.stop(true);
    open(i, dir);
  }
  T.next = function () { move(1); };
  T.back = function () { move(-1); };
  function open(i, dir) {
    var s = run.steps[i], tok = ++run.token, first = !run.seen[i];
    run.i = i; run.el = null; run.at = s.at; run.busy = true; run.waitOk = false; run.hand.hidden = true;
    draw(s);
    Promise.resolve().then(function () {
      if (s.room && ui.current !== s.room && ui.allowed(s.room)) { closeLayers(run.ctx.layers); ui.go(s.room, true); }
      if (s.prep && first) return s.prep(run.ctx);
    }).then(function () { return found(s.at, tok); }).then(function (n) {
      if (!run || run.token !== tok) return null;
      if (s.at && !n && s.optional) { run.skipped[i] = true; run.busy = false; return move(dir || 1); }
      run.el = n;
      if (n) { var r = n.getBoundingClientRect(); if (r.top < 60 || r.bottom > window.innerHeight - 40) try { n.scrollIntoView({ block: "center", behavior: still() ? "auto" : "smooth" }); } catch (e) { } }
      run.seen[i] = true;
      var doIt = s.act && first && n && (!s.writes || run.ctx.practice);
      draw(s, doIt);
      if (!doIt) return null;
      /* time to read what the step says before the pointer moves */
      var D = demo(tok), words = t(s.say).split(/\s+/).length;
      return D.pause(Math.min(2200, 500 + 120 * words)).then(function () { return s.act(D, n, run.ctx); }).then(function () { return "acted"; });
    }).then(function (how) {
      if (!run || run.token !== tok) return;
      run.busy = false; run.hand.hidden = true;
      /* a key that closed its window as it was pressed: what it did is the next step's to show */
      if (how === "acted" && !shown(el(s.at)) && i < run.steps.length - 1) return move(1);
      draw(s); if (s.wait) watch(s, tok);
    }, function (e) {
      if (e !== STOP) console.error(e);
      if (run && run.token === tok) { run.busy = false; run.hand.hidden = true; draw(s); }
    });
  }
  /* the person's turn: the step is done when what it asks has been done */
  function watch(s, tok) {
    (function look() {
      if (!run || run.token !== tok) return;
      var ok = false; try { ok = !!s.wait(); } catch (e) { }
      if (ok !== run.waitOk) { run.waitOk = ok; draw(s); if (ok && E.sound) E.sound.play("soft"); }
      setTimeout(look, 220);
    })();
  }
  function counts() {
    var n = 0, m = 0;
    run.steps.forEach(function (x, k) { if (run.skipped[k] === true && k !== run.i) return; m++; if (k <= run.i) n++; });
    return { n: n, m: m };
  }
  function draw(s, watching) {
    var b = run.bubble, c = counts(), last = run.i >= run.steps.length - 1, real = s.writes && !run.ctx.practice;
    U.clear(b);
    b.appendChild(h("div.tour-top", null, [h("span.tour-step#tourTitle", null, [ui.emo(run.lesson.emo), h("b", null, t("learn." + run.id + ".t")), h("span", null, t("tour.step", { n: c.n, m: c.m }))]),
      h("button.icon-key.tour-x#tourClose", { type: "button", "aria-label": t("tour.close"), title: t("tour.close"), onclick: function () { T.stop(false); } }, U.icon("x"))]));
    b.appendChild(h("p.tour-text#tourText", { "aria-live": "polite" }, t(real && s.real ? s.real : s.say)));
    if (real) b.appendChild(h("p.tour-note#tourReal", null, [U.icon("lock"), h("span", null, t("tour.realNote"))]));
    if (s.wait) b.appendChild(h("p.tour-turn#tourTurn" + (run.waitOk ? ".ok" : ""), { "aria-live": "polite" }, [run.waitOk ? U.icon("check") : ui.emo("👉"), h("span", null, t(run.waitOk ? "tour.turnDone" : "tour.yourTurn"))]));
    var back = h("button.key.sm#tourBack", { type: "button", disabled: run.i === 0 || run.busy ? "" : null, onclick: T.back }, [U.icon("back"), t("back")]);
    var nextLabel = run.busy && watching ? t("tour.watch") : s.wait && !run.waitOk ? t("tour.skip") : last ? t("tour.finish") : t("next");
    var next = h("button.key.sm#tourNext" + (s.wait && !run.waitOk ? "" : ".primary"), { type: "button", disabled: run.busy ? "" : null, onclick: T.next }, [nextLabel, run.busy ? null : U.icon("next")]);
    b.appendChild(h("div.tour-keys", null, [back, h("span.tour-dots", { "aria-hidden": "true" }, run.steps.map(function (x, k) {
      return run.skipped[k] === true && k !== run.i ? null : h("i" + (k === run.i ? ".on" : k < run.i ? ".past" : ""));
    })), next]));
    run.last = "";
    if (!run.busy && b.contains(document.activeElement) === false) setTimeout(function () { var k = document.getElementById("tourNext"); if (k && run && !s.wait) try { k.focus({ preventScroll: true }); } catch (e) { } }, 30);
  }
  /* the light and the bubble follow what is lit as the page moves */
  function frame() {
    if (!run) return;
    /* a room that draws itself again replaces what was lit: the step's element is found again */
    var n = run.el;
    if ((!n || !document.body.contains(n)) && run.at && !run.busy) { n = el(run.at); if (n) run.el = n; }
    var r = n && document.body.contains(n) ? n.getBoundingClientRect() : null;
    if (r && !r.width && !r.height) r = null;
    var vw = window.innerWidth, vh = window.innerHeight, bw = run.bubble.offsetWidth, bh = run.bubble.offsetHeight;
    var key = r ? [r.left, r.top, r.width, r.height].map(Math.round).join(",") : "none";
    key += "|" + vw + "x" + vh + "|" + bw + "x" + bh;
    if (key !== run.last) {
      run.last = key;
      var pad = 6, sp = run.spot.style;
      if (r) { sp.left = Math.round(r.left - pad) + "px"; sp.top = Math.round(r.top - pad) + "px"; sp.width = Math.round(r.width + pad * 2) + "px"; sp.height = Math.round(r.height + pad * 2) + "px"; run.spot.classList.remove("none"); }
      else { sp.left = Math.round(vw / 2) + "px"; sp.top = Math.round(vh / 2) + "px"; sp.width = "0px"; sp.height = "0px"; run.spot.classList.add("none"); }
      var m = 12, x, y, bs = run.bubble.style;
      if (vw < 600) {
        x = m; y = vh - bh - m;
        if (r && r.bottom + 8 > y && r.top > bh + m * 2) y = m;
        bs.left = x + "px"; bs.top = Math.max(m, y) + "px"; bs.right = m + "px";
      } else {
        bs.right = "auto";
        if (!r) { x = (vw - bw) / 2; y = Math.max(m, (vh - bh) / 2); }
        else if (r.bottom + pad + m + bh <= vh - m) { y = r.bottom + pad + m; x = r.left + r.width / 2 - bw / 2; }
        else if (r.top - pad - m - bh >= m) { y = r.top - pad - m - bh; x = r.left + r.width / 2 - bw / 2; }
        else if (r.right + pad + m + bw <= vw - m) { x = r.right + pad + m; y = r.top; }
        else if (r.left - pad - m - bw >= m) { x = r.left - pad - m - bw; y = r.top; }
        else { x = (vw - bw) / 2; y = vh - bh - m; }
        x = Math.min(Math.max(m, x), vw - bw - m); y = Math.min(Math.max(m, y), vh - bh - m);
        bs.left = Math.round(x) + "px"; bs.top = Math.round(y) + "px";
      }
    }
    run.raf = requestAnimationFrame(frame);
  }
  function onKey(e) {
    if (!run) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); T.stop(false); return; }
    var inBubble = run.bubble.contains(document.activeElement) || document.activeElement === document.body;
    if (!inBubble) return;
    if (e.key === "ArrowRight") { e.preventDefault(); T.next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); T.back(); }
  }
  /* the end of a tour: what it opened is closed, the ticket and the Inventory's search are put back as they were */
  T.stop = function (finished, quiet) {
    if (!run) return;
    var r = run; run = null;
    window.removeEventListener("keydown", onKey, true);
    if (r.raf) cancelAnimationFrame(r.raf);
    r.root.remove();
    if (!B.isOpen) return;
    closePops();
    closeLayers(r.ctx.layers);
    if (r.ctx.ticket && E.register && E.register.setLines) E.register.setLines(r.ctx.ticket);
    if (r.ctx.inv && E.inventory) { E.inventory.dept = r.ctx.inv.dept; E.inventory.filter = r.ctx.inv.filter; E.inventory.q = r.ctx.inv.q; E.inventory.page = r.ctx.inv.page; }
    var to = r.ctx.room === "learn" ? "learn" : ui.current;
    if (!quiet) ui.go(ui.allowed(to) ? to : "home", true);
    if (r.ctx.back && document.body.contains(r.ctx.back)) try { r.ctx.back.focus({ preventScroll: true }); } catch (e) { }
    if (finished && !quiet) {
      ui.dialog({ title: t("tour.endT"), emoji: "🎓", body: h("p", null, t("tour.endP", { name: t("learn." + r.id + ".t") })),
        actions: [{ label: t("tour.later") }, { label: t("tour.toQuiz"), kind: "primary", id: "tourQuiz", onClick: function (close) { close(); L.quiz(r.id); } }] });
    }
  };
  B.on("lock", function () { if (run) T.stop(false, true); });

  /* ---------- the questions ---------- */
  L.quiz = function (id) {
    var l = lesson(id); if (!l || !B.isOpen) return null;
    var qs = questions(id), i = 0, right = 0, missed = false, solved = false, d;
    var body = h("div.quiz#quiz");
    function step() {
      U.clear(body); missed = false; solved = false;
      var cur = qs[i], why = h("p.quiz-why#quizWhy", { "aria-live": "polite" });
      body.appendChild(h("p.eyebrow.quiz-n", null, t("quiz.qn", { n: i + 1, m: qs.length })));
      body.appendChild(h("h3.quiz-q#quizQ", null, t(cur.q)));
      body.appendChild(h("div.quiz-opts", { role: "group", "aria-labelledby": "quizQ" }, cur.opts.map(function (o, k) {
        var b = h("button.quiz-opt", { type: "button", "data-k": String(k) }, [h("span.quiz-letter", { "aria-hidden": "true" }, "ABC".charAt(k)), h("span.quiz-t", null, t(o[0])), h("span.quiz-mark", { "aria-hidden": "true" })]);
        b.addEventListener("click", function () {
          if (solved) return;
          if (o[1]) {
            solved = true; if (!missed) right++;
            b.classList.add("right"); b.setAttribute("aria-pressed", "true"); b.querySelector(".quiz-mark").appendChild(U.icon("check"));
            Array.prototype.forEach.call(body.querySelectorAll(".quiz-opt"), function (x) { if (x !== b) x.disabled = true; });
            why.textContent = t("quiz.right") + " " + t(cur.why); why.className = "quiz-why ok";
            var nx = document.getElementById("quizNext"); if (nx) { nx.disabled = false; setTimeout(function () { try { nx.focus(); } catch (e) { } }, 30); }
            if (E.sound) E.sound.play("soft");
          } else {
            missed = true; b.classList.add("wrong"); b.disabled = true; b.querySelector(".quiz-mark").appendChild(U.icon("x"));
            why.textContent = t("quiz.wrong"); why.className = "quiz-why no";
          }
        });
        return b;
      })));
      body.appendChild(why);
      var nx = document.getElementById("quizNext");
      if (nx) { nx.disabled = true; nx.lastChild.textContent = t(i === qs.length - 1 ? "quiz.finish" : "quiz.next"); }
    }
    d = ui.dialog({ title: t("quiz.title", { name: t("learn." + id + ".t") }), emoji: l.emo, body: body,
      actions: [{ label: t("close") }, { label: t("quiz.next"), kind: "primary", id: "quizNext", disabled: true, onClick: function (close, btn) {
        if (!solved) return false;
        if (i < qs.length - 1) { i++; step(); setTimeout(function () { var f = body.querySelector(".quiz-opt"); if (f) f.focus(); }, 30); return false; }
        btn.disabled = true;
        B.trainDone(id, right, qs.length).then(function () {
          close();
          ui.toast(t("quiz.saved", { name: t("learn." + id + ".t"), s: right, o: qs.length }), "good");
          if (E.sound) E.sound.play("sale");
          if (ui.current === "learn" || ui.current === "home") ui.refresh();
        }, function (e) { btn.disabled = false; ui.failed(e); });
        return false;
      } }] });
    step();
    setTimeout(function () { var f = body.querySelector(".quiz-opt"); if (f) f.focus(); }, 40);
    return d;
  };

  /* a lesson's chapter of the Guidebook, read where the lesson is */
  L.read = function (id) {
    var paras = t("guide." + id + ".b").split("\n");
    ui.dialog({ title: t("guide." + id + ".t"), emoji: "📖", wide: true, body: [h("div.learn-read", null, paras.map(function (p) { return h("p", null, p); })),
      h("div.tip-box", null, [ui.emo("💡"), h("p", null, [h("strong", null, t("tip") + ": "), t("guide." + id + ".tip")])]),
      ui.readAloud(t("guide." + id + ".t") + ". " + paras.join(" "))], actions: [{ label: t("gotIt"), kind: "primary" }] });
  };

  /* ---------- the Learning room ---------- */
  ui.rooms.learn = function (main) {
    var me = B.user, mine = L.lessonsFor(me), done = L.doneOf(me), practice = B.mode === "practice";
    var n = mine.filter(function (l) { return done[l.id]; }).length, next = mine.filter(function (l) { return !done[l.id]; })[0];
    main.appendChild(ui.roomHead("room.learn", "tip.learn", [h("button.key.primary#learnTour", { type: "button", onclick: function () { T.start("welcome"); } }, [U.icon("play"), t("learn.tour")])]));

    var fill = h("span.learn-fill"); fill.style.width = (mine.length ? Math.round(100 * n / mine.length) : 0) + "%";
    main.appendChild(h("section.card.learn-mine#learnMine", { "aria-labelledby": "learnMineH" }, [
      h("div.learn-mine-head", null, [h("span.learn-cap", { "aria-hidden": "true" }, U.icon("cap")),
        h("div.learn-mine-t", null, [h("h2#learnMineH", null, t("learn.mineH")), h("p#learnCount", null, n === mine.length ? t("learn.allDone") : t("learn.progress", { n: n, m: mine.length }))]),
        next ? h("div.learn-next", null, [h("small", null, t("learn.next", { name: t("learn." + next.id + ".t") })),
          h("button.key.primary#learnNext", { type: "button", "data-lesson": next.id, onclick: function () { T.start(next.id); } }, [U.icon("play"), t("learn.start")])]) : null]),
      h("div.learn-bar", { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(mine.length), "aria-valuenow": String(n), "aria-label": t("learn.mineH") }, fill),
      h("p.hint.learn-note", null, [ui.emo(practice ? "🧪" : "🛡️"), t(practice ? "learn.practiceNote" : "learn.realNote")])]));

    main.appendChild(h("div.learn-grid#learnList", null, mine.map(function (l) {
      var x = done[l.id];
      return h("article.lesson" + (x ? ".done" : ""), { "data-lesson": l.id, "aria-labelledby": "ls-" + l.id }, [
        h("div.lesson-head", null, [h("span.lesson-emo", { "aria-hidden": "true" }, l.emo), h("h3.lesson-t#ls-" + l.id, null, t("learn." + l.id + ".t")),
          x ? h("span.badge.ok.lesson-state", null, [U.icon("check"), t("learn.done")]) : h("span.badge.lesson-state.todo", null, t("learn.todo"))]),
        h("p.lesson-d", null, t("learn." + l.id + ".d")),
        h("p.lesson-meta.muted", null, x ? t("learn.doneOn", { d: E.fmtDate(new Date(x.at), "short"), s: x.score, o: x.of }) : t("learn.min", { n: l.min }) + " · " + t("learn.for." + (l.need || "all"))),
        h("div.lesson-keys", null, [
          h("button.key.sm.primary", { type: "button", "data-act": "tour", onclick: function () { T.start(l.id); } }, [U.icon("play"), t("learn.showMe")]),
          h("button.key.sm", { type: "button", "data-act": "read", onclick: function () { L.read(l.guide); } }, [U.icon("book"), t("learn.read")]),
          h("button.key.sm", { type: "button", "data-act": "quiz", onclick: function () { L.quiz(l.id); } }, [U.icon("edit"), t("learn.quiz")])])]);
    })));

    /* the team's lessons, for the owner and those with the team access */
    if (B.can("team")) {
      var people = B.people().filter(function (u) { return u.active !== false; });
      main.appendChild(h("section.card.learn-team#learnTeam", { "aria-labelledby": "learnTeamH" }, [
        h("div.card-head", null, h("h2#learnTeamH", null, [ui.emo("👥"), t("learn.teamH")])), h("p.hint", null, t("learn.teamP")),
        h("div.table-wrap", null, h("table.grid#learnPeople", null, [
          h("thead", null, h("tr", null, [h("th", null, t("people.name")), h("th.num", null, t("learn.colDone")), h("th", null, t("learn.colLast")), h("th", null, t("learn.colMarks"))])),
          h("tbody", null, people.map(function (u) {
            var theirs = L.lessonsFor(u), d = L.doneOf(u), k = theirs.filter(function (l) { return d[l.id]; }).length, lastAt = null;
            theirs.forEach(function (l) { if (d[l.id] && (!lastAt || d[l.id].at > lastAt)) lastAt = d[l.id].at; });
            return h("tr", { "data-person": u.id }, [h("td", null, ui.personTag(u)), h("td.num", null, h("span.badge" + (k === theirs.length ? ".ok" : ""), null, k + " / " + theirs.length)),
              h("td.muted", null, lastAt ? E.fmtDate(new Date(lastAt), "short") : t("learn.never")),
              h("td", null, h("span.learn-marks", null, theirs.map(function (l) {
                var on = !!d[l.id], label = t(on ? "learn.markDone" : "learn.markTodo", { name: t("learn." + l.id + ".t") }) + (on ? " (" + d[l.id].score + "/" + d[l.id].of + ")" : "");
                return h("span.learn-mark" + (on ? ".on" : ""), { role: "img", "aria-label": label, title: label }, l.emo);
              })))]);
          }))]))]));
    }

    /* every tip, room by room */
    main.appendChild(h("section.card.learn-tips#learnTips", { "aria-labelledby": "learnTipsH" }, [
      h("div.card-head", null, h("h2#learnTipsH", null, [ui.emo("💡"), t("learn.allTipsH")])),
      h("div.learn-tip-rooms", null, Object.keys(TIPS).filter(function (r) { return r === "learn" || ui.allowed(r); }).map(function (r) {
        var list = [];
        for (var k = 1; k <= TIPS[r]; k++) list.push(h("li", null, t("tips." + r + "." + k)));
        return h("details.learn-tip-room", null, [h("summary", null, [ui.emo(ui.ROOM_EMO[r] || "💡"), t("room." + r)]), h("ul", null, list)]);
      }))]));
  };

  /* ---------- tips at the foot of each room ---------- */
  var TIPS = { home: 4, register: 4, inventory: 4, reports: 3, team: 3, learn: 3, guide: 2, settings: 3, studio: 2 };
  var tipAt = {};
  L.tipsOn = function () { return U.prefGet("tips", "1") === "1"; };
  /* fresh: a new visit to the room shows its next tip; a room drawn again keeps the one it shows */
  L.tipStrip = function (room, fresh) {
    if (!L.tipsOn() || !TIPS[room] || !B.isOpen) return null;
    var n = TIPS[room];
    if (tipAt[room] === undefined) tipAt[room] = (parseInt(U.prefGet("tipAt." + room, "0"), 10) || 0) % n;
    else if (fresh) tipAt[room] = (tipAt[room] + 1) % n;
    U.prefSet("tipAt." + room, String((tipAt[room] + 1) % n));
    var text = h("span.tip-strip-t#tipText", { "aria-live": "polite" }, t("tips." + room + "." + (tipAt[room] + 1)));
    var strip = h("aside.tip-strip#tipStrip", { "aria-label": t("learn.tipH") }, [h("span.tip-strip-emo", { "aria-hidden": "true" }, "💡"),
      h("p.tip-strip-p", null, [h("b", null, t("learn.tipH") + " "), text]),
      h("span.tip-strip-keys", null, [n > 1 ? h("button.key.sm.quiet#tipMore", { type: "button", onclick: function () {
        tipAt[room] = (tipAt[room] + 1) % n; text.textContent = t("tips." + room + "." + (tipAt[room] + 1)); U.prefSet("tipAt." + room, String((tipAt[room] + 1) % n));
      } }, t("learn.another")) : null,
        h("button.icon-key#tipHide", { type: "button", "aria-label": t("learn.hideTips"), title: t("learn.hideTips"), onclick: function () {
          U.prefSet("tips", "0"); strip.remove(); ui.toast(t("learn.tipsHidden"));
        } }, U.icon("x"))])]);
    return strip;
  };
  L.TIPS = TIPS;

  /* ---------- "Show me" in the heading of a room that has a tour ---------- */
  L.showKey = function (room) {
    if (!B.isOpen || !B.user) return null;
    var id = { register: "sale", inventory: B.can("receive") ? "stock" : "svc", reports: "reports", team: "clock", settings: "safe" }[room];
    if (!id || !canTake(B.user, lesson(id))) return null;
    return h("button.key.tour-key#showMe", { type: "button", "data-tour": id, title: t("learn.showMeTip"), onclick: function () { T.start(id); } }, [U.icon("play"), t("learn.showMe")]);
  };
})();
