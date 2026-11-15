/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Earnings (Build 21): what the store earns apart from its sales (the commission on transfers and top-ups), settling
   with each provider in the way the owner chose for it, and each person's pay from the time clock. The room has tabs:
   My pay (each person's own), The store (its earnings for a period), Providers (what is held for each, the payments,
   the statements checked) and Pay (everyone's hours, rates and pay, for those given "pay"). Pay is an estimate before
   taxes and deductions: Lakay does not do payroll taxes, and says so wherever pay is shown. */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui, money = U.money;
  var EA = E.earnings = { tab: null, period: "month", payAt: 0 };

  /* ---------- small helpers ---------- */
  function nameOf(id) { var u = B.state().users[id]; return u ? u.name : id; }
  function staff() { return B.people().filter(function (u) { return u.role !== "owner" && u.active !== false; }); }
  function today() { return U.dayKey(); }
  /* a day as "9 Nov", with the year only when it is not this year's */
  function dshort(k) {
    var d = typeof k === "string" ? U.fromDayKey(k) : k, s = E.fmtDate(d, "short"), y = " " + new Date().getFullYear();
    return s.slice(-y.length) === y ? s.slice(0, -y.length) : s;
  }
  function span(p) { return p.from === p.to ? dshort(p.from) : t("rep.range", { a: dshort(p.from), b: dshort(p.to) }); }
  function dur(min) { return ui.dur(min * 60000); }
  function perHour(c) { return t("ea.perHour", { m: money(c) }); }
  /* the overtime rule, in words */
  function otRule(s) { return s.otAfter === null ? t("ea.otNone") : t("ea.otRule", { n: s.otAfter, x: s.otTimes === 200 ? t("ea.x200") : s.otTimes === 150 ? t("ea.x150") : t("ea.xPct", { n: s.otTimes }) }); }
  var ERR = { amount: "ea.err.amount", future: "ea.err.future", already: "ea.err.already", rate: "ea.err.rate", overtime: "ea.err.overtime",
    self: "ea.err.self", note: "ea.err.note", period: "ea.err.period", drill: "ex.busy", noperson: "sch.err.person" };
  function failed(e) { var k = e && ERR[e.code]; if (k) ui.toast(t(k), "bad"); else ui.failed(e); }
  function redraw() { if (ui.current === "earnings") ui.refresh(); }
  function fig(label, value, tone, id, sub) {
    return h("div.ea-fig" + (tone ? "." + tone : ""), id ? { id: id } : null, [h("span.ea-fig-l", null, label), h("b.ea-fig-v", null, value), sub ? h("small.ea-fig-s", null, sub) : null]);
  }
  function card(id, emo, title, kids, cls) {
    return h("section.card.ea-sec" + (cls ? "." + cls : ""), { id: id, "aria-labelledby": id + "H" }, [h("div.card-head", null, h("h2", { id: id + "H" }, [ui.emo(emo), title]))].concat(kids));
  }
  /* a statement's figure may be below zero (the provider owes the store): a leading minus is kept */
  function parseSigned(v) { var s = String(v || "").trim(), neg = /^[-−]/.test(s), c = U.parseMoney(neg ? s.slice(1) : s); return c === null ? null : neg ? -c : c; }

  /* ---------- the room and its tabs ---------- */
  var TABS = [["mine", "clock"], ["store", "coins"], ["providers", "swap"], ["pay", "people"]];
  function tabsFor() {
    return TABS.filter(function (x) {
      if (x[0] === "mine") return !B.isOwner();
      if (x[0] === "pay") return B.can("pay");
      return B.can("reports");
    });
  }
  var PANES = {};
  ui.rooms.earnings = function (main) {
    var list = tabsFor();
    if (!EA.tab || !list.some(function (x) { return x[0] === EA.tab; })) EA.tab = list[0][0];
    main.appendChild(ui.roomHead("room.earnings", "tip.earnings"));
    if (list.length > 1) {
      var unpaid = B.can("pay") ? unpaidLast().length : 0;
      var tabs = h("div.inv-tabs", { role: "tablist", "aria-label": t("room.earnings") });
      list.forEach(function (x) {
        var n = x[0] === "pay" ? unpaid : 0;
        tabs.appendChild(h("button.inv-tab#eaTab-" + x[0], { type: "button", role: "tab", "aria-selected": String(EA.tab === x[0]), tabindex: EA.tab === x[0] ? "0" : "-1", "aria-controls": "earnPane", "data-tab": x[0],
          onclick: function () { EA.tab = x[0]; ui.refresh(); var b = document.getElementById("eaTab-" + x[0]); if (b) try { b.focus({ preventScroll: true }); } catch (e) { } } },
          [h("span.dept-jewel.sm", { "aria-hidden": "true" }, U.icon(x[1])), h("span.inv-tab-name", null, t("ea.tab." + x[0])), n ? h("span.inv-tab-n", null, String(n)) : null]));
      });
      tabs.addEventListener("keydown", function (e) {
        var ids = list.map(function (x) { return x[0]; }), i = ids.indexOf(EA.tab), to = null;
        if (e.key === "ArrowRight") to = ids[(i + 1) % ids.length]; else if (e.key === "ArrowLeft") to = ids[(i - 1 + ids.length) % ids.length];
        if (to) { e.preventDefault(); EA.tab = to; ui.refresh(); var b = document.getElementById("eaTab-" + to); if (b) try { b.focus({ preventScroll: true }); } catch (x2) { } }
      });
      main.appendChild(h("div.inv-tabs-wrap.ea-tabs", null, tabs));
    }
    var pane = h("div.ea-pane#earnPane", list.length > 1 ? { role: "tabpanel", "aria-labelledby": "eaTab-" + EA.tab } : null);
    main.appendChild(pane);
    PANES[EA.tab](pane);
  };
  /* another person signed in: the room opens on their own first tab */
  B.on("user", function () { EA.tab = null; EA.payAt = 0; });
  B.on("lock", function () { EA.tab = null; EA.payAt = 0; });

  /* ---------- My pay: the person's own hours and pay ---------- */
  PANES.mine = function (pane) {
    var u = B.user, s = B.paySettings(), periods = B.payPeriods(6), cur = periods[0], e = B.payFor(u.id, cur.from, cur.to), rate = B.rateOf(u.id, today());
    pane.appendChild(card("eaMine", "🕘", t("ea.mine.now"), [
      h("p.ea-span", null, [span(cur), h("span.ea-dot", { "aria-hidden": "true" }, "·"), t("ea.period." + s.period)]),
      h("div.ea-figs", null, [
        fig(t("ea.hours"), dur(e.regMin), null, "eaMyHours", t(e.shifts === 1 ? "ea.shifts1" : "ea.shifts", { n: e.shifts })),
        fig(t("ea.ot"), e.otMin ? dur(e.otMin) : "—", null, "eaMyOt"),
        fig(t("ea.rate"), rate === null ? "—" : perHour(rate), null, "eaMyRate"),
        fig(t("ea.estimate"), rate === null ? "—" : money(e.gross), "good", "eaMyEst", t("ea.beforeTax"))]),
      e.open ? h("p.note", null, [ui.emo("🕘"), t("ea.mine.open")]) : null,
      rate === null ? h("p.note#eaNoRate", null, [ui.emo("ℹ️"), t("ea.mine.noRate")]) : null,
      h("p.hint", null, t("ea.mine.honest", { rule: otRule(s) }))]));
    var rows = [];
    periods.forEach(function (p, i) {
      var x = B.payFor(u.id, p.from, p.to), none = !x.shifts || x.noRate === x.shifts;
      /* a period gone by with no hours and no pay is left out */
      if (i > 0 && !x.shifts && !x.paid) return;
      rows.push(h("li.ea-row", { "data-from": p.from }, [
        h("div.ea-row-t", null, [h("b", null, i === 0 ? t("ea.thisPeriod") : span(p)), h("small", null, (i === 0 ? span(p) + " · " : "") + dur(x.regMin + x.otMin) + (x.otMin ? " · " + t("ea.otShort", { d: dur(x.otMin) }) : ""))]),
        h("span.ea-row-amt", null, none ? "—" : money(x.gross)),
        x.paid ? h("span.ea-chip.paid", null, [U.icon("check"), t("ea.paidOn", { m: money(x.paid.amount), d: dshort(x.paid.day), how: t("ea.wm." + x.paid.method) })])
          : h("span.ea-chip", null, i === 0 ? t("ea.inProgress") : x.shifts ? t("ea.notPaid") : t("ea.noHours"))]));
    });
    pane.appendChild(card("eaMyPeriods", "🧾", t("ea.mine.past"), [h("ul.ea-rows", null, rows), h("p.hint", null, t("ea.mine.slip"))]));
  };

  /* ---------- The store: what it earned in a period ---------- */
  var SPANS = ["today", "week", "lastweek", "month", "lastmonth", "year"];
  PANES.store = function (pane) {
    var rg = E.reports.range(EA.period), r = B.report(rg.from, rg.to, null, null), sv = r.services;
    var unknownList = noCommission(function (v) { return v.day >= rg.from && v.day <= rg.to; }), unknown = unknownList.length;
    var chips = h("div.chips.ea-spans", { role: "group", "aria-label": t("ea.spanH") }, SPANS.map(function (p) {
      return h("button.chip", { type: "button", "data-p": p, "aria-pressed": String(EA.period === p), onclick: function () { EA.period = p; redraw(); } }, t("rep.p." + p));
    }));
    pane.appendChild(h("div.ea-spanbar", null, [chips, h("p.ea-range#eaRange", null, [ui.emo("📅"), rg.label])]));
    /* apart from the sales: the commission on transfers and top-ups (Build 22 adds the travel bookings) */
    var provs = Object.keys(sv.byProvider).sort(function (a, b) { return sv.byProvider[b].commission - sv.byProvider[a].commission; });
    pane.appendChild(h("section.card.ea-hero#eaApartCard", { "aria-labelledby": "eaApartH" }, [
      h("div.ea-hero-t", null, [h("p.label-caps#eaApartH", null, [ui.emo("💱"), t("ea.apart")]), h("p.ea-big#eaApart", null, money(sv.commission)),
        h("p.ea-sub", null, sv.count ? t(sv.count === 1 ? "ea.apartSub1" : "ea.apartSub", { n: sv.count }) : t("ea.apartNone"))]),
      provs.length ? h("div.table-wrap", null, h("table.grid.compact#eaByProv", null, [
        h("thead", null, h("tr", null, [h("th", null, t("svc.provider")), h("th.num", null, t("svc.entries")), h("th.num", null, t("svc.commission")), h("th.num", null, t("svc.fees"))])),
        h("tbody", null, provs.map(function (p) { var x = sv.byProvider[p]; return h("tr", null, [h("td", null, t("svc.p." + p)), h("td.num", null, String(x.count)), h("td.num", null, money(x.commission)), h("td.num", null, money(x.fees))]); }))])) : null,
      unknown ? h("div.note.ea-unknown#eaUnknown", null, [ui.emo("ℹ️"), h("span", null, t(unknown === 1 ? "ea.unknown1" : "ea.unknown", { n: unknown })),
        h("button.key.sm#eaWriteCom", { type: "button", onclick: function () { EA.comForm(unknownList); } }, [U.icon("edit"), t("ea.cmKey")])]) : null,
      h("p.hint", null, t("ea.feesNote"))]));
    /* with the sales, for those who see the costs; and after pay, for those who also see it */
    if (B.can("costs")) {
      var all = r.profit + sv.commission;
      pane.appendChild(card("eaAll", "📈", t("ea.allH"), [h("div.ea-sum", null, [
        fig(t("ea.salesProfit"), money(r.profit), r.profit < 0 ? "bad" : null, "eaProfit", t(r.count === 1 ? "ea.salesN1" : "ea.salesN", { n: r.count })),
        h("span.ea-op", { "aria-hidden": "true" }, "+"), fig(t("ea.apartShort"), money(sv.commission), null, "eaApart2"),
        h("span.ea-op", { "aria-hidden": "true" }, "="), fig(t("ea.allEarned"), money(all), all < 0 ? "bad" : "good", "eaAllEarned")]),
        r.noCost ? h("p.note", null, [ui.emo("ℹ️"), t("rep.noCostNote", { m: money(r.noCost) })]) : null]));
      if (B.can("pay")) {
        var w = staff().reduce(function (m, u) { var x = B.payFor(u.id, rg.from, rg.to); m.gross += x.gross; m.min += x.regMin + x.otMin; m.noRate += x.noRate; return m; }, { gross: 0, min: 0, noRate: 0 });
        pane.appendChild(card("eaAfter", "🧮", t("ea.afterH"), [h("div.ea-sum", null, [
          fig(t("ea.allEarned"), money(all), null, "eaAllEarned2"), h("span.ea-op", { "aria-hidden": "true" }, "−"),
          fig(t("ea.payEst"), money(w.gross), null, "eaWages", dur(w.min)), h("span.ea-op", { "aria-hidden": "true" }, "="),
          fig(t("ea.afterPay"), money(all - w.gross), all - w.gross < 0 ? "bad" : "good", "eaAfterPay")]),
          w.noRate ? h("p.note", null, [ui.emo("ℹ️"), t("ea.someNoRate", { n: w.noRate })]) : null,
          h("p.hint", null, t("ea.afterNote"))]));
      }
    }
  };

  /* the entries written without a commission (a cashier recorded them), oldest first */
  function noCommission(more) {
    return B.services(function (v) { return v.status !== "void" && (v.commission === null || v.commission === undefined) && (!more || more(v)); })
      .slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; });
  }
  /* writing their commission, from the provider's statement */
  EA.comForm = function (list) {
    if (!B.can("reports") || !list || !list.length) return;
    var rowsList = list.slice(0, 40), inputs = {};
    var rows = rowsList.map(function (v) {
      var inp = ui.input({ id: "cm-" + v.id, inputmode: "decimal", class: "money-in ea-cm-in", "aria-label": t("ea.cmFor", { p: t("svc.p." + v.provider), m: money(v.amount), d: dshort(v.day) }) });
      inputs[v.id] = inp;
      return h("tr", { "data-id": v.id }, [h("td", null, dshort(v.day) + ", " + E.fmtTime(new Date(v.at))), h("td", null, t("svc.p." + v.provider)), h("td", null, t("svc.k." + v.kind)),
        h("td.num", null, money(v.amount)), h("td.num", null, money(v.fee || 0)), h("td", null, inp)]);
    });
    ui.dialog({ title: t("ea.cmH"), emoji: "✍️", wide: true, body: [h("p", null, t("ea.cmIntro")), h("div.table-wrap", null, h("table.grid.compact.ea-cm#cmT", null, [
      h("thead", null, h("tr", null, [h("th", null, t("ea.when")), h("th", null, t("svc.provider")), h("th", null, t("svc.kind")), h("th.num", null, t("svc.amount")), h("th.num", null, t("svc.fee")), h("th", null, t("svc.commission"))])),
      h("tbody", null, rows)])), list.length > rowsList.length ? h("p.hint", null, t("ea.cmMore", { n: list.length - rowsList.length })) : null],
      actions: [{ label: t("cancel") }, { label: t("save"), kind: "primary", id: "cmSave", onClick: function (close, btn) {
        var out = [], bad = null;
        rowsList.forEach(function (v) {
          var x = inputs[v.id].value.trim(); inputs[v.id].removeAttribute("aria-invalid"); if (!x) return;
          var c = U.parseMoney(x); if (c === null) { if (!bad) bad = inputs[v.id]; inputs[v.id].setAttribute("aria-invalid", "true"); return; }
          out.push({ id: v.id, commission: c });
        });
        if (bad) { ui.toast(t("ea.err.amount"), "bad"); bad.focus(); return false; }
        if (!out.length) { close(); return false; }
        btn.disabled = true;
        B.setSvcCommissions(out).then(function () { close(); ui.toast(t(out.length === 1 ? "ea.cmSaved1" : "ea.cmSaved", { n: out.length }), "good"); redraw(); }, function (e) { btn.disabled = false; failed(e); });
        return false;
      } }], focus: ".ea-cm-in" });
  };

  /* ---------- Providers: what is held for each, and settling with it ---------- */
  function shown() { return B.PROVIDERS.filter(function (id) { var a = B.providerAccount(id); return a.count || a.setup || a.paid || a.returned || a.comReceived; }); }
  PANES.providers = function (pane) {
    var ids = shown();
    if (!ids.length) { pane.appendChild(h("section.card.ea-empty", null, [h("p", null, [ui.emo("💱"), t("ea.provNone")])])); return; }
    pane.appendChild(h("p.ea-intro", null, t("ea.provIntro")));
    pane.appendChild(h("div.ea-provs#eaProvs", null, ids.map(provCard)));
    pane.appendChild(settleLog());
  };
  function provCard(id) {
    var a = B.providerAccount(id), s = a.setup, prepaid = s && s.how === "prepaid", name = t("svc.p." + id), main, com;
    if (prepaid) main = fig(t("ea.balance"), money(-a.held), -a.held <= 0 ? "bad" : null, "eaBal-" + id, -a.held <= 0 ? t("ea.balanceOut") : t("ea.balanceSub"));
    else if (a.held >= 0) main = fig(t("ea.held", { p: name }), money(a.held), null, "eaHeld-" + id, t("ea.heldSub"));
    else main = fig(t("ea.owesStore", { p: name }), money(-a.held), null, "eaHeld-" + id, t("ea.owesSub"));
    if (s && s.com === "monthly") com = fig(t("ea.comDue"), money(a.comDue), a.comDue > 0 ? "warn" : null, "eaCom-" + id, t("ea.comDueSub", { m: money(a.comReceived) }));
    else com = fig(t("ea.comKept"), money(a.kept), null, "eaCom-" + id, t("ea.comKeptSub"));
    var chk = a.lastCheck, facts = [
      h("li", null, t(!a.cashOut ? "ea.tookIn" : !a.cashIn ? "ea.paidOut" : "ea.inOut", { a: money(a.cashIn), b: money(a.cashOut), n: a.count })),
      h("li", null, a.lastPaid ? t(prepaid ? "ea.lastAdded" : "ea.lastPaid", { d: dshort(a.lastPaid), m: money(a.paid) })
        : a.lastReturned ? t("ea.lastReturned", { d: dshort(a.lastReturned), m: money(a.returned) }) : t("ea.neverPaid")),
      chk ? h("li" + (chk.diff ? ".off" : ""), null, chk.diff ? t("ea.checkOff", { d: dshort(chk.day), m: money(Math.abs(chk.diff)) }) : t("ea.checkOk", { d: dshort(chk.day) })) : null,
      a.unknown ? h("li.off", null, [t(a.unknown === 1 ? "ea.unknown1" : "ea.unknown", { n: a.unknown }), " ",
        h("button.row-key#eaWriteCom-" + id, { type: "button", onclick: function () { EA.comForm(noCommission(function (v) { return v.provider === id; })); } }, h("span", null, t("ea.cmKey")))]) : null];
    var keys = [h("button.key.sm.primary#eaSettle-" + id, { type: "button", onclick: function () { EA.settleForm(id); } }, [U.icon("plus"), t("ea.record")]),
      h("button.key.sm#eaCheck-" + id, { type: "button", onclick: function () { EA.checkForm(id); } }, [U.icon("check"), t("ea.check")])];
    if (B.isOwner()) keys.push(h("button.key.sm#eaSetup-" + id, { type: "button", onclick: function () { EA.setupForm(id); } }, [U.icon("gear"), t("ea.setup")]));
    return h("article.ea-prov" + (prepaid ? ".prepaid" : ""), { id: "eaProv-" + id, "data-provider": id, "aria-labelledby": "eaProvH-" + id }, [
      h("div.ea-prov-h", null, [h("h3", { id: "eaProvH-" + id }, name), h("div.ea-tags", null, s ? [h("span.ea-chip", null, t("ea.how." + s.how)), h("span.ea-chip", null, t("ea.com." + s.com))]
        : [h("span.ea-chip.warn", null, t("ea.notSet"))])]),
      h("div.ea-figs.two", null, [main, com]), h("ul.ea-facts", null, facts), h("div.ea-keys", null, keys)]);
  }
  function settleLog() {
    var list = B.settlements().sort(function (a, b) { return a.day !== b.day ? (a.day < b.day ? 1 : -1) : (a.at < b.at ? 1 : -1); }), shownList = list.slice(0, 40);
    if (!list.length) return card("eaLog", "🗂️", t("ea.logH"), [h("p.muted", null, t("ea.logNone"))]);
    return card("eaLog", "🗂️", t("ea.logH"), [h("div.table-wrap", null, h("table.grid.compact#eaLogT", null, [
      h("thead", null, h("tr", null, [h("th", null, t("ea.when")), h("th", null, t("svc.provider")), h("th", null, t("ea.what")), h("th.num", null, t("svc.amount")), h("th", null, t("ea.ref")), h("th", null, t("ea.by")), h("th", null, h("span.ea-sr", null, t("ea.void")))])),
      h("tbody", null, shownList.map(function (x) {
        var void_ = x.status === "void", how = (B.provSetup(x.provider) || {}).how || "deposit";
        return h("tr" + (void_ ? ".voided" : ""), { "data-id": x.id }, [h("td", null, dshort(x.day)), h("td", null, t("svc.p." + x.provider)),
          h("td", null, [t(x.kind === "paid" ? "ea.k.paid." + how : "ea.k." + x.kind), void_ ? h("small.ea-void-why", null, t("ea.voided", { why: x.voidReason || "" })) : null]),
          h("td.num", null, money(x.amount)), h("td", null, x.ref || "—"), h("td", null, nameOf(x.by)),
          h("td", null, void_ ? null : h("button.row-key", { type: "button", title: t("ea.voidT"), "aria-label": t("ea.voidT"), onclick: function () { voidSettle(x); } }, U.icon("x")))]);
      }))])), list.length > shownList.length ? h("p.hint", null, t("ea.logMore", { n: list.length - shownList.length })) : null]);
  }
  function voidSettle(x) {
    var why = ui.input({ id: "vdWhy", maxlength: "200", placeholder: t("ea.voidPh") });
    ui.dialog({ title: t("ea.voidT"), emoji: "↩️", body: [h("p", null, t("ea.voidQ", { m: money(x.amount), p: t("svc.p." + x.provider), d: dshort(x.day) })), ui.field("ea.voidWhy", why, { required: true })],
      actions: [{ label: t("cancel") }, { label: t("ea.void"), kind: "danger", id: "vdSave", onClick: function (close, btn) {
        if (!why.value.trim()) { ui.fieldError(why, t("ea.err.note")); return false; }
        btn.disabled = true;
        B.voidSettle(x.id, why.value).then(function () { close(); ui.toast(t("ea.voidedToast")); redraw(); }, function (e) { btn.disabled = false; failed(e); });
        return false;
      } }], focus: "#vdWhy" });
  }

  /* recording a payment to or from a provider */
  EA.settleForm = function (id, kind0) {
    if (!B.can("reports")) return;
    var a = B.providerAccount(id), s = a.setup || { how: "deposit", com: "deducted" }, name = t("svc.p." + id), kind = kind0 || "paid";
    var seg = ui.seg([["paid", t("ea.k.paid." + s.how)], ["returned", t("ea.k.returned")], ["commission", t("ea.k.commission")]], kind, function (v) { kind = v; prefill(); }, t("ea.kindH"));
    seg.id = "stKind";
    var amount = ui.input({ id: "stAmount", inputmode: "decimal", class: "money-in" });
    var day = h("input#stDay", { type: "date", value: today(), max: today() });
    var ref = ui.input({ id: "stRef", maxlength: "40", placeholder: t("ea.refPh") });
    var note = ui.input({ id: "stNote", maxlength: "200" });
    var hint = h("p.hint.ea-hint#stHint");
    function prefill() {
      var v = kind === "paid" ? (s.how === "prepaid" ? 0 : Math.max(0, a.held)) : kind === "commission" ? Math.max(0, a.comDue) : 0;
      amount.value = v ? U.moneyPlain(v) : "";
      hint.textContent = kind === "paid" ? (s.how === "prepaid" ? t("ea.hint.prepaid", { m: money(-a.held) }) : t("ea.hint.held", { m: money(a.held), p: name }))
        : kind === "commission" ? (s.com === "monthly" ? t("ea.hint.comDue", { m: money(a.comDue) }) : t("ea.hint.comAtOnce")) : t("ea.hint.returned", { p: name });
    }
    prefill();
    ui.dialog({ title: t("ea.settleH", { p: name }), emoji: "🏦", body: [h("p.label-caps", null, t("ea.kindH")), seg, ui.field("ea.amount", amount, { required: true }), hint,
      ui.field("ea.day", day), ui.field("ea.ref", ref, { hint: t("ea.refHint") }), ui.field("ea.note", note)],
      actions: [{ label: t("cancel") }, { label: t("save"), kind: "primary", id: "stSave", onClick: function (close, btn) {
        ui.fieldError(amount, ""); ui.fieldError(day, "");
        var c = U.parseMoney(amount.value);
        if (c === null || c <= 0) { ui.fieldError(amount, t("ea.err.amount")); return false; }
        if (!day.value || day.value > today()) { ui.fieldError(day, t("ea.err.future")); return false; }
        btn.disabled = true;
        B.settle({ provider: id, kind: kind, amount: c, ref: ref.value, note: note.value, day: day.value }).then(function () { close(); ui.toast(t("ea.settled", { p: name }), "good"); redraw(); },
          function (e) { btn.disabled = false; failed(e); });
        return false;
      } }], focus: "#stAmount" });
  };
  /* checking a provider's statement against what Lakay works out */
  EA.checkForm = function (id) {
    if (!B.can("reports")) return;
    var a = B.providerAccount(id), prepaid = a.setup && a.setup.how === "prepaid", lakay = prepaid ? -a.held : a.held, name = t("svc.p." + id);
    var says = ui.input({ id: "ckSays", inputmode: "decimal", class: "money-in" });
    var note = ui.input({ id: "ckNote", maxlength: "200" });
    var out = h("p.ea-check#ckOut", { role: "status", "aria-live": "polite" });
    says.addEventListener("input", function () {
      var c = parseSigned(says.value);
      out.className = "ea-check" + (c === null ? "" : c === lakay ? " same" : " off");
      out.textContent = c === null ? "" : c === lakay ? t("ea.check.same") : t("ea.check.diff", { m: money(Math.abs(c - lakay)) });
    });
    ui.dialog({ title: t("ea.checkH", { p: name }), emoji: "🔎", body: [h("p", null, t(prepaid ? "ea.check.introPre" : "ea.check.intro", { p: name, m: money(lakay) })),
      ui.field(prepaid ? "ea.check.saysPre" : "ea.check.says", says, { required: true, hint: t("ea.check.minus") }), out, ui.field("ea.note", note)],
      actions: [{ label: t("cancel") }, { label: t("ea.check.save"), kind: "primary", id: "ckSave", onClick: function (close, btn) {
        var c = parseSigned(says.value);
        if (c === null) { ui.fieldError(says, t("ea.err.amount")); return false; }
        btn.disabled = true;
        B.checkStatement(id, c, note.value).then(function (x) {
          close(); ui.toast(x.diff ? t("ea.check.offToast", { m: money(Math.abs(x.diff)) }) : t("ea.check.okToast"), x.diff ? "warn" : "good"); redraw();
        }, function (e) { btn.disabled = false; failed(e); });
        return false;
      } }], focus: "#ckSays" });
  };
  /* how a provider settles: the owner's to say */
  EA.setupForm = function (id) {
    if (!B.isOwner()) return;
    var cur = B.provSetup(id) || { how: "deposit", com: "deducted", note: "" }, how = cur.how, com = cur.com;
    var d1 = h("p.hint.ea-hint#psHowD"), d2 = h("p.hint.ea-hint#psComD");
    function desc() { d1.textContent = t("ea.howD." + how); d2.textContent = t("ea.comD." + com); }
    var howSeg = ui.seg(B.PROV_HOW.map(function (k) { return [k, t("ea.how." + k)]; }), how, function (v) { how = v; desc(); }, t("ea.howH")); howSeg.id = "psHow";
    var comSeg = ui.seg(B.PROV_COM.map(function (k) { return [k, t("ea.com." + k)]; }), com, function (v) { com = v; desc(); }, t("ea.comH")); comSeg.id = "psCom";
    var note = ui.input({ id: "psNote", maxlength: "120", value: cur.note || "", placeholder: t("ea.setupNotePh") });
    desc();
    ui.dialog({ title: t("ea.setupH", { p: t("svc.p." + id) }), emoji: "⚙️", body: [h("p.label-caps", null, t("ea.howH")), howSeg, d1, h("p.label-caps", null, t("ea.comH")), comSeg, d2, ui.field("ea.note", note)],
      actions: [{ label: t("cancel") }, { label: t("save"), kind: "primary", id: "psSave", onClick: function (close, btn) {
        btn.disabled = true;
        B.setProvSetup(id, { how: how, com: com, note: note.value }).then(function () { close(); ui.toast(t("ea.setupSaved"), "good"); redraw(); }, function (e) { btn.disabled = false; failed(e); });
        return false;
      } }] });
  };

  /* ---------- Pay: everyone's hours, rates and pay, for those given "pay" ---------- */
  /* the people with hours in the last period that has ended, not yet marked paid */
  function unpaidLast() {
    var p = B.payPeriods(2)[1]; if (!p) return [];
    return staff().filter(function (u) { if (u.id === B.user.id && !B.isOwner()) return false; var e = B.payFor(u.id, p.from, p.to); return e.shifts > 0 && !e.paid; });
  }
  PANES.pay = function (pane) {
    var s = B.paySettings(), periods = B.payPeriods(6);
    if (EA.payAt >= periods.length) EA.payAt = 0;
    var p = periods[EA.payAt], over = p.to < today(), rateDay = p.to < today() ? p.to : today();
    var pick = ui.select(periods.map(function (x, i) { return [String(i), (i === 0 ? t("ea.thisPeriod") + " · " : i === 1 ? t("ea.lastPeriod") + " · " : "") + span(x)]; }), String(EA.payAt), { id: "eaPeriod" });
    pick.addEventListener("change", function () { EA.payAt = +pick.value; redraw(); });
    pane.appendChild(h("section.card.ea-set#eaPaySet", null, [
      h("div.ea-set-t", null, [h("p.label-caps", null, [ui.emo("🗓️"), t("ea.paidH")]), h("b#eaPayRule", null, t("ea.period." + s.period)), h("small", null, otRule(s))]),
      h("div.ea-set-pick", null, [h("label.ea-sr", { for: "eaPeriod" }, t("ea.periodPick")), pick]),
      h("button.key.sm#eaPaySetKey", { type: "button", onclick: EA.settingsForm }, [U.icon("gear"), t("ea.change")])]));
    var rows = staff().map(function (u) { return { u: u, e: B.payFor(u.id, p.from, p.to), rate: B.rateOf(u.id, rateDay), self: u.id === B.user.id && !B.isOwner() }; });
    var tot = rows.reduce(function (m, r) { m.reg += r.e.regMin; m.ot += r.e.otMin; m.gross += r.e.gross; m.paid += r.e.paid ? r.e.paid.amount : 0; m.open += r.e.open; m.noRate += r.e.noRate; return m; }, { reg: 0, ot: 0, gross: 0, paid: 0, open: 0, noRate: 0 });
    if (!rows.length) { pane.appendChild(h("section.card.ea-empty", null, h("p", null, [ui.emo("👥"), t("ea.noStaff")]))); return; }
    var body = rows.map(function (r) {
      var u = r.u, e = r.e, rateKey = r.self ? h("span.muted", { title: t("ea.err.self") }, r.rate === null ? "—" : perHour(r.rate))
        : h("button.row-key#eaRate-" + u.id, { type: "button", onclick: function () { EA.rateForm(u.id); } }, [U.icon("edit"), h("span", null, r.rate === null ? t("ea.setRate") : perHour(r.rate))]);
      var paid = e.paid ? h("button.row-key.ea-paid#eaPaid-" + u.id, { type: "button", onclick: function () { EA.paidView(e.paid); } }, [U.icon("check"), h("span", null, t("ea.paidShort", { m: money(e.paid.amount), how: t("ea.wm." + e.paid.method) }))])
        : r.self ? h("span.muted", null, t("ea.notPaid")) : e.shifts ? h("button.key.sm#eaMark-" + u.id, { type: "button", onclick: function () { EA.markForm(u.id, p); } }, t("ea.markPaid")) : h("span.muted", null, t("ea.noHours"));
      var warn = [];
      if (e.open) warn.push(t(e.open === 1 ? "ea.open1" : "ea.open", { n: e.open }));
      if (e.noRate) warn.push(t(e.noRate === 1 ? "ea.noRate1" : "ea.noRate", { n: e.noRate }));
      return h("tr", { "data-user": u.id }, [h("th", { scope: "row" }, [h("b", null, u.name), h("small", null, t("people.id", { n: B.numberOf(u) }))]), h("td", null, rateKey),
        h("td.num", null, [dur(e.regMin), h("small", null, t(e.shifts === 1 ? "ea.shifts1" : "ea.shifts", { n: e.shifts }))]), h("td.num", null, e.otMin ? dur(e.otMin) : "—"),
        h("td.num", null, [h("b", null, e.shifts && e.noRate === e.shifts ? "—" : money(e.gross)), warn.length ? h("small.warn", null, warn.join(" · ")) : null]), h("td", null, paid)]);
    });
    pane.appendChild(h("section.card.ea-sec#eaPayCard", { "aria-labelledby": "eaPayH" }, [
      h("div.card-head", null, [h("h2#eaPayH", null, [ui.emo("👥"), t("ea.payH", { p: span(p) })]), over ? null : h("span.ea-chip", null, t("ea.inProgress"))]),
      h("div.table-wrap", null, h("table.grid.compact.ea-pay#eaPayT", null, [
        h("thead", null, h("tr", null, [h("th", null, t("ea.person")), h("th", null, t("ea.rate")), h("th.num", null, t("ea.hours")), h("th.num", null, t("ea.ot")), h("th.num", null, t("ea.estimate")), h("th", null, t("ea.paidCol"))])),
        h("tbody", null, body),
        h("tfoot", null, h("tr", null, [h("th", { scope: "row" }, t("ea.total")), h("td"), h("td.num", null, dur(tot.reg)), h("td.num", null, tot.ot ? dur(tot.ot) : "—"), h("td.num#eaPayTotal", null, h("b", null, money(tot.gross))),
          h("td", null, tot.paid ? t("ea.paidSum", { m: money(tot.paid) }) : "")]))])),
      tot.open ? h("p.note", null, [ui.emo("🕘"), t("ea.openNote")]) : null,
      h("p.hint", null, t("ea.payHonest"))]));
  };
  /* how often pay is worked out, and the overtime */
  EA.settingsForm = function () {
    if (!B.can("pay")) return;
    var s = B.paySettings();
    var period = ui.select(B.PAY_PERIODS.map(function (k) { return [k, t("ea.period." + k)]; }), s.period, { id: "ppPeriod" });
    var anchor = h("input#ppAnchor", { type: "date", value: s.anchor });
    var anchorBox = ui.field("ea.anchor", anchor, { hint: t("ea.anchorHint") });
    function showAnchor() { anchorBox.hidden = period.value !== "biweekly"; }
    period.addEventListener("change", showAnchor); showAnchor();
    var ot = h("input#ppOt", { type: "checkbox" }); ot.checked = s.otAfter !== null;
    var after = ui.input({ id: "ppAfter", inputmode: "numeric", value: String(s.otAfter === null ? 40 : s.otAfter), maxlength: "2" });
    var times = ui.select([["150", t("ea.x150")], ["200", t("ea.x200")]], String(s.otTimes === 200 ? 200 : 150), { id: "ppTimes" });
    var otBox = h("div.ea-ot", null, [ui.field("ea.otAfter", after), ui.field("ea.otTimes", times)]);
    function showOt() { otBox.hidden = !ot.checked; }
    ot.addEventListener("change", showOt); showOt();
    ui.dialog({ title: t("ea.setH"), emoji: "🗓️", body: [ui.field("ea.periodH", period), anchorBox,
      h("label.access-row#ppOtRow", { for: "ppOt" }, [ot, h("span", null, [h("b", null, t("ea.otOn")), h("small", null, t("ea.otOnD"))])]), otBox, h("p.hint", null, t("ea.otCheck"))],
      actions: [{ label: t("cancel") }, { label: t("save"), kind: "primary", id: "ppSave", onClick: function (close, btn) {
        ui.fieldError(after, "");
        var n = parseInt(after.value, 10);
        if (ot.checked && !(n >= 1 && n <= 80)) { ui.fieldError(after, t("ea.err.overtime")); return false; }
        btn.disabled = true;
        B.setPaySettings({ period: period.value, anchor: anchor.value, otAfter: ot.checked ? n : null, otTimes: +times.value }).then(function () { close(); EA.payAt = 0; ui.toast(t("ea.setSaved"), "good"); redraw(); },
          function (e) { btn.disabled = false; failed(e); });
        return false;
      } }] });
  };
  /* a person's rate, from a day on (the days before keep the rate they had) */
  EA.rateForm = function (uid) {
    var u = B.state().users[uid]; if (!u || !B.can("pay")) return;
    if (uid === B.user.id && !B.isOwner()) { ui.toast(t("ea.err.self"), "bad"); return; }
    var cur = B.rateOf(uid, today()), list = B.rates(uid).slice().reverse();
    var rate = ui.input({ id: "rtRate", inputmode: "decimal", class: "money-in", value: cur !== null ? U.moneyPlain(cur) : "" });
    var from = h("input#rtFrom", { type: "date", value: today() });
    ui.dialog({ title: t("ea.rateH", { name: u.name }), emoji: "🏷️", body: [ui.field("ea.rateField", rate, { required: true, hint: t("ea.rateHint") }), ui.field("ea.rateFrom", from, { hint: t("ea.rateFromHint") }),
      list.length ? h("div.ea-hist", null, [h("p.label-caps", null, t("ea.rateHist")), h("ul.ea-facts", null, list.map(function (x) { return h("li", null, t("ea.rateFromLine", { d: dshort(x.from), m: perHour(x.rate) })); }))]) : null],
      actions: [{ label: t("cancel") }, { label: t("save"), kind: "primary", id: "rtSave", onClick: function (close, btn) {
        ui.fieldError(rate, "");
        var c = U.parseMoney(rate.value);
        if (c === null || c > 100000) { ui.fieldError(rate, t("ea.err.rate")); return false; }
        btn.disabled = true;
        B.setRate(uid, c, from.value || today()).then(function () { close(); ui.toast(t("ea.rateSaved", { name: u.name }), "good"); redraw(); }, function (e) { btn.disabled = false; failed(e); });
        return false;
      } }], focus: "#rtRate" });
  };
  /* a period's pay, handed over */
  EA.markForm = function (uid, p) {
    var u = B.state().users[uid]; if (!u || !B.can("pay")) return;
    if (uid === B.user.id && !B.isOwner()) { ui.toast(t("ea.err.self"), "bad"); return; }
    var e = B.payFor(uid, p.from, p.to), over = p.to < today();
    var amount = ui.input({ id: "mpAmount", inputmode: "decimal", class: "money-in", value: U.moneyPlain(e.gross) });
    var method = ui.select(B.WAGE_METHODS.map(function (k) { return [k, t("ea.wm." + k)]; }), "cash", { id: "mpMethod" });
    var ref = ui.input({ id: "mpRef", maxlength: "40", placeholder: t("ea.mpRefPh") });
    var note = ui.input({ id: "mpNote", maxlength: "200" });
    ui.dialog({ title: t("ea.markH", { name: u.name }), emoji: "🧾", body: [
      h("p", null, t("ea.markIntro", { name: u.name, d: dur(e.regMin + e.otMin), p: span(p), m: money(e.gross) })),
      over ? null : h("p.note", null, [ui.emo("⚠️"), t("ea.notOver")]), e.open ? h("p.note", null, [ui.emo("🕘"), t("ea.openNote")]) : null,
      ui.field("ea.amountPaid", amount, { required: true, hint: t("ea.amountHint") }), ui.field("ea.method", method), ui.field("ea.ref", ref), ui.field("ea.note", note)],
      actions: [{ label: t("cancel") }, { label: t("ea.markPaid"), kind: "primary", id: "mpSave", onClick: function (close, btn) {
        ui.fieldError(amount, "");
        var c = U.parseMoney(amount.value);
        if (c === null) { ui.fieldError(amount, t("ea.err.amount")); return false; }
        btn.disabled = true;
        B.markPaid({ user: uid, from: p.from, to: p.to, amount: c, method: method.value, ref: ref.value, note: note.value }).then(function () { close(); ui.toast(t("ea.marked", { name: u.name }), "good"); redraw(); },
          function (er) { btn.disabled = false; failed(er); });
        return false;
      } }], focus: "#mpAmount" });
  };
  /* what was handed over, and undoing it with a reason */
  EA.paidView = function (x) {
    var mayUndo = B.can("pay") && (x.user !== B.user.id || B.isOwner());
    var rows = [[t("ea.amountPaid"), money(x.amount)], [t("ea.method"), t("ea.wm." + x.method)], [t("ea.periodWord"), span(x)], [t("ea.hours"), dur(x.minutes || 0) + (x.otMinutes ? " · " + t("ea.otShort", { d: dur(x.otMinutes) }) : "")],
      [t("ea.estimate"), money(x.estimate || 0)], [t("ea.paidWhen"), E.fmtDate(new Date(x.at), "long") + ", " + E.fmtTime(new Date(x.at))], [t("ea.by"), nameOf(x.by)]];
    if (x.ref) rows.splice(2, 0, [t("ea.ref"), x.ref]);
    if (x.note) rows.push([t("ea.note"), x.note]);
    var actions = [{ label: t("close") }];
    if (mayUndo) actions.unshift({ label: t("ea.undoPaid"), kind: "danger", id: "pvUndo", onClick: function (close) {
      close();
      var why = ui.input({ id: "pvWhy", maxlength: "200", placeholder: t("ea.voidPh") });
      ui.dialog({ title: t("ea.undoPaid"), emoji: "↩️", body: [h("p", null, t("ea.undoQ", { name: nameOf(x.user), m: money(x.amount) })), ui.field("ea.voidWhy", why, { required: true })],
        actions: [{ label: t("cancel") }, { label: t("ea.undoPaid"), kind: "danger", id: "pvSave", onClick: function (c2, btn) {
          if (!why.value.trim()) { ui.fieldError(why, t("ea.err.note")); return false; }
          btn.disabled = true;
          B.voidPaid(x.id, why.value).then(function () { c2(); ui.toast(t("ea.undone")); redraw(); }, function (e) { btn.disabled = false; failed(e); });
          return false;
        } }], focus: "#pvWhy" });
    } });
    ui.dialog({ title: t("ea.paidViewH", { name: nameOf(x.user) }), emoji: "🧾", body: h("dl.ea-dl", null, [].concat.apply([], rows.map(function (r) { return [h("dt", null, r[0]), h("dd", null, r[1])]; }))), actions: actions });
  };

  /* ---------- the Home: what is waiting ---------- */
  EA.homeRows = function (need) {
    var out = []; if (!B.user) return out;
    if (B.can("pay")) {
      var left = unpaidLast();
      if (left.length) out.push(need("🧾", t(left.length === 1 ? "ea.home1" : "ea.home", { n: left.length }), left.map(function (u) { return u.name; }).join(", "), null,
        [t("home.open"), function () { EA.tab = "pay"; EA.payAt = 1; ui.go("earnings"); }]));
    }
    if (B.can("reports")) {
      B.PROVIDERS.forEach(function (id) {
        var a = B.providerAccount(id);
        if (a.setup && a.setup.how === "prepaid" && a.count && -a.held <= 0) out.push(need("💱", t("ea.homeOut", { p: t("svc.p." + id) }), t("ea.homeOutSub"), "warn",
          [t("home.open"), function () { EA.tab = "providers"; ui.go("earnings"); }]));
      });
    }
    return out;
  };
})();
