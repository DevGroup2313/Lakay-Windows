/* LAKAY | Build 20 test: the Schedule. The week's shifts person by person; those with the team access add, change and
   remove a shift, fill a week from the usual week or from the week before, and keep a week as the usual one; the plan
   of a day gone by cannot be rewritten; a person asks a colleague to cover a shift or to trade one, the colleague
   answers, and a leader approves (never their own request); each shift that has begun is held against the time clock.
   In the practice store: Marie (a cashier) and Jean (a manager). Every word in French and Kreyòl; the week fits a phone.
   Run: node tests/t_build20.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const ROOT = path.resolve(__dirname, ".."), PAGE = process.argv[2] || "file://" + path.join(ROOT, "app", "Lakay.html");
let failed = 0, passed = 0;
function ok(cond, what) { if (cond) { passed++; console.log("  ok   " + what); } else { failed++; console.log("  FAIL " + what); } }
const wait = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const errors = [], csp = [];
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
  const go = async (room) => { await p.evaluate(r => E.ui.go(r), room); await wait(p, 350); };
  const as = async (id) => { await p.click("#statusPill"); await p.click('.as-keys [data-person="' + id + '"]'); await wait(p, 700); };
  const week = async (n) => { await p.evaluate(n => { E.schedule.week = n; E.ui.go("schedule", true); }, n); await wait(p, 300); };
  const lastLine = () => p.evaluate(() => E.books.lines().then(l => ({ type: l[0].type, by: l[0].by, data: l[0].data })));
  const day = (n) => p.evaluate(n => E.util.dayKey(E.util.addDays(E.util.fromDayKey(E.books.weekStartKey(new Date())), n)), n);
  const slotsOf = (user, d) => p.evaluate(([u, d]) => E.books.slots(x => x.user === u && x.day === d).map(x => x.from + "-" + x.to), [user, d]);
  const MARIE = "u_practice_marie", JEAN = "u_practice_jean";

  await p.goto(PAGE); await p.waitForSelector("#introEnter", { timeout: 20000 });
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await p.waitForSelector(".shell", { timeout: 90000 });
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); });

  console.log("The Schedule room");
  const nav = await p.$$eval(".nav-btn", b => b.map(x => x.getAttribute("data-room")));
  ok(nav.indexOf("schedule") === nav.indexOf("team") + 1, "the menu has Schedule, after Team");
  await go("schedule");
  ok((await p.textContent("main#room h1")).includes("Schedule"), "the room is called Schedule");
  const data = await p.evaluate(() => ({ slots: E.books.slots().length, usual: E.books.usualWeek().rows.length, swaps: E.books.swaps().map(w => w.kind + ":" + w.status).join(",") }));
  ok(data.slots >= 30 && data.usual === 10 && data.swaps === "cover:agreed,trade:asked", "the practice store's schedule: " + data.slots + " shifts, a usual week of ten, a cover agreed and a trade asked");
  ok(await p.locator("#schGrid tbody tr").count() === 3 && await p.locator("#schGrid thead th").count() === 9, "the week's table: the owner, Marie and Jean; seven days and the hours");
  await week(-1);
  const lw = await p.evaluate(() => Array.from(document.querySelectorAll("#schGrid .sch-chip")).map(c => c.className));
  ok(lw.length >= 13 && lw.every(c => /is-ontime|is-late|is-absent/.test(c)), "last week, every shift shows how it went (" + lw.length + " shifts)");
  ok(await p.isDisabled("#schFillUsual") && await p.isDisabled("#schFillLast"), "a week gone by cannot be filled");
  await week(0);
  const late = await p.evaluate(() => { const s = E.books.slots(x => x.from === "12:30")[0]; return s ? E.books.attendance(s) : null; });
  ok(!late || (late.state === "late" && late.minutes >= 15), "Jean, planned from half past twelve, clocked in at a quarter to one: late " + (late ? late.minutes + " min" : "(that day is still to come)"));
  ok(await p.locator("#schPlanned tbody tr").count() >= 2, "Planned and worked: the hours planned beside the hours the clock counted");

  console.log("Planning (the owner)");
  await go("home");
  ok(/1 swap waiting for your approval/.test(await p.textContent(".hm-needs")), "the Home says a swap waits for the owner");
  await week(1);
  const nextSat = await day(12), nextTue = await day(8);
  ok((await slotsOf(MARIE, nextSat)).length === 0, "Marie is off next Saturday");
  await p.click(`#schGrid td[data-person="${MARIE}"][data-day="${nextSat}"] .sch-add`); await wait(p, 400);
  ok(await p.locator(".layer #slWho").count() === 1 && await p.inputValue("#slDay") === nextSat, "the plus key in a day opens a new shift for that person and day");
  await p.fill("#slFrom", "10:00"); await p.fill("#slTo", "09:00"); await p.click("#slSave"); await wait(p, 300);
  ok(await p.locator("#slFrom[aria-invalid=true]").count() === 1, "the end must come after the start");
  await p.fill("#slTo", "16:00"); await p.fill("#slNote", "Stock count"); await p.click("#slSave"); await wait(p, 600);
  ok(JSON.stringify(await slotsOf(MARIE, nextSat)) === '["10:00-16:00"]', "the shift is added");
  let ln = await lastLine();
  ok(ln.type === "slot.added" && ln.by === "owner" && ln.data.slot.note === "Stock count", "the ledger keeps it, with who planned it");
  const twice = await p.evaluate(d => E.books.addSlot({ user: "u_practice_marie", day: d, from: "15:00", to: "18:00" }).then(() => "added", e => e.code), nextSat);
  ok(twice === "overlap", "no one is given two shifts at once");
  const pastDay = await p.evaluate(() => E.books.addSlot({ user: "u_practice_marie", day: E.util.dayKey(E.util.addDays(new Date(), -2)), from: "09:00", to: "12:00" }).then(() => "added", e => e.code));
  ok(pastDay === "pastday", "the plan of a day gone by cannot be rewritten");
  await p.click(`#schGrid td[data-person="${MARIE}"][data-day="${nextSat}"] .sch-chip`); await wait(p, 400);
  ok(await p.inputValue("#slFrom") === "10:00", "pressing a shift opens it to change");
  await p.fill("#slTo", "17:30"); await p.click("#slSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "slot.changed" && JSON.stringify(ln.data.diff.to) === '["16:00","17:30"]', "a change is a ledger line with what changed");
  await p.click(`#schGrid td[data-person="${MARIE}"][data-day="${nextSat}"] .sch-chip`); await wait(p, 400);
  await p.click("#slRemove"); await wait(p, 300);
  await p.locator(".layer").last().locator(".dialog-foot .key.danger").click(); await wait(p, 600);
  ok((await slotsOf(MARIE, nextSat)).length === 0 && (await lastLine()).type === "slot.removed", "a shift removed, and the ledger says so");

  console.log("Filling the weeks to come");
  await week(2);
  ok(await p.locator("#schGrid .sch-chip").count() === 0, "the week after next is empty");
  await p.click("#schFillUsual"); await wait(p, 300); await p.locator(".layer").last().locator(".dialog-foot .key.primary").click(); await wait(p, 700);
  ok(await p.locator("#schGrid .sch-chip").count() === 10 && (await lastLine()).data.added === 10, "Fill from the usual week: ten shifts in one press");
  const again = await p.evaluate(k => E.books.fillWeek(k, "usual"), await day(14));
  ok(again === null, "filled again, nothing is added twice");
  await week(3);
  await p.click("#schFillLast"); await wait(p, 300); await p.locator(".layer").last().locator(".dialog-foot .key.primary").click(); await wait(p, 700);
  ok(await p.locator("#schGrid .sch-chip").count() === 10 && (await lastLine()).data.source === "last", "Copy the week before: the same ten");
  const w3 = await day(21);
  await p.evaluate(k => { const s = E.books.slots(x => x.day === k && x.user === "u_practice_marie")[0]; return E.books.removeSlot(s.id); }, w3);
  await week(3);
  await p.click("#schKeep"); await wait(p, 300); await p.locator(".layer").last().locator(".dialog-foot .key.primary").click(); await wait(p, 600);
  ok(await p.evaluate(() => E.books.usualWeek().rows.length) === 9 && (await lastLine()).type === "rota.saved", "Keep as the usual week: the week shown becomes the pattern");

  console.log("Swaps: a leader approves");
  await week(0);
  const nextMon = await day(7);
  await p.click('#schToApprove [data-act="approve"]'); await wait(p, 700);
  ok(JSON.stringify(await slotsOf(JEAN, nextMon)) === '["08:45-15:15"]' && (await slotsOf(MARIE, nextMon)).length === 0, "approved: Jean works Marie's Monday");
  ln = await lastLine();
  ok(ln.type === "swap.decided" && ln.data.yes === true && ln.by === "owner", "the ledger keeps who approved it");
  ok(await p.evaluate(() => E.books.swaps(w => w.kind === "cover")[0].status) === "approved", "the request is closed as approved");

  console.log("Marie, a cashier");
  await as(MARIE);
  await go("home");
  ok(/Jean asks you to trade shifts/.test(await p.textContent(".hm-needs")) && /Your next shift/.test(await p.textContent(".hm-needs")), "her Home: Jean's request, and her next shift");
  await go("schedule");
  ok(await p.locator("#schAdd").count() === 0 && await p.locator(".sch-add").count() === 0 && await p.locator("#schFillUsual").count() === 0 && await p.locator("#schPlanned").count() === 0, "she plans nothing, and sees no one's hours worked");
  const deny = await p.evaluate(() => E.books.addSlot({ user: "u_practice_marie", day: E.util.dayKey(E.util.addDays(new Date(), 3)), from: "09:00", to: "10:00" }).then(() => "added", e => e.code));
  ok(deny === "denied", "the books refuse a shift from her");
  await p.click('#schAskedMe [data-act="yes"]'); await wait(p, 600);
  ok(await p.evaluate(() => E.books.swaps(w => w.kind === "trade")[0].status) === "agreed", "she agrees to Jean's trade; it waits for a leader");
  const notHers = await p.evaluate(() => { const w = E.books.swaps(w => w.kind === "trade")[0]; return E.books.decideSwap(w.id, true).then(() => "approved", e => e.code); });
  ok(notHers === "denied", "she cannot approve it");
  await week(1);
  const wedNext = await day(9);
  await p.click(`#schMine li[data-slot] [data-act="ask"]`); await wait(p, 400);
  ok(await p.locator(".layer #swKind").count() === 1 && await p.locator(".layer #swWho").count() === 1, "Ask to swap: cover or trade, and with whom");
  ok(await p.textContent("#swWho") === "Jean", "a colleague is offered first: Jean");
  ok(await p.locator("#swBusy").isVisible() && await p.isDisabled("#swSend"), "Jean works that afternoon: the window says so, and Send stays closed");
  await p.click('#swKind [data-v="trade"]'); await wait(p, 250);
  const fits = await p.evaluate(() => Array.from(document.querySelectorAll("#swTheirsBox")).map(b => b.textContent)[0]);
  ok(await p.locator("#swTheirs").count() === 1 && /Wednesday/.test(fits) && !(await p.isDisabled("#swSend")), "a trade lists only the shifts that fit: Jean's Wednesday afternoon for her morning");
  await p.click('#swKind [data-v="cover"]'); await wait(p, 250);
  await p.evaluate(() => { const s = document.querySelector("#swWho"); s.value = "owner"; s.dispatchEvent(new Event("change")); }); await wait(p, 250);
  ok(!(await p.isDisabled("#swSend")) && await p.locator("#swBusy").count() === 0, "the owner is free then: Send opens");
  await p.fill("#swNote", "A doctor's visit"); await p.click("#swSend"); await wait(p, 700);
  const own = await p.evaluate(() => E.books.swaps(w => w.from === "u_practice_marie" && w.status === "asked").map(w => w.to + "|" + w.note)[0]);
  ok(own === "owner|A doctor's visit", "she asks the owner to cover it, with a word");
  const twiceAsk = await p.evaluate(() => { const w = E.books.swaps(w => w.from === "u_practice_marie" && w.status === "asked")[0]; return E.books.askSwap({ slot: w.slot, to: "owner", kind: "cover" }).then(() => "asked", e => e.code); });
  ok(twiceAsk === "already", "one request at a time on a shift");
  const cancel = await p.evaluate(() => { const w = E.books.swaps(w => w.from === "u_practice_marie" && w.status === "asked")[0]; return E.books.cancelSwap(w.id).then(w => w.status); });
  ok(cancel === "cancelled" && (await lastLine()).type === "swap.cancelled", "and cancels it");
  const notMine = await p.evaluate(() => { const s = E.books.slots(x => x.user === "u_practice_jean" && x.day > E.util.dayKey())[0]; return E.books.askSwap({ slot: s.id, to: "owner", kind: "cover" }).then(() => "asked", e => e.code); });
  ok(notMine === "denied", "no one asks a swap of another person's shift");

  console.log("Jean, a manager, and his own trade");
  await as(JEAN);
  await go("schedule");
  ok(await p.locator("#schAdd").count() === 1 && await p.locator('#schToApprove').count() === 0, "he plans the week, but his own trade is not his to approve");
  const self = await p.evaluate(() => { const w = E.books.swaps(w => w.kind === "trade")[0]; return E.books.decideSwap(w.id, true).then(() => "approved", e => e.code); });
  ok(self === "denied", "the books refuse it too");
  await as("owner");
  await go("schedule");
  await p.click('#schToApprove [data-act="approve"]'); await wait(p, 700);
  ok(JSON.stringify(await slotsOf(MARIE, nextSat)) === '["12:45-20:15"]' && JSON.stringify(await slotsOf(JEAN, nextTue)) === '["08:45-15:15"]', "the owner approves the trade: Marie takes Jean's Saturday, Jean takes Marie's Tuesday");
  const sunNext = await day(13);
  const refused = await p.evaluate(([J, M, sun]) => {
    const B = E.books, s = B.slots(x => x.user === J && x.day === sun)[0];
    return B.practiceAs(J).then(() => B.askSwap({ slot: s.id, to: M, kind: "cover" }))
      .then(w => B.practiceAs(M).then(() => B.answerSwap(w.id, true)).then(() => B.practiceAs("owner")).then(() => B.decideSwap(w.id, false, "Not that week")))
      .then(w => w.status + " " + B.slots(x => x.day === sun && x.user === J).length);
  }, [JEAN, MARIE, sunNext]);
  ok(refused === "refused 1", "a swap refused leaves the shift where it was");
  const changedAfter = await p.evaluate(([J, M, sun]) => {
    const B = E.books, s = B.slots(x => x.user === J && x.day === sun)[0];
    return B.practiceAs(J).then(() => B.askSwap({ slot: s.id, to: M, kind: "cover" }))
      .then(w => B.practiceAs("owner").then(() => B.changeSlot(s.id, { to: "19:00" })).then(() => B.swaps(x => x.id === w.id)[0].status));
  }, [JEAN, MARIE, sunNext]);
  ok(changedAfter === "void", "a request on a shift that a leader then changes is closed");

  console.log("Against the time clock");
  const att = await p.evaluate(() => {
    const s = E.books.slots(x => x.user === "u_practice_marie" && x.day > E.util.dayKey())[0];
    const d = E.util.fromDayKey(s.day), mk = (hh, mm) => { const x = new Date(d); x.setHours(hh, mm, 0, 0); return x; };
    return [E.books.attendance(s, mk(8, 0)).state, E.books.attendance(s, mk(9, 30)).state, E.books.attendance(s, mk(16, 0)).state].join(",");
  });
  ok(att === "later,notin,absent", "a shift not begun, begun with no one clocked in, and over with no one: " + att);
  ok(await p.evaluate(() => E.books.verify().then(r => r.ok && !r.problems.length)), "Verify passes");
  const types = await p.evaluate(() => E.books.lines().then(l => { const t = {}; l.forEach(x => { t[x.type] = 1; }); return t; }));
  ok(["slot.added", "slot.changed", "slot.removed", "week.filled", "rota.saved", "swap.asked", "swap.answered", "swap.decided", "swap.cancelled"].every(k => types[k]), "every step is a line in the ledger");

  console.log("A practice store made before Build 20");
  const old = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const o = await old.newPage(); o.on("pageerror", e => errors.push(e.message));
  await o.goto(PAGE); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  await o.evaluate(() => E.db.entries("rec").then(es => E.db.write(es.filter(e => /^(slot|rota|swap):/.test(e[0])).map(e => ({ store: "rec", key: e[0], del: true })))));
  await o.reload(); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  const up = await o.evaluate(() => ({ slots: E.books.slots().length, usual: E.books.usualWeek().rows.length, swaps: E.books.swaps().length, user: E.books.user.id }));
  ok(up.slots >= 30 && up.usual === 10 && up.swaps === 2 && up.user === "owner", "as it opens, it is given the schedule's samples once (" + JSON.stringify(up) + ")");
  await old.close();

  console.log("Three languages");
  const keysOk = await p.evaluate(() => {
    const d = E.dict, miss = [], same = [];
    Object.keys(d.en).filter(k => /^sch\.|^(room|lede)\.schedule$|^tip\.schedule\.|^tips\.schedule\.|^guide\.schedule\./.test(k))
      .forEach(k => { ["fr", "ht"].forEach(l => { if (!d[l][k]) miss.push(l + ":" + k); else if (d[l][k] === d.en[k] && !/^sch\.(no|absent|range|until)$/.test(k)) same.push(l + ":" + k); }); });
    return { miss: miss, same: same, n: Object.keys(d.en).filter(k => /^sch\./.test(k)).length };
  });
  ok(keysOk.miss.length === 0 && keysOk.same.length === 0, "every word of the Schedule is in French and Kreyòl (" + keysOk.n + " phrases)" + (keysOk.miss.length + keysOk.same.length ? " " + keysOk.miss.concat(keysOk.same).slice(0, 6).join(", ") : ""));
  for (const [lang, title] of [["fr", "Planning"], ["ht", "Orè"]]) {
    await p.evaluate(l => { E.setLang(l); E.ui.shell(); }, lang); await go("schedule");
    ok((await p.textContent("main#room h1")).includes(title) && !/sch\./.test(await p.textContent("main#room")), lang + ": " + title);
  }
  await p.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  ok(Object.keys(await p.evaluate(() => E.missing || {})).length === 0, "no word missing anywhere");

  console.log("On a phone");
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const q = await ph.newPage(); q.on("pageerror", e => errors.push(e.message));
  await q.goto(PAGE); await q.waitForSelector("#introEnter", { timeout: 20000 });
  await q.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await q.waitForSelector(".shell", { timeout: 90000 });
  await q.evaluate(() => E.ui.go("schedule")); await wait(q, 500);
  ok(await q.locator("#schDays").isVisible() && !(await q.locator(".sch-wrap").isVisible()), "on a phone, the week shows day by day");
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "and fits the phone's width");
  await ph.close();

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
