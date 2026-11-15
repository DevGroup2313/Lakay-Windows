/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Training (Build 19): a new person's first days, what leaders assign, refreshers, and exercises done on Lakay's real
   screens with the books set aside. The Learning room gathers it in tabs: My training (what is waiting, the onboarding
   day by day), Lessons, Exercises, the Team (each person's progress; assigning, signing off) and the Plans (the store's
   onboarding path, its own tasks, and the refreshers).
   An exercise asks for real work (a sale in two parts, a delivery, a transfer, a break) and watches for it. While it
   runs, the books Lakay shows are a copy in memory (B.drillStart in 04-books.js): what is done changes the copy, never
   the sealed books, and the copy is let go when the exercise ends. Only the mark that the exercise was done is written,
   after the copy is gone. A band at the top says that nothing is kept, with a key to end the exercise. */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui, L = E.learn, T = E.tour;
  var TR = E.train = { tab: null };

  /* ---------- the exercises ---------- */
  function distinct(lines) { var seen = {}; (lines || []).forEach(function (l) { seen[l.itemId] = 1; }); return Object.keys(seen).length; }
  var EXERCISES = [
    { id: "break", emo: "☕", room: "team", goal: function (l, s) { if (l.type === "break.started") s.started = true; return l.type === "break.ended" && !!s.started; } },
    { id: "sale", emo: "🛒", room: "register", goal: function (l) {
      if (l.type !== "sale.completed") return false; var sa = l.data.sale; return distinct(sa.lines) >= 2 && sa.pay.every(function (p) { return p.method === "cash"; }); } },
    { id: "split", emo: "🔀", room: "register", goal: function (l) { return l.type === "sale.completed" && l.data.sale.pay.length >= 2; } },
    { id: "card", emo: "💳", room: "register", open: function () { return B.payPrefs().methods.indexOf("card") >= 0; },
      goal: function (l) { var code = B.payPrefs().askCode !== "no"; return l.type === "sale.completed" && l.data.sale.pay.some(function (p) { return p.method === "card" && (!!p.ref || !code); }); } },
    { id: "receive", emo: "🚚", room: "inventory", goal: function (l) { return l.type === "stock.received"; } },
    { id: "transfer", emo: "💱", room: "inventory", prep: function () { if (E.inventory) E.inventory.show("services"); },
      goal: function (l) { return l.type === "service.recorded" && !!l.data.svc && l.data.svc.kind === "send" && l.data.svc.fee > 0; } }];
  TR.EXERCISES = EXERCISES;
  function exOf(id) { return EXERCISES.filter(function (x) { return x.id === id; })[0] || null; }
  /* an exercise this person can do here (the card one, only where the store takes cards) */
  TR.canDo = function (u, id) { var x = exOf(id); return !!x && B.canTrain(u, "exercise", id) && (!x.open || x.open()); };

  var drill = null;
  TR.active = function () { return !!drill; };
  /* the brief: what to do, and that nothing is kept */
  TR.exercise = function (id) {
    var x = exOf(id); if (!x || !B.isOpen || !TR.canDo(B.user, id)) return false;
    if (T && T.active && T.active()) T.stop(false, true);
    if (drill) end(false, true);
    var steps = t("ex." + id + ".how").split("\n");
    ui.dialog({ title: t("ex." + id + ".t"), emoji: x.emo, body: [h("p.ex-what", null, t("ex." + id + ".d")), h("ol.ex-steps", null, steps.map(function (s) { return h("li", null, s); })),
      h("p.ex-safe", null, [U.icon("lock"), h("span", null, t("ex.safe"))])],
      actions: [{ label: t("cancel") }, { label: t("ex.begin"), kind: "primary", emoji: "▶️", id: "exBegin", onClick: function (close) { close(); begin(x); } }] });
    return true;
  };
  function begin(x) {
    var memo = {}, ticket = E.register && E.register.ticket ? E.register.ticket.lines.map(function (l) { return { itemId: l.itemId, qty: l.qty }; }) : null;
    var ok = B.drillStart(function (line) {
      if (!drill || drill.x !== x || drill.done) return;
      var hit = false; try { hit = x.goal(line, memo); } catch (e) { console.error(e); }
      if (hit) { drill.done = true; setTimeout(finish, ui.still() ? 300 : 1100); }
    });
    if (!ok) return;
    drill = { x: x, ticket: ticket, room: ui.current, layers: Array.prototype.slice.call(document.querySelectorAll(".layer")), done: false };
    if (E.register && E.register.setLines) E.register.setLines([]);
    document.documentElement.classList.add("drilling");
    band();
    ui.refreshTop();
    ui.go(x.room);
    if (x.prep) x.prep();
    if (E.sound) E.sound.play("soft");
  }
  /* the band across the top while an exercise runs */
  function band() {
    var old = document.getElementById("drillBar"); if (old) old.remove();
    var x = drill.x;
    var hint = h("button.key.sm#drillHow", { type: "button", onclick: function () {
      ui.dialog({ title: t("ex." + x.id + ".t"), emoji: x.emo, body: [h("ol.ex-steps", null, t("ex." + x.id + ".how").split("\n").map(function (s) { return h("li", null, s); })), h("p.ex-safe", null, [U.icon("lock"), h("span", null, t("ex.safe"))])],
        actions: [{ label: t("gotIt"), kind: "primary" }] });
    } }, [U.icon("info"), h("span.drill-key-t", null, t("ex.how"))]);
    document.body.appendChild(h("div.drill-bar#drillBar", { role: "status" }, [h("span.drill-emo", { "aria-hidden": "true" }, "🧪"),
      h("span.drill-t", null, [h("b", null, t("ex.now", { name: t("ex." + x.id + ".t") })), h("small", null, t("ex.nothingKept"))]),
      hint, h("button.key.sm.primary#drillEnd", { type: "button", onclick: function () { end(false); } }, [U.icon("x"), t("ex.end")])]));
    measure();
  }
  /* the band's height, so the page, the top keys and the windows sit below it */
  function measure() {
    var b = document.getElementById("drillBar");
    if (b) document.documentElement.style.setProperty("--drill-h", b.offsetHeight + "px"); else document.documentElement.style.removeProperty("--drill-h");
  }
  window.addEventListener("resize", function () { if (drill) measure(); });
  function closeLayers(keep) {
    Array.prototype.slice.call(document.querySelectorAll(".layer")).reverse().forEach(function (l) {
      if (keep && keep.indexOf(l) >= 0) return;
      var x = l.querySelector(".dialog-head .icon-key"); if (x) x.click(); else l.remove();
    });
  }
  function end(done, quiet) {
    if (!drill) return;
    var r = drill; drill = null;
    B.drillEnd();
    document.documentElement.classList.remove("drilling");
    var b = document.getElementById("drillBar"); if (b) b.remove();
    measure();
    closeLayers(r.layers);
    if (r.ticket && E.register && E.register.setLines) E.register.setLines(r.ticket);
    if (E.find && E.find.reset) E.find.reset();
    if (!B.isOpen) return;
    ui.refreshTop();
    if (!quiet) ui.go(done ? "learn" : (ui.allowed(r.room) ? r.room : ui.current), true);
    if (!done && !quiet) ui.toast(t("ex.ended"));
  }
  TR.end = function () { end(false); };
  function finish() {
    if (!drill) return;
    var x = drill.x;
    end(true);
    B.exerciseDone(x.id).then(function () {
      if (E.sound) E.sound.play("sale");
      ui.celebrate && ui.celebrate();
      ui.dialog({ title: t("ex.doneT"), emoji: "🎉", body: [h("p", null, t("ex.doneP", { name: t("ex." + x.id + ".t") })), h("p.ex-safe", null, [U.icon("lock"), h("span", null, t("ex.doneKept"))])],
        actions: [{ label: t("close"), kind: "primary", id: "exDoneOk" }] });
      if (ui.current === "learn") ui.refresh();
    }, ui.failed);
  }
  B.on("lock", function () { if (drill) { drill = null; document.documentElement.classList.remove("drilling"); var b = document.getElementById("drillBar"); if (b) b.remove(); measure(); } });

  /* ---------- where each person stands ---------- */
  function today() { return U.dayKey(); }
  function titleOf(kind, ref, course) {
    if (kind === "lesson") return E.has("learn." + ref + ".t") ? t("learn." + ref + ".t") : null;
    if (kind === "exercise") return E.has("ex." + ref + ".t") ? t("ex." + ref + ".t") : null;
    var tk = (course.tasks || []).filter(function (x) { return x.id === ref; })[0];
    return tk ? tk.title : null;
  }
  function emoOf(kind, ref) {
    if (kind === "lesson") { var l = L.lesson(ref); return l ? l.emo : "📘"; }
    if (kind === "exercise") { var x = exOf(ref); return x ? x.emo : "🧪"; }
    return "📌";
  }
  function info(u, it, course, day) {
    var mark = B.markOf(u.id, it.kind, it.ref), done = B.itemDone(u.id, it);
    var tk = it.kind === "task" ? (course.tasks || []).filter(function (x) { return x.id === it.ref; })[0] : null;
    return { it: it, kind: it.kind, ref: it.ref, title: titleOf(it.kind, it.ref, course), emo: emoOf(it.kind, it.ref), due: it.due || null, done: done, mark: mark,
      overdue: !done && !!it.due && it.due < day, today: !done && it.due === day, lead: !!tk && tk.sign === "lead", body: tk ? tk.body : "" };
  }
  TR.statusOf = function (u) {
    var course = B.course(), plan = B.planOf(u.id), day = today();
    var items = plan.items.map(function (it) { return info(u, it, course, day); }).filter(function (x) { return x.title; });
    var refresh = B.refreshersOf(u.id).map(function (r) { var x = info(u, { kind: r.kind, ref: r.ref, due: r.due, why: "refresh", at: new Date().toISOString() }, course, day); x.every = r.every; x.last = r.last; return x; })
      .filter(function (x) { return x.title && !items.some(function (y) { return !y.done && y.kind === x.kind && y.ref === x.ref; }); });
    var open = items.filter(function (x) { return !x.done; }), ob = items.filter(function (x) { return x.it.why === "onboarding"; }), obDone = ob.filter(function (x) { return x.done; }).length;
    var onb = plan.onboarding;
    return { plan: plan, items: items, open: open, overdue: open.filter(function (x) { return x.overdue; }).length + refresh.filter(function (x) { return x.it.due < day; }).length,
      refresh: refresh, onboarding: onb, ob: ob, obDone: obDone, ready: !!onb && !onb.done && ob.length > 0 && obDone === ob.length, toDo: open.length + refresh.length };
  };

  /* one line of training: its sign, its name, when it is due or was done, and what can be done with it */
  function row(u, x, leader) {
    var me = B.user, mine = u.id === me.id, sub;
    if (x.done) sub = t("tr.doneOn", { d: E.fmtDate(new Date(x.mark.at), "short") });
    else if (x.it.why === "refresh") sub = t("tr.refreshSub", { d: x.last ? E.fmtDate(new Date(x.last), "short") : "", e: E.fmtDate(U.fromDayKey(x.due), "short") });
    else sub = x.due ? t("tr.dueOn", { d: E.fmtDate(U.fromDayKey(x.due), "short") }) : t("tr.noDue");
    var kindWord = t("tr.kind." + x.kind) + (x.lead ? " · " + t("tr.leadSigns") : "");
    var keys = [];
    if (!x.done && mine) {
      if (x.kind === "lesson") keys.push(h("button.key.sm.primary", { type: "button", "data-act": "start", onclick: function () { T.start(x.ref); } }, [U.icon("play"), t("learn.start")]),
        h("button.key.sm", { type: "button", "data-act": "quiz", onclick: function () { L.quiz(x.ref); } }, [U.icon("edit"), t("learn.quiz")]));
      else if (x.kind === "exercise") keys.push(h("button.key.sm.primary", { type: "button", "data-act": "exercise", onclick: function () { TR.exercise(x.ref); } }, [U.icon("play"), t("ex.begin")]));
      else if (!x.lead) keys.push(h("button.key.sm.primary", { type: "button", "data-act": "task", onclick: function () { markTask(u, x); } }, [U.icon("check"), t("tr.markDone")]));
    }
    if (!x.done && leader && x.kind === "task" && x.lead && (!mine || B.isOwner())) keys.push(h("button.key.sm.primary", { type: "button", "data-act": "signTask", onclick: function () { markTask(u, x); } }, [U.icon("check"), t("tr.signTask")]));
    if (leader && x.it.id && x.it.why === "assigned" && !x.done) keys.push(h("button.icon-key", { type: "button", "data-act": "unassign", "aria-label": t("tr.unassign"), title: t("tr.unassign"), onclick: function () {
      B.unassign(u.id, x.it.id).then(function () { ui.toast(t("tr.unassigned")); redraw(); }, ui.failed);
    } }, U.icon("x")));
    var state = x.done ? h("span.badge.ok", null, [U.icon("check"), t("learn.done")]) : x.overdue ? h("span.badge.bad", null, t("tr.overdue")) : x.today ? h("span.badge.warn", null, t("tr.today")) : null;
    return h("li.tr-row" + (x.done ? ".done" : "") + (x.overdue ? ".late" : ""), { "data-kind": x.kind, "data-ref": x.ref }, [
      h("span.tr-emo", { "aria-hidden": "true" }, x.emo),
      h("span.tr-t", null, [h("b", null, x.title), h("small", null, kindWord + " · " + sub), x.body && !x.done ? h("small.tr-body", null, x.body) : null]),
      state, keys.length ? h("span.tr-keys", null, keys) : (!x.done && mine && x.kind === "task" && x.lead ? h("small.tr-wait", null, t("tr.waitLead")) : null)]);
  }
  function markTask(u, x) {
    var mine = u.id === B.user.id;
    ui.confirm(t(mine ? "tr.markQ" : "tr.signQ", { name: x.title, who: u.name }), x.body || t("tr.markP"), t(mine ? "tr.markDone" : "tr.signTask")).then(function (yes) {
      if (yes) B.taskDone(u.id, x.ref).then(function () { ui.toast(t("tr.taskDone", { name: x.title }), "good"); redraw(); }, ui.failed);
    });
  }
  /* the room redraws; a person's window open over it redraws itself on the books' change */
  function redraw() { if (ui.current === "learn") ui.refresh(); }

  /* ---------- the Learning room, with its tabs ---------- */
  var TABS = [["mine", "cap"], ["lessons", "book"], ["exercises", "play"], ["team", "people"], ["plans", "list"]];
  function tabsFor() { return TABS.filter(function (x) { return x[0] === "team" ? (B.can("team") || B.can("train")) : x[0] === "plans" ? B.can("train") : true; }); }
  var PANES = {};
  ui.rooms.learn = function (main) {
    var list = tabsFor(), me = TR.statusOf(B.user), team = (B.can("team") || B.can("train")) ? teamCounts() : null;
    /* the room opens on the person's own training when something in it is waiting, and on the lessons otherwise */
    if (!TR.tab || !list.some(function (x) { return x[0] === TR.tab; })) TR.tab = me.toDo ? "mine" : "lessons";
    main.appendChild(ui.roomHead("room.learn", "tip.learn", [h("button.key.primary#learnTour", { type: "button", onclick: function () { T.start("welcome"); } }, [U.icon("play"), t("learn.tour")])]));
    var tabs = h("div.inv-tabs", { role: "tablist", "aria-label": t("room.learn") });
    list.forEach(function (x) {
      var n = x[0] === "mine" ? me.toDo : x[0] === "team" && team ? team.late : 0;
      tabs.appendChild(h("button.inv-tab#lrnTab-" + x[0], { type: "button", role: "tab", "aria-selected": String(TR.tab === x[0]), tabindex: TR.tab === x[0] ? "0" : "-1", "aria-controls": "learnPane", "data-tab": x[0],
        onclick: function () { TR.tab = x[0]; ui.refresh(); var b = document.getElementById("lrnTab-" + x[0]); if (b) try { b.focus({ preventScroll: true }); } catch (e) { } } },
        [h("span.dept-jewel.sm", { "aria-hidden": "true" }, U.icon(x[1])), h("span.inv-tab-name", null, t("lrn.tab." + x[0])), n ? h("span.inv-tab-n" + (x[0] === "team" ? ".late" : ""), null, String(n)) : null]));
    });
    tabs.addEventListener("keydown", function (e) {
      var ids = list.map(function (x) { return x[0]; }), i = ids.indexOf(TR.tab), to = null;
      if (e.key === "ArrowRight") to = ids[(i + 1) % ids.length]; else if (e.key === "ArrowLeft") to = ids[(i - 1 + ids.length) % ids.length];
      if (to) { e.preventDefault(); TR.tab = to; ui.refresh(); var b = document.getElementById("lrnTab-" + to); if (b) try { b.focus({ preventScroll: true }); } catch (x2) { } }
    });
    main.appendChild(h("div.inv-tabs-wrap.lrn-tabs", null, tabs));
    var pane = h("div.lrn-pane#learnPane", { role: "tabpanel", "aria-labelledby": "lrnTab-" + TR.tab });
    main.appendChild(pane);
    PANES[TR.tab](pane, me);
  };

  /* a new person signed in (or another sample person in the practice store): the room opens on their own tab */
  B.on("user", function () { TR.tab = null; });
  B.on("lock", function () { TR.tab = null; });
  /* My training: the onboarding day by day, what was assigned, the refreshers; and the person's lessons */
  PANES.mine = function (pane, s) {
    var u = B.user;
    if (s.onboarding) pane.appendChild(onboardingCard(u, s, false));
    var assigned = s.items.filter(function (x) { return x.it.why === "assigned"; }).sort(byDue);
    if (assigned.length) pane.appendChild(h("section.card.tr-sec#trAssigned", { "aria-labelledby": "trAssignedH" }, [h("div.card-head", null, h("h2#trAssignedH", null, [ui.emo("📋"), t("tr.assignedH")])),
      h("ul.tr-list", null, assigned.map(function (x) { return row(u, x, false); }))]));
    if (s.refresh.length) pane.appendChild(h("section.card.tr-sec#trRefresh", { "aria-labelledby": "trRefreshH" }, [h("div.card-head", null, h("h2#trRefreshH", null, [ui.emo("🔁"), t("tr.refreshH")])),
      h("p.hint", null, t("tr.refreshP")), h("ul.tr-list", null, s.refresh.map(function (x) { return row(u, x, false); }))]));
    if (!s.onboarding && !assigned.length && !s.refresh.length) { pane.appendChild(h("div.tr-calm#trCalm", null, [h("span.tr-calm-emo", { "aria-hidden": "true" }, "🌤️"), h("p", null, t("tr.nothing"))])); pane.appendChild(L.mineCard()); }
  };
  function byDue(a, b) { return (a.done - b.done) || ((a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : 0); }
  /* the onboarding: how far along, and each day's items */
  function onboardingCard(u, s, leader) {
    var onb = s.onboarding, total = s.ob.length, n = s.obDone, start = U.fromDayKey(onb.start), dayN = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
    var lastDay = s.ob.reduce(function (m, x) { return Math.max(m, x.it.day || 1); }, 1);
    var fill = h("span.learn-fill"); fill.style.width = (total ? Math.round(100 * n / total) : 0) + "%";
    var byDay = {};
    s.ob.forEach(function (x) { var d = x.it.day || 1; (byDay[d] = byDay[d] || []).push(x); });
    var who = B.state().users[onb.by];
    var status = onb.done ? h("p.tr-signed#trSigned", null, [U.icon("check"), h("span", null, t("tr.signedOff", { d: E.fmtDate(new Date(onb.done.at), "short"), who: ui.userName ? ui.userName(onb.done.by) : onb.done.by }))])
      : s.ready ? h("p.tr-ready", null, [U.icon("check"), h("span", null, t(leader ? "tr.readyLead" : "tr.readyMine"))]) : null;
    return h("section.card.tr-onb#trOnboarding", { "aria-labelledby": "trOnbH" }, [
      h("div.tr-onb-head", null, [h("span.learn-cap", { "aria-hidden": "true" }, U.icon(leader ? "people" : "cap")),
        h("div.tr-onb-t", null, [h("h2#trOnbH", null, t(leader ? "tr.onbTheirs" : "tr.onbH", { name: u.name })),
          h("p", null, t("tr.onbSub", { d: E.fmtDate(start, "short"), who: who ? who.name : "", n: Math.min(dayN, lastDay), m: lastDay }))]),
        h("div.tr-onb-n", null, [h("b#trOnbCount", null, n + " / " + total), h("small", null, t("tr.onbDone"))])]),
      h("div.learn-bar", { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(n), "aria-label": t("tr.onbH", { name: u.name }) }, fill),
      status,
      h("div.tr-days", null, Object.keys(byDay).map(Number).sort(function (a, b) { return a - b; }).map(function (d) {
        var all = byDay[d], doneAll = all.every(function (x) { return x.done; });
        return h("div.tr-day" + (doneAll ? ".done" : ""), null, [h("p.tr-day-h", null, [h("b", null, t("tr.day", { n: d })), h("small", null, E.fmtDate(U.addDays(start, d - 1), "short"))]),
          h("ul.tr-list", null, all.map(function (x) { return row(u, x, leader); }))]);
      }))]);
  }

  PANES.lessons = function (pane) { pane.appendChild(L.mineCard()); pane.appendChild(L.lessonsGrid()); pane.appendChild(L.tipsCard()); };

  PANES.exercises = function (pane) {
    var me = B.user;
    pane.appendChild(h("p.tr-intro", null, [U.icon("lock"), h("span", null, t("ex.intro"))]));
    pane.appendChild(h("div.learn-grid#exList", null, EXERCISES.filter(function (x) { return TR.canDo(me, x.id); }).map(function (x) {
      var m = B.markOf(me.id, "exercise", x.id);
      return h("article.lesson" + (m ? ".done" : ""), { "data-ex": x.id, "aria-labelledby": "ex-" + x.id }, [
        h("div.lesson-head", null, [h("span.lesson-emo", { "aria-hidden": "true" }, x.emo), h("h3.lesson-t#ex-" + x.id, null, t("ex." + x.id + ".t")),
          m ? h("span.badge.ok.lesson-state", null, [U.icon("check"), t("learn.done")]) : h("span.badge.lesson-state.todo", null, t("learn.todo"))]),
        h("p.lesson-d", null, t("ex." + x.id + ".d")),
        h("p.lesson-meta.muted", null, m ? t("tr.doneOn", { d: E.fmtDate(new Date(m.at), "short") }) : t("ex.where." + x.room)),
        h("div.lesson-keys", null, [h("button.key.sm.primary", { type: "button", "data-act": "exercise", onclick: function () { TR.exercise(x.id); } }, [U.icon("play"), t(m ? "ex.again" : "ex.begin")])])]);
    })));
  };

  /* the team: each person's onboarding and training, for leaders */
  function staff() { return B.people().filter(function (u) { return u.active !== false && u.role !== "owner"; }); }
  function teamCounts() { var late = 0, ready = 0; staff().forEach(function (u) { var s = TR.statusOf(u); late += s.overdue ? 1 : 0; ready += s.ready ? 1 : 0; }); return { late: late, ready: ready }; }
  TR.teamCounts = teamCounts;
  PANES.team = function (pane) {
    var train = B.can("train"), people = B.people().filter(function (u) { return u.active !== false; });
    pane.appendChild(h("section.card.learn-team#learnTeam", { "aria-labelledby": "learnTeamH" }, [
      h("div.card-head", null, [h("h2#learnTeamH", null, [ui.emo("👥"), t("tr.teamH")]),
        train ? h("button.key.primary#trAssign", { type: "button", onclick: function () { TR.assign([]); } }, [U.icon("plus"), t("tr.assign")]) : null]),
      h("p.hint", null, t("tr.teamP")),
      h("div.table-wrap", null, h("table.grid#learnPeople", null, [
        h("thead", null, h("tr", null, [h("th", null, t("people.name")), h("th", null, t("tr.colOnb")), h("th.num", null, t("tr.colToDo")), h("th.num", null, t("tr.colLate")),
          h("th.num", null, t("learn.colDone")), h("th", null, t("learn.colLast")), h("th", null, t("learn.colMarks")), h("th", null, h("span.sr-only", null, t("tr.details")))])),
        h("tbody", null, people.map(function (u) {
          var s = TR.statusOf(u), onb = s.onboarding, cell;
          if (!onb) cell = u.role === "owner" ? null : train ? h("button.key.sm", { type: "button", "data-act": "onboard", onclick: function () { TR.onboard(u.id); } }, [U.icon("play"), t("tr.startOnb")]) : h("span.muted", null, t("tr.noOnb"));
          else if (onb.done) cell = h("span.badge.ok", null, [U.icon("check"), t("tr.signed")]);
          else cell = h("span.tr-mini", null, [h("span.tr-mini-bar", null, (function () { var f = h("i"); f.style.width = (s.ob.length ? Math.round(100 * s.obDone / s.ob.length) : 0) + "%"; return f; })()),
            h("small", null, s.obDone + " / " + s.ob.length), s.ready ? h("span.badge.warn", null, t("tr.ready")) : null]);
          return h("tr", { "data-person": u.id }, [h("td", null, ui.personTag(u)), h("td", null, cell), h("td.num", null, String(s.toDo)),
            h("td.num", null, s.overdue ? h("span.badge.bad", null, String(s.overdue)) : "0")].concat(L.lessonCells(u), [
            h("td", null, h("button.key.sm", { type: "button", "data-act": "details", onclick: function () { TR.person(u.id); } }, t("tr.details")))]));
        }))]))]));
  };

  /* one person's training, for leaders: their onboarding, what was assigned, refreshers; signing off */
  TR.person = function (id) {
    var u = B.state().users[id]; if (!u) return;
    var train = B.can("train"), body = h("div#trPerson"), d;
    function draw() {
      U.clear(body);
      var s = TR.statusOf(u);
      body.appendChild(h("p.muted", null, ui.personTag(u) + " · " + ui.levelName(u)));
      if (s.onboarding) body.appendChild(onboardingCard(u, s, train));
      else if (train && u.role !== "owner") body.appendChild(h("div.tr-calm", null, [h("p", null, t("tr.noOnbP", { name: u.name })),
        h("button.key.primary#trStartOnb", { type: "button", onclick: function () { d.close(); TR.onboard(u.id); } }, [U.icon("play"), t("tr.startOnb")])]));
      var assigned = s.items.filter(function (x) { return x.it.why === "assigned"; }).sort(byDue);
      if (assigned.length) body.appendChild(h("section.tr-sec", null, [h("h3", null, t("tr.assignedTheirs")), h("ul.tr-list", null, assigned.map(function (x) { return row(u, x, train); }))]));
      if (s.refresh.length) body.appendChild(h("section.tr-sec", null, [h("h3", null, t("tr.refreshH")), h("ul.tr-list", null, s.refresh.map(function (x) { return row(u, x, train); }))]));
      if (!s.onboarding && !assigned.length && !s.refresh.length && !train) body.appendChild(h("p.muted", null, t("tr.nothingTheirs", { name: u.name })));
      var sign = document.getElementById("trSignOff"); if (sign) sign.hidden = !(train && s.ready && (u.id !== B.user.id || B.isOwner()));
    }
    var actions = [{ label: t("close") }];
    if (train) actions.push({ label: t("tr.assign"), id: "trAssignOne", onClick: function (close) { close(); TR.assign([u.id]); } });
    if (train) actions.push({ label: t("tr.signOff"), kind: "primary", id: "trSignOff", onClick: function (close, btn) {
      btn.disabled = true;
      B.signOff(u.id).then(function () { ui.toast(t("tr.signedOffNow", { name: u.name }), "good"); if (E.sound) E.sound.play("sale"); close(); if (ui.current === "learn") ui.refresh(); },
        function (e) { btn.disabled = false; ui.toast(t(e && e.code === "notDone" ? "tr.notDone" : "door.problem"), "bad"); });
      return false;
    } });
    d = ui.dialog({ title: t("tr.personH", { name: u.name }), emoji: "🎓", wide: true, body: body, actions: actions,
      onClose: function () { B.off && B.off("change", onChange); if (ui.current === "learn") ui.refresh(); } });
    function onChange() { if (document.body.contains(body)) draw(); }
    B.on("change", onChange);
    draw();
  };

  /* starting a person's onboarding: the day it starts */
  TR.onboard = function (id, quiet) {
    var u = B.state().users[id]; if (!u || !B.can("train")) return Promise.resolve(null);
    if (quiet) return B.startOnboarding(id);
    var day = h("input#trOnbDay", { type: "date", value: U.dayKey() });
    var course = B.course(), n = course.path.filter(function (x) { return B.canTrain(u, x[0], x[1], course); }).length;
    ui.dialog({ title: t("tr.onbStartH", { name: u.name }), emoji: "🎓", body: [h("p", null, t("tr.onbStartP", { n: n })), ui.field("tr.onbFrom", day), h("p.hint", null, t("tr.onbStartHint"))],
      actions: [{ label: t("cancel") }, { label: t("tr.startOnb"), kind: "primary", id: "trOnbGo", onClick: function (close, btn) {
        btn.disabled = true;
        B.startOnboarding(id, day.value).then(function () { close(); ui.toast(t("tr.onbStarted", { name: u.name }), "good"); if (ui.current === "learn") ui.refresh(); }, function (e) {
          btn.disabled = false; ui.toast(t(e && e.code === "already" ? "tr.onbAlready" : "door.problem"), "bad");
        });
        return false;
      } }] });
    return Promise.resolve(null);
  };

  /* assigning: to whom, what, and by when */
  TR.assign = function (ids) {
    if (!B.can("train")) return;
    var course = B.course(), people = staff();
    var who = h("div.tr-pick#trWho", { role: "group", "aria-label": t("tr.who") }, people.map(function (u) {
      var cb = h("input", { type: "checkbox", id: "trw-" + u.id, "data-person": u.id }); cb.checked = ids.indexOf(u.id) >= 0;
      return h("label.tr-check", { for: "trw-" + u.id }, [cb, h("span", null, [h("b", null, u.name), h("small", null, ui.levelName(u))])]);
    }));
    function group(titleKey, list) {
      if (!list.length) return null;
      return h("fieldset.tr-group", null, [h("legend", null, t(titleKey)), h("div.tr-pick", null, list.map(function (x) {
        var key = x[0] + ":" + x[1], cb = h("input", { type: "checkbox", id: "tri-" + key.replace(/[^a-z0-9]/gi, "-"), "data-item": key });
        return h("label.tr-check", { for: cb.id }, [cb, h("span", null, [h("b", null, [x[2] + " ", x[3]])])]);
      }))]);
    }
    var lessons = B.LESSON_IDS.filter(function (r) { return B.TRAIN_NEED["lesson:" + r] !== "owner"; }).map(function (r) { return ["lesson", r, emoOf("lesson", r), titleOf("lesson", r, course)]; });
    var exs = EXERCISES.filter(function (x) { return !x.open || x.open(); }).map(function (x) { return ["exercise", x.id, x.emo, t("ex." + x.id + ".t")]; });
    var tasks = (course.tasks || []).map(function (x) { return ["task", x.id, "📌", x.title]; });
    var what = h("div#trWhat", null, [group("tr.kinds.lesson", lessons), group("tr.kinds.exercise", exs), group("tr.kinds.task", tasks)]);
    var due = h("input#trDue", { type: "date", value: U.dayKey(U.addDays(new Date(), 7)) });
    var warn = h("p.err.tr-err#trAssignWarn", { role: "alert" });
    ui.dialog({ title: t("tr.assignH"), emoji: "📋", wide: true, body: [h("p.hint", null, t("tr.assignP")), h("h3.tr-h3", null, t("tr.who")), people.length ? who : h("p.muted", null, t("tr.noStaff")),
      h("h3.tr-h3", null, t("tr.what")), what, ui.field("tr.due", due), warn],
      actions: [{ label: t("cancel") }, { label: t("tr.assign"), kind: "primary", id: "trAssignGo", onClick: function (close, btn) {
        var users = Array.prototype.map.call(who.querySelectorAll("input:checked"), function (c) { return c.getAttribute("data-person"); });
        var items = Array.prototype.map.call(what.querySelectorAll("input:checked"), function (c) { var k = c.getAttribute("data-item"), i = k.indexOf(":"); return { kind: k.slice(0, i), ref: k.slice(i + 1) }; });
        if (!users.length) { warn.textContent = t("tr.needWho"); return false; }
        if (!items.length) { warn.textContent = t("tr.needWhat"); return false; }
        btn.disabled = true;
        B.assign(users, items, due.value).then(function (given) {
          close();
          var n = (given || []).reduce(function (a, g) { return a + g.n; }, 0);
          ui.toast(n ? t("tr.assigned", { n: n, p: (given || []).length }) : t("tr.assignedNone"), n ? "good" : null);
          if (ui.current === "learn") ui.refresh();
        }, function (e) { btn.disabled = false; ui.failed(e); });
        return false;
      } }] });
  };

  /* ---------- the plans: the store's onboarding path, its own tasks, and the refreshers ---------- */
  PANES.plans = function (pane) {
    var c = B.course();
    function save(next, msg) { return B.saveCourse(next).then(function (r) { if (r) ui.toast(t(msg || "tr.planSaved"), "good"); ui.refresh(); }, ui.failed); }
    function titled(kind, ref) { return [emoOf(kind, ref), titleOf(kind, ref, c) || ref]; }
    /* the path, day by day */
    var prevDay = 0;
    var rows = c.path.slice().sort(function (a, b) { return a[2] - b[2]; }).map(function (x) {
      var startsDay = prevDay && x[2] !== prevDay; prevDay = x[2];
      var nt = titled(x[0], x[1]);
      var daySel = h("select.tr-day-sel", { "aria-label": t("tr.dayOf", { name: nt[1] }), "data-item": x[0] + ":" + x[1] });
      for (var d = 1; d <= 14; d++) { var o = h("option", { value: String(d) }, t("tr.day", { n: d })); if (d === x[2]) o.selected = true; daySel.appendChild(o); }
      daySel.addEventListener("change", function () { var next = B.course(); next.path.forEach(function (y) { if (y[0] === x[0] && y[1] === x[1]) y[2] = +daySel.value; }); save(next); });
      return h("li.tr-path-row" + (startsDay ? ".day-start" : ""), { "data-item": x[0] + ":" + x[1] }, [daySel, h("span.tr-emo", { "aria-hidden": "true" }, nt[0]), h("span.tr-t", null, [h("b", null, nt[1]), h("small", null, t("tr.kind." + x[0]))]),
        h("button.icon-key", { type: "button", "aria-label": t("tr.pathRemove", { name: nt[1] }), title: t("tr.pathRemove", { name: nt[1] }), onclick: function () {
          var next = B.course(); next.path = next.path.filter(function (y) { return !(y[0] === x[0] && y[1] === x[1]); }); save(next);
        } }, U.icon("x"))]);
    });
    var missing = [].concat(B.LESSON_IDS.filter(function (r) { return B.TRAIN_NEED["lesson:" + r] !== "owner"; }).map(function (r) { return ["lesson", r]; }),
      B.EX_IDS.map(function (r) { return ["exercise", r]; }), (c.tasks || []).map(function (x) { return ["task", x.id]; }))
      .filter(function (x) { return !c.path.some(function (y) { return y[0] === x[0] && y[1] === x[1]; }); });
    var addSel = h("select#trPathAdd", { "aria-label": t("tr.pathAdd") }, missing.map(function (x) { var nt = titled(x[0], x[1]); return h("option", { value: x[0] + ":" + x[1] }, nt[0] + " " + nt[1]); }));
    var addDay = h("select#trPathAddDay", { "aria-label": t("tr.dayLabel") });
    for (var d = 1; d <= 14; d++) addDay.appendChild(h("option", { value: String(d) }, t("tr.day", { n: d })));
    pane.appendChild(h("section.card.tr-sec#trPath", { "aria-labelledby": "trPathH" }, [h("div.card-head", null, h("h2#trPathH", null, [ui.emo("🗺️"), t("tr.pathH")])),
      h("p.hint", null, t("tr.pathP")), h("ol.tr-list.tr-path", null, rows),
      missing.length ? h("div.tr-path-add", null, [addSel, addDay, h("button.key#trPathAddKey", { type: "button", onclick: function () {
        var v = addSel.value, i = v.indexOf(":"), next = B.course(); next.path.push([v.slice(0, i), v.slice(i + 1), +addDay.value]); save(next);
      } }, [U.icon("plus"), t("tr.pathAdd")])]) : null]));
    /* the store's own tasks */
    pane.appendChild(h("section.card.tr-sec#trTasks", { "aria-labelledby": "trTasksH" }, [h("div.card-head", null, [h("h2#trTasksH", null, [ui.emo("📌"), t("tr.tasksH")]),
      h("button.key.primary#trTaskAdd", { type: "button", onclick: function () { taskForm(null); } }, [U.icon("plus"), t("tr.taskAdd")])]),
      h("p.hint", null, t("tr.tasksP")),
      (c.tasks || []).length ? h("ul.tr-list", null, c.tasks.map(function (x) {
        return h("li.tr-row", { "data-task": x.id }, [h("span.tr-emo", { "aria-hidden": "true" }, "📌"), h("span.tr-t", null, [h("b", null, x.title),
          h("small", null, t(x.sign === "lead" ? "tr.signLead" : "tr.signSelf") + (x.need ? " · " + t("access." + x.need + ".s") : "")), x.body ? h("small.tr-body", null, x.body) : null]),
          h("span.tr-keys", null, [h("button.key.sm", { type: "button", onclick: function () { taskForm(x); } }, [U.icon("edit"), t("edit")]),
            h("button.icon-key", { type: "button", "aria-label": t("tr.taskRemove", { name: x.title }), title: t("tr.taskRemove", { name: x.title }), onclick: function () {
              ui.confirm(t("tr.taskRemoveQ", { name: x.title }), t("tr.taskRemoveP"), t("remove"), "danger").then(function (yes) {
                if (!yes) return; var next = B.course(); next.tasks = next.tasks.filter(function (y) { return y.id !== x.id; }); save(next);
              });
            } }, U.icon("x"))])]);
      })) : h("p.muted#trNoTasks", null, t("tr.noTasks"))]));
    /* the refreshers */
    var every = [["0", t("tr.never")], ["90", t("tr.months", { n: 3 })], ["180", t("tr.months", { n: 6 })], ["365", t("tr.months", { n: 12 })]];
    var items = B.LESSON_IDS.map(function (r) { return ["lesson", r]; }).concat(B.EX_IDS.map(function (r) { return ["exercise", r]; }));
    pane.appendChild(h("section.card.tr-sec#trRefreshers", { "aria-labelledby": "trRefH" }, [h("div.card-head", null, h("h2#trRefH", null, [ui.emo("🔁"), t("tr.refreshersH")])),
      h("p.hint", null, t("tr.refreshersP")),
      h("ul.tr-list.tr-ref", null, items.map(function (x) {
        var key = x[0] + ":" + x[1], nt = titled(x[0], x[1]), cur = String(c.refresh[key] || 0);
        if (["0", "90", "180", "365"].indexOf(cur) < 0) cur = "180";
        var seg = ui.seg(every, cur, function (v) { var next = B.course(); if (v === "0") delete next.refresh[key]; else next.refresh[key] = +v; save(next); }, t("tr.refreshOf", { name: nt[1] }));
        seg.setAttribute("data-item", key);
        return h("li.tr-row", { "data-item": key }, [h("span.tr-emo", { "aria-hidden": "true" }, nt[0]), h("span.tr-t", null, [h("b", null, nt[1]), h("small", null, t("tr.kind." + x[0]))]), seg]);
      }))]));
    function taskForm(x) {
      var title = ui.input({ id: "tkTitle", maxlength: "80", value: x ? x.title : "", placeholder: t("tr.taskTitlePh") });
      var body = h("textarea#tkBody", { rows: "3", maxlength: "400", placeholder: t("tr.taskBodyPh") }); body.value = x ? x.body : "";
      var sign = ui.seg([["self", t("tr.signSelf")], ["lead", t("tr.signLead")]], x ? x.sign : "self", function () { }, t("tr.taskSign")); sign.id = "tkSign";
      var need = ui.select([["", t("tr.forAll")]].concat(B.ACCESS.map(function (a) { return [a, t("tr.forAccess", { a: t("access." + a + ".s") })]; })), x && x.need ? x.need : "", { id: "tkNeed" });
      var inPath = h("input", { type: "checkbox", id: "tkPath" }); inPath.checked = !x;
      var pday = h("select#tkDay", { "aria-label": t("tr.dayLabel") }); for (var d2 = 1; d2 <= 14; d2++) pday.appendChild(h("option", { value: String(d2) }, t("tr.day", { n: d2 })));
      ui.dialog({ title: t(x ? "tr.taskEdit" : "tr.taskAdd"), emoji: "📌", wide: true, focus: "#tkTitle", body: [ui.field("tr.taskTitle", title, { required: true }), ui.field("tr.taskBody", body),
        h("div.field", null, [h("div.label-row", null, h("span.lbl", null, t("tr.taskSign"))), sign]), ui.field("tr.taskFor", need),
        x ? null : h("label.tr-check", { for: "tkPath" }, [inPath, h("span", null, [h("b", null, t("tr.taskInPath")), pday])])],
        actions: [{ label: t("cancel") }, { label: t("save"), kind: "primary", id: "tkSave", onClick: function (close) {
          if (!title.value.trim()) { ui.fieldError(title, t("tr.taskNeedTitle")); return false; }
          var next = B.course(), v = { id: x ? x.id : U.uid("k"), title: title.value, body: body.value, sign: sign.querySelector('[aria-checked="true"]').getAttribute("data-v"), need: need.value || null };
          if (x) next.tasks = next.tasks.map(function (y) { return y.id === x.id ? v : y; }); else { next.tasks.push(v); if (inPath.checked) next.path.push(["task", v.id, +pday.value]); }
          close(); save(next);
          return false;
        } }] });
    }
  };

  /* ---------- the Home: what is waiting ---------- */
  TR.homeRows = function (need) {
    var out = [], u = B.user; if (!u) return out;
    var s = TR.statusOf(u);
    if (s.toDo) out.push(need("🎓", t(s.toDo === 1 ? "tr.home1" : "tr.home", { n: s.toDo }), s.overdue ? t("tr.homeLate", { n: s.overdue }) : t("tr.homeSub"), s.overdue ? "warn" : null,
      [t("home.open"), function () { TR.tab = "mine"; ui.go("learn"); }]));
    if (B.can("train")) {
      var c = teamCounts();
      if (c.ready || c.late) out.push(need("👥", c.ready ? t(c.ready === 1 ? "tr.homeReady1" : "tr.homeReady", { n: c.ready }) : t(c.late === 1 ? "tr.homeTeamLate1" : "tr.homeTeamLate", { n: c.late }),
        t("tr.homeTeamSub"), c.late ? "warn" : null, [t("home.open"), function () { TR.tab = "team"; ui.go("learn"); }]));
    }
    return out;
  };
})();
