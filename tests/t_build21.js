/* LAKAY | Build 21 test: Earnings. What the store earns apart from its sales (the commission on transfers and top-ups,
   with the commissions a cashier could not write filled in afterwards); settling with each provider the way the owner
   chose for it (taken from the bank, deposited, or a prepaid balance; the commission at once or each month), with
   payments recorded and voided, and statements checked; each person's pay from the time clock, with rates from a day
   on, overtime by the week, periods marked paid and undone. No one sets their own pay; only the owner gives "pay".
   In the practice store: Marie (a cashier) and Jean (a manager). Every word in French and Kreyòl; it fits a phone.
   Run: node tests/t_build21.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
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
  const tab = async (t) => { await p.evaluate(t => { E.earnings.tab = t; E.ui.go("earnings", true); }, t); await wait(p, 300); };
  const as = async (id) => { await p.click("#statusPill"); await p.click('.as-keys [data-person="' + id + '"]'); await wait(p, 700); };
  const lastLine = () => p.evaluate(() => E.books.lines().then(l => ({ type: l[0].type, by: l[0].by, data: l[0].data })));
  const acct = (id) => p.evaluate(id => E.books.providerAccount(id), id);
  const code = (fn, arg) => p.evaluate(([fn, arg]) => new Function("arg", "return (" + fn + ")(arg)")(arg).then(() => "done", e => e.code), [fn.toString(), arg]);
  const MARIE = "u_practice_marie", JEAN = "u_practice_jean";

  await p.goto(PAGE); await p.waitForSelector("#introEnter", { timeout: 20000 });
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await p.waitForSelector(".shell", { timeout: 90000 });
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); });

  console.log("The Earnings room");
  const nav = await p.$$eval(".nav-btn", b => b.map(x => x.getAttribute("data-room")));
  ok(nav.indexOf("earnings") === nav.indexOf("schedule") + 1, "the menu has Earnings, after Schedule");
  await go("earnings");
  ok((await p.textContent("main#room h1")).includes("Earnings"), "the room is called Earnings");
  const tabs = await p.$$eval(".inv-tab", b => b.map(x => x.getAttribute("data-tab")));
  ok(tabs.join() === "store,providers,pay", "the owner's tabs: The store, Providers, Pay; no pay of the owner's own (" + tabs.join() + ")");
  const seed = await p.evaluate(() => {
    const B = E.books, set = {};
    B.PROVIDERS.forEach(id => { const s = B.provSetup(id); if (s) set[id] = s.how + "/" + s.com; });
    const last = B.payPeriods(2)[1];
    return { set: set, settles: B.settlements().length, pay: B.paySettings(), marie: B.rateOf("u_practice_marie", E.util.dayKey()), jean: B.rateOf("u_practice_jean", E.util.dayKey()),
      paid: ["u_practice_marie", "u_practice_jean"].map(u => !!B.payFor(u, last.from, last.to).paid), access: B.ACCESS.indexOf("pay") >= 0, mgr: B.PRESETS.manager.indexOf("pay") };
  });
  ok(seed.set.ria === "deposit/monthly" && seed.set.cam === "sweep/deducted" && seed.set.unitransfer === "deposit/deducted" && seed.set.boss === "prepaid/deducted",
    "the practice store settles each provider its own way: " + JSON.stringify(seed.set));
  ok(seed.settles >= 2, "with the payments written so far (" + seed.settles + ")");
  ok(seed.pay.period === "weekly" && seed.pay.otAfter === 40 && seed.pay.otTimes === 150 && seed.marie === 1550 && seed.jean === 1900,
    "pay each week, overtime after 40 hours at one and a half times; Marie at $15.50, Jean at $19.00");
  ok(seed.paid[0] && seed.paid[1], "last week's pay is marked paid for both");
  ok(seed.access && seed.mgr === -1, "a new kind of access, \"pay\", which no level holds");

  console.log("The store: earned apart from sales");
  await tab("store");
  const st = await p.evaluate(() => { const rg = E.reports.range("month"), r = E.books.report(rg.from, rg.to); return { com: r.services.commission, n: r.services.count, profit: r.profit }; });
  ok((await p.textContent("#eaApart")).replace(/[^0-9.]/g, "") === (st.com / 100).toFixed(2), "this month's commission on " + st.n + " transfers and top-ups is the hero figure");
  ok(await p.locator("#eaByProv tbody tr").count() >= 3, "provider by provider");
  ok(/counted as the providers' money/.test(await p.textContent("#eaApartCard")), "it says the fees are the providers' money, as the reports do");
  const allTxt = await p.textContent("#eaAllEarned");
  ok(allTxt.replace(/[^0-9.\-−]/g, "").replace("−", "-") === ((st.profit + st.com) / 100).toFixed(2), "with the sales: the profit on sales and the commission make the total (" + allTxt + ")");
  ok(await p.locator("#eaAfter").count() === 1 && /estimate from the time clock/.test(await p.textContent("#eaAfter")), "after pay, with the honest note that pay is an estimate");
  for (const sp of ["today", "lastweek", "year"]) { await p.click(`.ea-spans [data-p="${sp}"]`); await wait(p, 250); }
  ok(await p.getAttribute('.ea-spans [data-p="year"]', "aria-pressed") === "true", "the periods change at a press");
  await p.evaluate(() => { E.earnings.period = "year"; E.ui.go("earnings", true); }); await wait(p, 250);
  const unknown = await p.evaluate(() => E.books.services(v => v.status !== "void" && v.commission === null).length);
  ok(unknown > 0 && await p.locator("#eaUnknown").count() === 1, "the entries a cashier wrote have no commission, and the room says so (" + unknown + ")");
  await p.click("#eaWriteCom"); await wait(p, 300);
  const rowsN = await p.locator("#cmT tbody tr").count();
  ok(rowsN === Math.min(unknown, 40), "Write the commissions lists them, oldest first (" + rowsN + ")");
  const firstId = await p.getAttribute("#cmT tbody tr:first-child", "data-id");
  await p.fill(`#cm-${firstId}`, "abc"); await p.click("#cmSave"); await wait(p, 250);
  ok(await p.locator(".layer #cmT").count() === 1 && await p.getAttribute(`#cm-${firstId}`, "aria-invalid") === "true", "a figure that is not money is refused");
  const com0 = await p.evaluate(() => E.books.report("2000-01-01", "2999-12-31").services.commission);
  await p.fill(`#cm-${firstId}`, "2.25"); await p.click("#cmSave"); await wait(p, 600);
  const com1 = await p.evaluate(() => E.books.report("2000-01-01", "2999-12-31").services.commission);
  let ln = await lastLine();
  ok(com1 === com0 + 225 && ln.type === "service.commission" && ln.data.list.length === 1, "one commission written: the earnings go up by $2.25, one ledger line");
  ok(await code(a => E.books.setSvcCommissions([{ id: a, commission: 999 }]), firstId).then(r => r) === "done" && (await p.evaluate(id => E.books.services(v => v.id === id)[0].commission, firstId)) === 225,
    "a commission already written is left as it is");

  console.log("Providers");
  await tab("providers");
  ok(await p.locator(".ea-prov").count() === 4 && await p.locator("#eaProv-other").count() === 0, "a card for each provider the store works with, none for an unused one");
  const ria0 = await acct("ria");
  ok((await p.textContent("#eaHeld-ria")).includes((Math.abs(ria0.held) / 100).toFixed(2)), "RIA: the money held for it, worked out from the log (" + ria0.held + ")");
  ok(/Commission paid monthly/.test(await p.textContent("#eaProv-ria")) && (await p.textContent("#eaCom-ria")).includes((ria0.comDue / 100).toFixed(2)), "RIA pays its commission each month: what is due to the store");
  const boss = await acct("boss");
  ok(/Prepaid balance left/.test(await p.textContent("#eaProv-boss")) && (await p.textContent("#eaBal-boss")).includes(((-boss.held) / 100).toFixed(2)), "Boss Revolution: the prepaid balance left (" + (-boss.held) + ")");
  await p.click("#eaSettle-ria"); await wait(p, 300);
  ok(await p.inputValue("#stAmount") === (Math.max(0, ria0.held) / 100).toFixed(2) || ria0.held <= 0, "Record a payment starts at what is held");
  await p.fill("#stAmount", ""); await p.click("#stSave"); await wait(p, 200);
  ok((await p.textContent("#stAmount-e")).length > 0, "an amount is needed");
  await p.fill("#stAmount", "100.00"); await p.click("#stSave"); await wait(p, 600);
  ln = await lastLine();
  const ria1 = await acct("ria");
  ok(ln.type === "provider.settled" && ln.data.settle.kind === "paid" && ln.data.settle.amount === 10000 && ria1.held === ria0.held - 10000, "a deposit of $100.00: written, and the money held goes down by as much");
  const future = await code(() => E.books.settle({ provider: "ria", kind: "paid", amount: 100, day: "2999-01-01" }));
  ok(future === "future", "a payment cannot be dated in the future");
  const sid = await p.evaluate(() => E.books.settlements(x => x.status !== "void" && x.amount === 10000)[0].id);
  await p.click(`#eaLogT tr[data-id="${sid}"] .row-key`); await wait(p, 300);
  await p.click("#vdSave"); await wait(p, 200);
  ok((await p.textContent("#vdWhy-e")).length > 0, "voiding asks why");
  await p.fill("#vdWhy", "Typed on the wrong provider"); await p.click("#vdSave"); await wait(p, 600);
  ok((await acct("ria")).held === ria0.held && await p.locator(`#eaLogT tr.voided[data-id="${sid}"]`).count() === 1, "voided: it stays in the log, struck through, and the money held is as it was");
  await p.click("#eaSettle-ria"); await wait(p, 300);
  await p.click('#stKind [data-v="commission"]'); await wait(p, 100);
  const riaC = await acct("ria");
  ok(await p.inputValue("#stAmount") === (riaC.comDue > 0 ? (riaC.comDue / 100).toFixed(2) : ""), "a commission received starts at what is due");
  await p.fill("#stAmount", "5.00"); await p.click("#stSave"); await wait(p, 500);
  ok((await acct("ria")).comDue === riaC.comDue - 500, "and lowers what is due");
  /* checking a statement */
  const ria2 = await acct("ria");
  await p.click("#eaCheck-ria"); await wait(p, 300);
  const signed = (c) => (c < 0 ? "-" : "") + (Math.abs(c) / 100).toFixed(2);
  await p.fill("#ckSays", signed(ria2.held)); await wait(p, 100);
  ok(/matches/.test(await p.textContent("#ckOut")), "a statement that matches says so as it is typed");
  await p.fill("#ckSays", signed(ria2.held + 1234)); await wait(p, 100);
  ok(/12\.34/.test(await p.textContent("#ckOut")), "one that does not shows the difference");
  await p.click("#ckSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "provider.checked" && ln.data.check.diff === 1234 && /off by \$12\.34/.test(await p.textContent("#eaProv-ria")), "the check is kept, and the card shows it was off by $12.34");
  await p.click("#eaCheck-cam"); await wait(p, 300);
  const cam = await acct("cam");
  await p.fill("#ckSays", signed(cam.held)); await p.click("#ckSave"); await wait(p, 600);
  ok((await lastLine()).data.check.diff === 0 && /it matched/.test(await p.textContent("#eaProv-cam")), "a statement below zero (the provider owes the store) is typed with a minus, and matches");
  /* how it settles: the owner's to say */
  await p.click("#eaSetup-unitransfer"); await wait(p, 300);
  await p.click('#psHow [data-v="sweep"]'); await p.click('#psCom [data-v="monthly"]');
  ok(/bank account/.test(await p.textContent("#psHowD")) && /each month/.test(await p.textContent("#psComD")), "each way is explained as it is chosen");
  await p.click("#psSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "provider.setup" && ln.data.how === "sweep" && ln.data.com === "monthly" && /Takes it from the bank/.test(await p.textContent("#eaProv-unitransfer")), "Unitransfer now takes it from the bank, and pays its commission monthly");
  const un = await acct("unitransfer");
  ok(un.kept === 0 && un.comDue === un.commission - un.comReceived, "its commission is no longer kept at once: it is due from the provider");

  console.log("Pay");
  await tab("pay");
  ok(await p.locator("#eaPayT tbody tr").count() === 2, "a line for each person on the staff: Marie and Jean");
  const cur = await p.evaluate(() => { const B = E.books, q = B.payPeriods(1)[0]; return ["u_practice_marie", "u_practice_jean"].map(u => B.payFor(u, q.from, q.to)); });
  ok((await p.textContent(`#eaPayT tr[data-user="${MARIE}"]`)).includes((cur[0].gross / 100).toFixed(2)), "Marie's estimate for this period is her hours at her rate");
  const jl = await p.evaluate(() => { const B = E.books, q = B.payPeriods(2)[1]; return B.payFor("u_practice_jean", q.from, q.to); });
  ok(jl.regMin <= 2400 && jl.gross === Math.round((jl.regMin * 1900 * 100 + jl.otMin * 1900 * 150) / 6000), "overtime: past 40 hours in the week, at one and a half times (Jean last week: " + jl.otMin + " min)");
  await p.click(`#eaRate-${MARIE}`); await wait(p, 300);
  await p.fill("#rtRate", "fifteen"); await p.click("#rtSave"); await wait(p, 200);
  ok((await p.textContent("#rtRate-e")).length > 0, "a rate must be money");
  await p.fill("#rtRate", "16.25"); await p.click("#rtSave"); await wait(p, 600);
  ln = await lastLine();
  const today = await p.evaluate(() => E.util.dayKey());
  ok(ln.type === "pay.rate" && ln.data.rate === 1625 && ln.data.from === today, "Marie's new rate, from today: one ledger line");
  ok(await p.evaluate(() => E.books.rateOf("u_practice_marie", E.util.dayKey(E.util.addDays(new Date(), -1)))) === 1550, "the days before keep the rate they had");
  /* last period: paid; this period: mark it paid, then undo it */
  await p.evaluate(() => { E.earnings.payAt = 1; E.ui.go("earnings", true); }); await wait(p, 300);
  ok(await p.locator(`#eaPaid-${MARIE}`).count() === 1 && await p.locator(`#eaPaid-${JEAN}`).count() === 1, "last period shows both paid, with how");
  await p.evaluate(() => { E.earnings.payAt = 0; E.ui.go("earnings", true); }); await wait(p, 300);
  await p.click(`#eaMark-${JEAN}`); await wait(p, 300);
  ok(/not over yet/.test(await p.textContent(".layer")), "marking a period not over yet says so");
  await p.evaluate(() => { const s = document.querySelector("#mpMethod"); s.value = "check"; s.dispatchEvent(new Event("change")); });
  await p.fill("#mpRef", "1077"); await p.click("#mpSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "pay.paid" && ln.data.paid.user === JEAN && ln.data.paid.method === "check" && ln.data.paid.ref === "1077" && ln.data.paid.amount === cur[1].gross, "Jean's pay marked paid by check, at the estimate");
  const again = await p.evaluate(() => { const q = E.books.payPeriods(1)[0]; return E.books.markPaid({ user: "u_practice_jean", from: q.from, to: q.to, amount: 1, method: "cash" }).then(() => "done", e => e.code); });
  ok(again === "already", "a period is marked paid once");
  await p.click(`#eaPaid-${JEAN}`); await wait(p, 300);
  ok(/1077/.test(await p.textContent(".ea-dl")), "what was handed over, with the check's number");
  await p.click("#pvUndo"); await wait(p, 300); await p.click("#pvSave"); await wait(p, 200);
  ok((await p.textContent("#pvWhy-e")).length > 0, "undoing asks why");
  await p.fill("#pvWhy", "Paid on Monday instead"); await p.click("#pvSave"); await wait(p, 600);
  ok((await lastLine()).type === "pay.voided" && await p.locator(`#eaMark-${JEAN}`).count() === 1, "undone: the period can be marked paid again");
  /* how pay is worked out */
  await p.click("#eaPaySetKey"); await wait(p, 300);
  ok(await p.locator("#ppAnchor").isHidden(), "the first day of a two-week period is asked only for two weeks");
  await p.evaluate(() => { const s = document.querySelector("#ppPeriod"); s.value = "biweekly"; s.dispatchEvent(new Event("change")); }); await wait(p, 100);
  ok(await p.locator("#ppAnchor").isVisible(), "and shows for two weeks");
  await p.uncheck("#ppOt"); await wait(p, 100);
  ok(await p.locator("#ppAfter").isHidden(), "overtime can be turned off");
  await p.click("#ppSave"); await wait(p, 600);
  const s2 = await p.evaluate(() => { const B = E.books, q = B.payPeriods(1)[0]; return { s: B.paySettings(), days: (E.util.fromDayKey(q.to) - E.util.fromDayKey(q.from)) / 86400000 + 1, ot: B.payFor("u_practice_jean", q.from, q.to).otMin }; });
  ok(s2.s.period === "biweekly" && s2.s.otAfter === null && s2.days === 14 && s2.ot === 0, "every two weeks, no overtime: periods of fourteen days, every hour at the rate");
  await p.evaluate(() => E.books.setPaySettings({ period: "weekly", otAfter: 40, otTimes: 150 })); await tab("pay");

  console.log("No one sets their own pay");
  await p.evaluate(() => E.books.editPerson("u_practice_jean", { access: E.books.PRESETS.manager.concat(["pay"]), preset: "custom" }));
  await as(JEAN);
  await go("earnings");
  const jtabs = await p.$$eval(".inv-tab", b => b.map(x => x.getAttribute("data-tab")));
  ok(jtabs.join() === "mine,store,providers,pay", "Jean, given pay by the owner: his own pay, the store, the providers, and everyone's pay (" + jtabs.join() + ")");
  await tab("pay");
  ok(await p.locator(`#eaRate-${JEAN}`).count() === 0 && await p.locator(`#eaMark-${JEAN}`).count() === 0 && await p.locator(`#eaRate-${MARIE}`).count() === 1, "on his own line, no key to set his rate or mark his pay; on Marie's, both");
  const self = await p.evaluate(() => { const B = E.books, q = B.payPeriods(1)[0]; return Promise.all([B.setRate("u_practice_jean", 9999, null).then(() => "done", e => e.code), B.markPaid({ user: "u_practice_jean", from: q.from, to: q.to, amount: 1, method: "cash" }).then(() => "done", e => e.code)]); });
  ok(self[0] === "self" && self[1] === "self", "the books refuse it too: " + self.join(", "));
  const grant = await p.evaluate(() => E.books.grantable());
  ok(grant.indexOf("pay") < 0 && grant.indexOf("people") < 0 && grant.indexOf("reports") >= 0, "and he cannot give pay to anyone: only the owner does");
  await tab("providers");
  ok(await p.locator("#eaSettle-ria").count() === 1 && await p.locator("#eaSetup-ria").count() === 0 && await code(() => E.books.setProvSetup("ria", { how: "sweep", com: "deducted" })) === "denied", "how a provider settles is the owner's alone");

  console.log("Marie, a cashier");
  await as(MARIE);
  await go("earnings");
  ok(await p.locator(".inv-tab").count() === 0 && await p.locator("#eaMine").count() === 1, "Marie sees her own pay only, with no tabs");
  const mine = await p.evaluate(() => { const B = E.books, q = B.payPeriods(1)[0]; return B.payFor("u_practice_marie", q.from, q.to); });
  ok((await p.textContent("#eaMyEst")).includes((mine.gross / 100).toFixed(2)) && /before taxes/.test(await p.textContent("#eaMine")), "her estimate, before taxes and deductions");
  ok(await p.locator("#eaMyPeriods .ea-chip.paid").count() >= 1, "and the periods already paid");
  const den = await p.evaluate(() => Promise.all([E.books.setRate("u_practice_jean", 100, null).then(() => "done", e => e.code), E.books.settle({ provider: "ria", kind: "paid", amount: 100 }).then(() => "done", e => e.code)]));
  ok(den[0] === "denied" && den[1] === "denied", "the books refuse her rates and settlements");
  await as("owner");

  console.log("The Home, and an exercise");
  await p.evaluate(() => { const B = E.books, q = B.payPeriods(2)[1]; return B.voidPaid(B.payFor("u_practice_marie", q.from, q.to).paid.id, "Test"); });
  const b2 = await acct("boss");
  await p.evaluate(n => E.books.settle({ provider: "boss", kind: "returned", amount: n }), b2.paid);
  await go("home");
  const needs = await p.textContent(".hm-needs");
  ok(/Last period's pay: 1 person not marked paid/.test(needs), "the Home says last period's pay waits for one person");
  ok(/Boss Revolution: the prepaid balance is used up/.test(needs), "and that the prepaid balance is used up");
  const drill = await p.evaluate(() => { E.books.drillStart(function () { }); return E.books.settle({ provider: "ria", kind: "paid", amount: 100 }).then(() => "done", e => e.code).then(r => { E.books.drillEnd(); return r; }); });
  ok(drill === "drill", "nothing of the kind is written during an exercise");

  console.log("The books");
  const v = await p.evaluate(() => E.books.verify().then(r => ({ ok: r.ok, n: r.problems.length, lines: r.lines })));
  ok(v.ok && v.n === 0, "Verify replays every settlement and pay marked paid, and finds nothing wrong (" + v.lines + " lines)");
  const tamper = await p.evaluate(() => { const st = E.books.state(), x = st.settles[0], was = x.amount; x.amount += 1;
    return E.books.verify().then(r => { x.amount = was; return r.problems.filter(q => q.money === "settle" && q.what === "differs").length; }); });
  ok(tamper === 1, "a settlement changed outside the books is found");

  console.log("A practice store made before Build 21");
  const old = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const o = await old.newPage(); o.on("pageerror", e => errors.push(e.message));
  await o.goto(PAGE); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  await o.evaluate(() => E.db.entries("rec").then(es => E.db.write(es.filter(e => /^(prov|settle|stmt|payset|rate|paid):/.test(e[0])).map(e => ({ store: "rec", key: e[0], del: true })))));
  await o.reload(); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  const up = await o.evaluate(() => { const B = E.books; return { provs: B.PROVIDERS.filter(id => B.provSetup(id)).length, rate: B.rateOf("u_practice_marie", E.util.dayKey()), paids: B.paids().length, user: B.user.id }; });
  ok(up.provs === 4 && up.rate === 1550 && up.paids === 2 && up.user === "owner", "as it opens, it is given the providers and pay samples once (" + JSON.stringify(up) + ")");
  await old.close();

  console.log("Three languages");
  const keysOk = await p.evaluate(() => {
    const d = E.dict, miss = [], same = [];
    Object.keys(d.en).filter(k => /^ea\.|^(room|lede)\.earnings$|^tip\.earnings\.|^tips\.earnings\.|^guide\.earnings\.|^access\.pay\./.test(k))
      .forEach(k => { ["fr", "ht"].forEach(l => { if (!d[l][k]) miss.push(l + ":" + k); else if (d[l][k] === d.en[k] && !/^ea\.(paidShort|total|note)$/.test(k)) same.push(l + ":" + k); }); });
    return { miss: miss, same: same, n: Object.keys(d.en).filter(k => /^ea\./.test(k)).length };
  });
  ok(keysOk.miss.length === 0 && keysOk.same.length === 0, "every word of Earnings is in French and Kreyòl (" + keysOk.n + " phrases)" + (keysOk.miss.length + keysOk.same.length ? " " + keysOk.miss.concat(keysOk.same).slice(0, 6).join(", ") : ""));
  for (const [lang, title] of [["fr", "Gains"], ["ht", "Benefis"]]) {
    await p.evaluate(l => { E.setLang(l); E.ui.shell(); }, lang);
    let clean = true;
    for (const t of ["store", "providers", "pay"]) { await tab(t); if (/\bea\.|svc\.p\./.test(await p.textContent("main#room"))) clean = false; }
    ok((await p.textContent("main#room h1")).includes(title) && clean, lang + ": " + title + ", every tab in words");
  }
  await p.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  ok(Object.keys(await p.evaluate(() => E.missing || {})).length === 0, "no word missing anywhere");

  console.log("On a phone");
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const q = await ph.newPage(); q.on("pageerror", e => errors.push(e.message));
  await q.goto(PAGE); await q.waitForSelector("#introEnter", { timeout: 20000 });
  await q.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await q.waitForSelector(".shell", { timeout: 90000 });
  let fits = true;
  for (const t of ["store", "providers", "pay"]) {
    await q.evaluate(t => { E.earnings.tab = t; E.ui.go("earnings"); }, t); await wait(q, 400);
    if (!(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))) fits = false;
  }
  ok(fits, "every tab fits the phone's width");
  await ph.close();

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
