/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Travel bookings (Build 22). The owner books flights on websites for the store's clients; Lakay keeps a short record
   of each: the trip (from, to, the days, how many travel), where it was booked and its confirmation code, the ticket's
   price and the store's fee, and the client's payments until it is paid in full. The store's fee is its own earning,
   and joins the commission in Earnings. Never a passport number or a card number: Lakay refuses both wherever they
   could be typed. The client's name and phone are kept only if the owner turns that on in Settings (off at first). */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui, money = U.money;
  var TV = E.travel = { show: null };

  /* ---------- small helpers ---------- */
  function today() { return U.dayKey(); }
  function dshort(k) {
    var d = typeof k === "string" ? U.fromDayKey(k) : k, s = E.fmtDate(d, "short"), y = " " + new Date().getFullYear();
    return s.slice(-y.length) === y ? s.slice(0, -y.length) : s;
  }
  /* "Fri 20 Nov": the day of the week, cut to three letters, and the day */
  function dday(k) { var w = E.fmtDate(U.fromDayKey(k), "long").split(" ")[0]; return w.charAt(0).toUpperCase() + w.slice(1, 3) + " " + dshort(k); }
  function route(b) { return b.from + " → " + b.to; }
  function nameOf(id) { var u = B.state().users[id]; return u ? u.name : id; }
  var ERR = { place: "tv.err.place", days: "tv.err.days", pax: "tv.err.pax", amount: "tv.err.amount", over: "tv.err.over", card: "tv.err.card", idnum: "tv.err.idnum",
    method: "tv.err.method", note: "tv.err.note", closed: "tv.err.closed", refund: "tv.err.refund", kept: "tv.err.kept", below: "tv.err.below", drill: "ex.busy" };
  function failed(e) { var k = e && ERR[e.code]; if (k) ui.toast(t(k), "bad"); else ui.failed(e); }
  function redraw() { if (ui.current === "travel") ui.refresh(); }
  function chip(cls, text, icon) { return h("span.tv-chip" + (cls ? "." + cls : ""), null, [icon ? U.icon(icon) : null, text]); }
  /* where a booking stands: cancelled, travelled, paid in full, or a balance to pay */
  function stateOf(b) {
    var m = B.bookingMoney(b);
    if (b.status === "cancelled") return { key: "cancelled", m: m };
    if ((b.ret || b.depart) < today()) return { key: m.balance > 0 ? "due" : "travelled", m: m };
    return { key: m.balance > 0 ? "due" : "paid", m: m };
  }
  var FILTERS = ["due", "coming", "all", "cancelled"];
  function listFor(f) {
    var all = B.bookings();
    var out = all.filter(function (b) {
      var s = stateOf(b);
      if (f === "due") return s.key === "due";
      if (f === "coming") return b.status !== "cancelled" && (b.ret || b.depart) >= today();
      if (f === "cancelled") return b.status === "cancelled";
      return true;
    });
    return out.sort(function (a, b) { return f === "coming" || f === "due" ? (a.depart < b.depart ? -1 : a.depart > b.depart ? 1 : 0) : (a.at < b.at ? 1 : -1); });
  }

  /* ---------- the room ---------- */
  ui.rooms.travel = function (main) {
    if (!TV.show) TV.show = listFor("due").length ? "due" : "coming";
    main.appendChild(ui.roomHead("room.travel", "tip.travel", [h("button.key.primary#tvNew", { type: "button", onclick: function () { TV.form(null); } }, [U.icon("plus"), t("tv.new")])]));
    var due = listFor("due"), dueSum = due.reduce(function (s, b) { return s + B.bookingMoney(b).balance; }, 0), month = B.bookingEarned(U.dayKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), today());
    var stats = [ui.stat(t("tv.statDue"), money(dueSum), dueSum ? "warn" : null, "tvDueSum", "🧾"), ui.stat(t("tv.statDueN"), String(due.length), null, "tvDueN", "✈️"),
      ui.stat(t("tv.statMonth"), String(month.count + month.cancelled), null, "tvMonthN", "🗓️")];
    if (B.can("costs")) stats.push(ui.stat(t("tv.statFees"), money(month.fees), "good", "tvMonthFees", "💰"));
    main.appendChild(h("section.card.tv-sum", null, h("div.ledger", null, stats)));
    var chips = h("div.chips.tv-filters", { role: "group", "aria-label": t("tv.filterH") }, FILTERS.map(function (f) {
      var n = listFor(f).length;
      return h("button.chip", { type: "button", "data-f": f, "aria-pressed": String(TV.show === f), onclick: function () { TV.show = f; redraw(); } }, t("tv.f." + f) + (f === "all" ? "" : " · " + n));
    }));
    main.appendChild(chips);
    var list = listFor(TV.show);
    if (!list.length) { main.appendChild(h("section.card.tv-empty", null, h("p", null, [ui.emo("✈️"), t("tv.none." + TV.show)]))); }
    else main.appendChild(h("div.tv-list#tvList", null, list.map(card)));
    main.appendChild(h("p.hint.tv-never", null, [U.icon("lock"), h("span", null, t("tv.never"))]));
  };
  B.on("lock", function () { TV.show = null; });

  function card(b) {
    var s = stateOf(b), m = s.m, kids = [];
    kids.push(h("div.tv-card-h", null, [h("h3.tv-route", null, route(b)), h("div.tv-tags", null, [
      s.key === "cancelled" ? chip("bad", t("tv.s.cancelled")) : s.key === "due" ? chip("warn", t("tv.s.due", { m: money(m.balance) })) : s.key === "paid" ? chip("paid", t("tv.s.paid"), "check") : chip("", t("tv.s.travelled"), "check"),
      h("span.tv-no", null, b.no)])]));
    kids.push(h("p.tv-when", null, [U.icon("calendar"), h("span", null, b.ret ? t("tv.roundTrip", { a: dday(b.depart), b: dday(b.ret) }) : t("tv.oneWay", { a: dday(b.depart) })),
      h("span.tv-dot", { "aria-hidden": "true" }, "·"), h("span", null, t(b.pax === 1 ? "tv.pax1" : "tv.pax", { n: b.pax }))]));
    var facts = [];
    if (b.code) facts.push(h("span", null, [t("tv.codeShort"), " ", h("b.tv-code", null, b.code)]));
    if (b.site) facts.push(h("span", null, t("tv.via", { s: b.site })));
    if (b.client && (b.client.name || b.client.phone)) facts.push(h("span", null, [U.icon("people"), " ", [b.client.name, b.client.phone].filter(Boolean).join(" · ")]));
    if (facts.length) kids.push(h("p.tv-facts", null, facts));
    kids.push(h("div.tv-money", null, [
      h("span", null, [h("small", null, t("tv.total")), h("b", null, money(m.total))]),
      h("span", null, [h("small", null, t("tv.paid")), h("b", null, money(m.paid))]),
      b.status === "cancelled" ? h("span", null, [h("small", null, t("tv.refunded")), h("b", null, money(m.refunded))]) : h("span" + (m.balance ? ".due" : ""), null, [h("small", null, t("tv.balance")), h("b", null, money(m.balance))])]));
    var keys = [];
    if (b.status !== "cancelled" && m.balance > 0) keys.push(h("button.key.sm.primary#tvPay-" + b.id, { type: "button", onclick: function () { TV.payForm(b.id); } }, [U.icon("cash"), t("tv.takePay")]));
    keys.push(h("button.key.sm#tvOpen-" + b.id, { type: "button", onclick: function () { TV.view(b.id); } }, [U.icon("list"), t("tv.open")]));
    kids.push(h("div.tv-keys", null, keys));
    return h("article.tv-card.is-" + s.key, { id: "tvCard-" + b.id, "data-id": b.id }, kids);
  }

  /* ---------- a booking: new or changed ---------- */
  TV.form = function (id) {
    if (!B.can("sell")) return;
    var b = id ? B.booking(id) : null, prefs = B.bookingPrefs(), costs = B.can("costs") || !b;
    var from = ui.input({ id: "bkFrom", maxlength: "40", value: b ? b.from : "", placeholder: t("tv.fromPh"), autocapitalize: "characters" });
    var to = ui.input({ id: "bkTo", maxlength: "40", value: b ? b.to : "", placeholder: t("tv.toPh"), autocapitalize: "characters" });
    var depart = h("input#bkDepart", { type: "date", value: b ? b.depart : "" });
    var oneWay = h("input#bkOneWay", { type: "checkbox" }); oneWay.checked = b ? !b.ret : false;
    var ret = h("input#bkReturn", { type: "date", value: b && b.ret ? b.ret : "" });
    var retBox = ui.field("tv.return", ret);
    function showRet() { retBox.hidden = oneWay.checked; }
    oneWay.addEventListener("change", showRet); showRet();
    var pax = ui.input({ id: "bkPax", inputmode: "numeric", maxlength: "2", value: String(b ? b.pax : 1) });
    var site = ui.input({ id: "bkSite", maxlength: "40", value: b ? b.site || "" : "", placeholder: t("tv.sitePh") });
    var code = ui.input({ id: "bkCode", maxlength: "12", value: b ? b.code || "" : "", placeholder: t("tv.codePh"), autocapitalize: "characters" });
    var ticket = ui.input({ id: "bkTicket", inputmode: "decimal", class: "money-in", value: b ? U.moneyPlain(b.ticket) : "" });
    var fee = ui.input({ id: "bkFee", inputmode: "decimal", class: "money-in", value: b ? U.moneyPlain(b.fee) : prefs.fee ? U.moneyPlain(prefs.fee) : "" });
    var totalOut = h("p.tv-total#bkTotal", { role: "status", "aria-live": "polite" });
    function total() { var a = U.parseMoney(ticket.value) || 0, f = U.parseMoney(fee.value) || 0; totalOut.textContent = t("tv.clientPays", { m: money(a + f) }); }
    ticket.addEventListener("input", total); fee.addEventListener("input", total); total();
    var note = ui.input({ id: "bkNote", maxlength: "200", value: b ? b.note || "" : "" });
    var body = [h("div.tv-two", null, [ui.field("tv.from", from, { required: true }), ui.field("tv.to", to, { required: true })]),
      h("div.tv-two", null, [ui.field("tv.depart", depart, { required: true }), retBox]),
      h("label.access-row.tv-oneway", { for: "bkOneWay" }, [oneWay, h("span", null, h("b", null, t("tv.oneWayQ")))]),
      h("div.tv-two", null, [ui.field("tv.paxField", pax, { required: true }), ui.field("tv.code", code, { hint: t("tv.codeHint") })]),
      ui.field("tv.site", site)];
    if (costs) body.push(h("div.tv-two", null, [ui.field("tv.ticket", ticket, { required: true, hint: t("tv.ticketHint") }), ui.field("tv.fee", fee, { hint: t("tv.feeHint") })]), totalOut);
    var cname = null, cphone = null;
    if (prefs.keepClient) {
      cname = ui.input({ id: "bkClient", maxlength: "60", value: b && b.client ? b.client.name || "" : "", autocomplete: "off" });
      cphone = ui.input({ id: "bkPhone", inputmode: "tel", maxlength: "20", value: b && b.client ? b.client.phone || "" : "" });
      body.push(h("div.tv-two", null, [ui.field("tv.client", cname), ui.field("tv.phone", cphone)]));
    }
    body.push(ui.field("tv.note", note, { hint: t("tv.noteHint") }));
    /* a first payment, as the booking is made */
    var dep = null, depMethod = null;
    if (!b) {
      dep = ui.input({ id: "bkDeposit", inputmode: "decimal", class: "money-in" });
      depMethod = ui.seg(methods().map(function (k) { return [k, t("tv.m." + k)]; }), "cash", function () { }, t("tv.method")); depMethod.id = "bkDepMethod";
      body.push(h("div.tv-first", null, [ui.field("tv.deposit", dep, { hint: t("tv.depositHint") }), h("p.label-caps", null, t("tv.method")), depMethod]));
    }
    ui.dialog({ title: t(b ? "tv.changeH" : "tv.newH"), emoji: "✈️", wide: true, body: body,
      actions: [{ label: t("cancel") }, { label: t(b ? "save" : "tv.make"), kind: "primary", id: "bkSave", onClick: function (close, btn) {
        [from, to, depart, ret, pax, code, ticket, fee, note, dep, cname, cphone].forEach(function (x) { if (x) ui.fieldError(x, ""); });
        var f = { from: from.value, to: to.value, depart: depart.value, ret: oneWay.checked ? null : ret.value || null, pax: parseInt(pax.value, 10), site: site.value, code: code.value, note: note.value };
        if (costs) { f.ticket = U.parseMoney(ticket.value); f.fee = fee.value.trim() ? U.parseMoney(fee.value) : 0; }
        if (cname) f.client = { name: cname.value, phone: cphone.value };
        if (!f.from.trim()) { ui.fieldError(from, t("tv.err.place")); return false; }
        if (!f.to.trim()) { ui.fieldError(to, t("tv.err.place")); return false; }
        if (!f.depart) { ui.fieldError(depart, t("tv.err.days")); return false; }
        if (!oneWay.checked && !f.ret) { ui.fieldError(ret, t("tv.err.ret")); return false; }
        if (costs && (f.ticket === null || f.ticket <= 0)) { ui.fieldError(ticket, t("tv.err.amount")); return false; }
        if (costs && f.fee === null) { ui.fieldError(fee, t("tv.err.amount")); return false; }
        var first = null;
        if (dep && dep.value.trim()) {
          var c = U.parseMoney(dep.value); if (c === null || c <= 0) { ui.fieldError(dep, t("tv.err.amount")); return false; }
          first = { amount: c, method: depMethod.querySelector('[aria-checked="true"]').getAttribute("data-v") };
        }
        btn.disabled = true;
        (b ? B.changeBooking(b.id, f) : B.addBooking(f, first)).then(function (x) { close(); ui.toast(t(b ? "tv.changed" : "tv.made", { no: x.no }), "good"); redraw(); }, function (e) {
          btn.disabled = false;
          var k = e && ERR[e.code], where = { place: from, days: depart, pax: pax, card: note, idnum: note, amount: ticket, below: ticket, over: dep }[e && e.code];
          if (e && (e.code === "card" || e.code === "idnum") && e.extra) where = { code: code, site: site, note: note, place: from, client: cname, phone: cphone }[e.extra] || note;
          if (k && where) ui.fieldError(where, t(k)); else failed(e);
        });
        return false;
      } }], focus: b ? "#bkDepart" : "#bkFrom" });
  };
  /* the ways the store takes money for a booking: cash, a card on its own machine, or another way it accepts */
  function methods() { var p = B.payPrefs(), out = ["cash"]; if (p.methods.indexOf("card") >= 0) out.push("card"); if ((p.others || []).length) out.push("other"); return out; }

  /* ---------- a payment from the client ---------- */
  TV.payForm = function (id) {
    var b = B.booking(id); if (!b || b.status === "cancelled" || !B.can("sell")) return;
    var m = B.bookingMoney(b), method = "cash";
    var amount = ui.input({ id: "tpAmount", inputmode: "decimal", class: "money-in", value: U.moneyPlain(m.balance) });
    var ref = ui.input({ id: "tpRef", maxlength: "20", placeholder: t("tv.refPh") });
    var refBox = ui.field("tv.ref", ref, { hint: t("tv.refHint") });
    var seg = ui.seg(methods().map(function (k) { return [k, t("tv.m." + k)]; }), method, function (v) { method = v; refBox.hidden = v === "cash"; }, t("tv.method")); seg.id = "tpMethod";
    refBox.hidden = true;
    ui.dialog({ title: t("tv.payH", { r: route(b) }), emoji: "🧾", body: [h("p", null, t("tv.payIntro", { no: b.no, m: money(m.balance) })), ui.field("tv.amount", amount, { required: true }),
      h("p.label-caps", null, t("tv.method")), seg, refBox],
      actions: [{ label: t("cancel") }, { label: t("tv.take"), kind: "primary", id: "tpSave", onClick: function (close, btn) {
        ui.fieldError(amount, ""); ui.fieldError(ref, "");
        var c = U.parseMoney(amount.value);
        if (c === null || c <= 0) { ui.fieldError(amount, t("tv.err.amount")); return false; }
        if (c > m.balance) { ui.fieldError(amount, t("tv.err.overM", { m: money(m.balance) })); return false; }
        btn.disabled = true;
        B.payBooking(b.id, { amount: c, method: method, ref: method === "cash" ? "" : ref.value }).then(function (x) {
          close(); var left = B.bookingMoney(x).balance;
          ui.toast(left ? t("tv.payTaken", { m: money(c), b: money(left) }) : t("tv.payFull", { m: money(c) }), "good"); redraw();
        }, function (e) { btn.disabled = false; if (e && e.code === "card") ui.fieldError(ref, t("tv.err.card")); else failed(e); });
        return false;
      } }], focus: "#tpAmount" });
  };

  /* ---------- a booking, in full ---------- */
  TV.view = function (id) {
    var b = B.booking(id); if (!b) return;
    var m = B.bookingMoney(b), costs = B.can("costs"), rows = [];
    rows.push([t("tv.trip"), route(b)]);
    rows.push([t("tv.when"), b.ret ? t("tv.roundTrip", { a: dday(b.depart), b: dday(b.ret) }) : t("tv.oneWay", { a: dday(b.depart) })]);
    rows.push([t("tv.paxField"), String(b.pax)]);
    if (b.code) rows.push([t("tv.code"), b.code]);
    if (b.site) rows.push([t("tv.site"), b.site]);
    if (b.client && (b.client.name || b.client.phone)) rows.push([t("tv.clientWord"), [b.client.name, b.client.phone].filter(Boolean).join(" · ")]);
    if (costs) { rows.push([t("tv.ticket"), money(b.ticket)]); rows.push([t("tv.fee"), money(b.fee)]); }
    rows.push([t("tv.total"), money(m.total)]);
    if (b.note) rows.push([t("tv.note"), b.note]);
    rows.push([t("tv.madeBy"), nameOf(b.by) + ", " + E.fmtDate(new Date(b.at), "long")]);
    if (b.status === "cancelled") rows.push([t("tv.s.cancelled"), t("tv.cancelLine", { k: money(b.feeKept || 0), r: money(m.refunded), why: b.cancelReason || "" })]);
    var pays = (b.pays || []).slice().sort(function (x, y) { return x.at < y.at ? -1 : 1; });
    var payT = pays.length ? h("div.table-wrap", null, h("table.grid.compact#tvPays", null, [
      h("thead", null, h("tr", null, [h("th", null, t("tv.when")), h("th", null, t("tv.what")), h("th.num", null, t("tv.amount")), h("th", null, t("tv.by")), h("th", null, h("span.tv-sr", null, t("tv.void")))])),
      h("tbody", null, pays.map(function (p) {
        var v = p.status === "void";
        return h("tr" + (v ? ".voided" : ""), { "data-pay": p.id }, [h("td", null, dshort(U.dayKey(new Date(p.at))) + ", " + E.fmtTime(new Date(p.at))),
          h("td", null, [t(p.kind === "refund" ? "tv.k.refund" : "tv.k.pay", { m: t("tv.m." + p.method) }) + (p.ref ? " · " + p.ref : ""), v ? h("small.tv-void-why", null, t("tv.voided", { why: p.voidReason || "" })) : null]),
          h("td.num", null, (p.kind === "refund" ? "−" : "") + money(p.amount)), h("td", null, nameOf(p.by)),
          h("td", null, !v && B.can("reports") && b.status !== "cancelled" ? h("button.row-key", { type: "button", title: t("tv.voidPay"), "aria-label": t("tv.voidPay"), onclick: function () { if (dlg) dlg.close(); voidPay(b, p); } }, U.icon("x")) : null)]);
      }))])) : h("p.muted", null, t("tv.noPays"));
    var actions = [{ label: t("close") }];
    if (b.status !== "cancelled" && B.can("reports")) actions.unshift({ label: t("tv.cancelB"), kind: "danger", id: "tvCancel", onClick: function (close) { close(); TV.cancelForm(b.id); } });
    if (b.status !== "cancelled") actions.splice(actions.length - 1, 0, { label: t("tv.change"), id: "tvChange", onClick: function (close) { close(); TV.form(b.id); } });
    if (b.status !== "cancelled" && m.balance > 0) actions.push({ label: t("tv.takePay"), kind: "primary", id: "tvViewPay", onClick: function (close) { close(); TV.payForm(b.id); } });
    var dlg = ui.dialog({ title: b.no + " · " + route(b), emoji: "✈️", wide: true, body: [h("dl.ea-dl.tv-dl", null, [].concat.apply([], rows.map(function (r) { return [h("dt", null, r[0]), h("dd", null, r[1])]; }))),
      h("div.tv-money.tv-money-view", null, [h("span", null, [h("small", null, t("tv.paid")), h("b", null, money(m.paid))]), h("span" + (m.balance ? ".due" : ""), null, [h("small", null, t("tv.balance")), h("b", null, money(m.balance))])]),
      h("p.label-caps.tv-pays-h", null, t("tv.paysH")), payT], actions: actions });
  };
  function voidPay(b, p) {
    var why = ui.input({ id: "tvWhy", maxlength: "200", placeholder: t("tv.voidPh") });
    ui.dialog({ title: t("tv.voidPay"), emoji: "↩️", body: [h("p", null, t("tv.voidQ", { m: money(p.amount), no: b.no })), ui.field("tv.why", why, { required: true })],
      actions: [{ label: t("cancel") }, { label: t("tv.void"), kind: "danger", id: "tvVoidSave", onClick: function (close, btn) {
        if (!why.value.trim()) { ui.fieldError(why, t("tv.err.note")); return false; }
        btn.disabled = true;
        /* the booking's window comes back, with the payment struck through */
        B.voidBookingPay(b.id, p.id, why.value).then(function () { close(); ui.toast(t("tv.voidedToast")); redraw(); TV.view(b.id); }, function (e) { btn.disabled = false; failed(e); });
        return false;
      } }], focus: "#tvWhy" });
  }

  /* ---------- cancelling: the fee the store keeps, and what goes back to the client ---------- */
  TV.cancelForm = function (id) {
    var b = B.booking(id); if (!b || b.status === "cancelled" || !B.can("reports")) return;
    var m = B.bookingMoney(b);
    var kept = ui.input({ id: "bcKept", inputmode: "decimal", class: "money-in", value: U.moneyPlain(Math.min(b.fee, m.paid)) });
    var refund = ui.input({ id: "bcRefund", inputmode: "decimal", class: "money-in", value: U.moneyPlain(Math.max(0, m.paid - Math.min(b.fee, m.paid))) });
    var method = "cash", seg = ui.seg(methods().map(function (k) { return [k, t("tv.m." + k)]; }), method, function (v) { method = v; }, t("tv.method")); seg.id = "bcMethod";
    var why = ui.input({ id: "bcWhy", maxlength: "200", placeholder: t("tv.cancelPh") });
    ui.dialog({ title: t("tv.cancelH", { no: b.no }), emoji: "🛑", body: [h("p", null, t("tv.cancelIntro", { m: money(m.paid) })),
      h("div.tv-two", null, [ui.field("tv.feeKept", kept, { hint: t("tv.feeKeptHint") }), ui.field("tv.refundField", refund, { hint: t("tv.refundHint") })]),
      h("p.label-caps", null, t("tv.refundHow")), seg, ui.field("tv.why", why, { required: true })],
      actions: [{ label: t("cancel") }, { label: t("tv.cancelB"), kind: "danger", id: "bcSave", onClick: function (close, btn) {
        [kept, refund, why].forEach(function (x) { ui.fieldError(x, ""); });
        var k = kept.value.trim() ? U.parseMoney(kept.value) : 0, r = refund.value.trim() ? U.parseMoney(refund.value) : 0;
        if (k === null || k > b.fee) { ui.fieldError(kept, t("tv.err.keptM", { m: money(b.fee) })); return false; }
        if (r === null || r > m.paid) { ui.fieldError(refund, t("tv.err.refundM", { m: money(m.paid) })); return false; }
        if (!why.value.trim()) { ui.fieldError(why, t("tv.err.note")); return false; }
        btn.disabled = true;
        B.cancelBooking(b.id, { feeKept: k, refund: r, method: method, reason: why.value }).then(function () { close(); ui.toast(t("tv.cancelled", { no: b.no })); redraw(); },
          function (e) { btn.disabled = false; failed(e); });
        return false;
      } }], focus: "#bcWhy" });
  };

  /* ---------- the Home: a balance to pay before the trip ---------- */
  TV.homeRows = function (need) {
    var out = []; if (!B.user || !B.can("sell")) return out;
    var soon = U.dayKey(U.addDays(new Date(), 7));
    var list = B.bookings(function (b) { return b.status !== "cancelled" && b.depart >= today() && b.depart <= soon && B.bookingMoney(b).balance > 0; });
    if (list.length) out.push(need("✈️", t(list.length === 1 ? "tv.home1" : "tv.home", { n: list.length }), list.map(function (b) { return route(b) + ", " + dday(b.depart); }).join(" · "), "warn",
      [t("home.open"), function () { TV.show = "due"; ui.go("travel"); }]));
    return out;
  };
})();
