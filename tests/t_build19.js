/* LAKAY | Build 19 test: team leaders and managers with limited access to lead; training assigned to each person;
   exercises on Lakay's real screens with the sealed books set aside; a full onboarding, day by day, signed off by a
   leader; the store's own tasks; refreshers that come due again. In the practice store: Marie (a cashier, two days
   into her onboarding) and Jean (a manager). In a store of its own: a manager who adds a person with her own
   password, and that person signing in. Every word in French and Kreyòl; the room fits a phone.
   Run: node tests/t_build19.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const ROOT = path.resolve(__dirname, ".."), PAGE = process.argv[2] || "file://" + path.join(ROOT, "app", "Lakay.html");
let failed = 0, passed = 0;
function ok(cond, what) { if (cond) { passed++; console.log("  ok   " + what); } else { failed++; console.log("  FAIL " + what); } }
const wait = (p, ms) => p.waitForTimeout(ms);
const OWNER_PW = "kreyol and coffee 2026", ANA_FIRST = "first key for ana", ANA_PW = "ana leads the floor", BEN_FIRST = "first key for ben", BEN_PW = "ben rings up kompa";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const errors = [], csp = [];
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
  const go = async (room) => { await p.evaluate(r => E.ui.go(r), room); await wait(p, 300); };
  const tab = async (t) => { await p.click("#lrnTab-" + t); await wait(p, 300); };
  const as = async (id) => { await p.click("#statusPill"); await p.click('.as-keys [data-person="' + id + '"]'); await wait(p, 700); };
  const seq = () => p.evaluate(() => E.books.state().head.seq);
  const status = (id) => p.evaluate(i => { const s = E.train.statusOf(E.books.state().users[i]); return { items: s.items.length, done: s.items.filter(x => x.done).length, overdue: s.overdue, toDo: s.toDo, ready: s.ready, refresh: s.refresh.map(x => x.kind + ":" + x.ref), onb: !!s.onboarding, signed: !!(s.onboarding && s.onboarding.done) }; }, id);
  const ring = async (codes) => { for (const c of codes) { await p.fill("#regSearch", c); await p.press("#regSearch", "Enter"); await wait(p, 150); } };
  const exerciseDone = () => p.waitForSelector("#exDoneOk", { timeout: 15000 }).then(() => true, () => false);
  const books = () => p.evaluate(() => { const st = E.books.state(); return { seq: st.head.seq, sales: st.sales.length, svc: (st.services || []).length, moves: st.moves.length, stock: Object.keys(st.items).map(k => st.items[k].stock).join(","), shifts: JSON.stringify(st.shifts) }; });

  await p.goto(PAGE); await p.waitForSelector("#introEnter", { timeout: 20000 });
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await p.waitForSelector(".shell", { timeout: 90000 });
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); E.tour.speed = 0.25; });

  console.log("Access to lead: the kinds and the levels");
  const acc = await p.evaluate(() => ({ access: E.books.ACCESS.join(","), lead: E.books.PRESETS.lead.join(","), manager: E.books.PRESETS.manager.join(",") }));
  ok(/train/.test(acc.access) && /people/.test(acc.access) && /backup/.test(acc.access), "three new kinds of access: training, the people, backups (" + acc.access + ")");
  ok(acc.lead === "sell,items,receive,adjust,team,train", "a team leader sells, keeps the stock, sees the team's hours and trains (" + acc.lead + ")");
  ok(/people/.test(acc.manager) && /backup/.test(acc.manager) && /train/.test(acc.manager), "a manager may also look after the people and save backups");

  console.log("The practice store's training");
  const course = await p.evaluate(() => { const c = E.books.course(); return { tasks: c.tasks.map(x => x.id + ":" + x.sign).join(","), path: c.path.length, refresh: c.refresh }; });
  ok(course.tasks === "krulesone:self,kshadowing:lead" && course.path === 15, "the store's plan: two tasks of its own, fifteen steps (" + course.tasks + ", " + course.path + ")");
  ok(course.refresh["lesson:sale"] === 365 && course.refresh["lesson:pay"] === 180 && course.refresh["exercise:split"] === 90, "three refreshers: a year, six months, three months");
  const m0 = await status("u_practice_marie"), j0 = await status("u_practice_jean");
  ok(m0.onb && m0.items === 12 && m0.done === 4 && m0.overdue === 3 && !m0.ready, "Marie is two days into her onboarding: 4 of 12 done, 3 overdue (" + JSON.stringify(m0) + ")");
  ok(!j0.onb && j0.items === 1 && j0.toDo === 1, "Jean was given the Reports lesson, due in three days");
  ok(await p.evaluate(() => E.books.verify().then(r => r.ok)), "Verify replays the practice store's training");

  console.log("The Learning room's tabs, for the owner");
  await go("learn");
  const tabs = await p.$$eval(".lrn-tabs .inv-tab", b => b.map(x => x.getAttribute("data-tab")));
  ok(tabs.join(",") === "mine,lessons,exercises,team,plans", "five tabs: My training, Lessons, Exercises, The team, Plans (" + tabs.join(",") + ")");
  ok(await p.getAttribute("#lrnTab-lessons", "aria-selected") === "true", "with nothing waiting for the owner, the room opens on the lessons");
  ok(/1/.test(await p.textContent("#lrnTab-team .inv-tab-n")), "The team's tab counts one person with overdue training");
  await p.focus("#lrnTab-lessons"); await p.keyboard.press("ArrowRight"); await wait(p, 300);
  ok(await p.getAttribute("#lrnTab-exercises", "aria-selected") === "true", "the arrow keys move between the tabs");
  ok(await p.locator("#exList .lesson").count() === 6, "the owner can do all six exercises");
  await tab("team");
  const rows = await p.$$eval("#learnPeople tbody tr", rs => rs.map(r => r.getAttribute("data-person") + "|" + r.textContent));
  ok(rows.length === 3 && rows.some(x => /marie/.test(x) && /4 \/ 12/.test(x)) && rows.some(x => /jean/.test(x) && /Start the onboarding/.test(x)), "the team's table: Marie's onboarding 4 of 12, a key to start Jean's");
  await p.click('#learnPeople tr[data-person="u_practice_marie"] [data-act="details"]'); await wait(p, 500);
  ok(await p.locator("#trPerson #trOnboarding .tr-day").count() === 4 && await p.locator("#trPerson .tr-row.late").count() === 3, "Marie's details: her onboarding in four days, three items overdue");
  ok(await p.locator("#trSignOff").isHidden(), "not everything is done: the onboarding cannot be signed off yet");
  const early = await p.evaluate(() => E.books.signOff("u_practice_marie").then(() => "signed", e => e.code));
  ok(early === "notDone", "the books themselves refuse an early sign-off");
  await p.keyboard.press("Escape"); await wait(p, 300);

  console.log("Assigning training");
  await p.click("#trAssign"); await wait(p, 400);
  await p.click("#trAssignGo"); await wait(p, 200);
  ok(/at least one person/.test(await p.textContent("#trAssignWarn")), "who is asked first");
  await p.check("#trw-u_practice_marie"); await p.check("#trw-u_practice_jean"); await p.click("#trAssignGo"); await wait(p, 200);
  ok(/at least one lesson/.test(await p.textContent("#trAssignWarn")), "then what");
  await p.check('[data-item="lesson:stock"]'); await p.check('[data-item="exercise:receive"]');
  await p.fill("#trDue", await p.evaluate(() => E.util.dayKey(E.util.addDays(new Date(), 5))));
  const s0 = await seq();
  await p.click("#trAssignGo"); await wait(p, 600);
  const given = await p.evaluate(() => ({ marie: E.books.planOf("u_practice_marie").items.filter(x => x.why === "assigned").length, jean: E.books.planOf("u_practice_jean").items.map(x => x.ref).join(",") }));
  ok(given.marie === 0 && given.jean === "reports,stock,receive" && await seq() === s0 + 1, "each gets only what their access opens: Jean the deliveries, Marie nothing (" + JSON.stringify(given) + ")");
  const again = await p.evaluate(() => E.books.assign(["u_practice_jean"], [{ kind: "lesson", ref: "stock" }], null));
  ok(again === null, "what a person already has, not done, is not given twice");
  const line = await p.evaluate(() => E.books.lines().then(l => l[0]));
  ok(line.type === "training.assigned" && line.by === "owner", "the ledger keeps who assigned what");

  console.log("The plans: the path, the store's tasks, the refreshers");
  await tab("plans");
  ok(await p.locator("#trPath .tr-path-row").count() === 15 && await p.locator("#trTasks [data-task]").count() === 2 && await p.locator("#trRefreshers .tr-row").count() === 14, "the path's fifteen steps, the two tasks, fourteen refreshers to set");
  await p.selectOption('#trPath .tr-day-sel[data-item="lesson:reports"]', "7"); await wait(p, 500);
  ok(await p.evaluate(() => E.books.course().path.filter(x => x[1] === "reports")[0][2]) === 7, "a step moves to another day");
  await p.click("#trTaskAdd"); await wait(p, 300);
  await p.click("#tkSave"); await wait(p, 200);
  ok(await p.locator("#tkTitle[aria-invalid=true]").count() === 1, "a task needs to say what is to be done");
  await p.fill("#tkTitle", "Count the drawer\u0007 with a leader"); await p.fill("#tkBody", "At closing, with the day's report.");
  await p.click('#tkSign [data-v="lead"]'); await p.selectOption("#tkDay", "3");
  await p.click("#tkSave"); await wait(p, 600);
  const task = await p.evaluate(() => { const c = E.books.course(), k = c.tasks[2]; return { k: k, inPath: c.path.some(x => x[0] === "task" && x[1] === k.id && x[2] === 3) }; });
  ok(task.k.title === "Count the drawer with a leader" && task.k.sign === "lead" && task.inPath, "a new task, signed by a leader, on day 3 of the path (control characters taken out)");
  await p.click('#trRefreshers [data-item="lesson:svc"] [data-v="180"]'); await wait(p, 500);
  ok(await p.evaluate(() => E.books.course().refresh["lesson:svc"]) === 180, "a refresher set: the transfers lesson every six months");
  const clean = await p.evaluate(() => E.books.cleanCourse({ tasks: [{ id: "bad id", title: "x".repeat(200), sign: "boss", need: "god" }], path: [["lesson", "nope", 3], ["lesson", "sale", 99], ["lesson", "sale", 2], ["task", "missing", 1]], refresh: { "lesson:sale": 5, "lesson:pay": 90, "exercise:fly": 90 } }));
  ok(clean.tasks.length === 1 && clean.tasks[0].title.length === 80 && /^k[a-z0-9]{6,12}$/.test(clean.tasks[0].id) && clean.tasks[0].sign === "self" && clean.tasks[0].need === null, "a course holds only what it may: a task's title is cut to 80, its sign and access made plain");
  ok(clean.path.length === 1 && clean.path[0][2] === 1 && JSON.stringify(clean.refresh) === '{"lesson:pay":90}', "steps that do not exist, days out of range and refreshers under a month are left out");

  console.log("Refreshers coming due");
  await p.evaluate(() => { E.books._at = new Date(Date.now() + 200 * 86400000).toISOString(); });
  const later = await status("u_practice_jean");
  ok(later.refresh.indexOf("lesson:pay") >= 0 && later.refresh.indexOf("lesson:sale") < 0, "two hundred days on, Jean's payments lesson is due again; his sale lesson (yearly) is not (" + later.refresh.join(",") + ")");
  await p.evaluate(() => E.books.practiceAs("u_practice_jean").then(() => E.books.trainDone("pay", 2, 2)).then(() => E.books.practiceAs("owner")));
  ok((await status("u_practice_jean")).refresh.indexOf("lesson:pay") < 0, "taken again, the refresher is done");
  await p.evaluate(() => { E.books._at = null; });

  console.log("Marie, a cashier, in her onboarding");
  await as("u_practice_marie");
  await go("home");
  ok(/Your training: 8 to do/.test(await p.textContent(".hm-needs")) && /3 overdue/.test(await p.textContent(".hm-needs")), "the Home says what is waiting: 8 to do, 3 overdue");
  await p.locator(".hm-need", { hasText: "Your training" }).locator(".hm-need-k").click(); await wait(p, 400);
  ok(await p.evaluate(() => E.ui.current) === "learn" && await p.getAttribute("#lrnTab-mine", "aria-selected") === "true", "its key opens her own training");
  const mtabs = await p.$$eval(".lrn-tabs .inv-tab", b => b.map(x => x.getAttribute("data-tab")));
  ok(mtabs.join(",") === "mine,lessons,exercises", "a cashier has three tabs: no team, no plans");
  ok(/4 \/ 12/.test(await p.textContent("#trOnbCount")) && /Day 3 of 5/.test(await p.textContent("#trOnboarding")), "her onboarding: 4 of 12, day 3 of 5");
  ok(/A leader signs this/.test(await p.textContent('#trOnboarding li[data-ref="kshadowing"]')) && await p.locator('#trOnboarding li[data-ref="kshadowing"] [data-act]').count() === 0, "a task a leader signs has no key for her");
  const self = await p.evaluate(() => E.books.taskDone("u_practice_marie", "kshadowing").then(() => "done", e => e.code));
  ok(self === "denied", "and the books refuse her signing it herself");
  const noTrain = await p.evaluate(() => E.books.assign(["u_practice_marie"], [{ kind: "lesson", ref: "sale" }], null).then(() => "given", e => e.code));
  ok(noTrain === "denied", "a cashier assigns nothing");
  await tab("exercises");
  const mex = await p.$$eval("#exList .lesson", a => a.map(x => x.getAttribute("data-ex")));
  ok(mex.join(",") === "break,sale,split,card,transfer", "her exercises: the five her access opens, not the delivery (" + mex.join(",") + ")");

  console.log("An exercise: a sale, with the books set aside");
  await go("register"); await ring(["0850001000017"]);
  const before = await books();
  await go("learn"); await tab("exercises");
  await p.click('#exList [data-ex="sale"] [data-act="exercise"]'); await wait(p, 400);
  ok(await p.locator(".layer .ex-steps li").count() === 4 && /nothing you do is kept/.test(await p.textContent(".layer .ex-safe")), "the brief: four steps, and that nothing is kept");
  await p.click("#exBegin"); await wait(p, 700);
  ok(await p.evaluate(() => document.documentElement.classList.contains("drilling") && E.books.drilling()) && await p.locator("#drillBar").count() === 1, "the band across the top: an exercise is running");
  ok(await p.evaluate(() => E.ui.current) === "register" && await p.evaluate(() => E.register.ticket.lines.length) === 0, "it opens the Register, with an empty sale (the one waiting is put aside)");
  const pill = await p.$eval("#statusPill", n => n.getBoundingClientRect().top), bar = await p.$eval("#drillBar", n => n.getBoundingClientRect().bottom);
  ok(pill >= bar - 1, "the keys at the top stay below the band, within reach (" + Math.round(pill) + " ≥ " + Math.round(bar) + ")");
  const busy = await p.evaluate(() => E.tour.start("sale"));
  ok(busy === false, "no tour starts while an exercise runs");
  await ring(["0850005000013", "0850004000076"]);
  await p.click("#takeCash"); await p.waitForSelector("#cashIn"); await p.fill("#cashIn", "10"); await wait(p, 150);
  await p.click("#cashDone");
  ok(await exerciseDone(), "the sale done, the exercise is done");
  const after = await books();
  ok(after.seq === before.seq + 1 && after.sales === before.sales && after.stock === before.stock && after.moves === before.moves, "the books are as they were: no sale, no stock gone; one line only, the mark");
  ok((await p.evaluate(() => E.books.lines().then(l => l[0].type))) === "training.exercise", "that line is the mark that the exercise was done");
  ok(await p.evaluate(() => !E.books.drilling() && !document.getElementById("drillBar") && !document.documentElement.classList.contains("drilling")), "the band is gone, and the books are back");
  await p.click("#exDoneOk"); await wait(p, 300);
  ok(await p.evaluate(() => E.register.ticket.lines.map(l => l.qty).join(",")) === "1", "the sale that was waiting at the Register is back");
  ok(/5 \/ 12/.test(await (async () => { await tab("mine"); return p.textContent("#trOnbCount"); })()), "her onboarding counts it: 5 of 12");
  await go("register"); await p.evaluate(() => E.register.setLines([])); await wait(p, 200);

  console.log("A sale in two parts, a card, a transfer, a break");
  await p.evaluate(() => E.train.exercise("split")); await wait(p, 300); await p.click("#exBegin"); await wait(p, 600);
  await ring(["0850003000039"]);
  await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#payWay-card"); await p.fill("#payAmount", "20.00"); await p.fill("#payCode", "123456"); await p.click("#payPart"); await wait(p, 250);
  await p.fill("#cashIn", "20"); await wait(p, 150); await p.click("#cashDone");
  ok(await exerciseDone(), "a sale paid by card, then cash: done");
  await p.click("#exDoneOk"); await wait(p, 300);
  await p.evaluate(() => E.train.exercise("card")); await wait(p, 300); await p.click("#exBegin"); await wait(p, 600);
  await ring(["0850005000020"]); await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#payWay-card"); await p.fill("#payCode", "123456"); await wait(p, 150); await p.click("#cashDone");
  ok(await exerciseDone(), "a card payment with its approval code: done");
  await p.click("#exDoneOk"); await wait(p, 300);
  const sv0 = await books();
  await p.evaluate(() => E.train.exercise("transfer")); await wait(p, 300); await p.click("#exBegin"); await wait(p, 800);
  ok(await p.locator("#svcRecord").count() === 1, "the transfer exercise opens the money transfers' page");
  await p.click("#svcRecord"); await wait(p, 300);
  await p.click('#svcProviders [data-v="cam"]'); await p.click('#svcKinds [data-v="send"]');
  await p.fill("#svcAmount", "120.00"); await p.fill("#svcFee", "7.50"); await p.fill("#svcRef", "CA-1"); await p.click("#svcSave");
  ok(await exerciseDone(), "a transfer sent, with its fee: done");
  await p.click("#exDoneOk"); await wait(p, 300);
  ok((await books()).svc === sv0.svc, "no transfer was kept");
  const sh0 = await books();
  await p.evaluate(() => E.train.exercise("break")); await wait(p, 300); await p.click("#exBegin"); await wait(p, 600);
  await p.click("#statusPill"); await wait(p, 300);
  ok(await p.locator(".as-keys").count() === 0, "while it runs, the practice store's people cannot be switched");
  await p.click("#breakKey"); await wait(p, 400);
  await p.click("#statusPill"); await p.click("#breakKey");
  ok(await exerciseDone(), "a break begun and ended: done");
  await p.click("#exDoneOk"); await wait(p, 300);
  ok((await books()).shifts === sh0.shifts, "her real shift has no break in it");
  const m1 = await status("u_practice_marie");
  ok(m1.done === 8 && m1.overdue === 2, "her onboarding: 8 of 12, 2 overdue (" + m1.done + ", " + m1.overdue + ")");

  console.log("Ending an exercise part way");
  const e0 = await books();
  await p.evaluate(() => E.train.exercise("sale")); await wait(p, 300); await p.click("#exBegin"); await wait(p, 600);
  await ring(["0850005000013"]); await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#drillEnd"); await wait(p, 500);
  ok(await p.evaluate(() => !E.books.drilling()) && await p.locator(".layer").count() === 0 && JSON.stringify(await books()) === JSON.stringify(e0), "End the exercise: the windows close, and the books are exactly as they were");
  ok(await p.evaluate(() => E.register.ticket.lines.length) === 0, "the Register is as it was");

  console.log("Jean, a manager: the people, within what he has");
  await as("u_practice_jean");
  await go("team");
  ok(await p.locator("#addPerson").count() === 1 && await p.locator("#peopleList").count() === 1, "he may add people, and sees the list");
  ok(await p.locator('#peopleList tr[data-person="owner"] .row-key').count() === 0 && await p.locator('#peopleList tr[data-person="u_practice_jean"] .row-key').count() === 0 && await p.locator('#peopleList tr[data-person="u_practice_marie"] .row-key').count() === 1,
    "he may change Marie, but not the owner, and not himself");
  ok(await p.locator("#teamBackup").count() === 0, "in the practice store, there is no backup to save");
  await p.click("#addPerson"); await wait(p, 400);
  ok(await p.isDisabled('#pLevel [data-v="manager"]') && await p.isDisabled("#acc-people") && !(await p.isDisabled("#acc-train")), "he cannot give the manager's level or The people; he can give Training");
  await p.fill("#pName", "Lucie"); await p.click('#pLevel [data-v="lead"]');
  ok(await p.isChecked("#acc-train") && await p.isChecked("#pOnboard"), "a team leader trains; her onboarding starts today");
  await p.fill("#pPw", "first key for lucie"); await p.fill("#pPw2", "first key for lucie");
  await p.click("#pSave"); await p.waitForSelector("#newPersonId", { timeout: 30000 });
  ok(/1004/.test(await p.textContent("#newPersonId")) && await p.locator("#newPersonOnb").count() === 1, "Lucie is 1004, and her onboarding has started");
  await p.click("text=Got it"); await wait(p, 300);
  const lucie = await p.evaluate(() => { const u = E.books.people().filter(x => x.name === "Lucie")[0], pl = E.books.planOf(u.id); return { id: u.id, preset: u.preset, onb: !!pl.onboarding, n: pl.items.length, by: pl.onboarding && pl.onboarding.by }; });
  ok(lucie.preset === "lead" && lucie.onb && lucie.n === 15 && lucie.by === "u_practice_jean", "her plan: every step of the path her access opens, started by Jean (" + lucie.n + ")");
  const deny = await p.evaluate(() => Promise.all([
    E.books.addPerson({ name: "Max", access: ["sell", "people"], password: "first key for max" }).then(() => "added", e => e.code),
    E.books.editPerson("u_practice_marie", { access: ["sell", "people"], preset: "custom" }).then(() => "changed", e => e.code),
    E.books.retirePerson("owner").then(() => "retired", e => e.code),
    E.books.editPerson("u_practice_jean", { name: "Jean Baptiste" }).then(() => "changed", e => e.code)]));
  ok(deny.join(",") === "denied,denied,noperson,denied", "the books refuse him: giving The people, touching the owner, changing himself (" + deny.join(",") + ")");

  console.log("Jean signs off Marie's onboarding");
  await go("learn"); await tab("team");
  await p.click('#learnPeople tr[data-person="u_practice_marie"] [data-act="details"]'); await wait(p, 500);
  await p.click('#trPerson li[data-ref="kshadowing"] [data-act="signTask"]'); await wait(p, 300);
  await p.locator(".layer").last().locator(".dialog-foot .key.primary").click(); await wait(p, 700);
  const mark = await p.evaluate(() => E.books.markOf("u_practice_marie", "task", "kshadowing"));
  ok(mark && mark.by === "u_practice_jean", "the shift beside a leader: signed by Jean");
  await p.keyboard.press("Escape"); await wait(p, 300);
  await p.evaluate(() => E.books.practiceAs("u_practice_marie").then(() => E.books.trainDone("sale", 2, 2)).then(() => E.books.trainDone("pay", 2, 2)).then(() => E.books.trainDone("svc", 2, 2)).then(() => E.books.practiceAs("u_practice_jean")));
  const ready = await status("u_practice_marie");
  ok(ready.ready && ready.done === 12, "every item done: ready to sign off");
  await go("home");
  ok(/1 onboarding ready to sign off/.test(await p.textContent(".hm-needs")), "Jean's Home says so");
  await p.locator(".hm-need", { hasText: "ready to sign off" }).locator(".hm-need-k").click(); await wait(p, 400);
  ok(await p.getAttribute("#lrnTab-team", "aria-selected") === "true", "its key opens the team's training");
  const own = await p.evaluate(() => E.books.signOff("u_practice_jean").then(() => "signed", e => e.code));
  ok(own === "denied", "no one signs off their own onboarding");
  await p.click('#learnPeople tr[data-person="u_practice_marie"] [data-act="details"]'); await wait(p, 500);
  ok(await p.locator("#trSignOff").isVisible(), "Sign off the onboarding is open");
  await p.click("#trSignOff"); await wait(p, 700);
  const signed = await p.evaluate(() => E.books.planOf("u_practice_marie").onboarding.done);
  ok(signed && signed.by === "u_practice_jean", "Marie's onboarding is signed off, by Jean");
  ok(/Signed off/.test(await p.textContent('#learnPeople tr[data-person="u_practice_marie"]')), "the team's table says so");
  const types = await p.evaluate(() => E.books.lines().then(l => { const t = {}; l.forEach(x => { t[x.type] = 1; }); return t; }));
  ok(["course.updated", "onboarding.started", "onboarding.signedoff", "training.assigned", "training.exercise", "training.task", "person.added"].every(k => types[k]), "each step is a line in the ledger");
  ok(await p.evaluate(() => E.books.verify().then(r => r.ok && !r.problems.length)), "and Verify replays it all");

  console.log("Locking during an exercise");
  await as("owner");
  const l0 = await books();
  await p.evaluate(() => E.train.exercise("receive")); await wait(p, 300); await p.click("#exBegin"); await wait(p, 600);
  await p.evaluate(() => E.inventory.receive(Object.keys(E.books.state().items)[0])); await wait(p, 300);
  await p.fill("#rcQty", "3"); await p.click("#rcSave");
  ok(await exerciseDone(), "a delivery received: done");
  await p.click("#exDoneOk"); await wait(p, 300);
  ok((await books()).stock === l0.stock, "the stock did not rise");
  await p.evaluate(() => E.train.exercise("sale")); await wait(p, 300); await p.click("#exBegin"); await wait(p, 500);
  const refused = await p.evaluate(() => E.books.addItem({ name: "Not in an exercise", cat: "other", price: 100 }).then(() => "added", e => e.code));
  ok(refused === "drill", "work other than the counter's is refused while an exercise runs");
  const l1 = await books();
  await p.evaluate(() => { E.books.lock("hand"); });
  await wait(p, 500);
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true))); await p.waitForSelector(".shell", { timeout: 60000 }); await wait(p, 500);
  ok(await p.evaluate(() => !E.books.drilling() && !document.getElementById("drillBar")) && (await books()).seq === l1.seq, "a lock ends it: the books open as they were, with no band");

  console.log("Three languages");
  const keysOk = await p.evaluate(() => {
    const d = E.dict, miss = [], same = [];
    Object.keys(d.en).filter(k => /^(tr|ex|lrn)\.|^access\.(train|people|backup)\.|^level\.lead$|^people\.(limit|notGiven|notYours|onboard|backup)|^practice\.task|^guide\.train\./.test(k))
      .forEach(k => { ["fr", "ht"].forEach(l => { if (!d[l][k]) miss.push(l + ":" + k); else if (d[l][k] === d.en[k]) same.push(l + ":" + k); }); });
    return { miss: miss, same: same, n: Object.keys(d.en).filter(k => /^(tr|ex|lrn)\./.test(k)).length };
  });
  ok(keysOk.miss.length === 0 && keysOk.same.length === 0, "every word of Build 19 is in French and Kreyòl, each its own (" + keysOk.n + " phrases)" + (keysOk.miss.length + keysOk.same.length ? " " + keysOk.miss.concat(keysOk.same).slice(0, 6).join(", ") : ""));
  for (const [lang, title, word] of [["fr", "Ma formation", "Exercices"], ["ht", "Fòmasyon mwen", "Egzèsis"]]) {
    await p.evaluate(l => { E.setLang(l); E.ui.shell(); }, lang); await go("learn");
    const txt = await p.textContent(".lrn-tabs");
    ok(txt.includes(title) && txt.includes(word), lang + ": the tabs read " + title + ", " + word);
    await tab("exercises"); await p.click('#exList [data-ex="sale"] [data-act="exercise"]'); await wait(p, 300);
    ok(!/ex\.|tr\./.test(await p.textContent(".layer")), lang + ": the brief speaks it");
    await p.keyboard.press("Escape"); await wait(p, 200);
  }
  await p.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  ok(Object.keys(await p.evaluate(() => E.missing || {})).length === 0, "no word missing anywhere");

  console.log("On a phone");
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const q = await ph.newPage(); q.on("pageerror", e => errors.push(e.message));
  await q.goto(PAGE); await q.waitForSelector("#introEnter", { timeout: 20000 });
  await q.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await q.waitForSelector(".shell", { timeout: 90000 });
  await q.evaluate(() => E.books.practiceAs("u_practice_marie").then(() => { E.ui.shell(); E.ui.go("learn"); })); await wait(q, 500);
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && await q.locator("#trOnboarding").count() === 1, "her onboarding fits a phone's width");
  await q.evaluate(() => E.train.exercise("sale")); await wait(q, 300); await q.click("#exBegin"); await wait(q, 600);
  const band = await q.$eval("#drillBar", n => ({ h: n.getBoundingClientRect().height, w: n.scrollWidth <= n.clientWidth + 1 }));
  ok(band.h <= 64 && band.w, "the band is one line on a phone (" + Math.round(band.h) + " px)");
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "and the Register still fits");
  await q.click("#drillEnd"); await wait(q, 300);
  await ph.close();

  console.log("A practice store made before Build 19");
  const old = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const o = await old.newPage(); o.on("pageerror", e => errors.push(e.message));
  await o.goto(PAGE); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  /* made as an older build made it: Jean with the seven kinds of access of Build 6, and no plan of training */
  await o.evaluate(() => E.books.editPerson("u_practice_jean", { access: ["sell", "items", "receive", "adjust", "costs", "reports", "team"], preset: "manager" })
    .then(() => E.db.entries("rec")).then(es => E.db.write(es.filter(e => /^(course|plan):/.test(e[0])).map(e => ({ store: "rec", key: e[0], del: true })))));
  await o.reload(); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  const up = await o.evaluate(() => { const st = E.books.state(); return { jean: st.users.u_practice_jean.access.length, course: !!st.course, tasks: st.course && st.course.tasks.length, marie: !!E.books.planOf("u_practice_marie").onboarding, user: E.books.user.id }; });
  ok(up.jean === 10 && up.course && up.tasks === 2 && up.marie && up.user === "owner", "as it opens, it is given Build 19's samples once: Jean's new access, the plan, Marie's onboarding (" + JSON.stringify(up) + ")");
  ok(await o.evaluate(() => E.books.verify().then(r => r.ok)), "and Verify still passes");
  await old.close();

  console.log("A store of its own: a manager adds a person with her own password");
  const real = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const r = await real.newPage(); r.on("pageerror", e => errors.push(e.message));
  await r.goto(PAGE); await r.waitForSelector("#introProtect", { timeout: 20000 });
  await r.click("#introProtect");
  await r.fill("#ldStore", "Lakay Leaders Test"); await r.fill("#ldUser", "Yannie");
  await r.fill("#ldP1", OWNER_PW); await r.fill("#ldP2", OWNER_PW);
  await r.click("#ldNext");
  await r.waitForSelector(".ild-words li", { timeout: 60000 });
  const groups = await r.$$eval(".ild-words li", lis => lis.map(li => li.textContent.slice(li.querySelector("b").textContent.length).trim()));
  await r.click("#ldWrote"); await r.waitForSelector("#ldG1");
  const labels = await r.locator("form#ldCf label").allTextContents(), nums = labels.map(s => parseInt((s.match(/\d+/) || ["0"])[0], 10));
  await r.fill("#ldG1", groups[nums[0] - 1]); await r.fill("#ldG2", groups[nums[1] - 1]);
  await r.click("#ldSeal"); await r.waitForSelector(".shell", { timeout: 60000 });
  await r.evaluate(() => E.books.addItem({ name: "Kompa classics, volume 3 (CD)", cat: "music", price: 1299, cost: 650, openingStock: 20, reorderAt: 4, taxId: null, barcode: "" }));
  await r.click('.nav-btn[data-room="team"]'); await r.waitForSelector("#addPerson");
  await r.click("#addPerson");
  await r.fill("#pName", "Ana"); await r.click('#pLevel [data-v="manager"]');
  await r.uncheck("#pOnboard");
  await r.fill("#pPw", ANA_FIRST); await r.fill("#pPw2", ANA_FIRST); await r.fill("#pOwnerPw", OWNER_PW);
  await r.click("#pSave"); await r.waitForSelector("#newPersonId", { timeout: 30000 });
  ok(/1002/.test(await r.textContent("#newPersonId")) && await r.locator("#newPersonOnb").count() === 0, "the owner adds Ana, a manager (1002), with no onboarding");
  await r.click("text=Got it");
  await r.click("#statusPill"); await r.click("#signOutKey");
  await r.waitForSelector("#lockDoor #ldName", { state: "visible", timeout: 20000 });
  await r.fill("#ldName", "Ana"); await r.fill("#ldPw", ANA_FIRST); await r.click("#ldGo");
  await r.waitForSelector("#ldOwn1", { timeout: 30000 });
  await r.fill("#ldOwn1", ANA_PW); await r.fill("#ldOwn2", ANA_PW); await r.click("#ldOwnGo");
  await r.waitForSelector(".shell", { timeout: 60000 });
  ok(await r.locator('.nav-btn[data-room="settings"]').count() === 0 && await r.locator('.nav-btn[data-room="studio"]').count() === 0, "Ana is in: no Settings, no Author Studio");
  await r.click('.nav-btn[data-room="team"]'); await r.waitForSelector("#addPerson");
  ok(await r.locator("#teamBackup").count() === 1 && /No backup yet/.test(await r.textContent("#teamBackupLast")), "her Team room has the key to save a sealed backup");
  const backup = await r.evaluate(() => E.books.makeBackup().then(t => JSON.parse(t).format, e => e.code));
  ok(backup === "emporium-backup", "and the books let her make one");
  ok(await r.locator('#peopleList tr[data-person="owner"] .row-key').count() === 0, "the owner's line is not hers to change");
  await r.click("#addPerson");
  await r.fill("#pName", "Ben");
  ok(/Your own password/.test(await r.textContent(".layer")) && /You give only what you have yourself/.test(await r.textContent(".layer")), "the window asks for her own password, and says she gives only what she has");
  await r.fill("#pPw", BEN_FIRST); await r.fill("#pPw2", BEN_FIRST); await r.fill("#pOwnerPw", "not her password at all");
  await r.click("#pSave"); await r.waitForSelector("#pOwnerPw[aria-invalid=true]", { timeout: 30000 });
  ok(true, "a wrong password gives no key");
  await r.fill("#pOwnerPw", ANA_PW); await r.click("#pSave");
  await r.waitForSelector("#newPersonId", { timeout: 30000 });
  ok(/1003/.test(await r.textContent("#newPersonId")) && await r.locator("#newPersonOnb").count() === 1, "Ben is 1003, and his onboarding has started");
  await r.click("text=Got it");
  const benLine = await r.evaluate(() => E.books.lines().then(l => l.filter(x => x.type === "person.added")[0]));
  ok(benLine && benLine.by !== "owner", "the ledger says Ana added him");
  await r.click("#statusPill"); await r.click("#signOutKey");
  await r.waitForSelector("#lockDoor #ldName", { state: "visible", timeout: 20000 });
  await r.fill("#ldName", "Ben"); await r.fill("#ldPw", BEN_FIRST); await r.click("#ldGo");
  await r.waitForSelector("#ldOwn1", { timeout: 30000 });
  await r.fill("#ldOwn1", BEN_PW); await r.fill("#ldOwn2", BEN_PW); await r.click("#ldOwnGo");
  await r.waitForSelector(".shell", { timeout: 60000 });
  ok(/Ben/.test(await r.textContent("#statusPill")), "Ben signs in with the key Ana gave him: the store's own books open");
  await r.click('.nav-btn[data-room="home"]'); await wait(r, 400);
  ok(/Your training: \d+ to do/.test(await r.textContent(".hm-needs")), "his Home shows his onboarding");
  ok(await r.evaluate(() => E.books.verify().then(x => x.ok)), "Verify passes");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
