/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   The Schedule (Build 20): the week's shifts, person by person and day by day. Those with the team access plan it: add,
   change and remove a shift, fill a week from the usual week or from the week before, and keep a week as the usual one.
   Everyone sees the week, and their own shifts first. A person may ask a colleague to cover one of their shifts, or to
   trade one for one of the colleague's; the colleague answers, a leader approves, and only then do the shifts change
   hands. Each shift that has begun is held against the time clock: on time, late, not in yet, or absent. The books keep
   it all (04-books.js: B.addSlot, B.fillWeek, B.askSwap, B.decideSwap, B.attendance ...). */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui;
  var S = E.schedule = { week: 0 };
  var MIN_WEEK = -8, MAX_WEEK = 8;

  /* ---------- small helpers ---------- */
  function weekKey(off) { return U.dayKey(U.addDays(U.fromDayKey(B.weekStartKey(new Date())), 7 * off)); }
  function daysOf(wk) { var s = U.fromDayKey(wk), out = []; for (var i = 0; i < 7; i++) out.push(U.addDays(s, i)); return out; }
  function at(day, hm) { var d = U.fromDayKey(day); d.setHours(+hm.slice(0, 2), +hm.slice(3, 5), 0, 0); return d; }
  function tm(day, hm) { return E.fmtTime(at(day, hm)); }
  S.range = function (sl) { return t("sch.range", { a: tm(sl.day, sl.from), b: tm(sl.day, sl.to) }); };
  function dayName(day) { return E.fmtDate(U.fromDayKey(day), "long"); }
  function short(d) { return t("sch.dow." + d.getDay()) + " " + d.getDate(); }
  function nameOf(id) { var u = B.state().users[id]; return u ? u.name : id; }
  function people() { return B.people().filter(function (u) { return u.active !== false; }); }
  function startsLater(sl) { return at(sl.day, sl.from).getTime() > Date.now(); }
  /* hours in a narrow column: 39 h, or 52 h 45 */
  function hrs(m) { var hh = Math.floor(m / 60), mm = m % 60; return hh + " h" + (mm ? " " + U.pad2(mm) : ""); }
  /* another person signed in (or another sample person in the practice store): the schedule opens on this week */
  B.on("user", function () { S.week = 0; });
  B.on("lock", function () { S.week = 0; });
  function openSwapOn(id) { return B.swaps(function (w) { return B.SWAP_OPEN.indexOf(w.status) >= 0 && (w.slot === id || w.theirSlot === id); })[0] || null; }
  var ERR = { overlap: "sch.err.overlap", hours: "sch.err.hours", day: "sch.err.day", noperson: "sch.err.person", already: "sch.err.already", past: "sch.err.past",
    changed: "sch.err.changed", noslot: "sch.err.changed", closed: "sch.err.closed", empty: "sch.err.empty", pastday: "sch.err.pastday", denied: "people.denied" };
  function failed(e) { var k = e && ERR[e.code]; if (k) ui.toast(t(k), "bad"); else ui.failed(e); }
  function redraw() { if (ui.current === "schedule") ui.refresh(); }

  /* how a shift that has begun stands against the time clock */
  function mark(sl) {
    var a = B.attendance(sl);
    if (a.state === "ontime") return { cls: ".is-ontime", text: t("sch.ontime"), badge: "ok" };
    if (a.state === "late") return { cls: ".is-late", text: t("sch.late", { n: a.minutes }), badge: "warn" };
    if (a.state === "notin") return { cls: ".is-notin", text: t("sch.notin"), badge: "warn" };
    if (a.state === "absent") return { cls: ".is-absent", text: t("sch.absent"), badge: "bad" };
    return null;
  }

  /* ---------- the room ---------- */
  ui.rooms.schedule = function (main) {
    if (S.week < MIN_WEEK || S.week > MAX_WEEK) S.week = 0;
    var wk = weekKey(S.week), ds = daysOf(wk), lead = B.can("team");
    main.appendChild(ui.roomHead("room.schedule", "tip.schedule", lead ? [h("button.key.primary#schAdd", { type: "button", onclick: function () { S.slotForm(null, { day: U.dayKey() }); } }, [U.icon("plus"), t("sch.add")])] : null));
    var swaps = swapCard(lead); if (swaps) main.appendChild(swaps);
    main.appendChild(mineCard());
    main.appendChild(weekBar(wk, ds, lead));
    main.appendChild(grid(wk, ds, lead));
    main.appendChild(dayList(wk, ds, lead));
    if (lead && wk <= U.dayKey()) main.appendChild(planned(wk, ds));
  };

  /* the week shown, the keys to move between weeks, and the leaders' keys to fill it */
  function weekBar(wk, ds, lead) {
    var label = h("p.sch-week#schWeek", null, [h("b", null, S.week === 0 ? t("sch.thisWeek") : S.week === 1 ? t("sch.nextWeek") : S.week === -1 ? t("sch.lastWeek") : t("sch.weekN")),
      h("span", null, t("team.weekOf", { a: E.fmtDate(ds[0], "short"), b: E.fmtDate(ds[6], "short") }))]);
    function move(n) { S.week = Math.max(MIN_WEEK, Math.min(MAX_WEEK, S.week + n)); ui.refresh(); }
    var nav = h("div.sch-nav", null, [
      h("button.icon-key#schPrev", { type: "button", "aria-label": t("sch.prev"), title: t("sch.prev"), disabled: S.week <= MIN_WEEK, onclick: function () { move(-1); } }, U.icon("back")),
      label,
      h("button.icon-key#schNext", { type: "button", "aria-label": t("sch.next"), title: t("sch.next"), disabled: S.week >= MAX_WEEK, onclick: function () { move(1); } }, U.icon("next")),
      S.week !== 0 ? h("button.key.sm#schToday", { type: "button", onclick: function () { S.week = 0; ui.refresh(); } }, t("sch.thisWeek")) : null]);
    var tools = null;
    if (lead) {
      var last = ds[6] < new Date(new Date().setHours(0, 0, 0, 0));
      tools = h("div.sch-tools", null, [
        h("button.key.sm#schFillUsual", { type: "button", disabled: last || !B.usualWeek().rows.length, title: B.usualWeek().rows.length ? "" : t("sch.noUsual"), onclick: function () { fill(wk, "usual"); } }, [U.icon("list"), t("sch.fillUsual")]),
        h("button.key.sm#schFillLast", { type: "button", disabled: last, onclick: function () { fill(wk, "last"); } }, [U.icon("swap"), t("sch.fillLast")]),
        h("button.key.sm#schKeep", { type: "button", onclick: function () { keep(wk); } }, [U.icon("check"), t("sch.keep")])]);
    }
    return h("section.card.sch-bar#schBar", { "aria-label": t("sch.weekH") }, [nav, tools]);
  }
  function fill(wk, source) {
    ui.confirm(t(source === "usual" ? "sch.fillUsualQ" : "sch.fillLastQ"), t("sch.fillP"), t(source === "usual" ? "sch.fillUsual" : "sch.fillLast")).then(function (yes) {
      if (!yes) return;
      B.fillWeek(wk, source).then(function (added) { ui.toast(added && added.length ? t("sch.filled", { n: added.length }) : t("sch.filledNone"), added && added.length ? "good" : null); redraw(); }, failed);
    });
  }
  function keep(wk) {
    ui.confirm(t("sch.keepQ"), t("sch.keepP"), t("sch.keep")).then(function (yes) {
      if (yes) B.saveUsualWeek(wk).then(function () { ui.toast(t("sch.kept"), "good"); redraw(); }, failed);
    });
  }

  /* a shift as a small card: when it begins and ends, and how it stands against the clock */
  function chip(sl, lead) {
    var mine = sl.user === B.user.id, m = startsLater(sl) ? null : mark(sl), sw = openSwapOn(sl.id);
    var can = lead || (mine && startsLater(sl) && !sw);
    var title = nameOf(sl.user) + ", " + dayName(sl.day) + ", " + S.range(sl) + (m ? " · " + m.text : "") + (sw ? " · " + t("sch.swapOpen") : "") + (sl.note ? " · " + sl.note : "");
    var kids = [h("b", null, tm(sl.day, sl.from)), h("small", null, t("sch.until", { t: tm(sl.day, sl.to) }))];
    if (sl.note) kids.push(h("small.sch-note", null, sl.note));
    if (m) kids.push(h("span.sch-mark", null, m.text));
    if (sw) kids.push(h("span.sch-mark.sch-swap", null, [U.icon("swap"), t("sch.swapShort")]));
    return h("button.sch-chip" + (mine ? ".mine" : "") + (m ? m.cls : "") + (sw ? ".swapping" : ""), { type: "button", "data-slot": sl.id, title: title, "aria-label": title,
      onclick: function (e) { e.stopPropagation(); if (lead && sl.day >= U.dayKey()) S.slotForm(sl); else if (can) S.askForm(sl); else details(sl); } }, kids);
  }
  function details(sl) {
    var m = startsLater(sl) ? null : mark(sl);
    ui.dialog({ title: nameOf(sl.user), emoji: "🗓️", body: [h("p", null, dayName(sl.day)), h("p", null, h("b", null, S.range(sl))), sl.note ? h("p.muted", null, sl.note) : null,
      m ? h("p", null, h("span.badge." + m.badge, null, m.text)) : null], actions: [{ label: t("close"), kind: "primary" }] });
  }

  /* the week as a table: a line for each person, a column for each day, and the hours planned */
  function grid(wk, ds, lead) {
    var all = B.slots(function (x) { return x.day >= wk && x.day <= U.dayKey(ds[6]); }), today = U.dayKey();
    var who = people().filter(function (u) { return lead || u.role !== "owner" || all.some(function (x) { return x.user === u.id; }); });
    return h("div.table-wrap.sch-wrap", null, h("table.grid.sch-grid#schGrid", { "aria-label": t("sch.weekH") }, [
      h("thead", null, h("tr", null, [h("th", { scope: "col" }, t("people.name"))].concat(ds.map(function (d) {
        var k = U.dayKey(d); return h("th" + (k === today ? ".today" : ""), { scope: "col", "data-day": k }, [h("span.sch-dow", null, t("sch.dow." + d.getDay())), h("span.sch-date", null, String(d.getDate()))]);
      }), [h("th.num", { scope: "col" }, t("sch.hours"))]))),
      h("tbody", null, who.map(function (u) {
        var mins = 0;
        var cells = ds.map(function (d) {
          var k = U.dayKey(d), list = all.filter(function (x) { return x.user === u.id && x.day === k; });
          list.forEach(function (x) { mins += B.slotMins(x); });
          var add = lead && k >= today && !list.length ? h("button.sch-add", { type: "button", "aria-label": t("sch.addFor", { name: u.name, day: dayName(k) }), title: t("sch.add"), onclick: function () { S.slotForm(null, { user: u.id, day: k }); } }, U.icon("plus")) : null;
          return h("td.sch-cell" + (k === today ? ".today" : "") + (k < today ? ".past" : ""), { "data-day": k, "data-person": u.id }, list.map(function (x) { return chip(x, lead); }).concat([add]));
        });
        return h("tr" + (u.id === B.user.id ? ".me" : ""), { "data-person": u.id }, [h("th.sch-person", { scope: "row", title: ui.personTag(u) }, [h("b", null, u.name), h("small", null, t("people.id", { n: B.numberOf(u) }))])]
          .concat(cells, [h("td.num.sch-total", { title: mins ? ui.dur(mins * 60000) : "" }, mins ? hrs(mins) : "·")]));
      }))]));
  }
  /* the same week, day by day, for a phone */
  function dayList(wk, ds, lead) {
    var all = B.slots(function (x) { return x.day >= wk && x.day <= U.dayKey(ds[6]); }), today = U.dayKey();
    return h("div.sch-days#schDays", null, ds.map(function (d) {
      var k = U.dayKey(d), list = all.filter(function (x) { return x.day === k; });
      return h("section.sch-day" + (k === today ? ".today" : ""), { "data-day": k, "aria-label": dayName(k) }, [h("h3.sch-day-h", null, [h("b", null, t("sch.dow." + d.getDay())), h("span", null, E.fmtDate(d, "short"))]),
        list.length ? h("ul.sch-day-list", null, list.map(function (x) { return h("li", null, [h("span.sch-who", null, nameOf(x.user)), chip(x, lead)]); })) : h("p.muted", null, t("sch.noneDay")),
        lead && k >= today ? h("button.key.sm.sch-day-add", { type: "button", onclick: function () { S.slotForm(null, { day: k }); } }, [U.icon("plus"), t("sch.add")]) : null]);
    }));
  }

  /* the person's own shifts, the next two weeks */
  function mineCard() {
    var me = B.user, today = U.dayKey(), until = U.dayKey(U.addDays(new Date(), 13));
    var list = B.slots(function (x) { return x.user === me.id && x.day >= today && x.day <= until; });
    return h("section.card.sch-mine#schMine", { "aria-labelledby": "schMineH" }, [h("div.card-head", null, h("h2#schMineH", null, [ui.emo("🗓️"), t("sch.mineH")])),
      list.length ? h("ul.sch-mine-list", null, list.map(function (x) {
        var sw = openSwapOn(x.id), later = startsLater(x), m = later ? null : mark(x);
        return h("li.sch-mine-row", { "data-slot": x.id }, [h("span.sch-mine-day", null, [h("b", null, dayName(x.day)), h("small", null, S.range(x) + (x.note ? " · " + x.note : ""))]),
          m ? h("span.badge." + m.badge, null, m.text) : null,
          sw ? h("span.badge", null, t(sw.status === "agreed" ? "sch.swapAgreed" : "sch.swapAsked")) : null,
          later && !sw ? h("button.key.sm", { type: "button", "data-act": "ask", onclick: function () { S.askForm(x); } }, [U.icon("swap"), t("sch.ask")]) : null]);
      })) : h("p.muted#schMineNone", null, t("sch.mineNone"))]);
  }

  /* the requests: what is asked of this person, what waits for a leader, and their own */
  function swapLine(w) {
    var a = B.slotOf(w.slot), b = w.theirSlot ? B.slotOf(w.theirSlot) : null;
    if (!a) return t("sch.swapGone");
    var mineA = dayName(a.day) + ", " + S.range(a);
    if (w.kind === "trade" && b) return t("sch.tradeLine", { a: nameOf(w.from), b: nameOf(w.to), x: mineA, y: dayName(b.day) + ", " + S.range(b) });
    return t("sch.coverLine", { a: nameOf(w.from), b: nameOf(w.to), x: mineA });
  }
  function swapCard(lead) {
    var me = B.user.id, recent = new Date(Date.now() - 3 * 86400000).toISOString();
    var askedMe = B.swaps(function (w) { return w.to === me && w.status === "asked"; });
    var toApprove = lead ? B.swaps(function (w) { return w.status === "agreed" && (B.isOwner() || (w.from !== me && w.to !== me)); }) : [];
    var mine = B.swaps(function (w) { return w.from === me && (B.SWAP_OPEN.indexOf(w.status) >= 0 || (w.closed || w.decided || w.answered || "") >= recent); });
    if (!askedMe.length && !toApprove.length && !mine.length) return null;
    function row(w, keys, state) {
      return h("li.sch-req", { "data-swap": w.id }, [h("span.sch-req-emo", { "aria-hidden": "true" }, w.kind === "trade" ? "🔁" : "🤝"),
        h("span.sch-req-t", null, [h("b", null, swapLine(w)), w.note ? h("small", null, "“" + w.note + "”") : null]), state || null, keys.length ? h("span.sch-req-keys", null, keys) : null]);
    }
    var kids = [h("div.card-head", null, h("h2#schSwapsH", null, [ui.emo("🔁"), t("sch.swapsH")]))];
    if (askedMe.length) kids.push(h("h3.sch-sub", null, t("sch.askedMe")), h("ul.sch-reqs#schAskedMe", null, askedMe.map(function (w) {
      return row(w, [h("button.key.sm.primary", { type: "button", "data-act": "yes", onclick: function () { B.answerSwap(w.id, true).then(function () { ui.toast(t("sch.agreedT"), "good"); redraw(); }, failed); } }, [U.icon("check"), t("sch.yes")]),
        h("button.key.sm", { type: "button", "data-act": "no", onclick: function () { B.answerSwap(w.id, false).then(function () { ui.toast(t("sch.declinedT")); redraw(); }, failed); } }, t("sch.no"))]);
    })));
    if (toApprove.length) kids.push(h("h3.sch-sub", null, t("sch.toApprove")), h("ul.sch-reqs#schToApprove", null, toApprove.map(function (w) {
      return row(w, [h("button.key.sm.primary", { type: "button", "data-act": "approve", onclick: function () { B.decideSwap(w.id, true).then(function () { ui.toast(t("sch.approvedT"), "good"); redraw(); }, failed); } }, [U.icon("check"), t("sch.approve")]),
        h("button.key.sm", { type: "button", "data-act": "refuse", onclick: function () { B.decideSwap(w.id, false).then(function () { ui.toast(t("sch.refusedT")); redraw(); }, failed); } }, t("sch.refuse"))]);
    })));
    if (mine.length) kids.push(h("h3.sch-sub", null, t("sch.myAsks")), h("ul.sch-reqs#schMyAsks", null, mine.map(function (w) {
      var open = B.SWAP_OPEN.indexOf(w.status) >= 0;
      var badge = h("span.badge" + (w.status === "approved" ? ".ok" : w.status === "agreed" || w.status === "asked" ? "" : ".bad"), null, t("sch.st." + w.status, { name: nameOf(w.to) }));
      return row(w, open ? [h("button.key.sm", { type: "button", "data-act": "cancel", onclick: function () { B.cancelSwap(w.id).then(function () { ui.toast(t("sch.cancelledT")); redraw(); }, failed); } }, t("sch.cancel"))] : [], badge);
    })));
    return h("section.card.sch-swaps#schSwaps", { "aria-labelledby": "schSwapsH" }, kids);
  }

  /* planned against worked, for the weeks that have begun (leaders) */
  function planned(wk, ds) {
    var end = U.dayKey(ds[6]), today = U.dayKey(), all = B.slots(function (x) { return x.day >= wk && x.day <= end; });
    var from = ds[0].getTime(), to = U.addDays(ds[6], 1).getTime();
    var rows = people().map(function (u) {
      var mine = all.filter(function (x) { return x.user === u.id; }), plan = 0, late = 0, absent = 0;
      mine.forEach(function (x) { plan += B.slotMins(x) * 60000; if (x.day > today) return; var a = B.attendance(x); if (a.state === "late") late++; if (a.state === "absent") absent++; });
      var worked = B.shifts(function (x) { return x.user === u.id; }).filter(function (x) { var a = Date.parse(x.in); return a >= from && a < to; }).reduce(function (m, x) { return m + B.shiftMs(x); }, 0);
      if (!plan && !worked) return null;
      return h("tr", { "data-person": u.id }, [h("th", { scope: "row" }, ui.personTag(u)), h("td.num", null, plan ? ui.dur(plan) : "·"), h("td.num", null, worked ? ui.dur(worked) : "·"),
        h("td.num", null, late ? h("span.badge.warn", null, String(late)) : "0"), h("td.num", null, absent ? h("span.badge.bad", null, String(absent)) : "0")]);
    }).filter(Boolean);
    return h("section.card.sch-plan#schPlanned", { "aria-labelledby": "schPlannedH" }, [h("div.card-head", null, h("h2#schPlannedH", null, [ui.emo("⏱️"), t("sch.plannedH")])),
      h("p.hint", null, t("sch.plannedP")),
      rows.length ? h("div.table-wrap", null, h("table.grid#schPlannedT", null, [h("thead", null, h("tr", null, [h("th", null, t("people.name")), h("th.num", null, t("sch.planned")),
        h("th.num", null, t("sch.worked")), h("th.num", null, t("sch.lateN")), h("th.num", null, t("sch.absentN"))])), h("tbody", null, rows)])) : h("p.muted", null, t("sch.noneWeek"))]);
  }

  /* ---------- a shift: added, changed or removed (leaders) ---------- */
  S.slotForm = function (sl, pre) {
    if (!B.can("team")) return;
    pre = pre || {};
    var who = ui.select(people().map(function (u) { return [u.id, u.name]; }), sl ? sl.user : pre.user || (people().filter(function (u) { return u.role !== "owner"; })[0] || B.user).id, { id: "slWho" });
    var day = h("input#slDay", { type: "date", value: sl ? sl.day : pre.day || U.dayKey(), min: U.dayKey() });
    var from = h("input#slFrom", { type: "time", value: sl ? sl.from : pre.from || "09:00", step: "300" });
    var to = h("input#slTo", { type: "time", value: sl ? sl.to : pre.to || "17:00", step: "300" });
    var note = ui.input({ id: "slNote", maxlength: "60", value: sl ? sl.note || "" : "", placeholder: t("sch.notePh") });
    var actions = [{ label: t("cancel") }];
    if (sl) actions.push({ label: t("remove"), kind: "danger", id: "slRemove", onClick: function (close) {
      close();
      ui.confirm(t("sch.removeQ", { name: nameOf(sl.user) }), dayName(sl.day) + ", " + S.range(sl), t("remove"), "danger").then(function (yes) {
        if (yes) B.removeSlot(sl.id).then(function () { ui.toast(t("sch.removed")); redraw(); }, failed);
      });
    } });
    actions.push({ label: t("save"), kind: "primary", id: "slSave", onClick: function (close, btn) {
      ui.fieldError(from, ""); ui.fieldError(day, "");
      var f = { user: who.value, day: day.value, from: from.value, to: to.value, note: note.value };
      btn.disabled = true;
      (sl ? B.changeSlot(sl.id, f) : B.addSlot(f)).then(function () { close(); ui.toast(t(sl ? "sch.changed" : "sch.added"), "good"); redraw(); }, function (e) {
        btn.disabled = false;
        var k = e && ERR[e.code];
        if (e && (e.code === "overlap" || e.code === "hours")) ui.fieldError(from, t(k)); else if (e && (e.code === "day" || e.code === "pastday")) ui.fieldError(day, t(k)); else failed(e);
      });
      return false;
    } });
    ui.dialog({ title: t(sl ? "sch.editH" : "sch.addH"), emoji: "🗓️", body: [ui.field("sch.who", who), ui.field("sch.day", day),
      h("div.sch-times", null, [ui.field("sch.from", from, { required: true }), ui.field("sch.to", to, { required: true })]), ui.field("sch.note", note),
      sl && sl.swap ? h("p.hint", null, t("sch.wasSwapped")) : null], actions: actions, focus: sl ? "#slFrom" : "#slWho" });
  };

  /* ---------- asking a colleague: cover my shift, or trade one of theirs for it ---------- */
  S.askForm = function (sl) {
    var me = B.user, others = people().filter(function (u) { return u.id !== me.id; });
    if (!others.length) { ui.toast(t("sch.noOne")); return; }
    var kind = "cover";
    var kindSeg = ui.seg([["cover", t("sch.kind.cover")], ["trade", t("sch.kind.trade")]], kind, function (v) { kind = v; draw(); }, t("sch.kindH"));
    kindSeg.id = "swKind";
    var who = ui.select(others.map(function (u) { return [u.id, u.name]; }), others.filter(function (u) { return u.role !== "owner"; }).concat(others)[0].id, { id: "swWho" });
    var theirsBox = h("div#swTheirsBox"), note = ui.input({ id: "swNote", maxlength: "120", placeholder: t("sch.askNotePh") }), theirs = null;
    function draw() {
      U.clear(theirsBox); theirs = null;
      if (kind !== "trade") return;
      var list = B.slots(function (x) { return x.user === who.value && x.day >= U.dayKey() && startsLater(x) && !openSwapOn(x.id); });
      if (!list.length) { theirsBox.appendChild(h("p.muted#swNoTheirs", null, t("sch.noTheirs", { name: nameOf(who.value) }))); return; }
      theirs = ui.select(list.map(function (x) { return [x.id, dayName(x.day) + ", " + S.range(x)]; }), list[0].id, { id: "swTheirs" });
      theirsBox.appendChild(ui.field("sch.theirShift", theirs));
    }
    who.addEventListener("change", draw);
    draw();
    ui.dialog({ title: t("sch.askH"), emoji: "🔁", body: [h("p", null, [h("b", null, dayName(sl.day)), h("br"), S.range(sl)]),
      h("div.field", null, [h("div.label-row", null, h("span.lbl", null, t("sch.kindH"))), kindSeg]), ui.field("sch.askWho", who), theirsBox, ui.field("sch.askNote", note),
      h("p.hint", null, t("sch.askP"))],
      actions: [{ label: t("cancel") }, { label: t("sch.send"), kind: "primary", id: "swSend", onClick: function (close, btn) {
        if (kind === "trade" && !theirs) { ui.toast(t("sch.noTheirs", { name: nameOf(who.value) }), "bad"); return false; }
        btn.disabled = true;
        B.askSwap({ slot: sl.id, to: who.value, kind: kind, theirSlot: theirs ? theirs.value : null, note: note.value }).then(function () {
          close(); ui.toast(t("sch.sent", { name: nameOf(who.value) }), "good"); redraw();
        }, function (e) { btn.disabled = false; failed(e); });
        return false;
      } }] });
  };

  /* ---------- the Home: the next shift, what is asked of the person, and what waits for a leader ---------- */
  S.homeRows = function (need) {
    var out = [], me = B.user; if (!me) return out;
    var today = U.dayKey(), soon = U.dayKey(U.addDays(new Date(), 7));
    var next = B.slots(function (x) { return x.user === me.id && x.day >= today && x.day <= soon && at(x.day, x.to).getTime() > Date.now(); })[0];
    if (next) {
      var n = Math.round((U.fromDayKey(next.day).getTime() - U.fromDayKey(today).getTime()) / 86400000);
      out.push(need("🗓️", t("sch.homeNext", { day: n === 0 ? t("sch.today") : n === 1 ? t("sch.tomorrow") : dayName(next.day) }), S.range(next) + (next.note ? " · " + next.note : ""), null,
        [t("home.open"), function () { S.week = 0; ui.go("schedule"); }]));
    }
    B.swaps(function (w) { return w.to === me.id && w.status === "asked"; }).forEach(function (w) {
      out.push(need("🔁", t(w.kind === "trade" ? "sch.homeTrade" : "sch.homeCover", { name: nameOf(w.from) }), swapLine(w), "warn", [t("home.open"), function () { ui.go("schedule"); }]));
    });
    if (B.can("team")) {
      var waiting = B.swaps(function (w) { return w.status === "agreed" && (B.isOwner() || (w.from !== me.id && w.to !== me.id)); }).length;
      if (waiting) out.push(need("🔁", t(waiting === 1 ? "sch.homeApprove1" : "sch.homeApprove", { n: waiting }), t("sch.homeApproveSub"), "warn", [t("home.open"), function () { ui.go("schedule"); }]));
    }
    return out;
  };
})();
