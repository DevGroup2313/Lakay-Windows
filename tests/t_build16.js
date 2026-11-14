/* LAKAY | Build 16 test: taking payment. Cash is chosen first and works as it always did. A card, Apple Pay, Google Pay
   or another way the owner accepts is charged on the store's own card machine and recorded with its approval code
   (and, for a card, its last four digits when the owner asks for them); a sale is paid in parts; a part can be taken
   back before the sale is done; no part may be more than what is left. A card's full number is refused wherever it
   could be typed, in the page and in the books. The owner's Settings choose the ways, name the machine and say what to
   ask for. Receipts list each payment; the Reports say how the day was paid; Verify still passes. A cashier takes
   payment too. Every word is in French and Kreyòl. On a device with no camera, the camera key stays hidden.
   Run: node tests/t_build16.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
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
  const go = async (room) => { await p.evaluate(r => E.ui.go(r), room); await wait(p, 300); };
  const ring = async (codes) => { await go("register"); for (const c of codes) { await p.fill("#regSearch", c); await p.press("#regSearch", "Enter"); await wait(p, 120); } };
  const total = () => p.evaluate(() => E.books.priceTicket(E.register.ticket.lines).total);
  const lastSale = () => p.evaluate(() => { const s = E.books.state().sales; return s[s.length - 1]; });
  const money = (c) => "$" + (c / 100).toFixed(2);
  const done = async () => { await p.click("#cashDone"); await p.waitForSelector("#receiptDone", { timeout: 5000 }); };
  const closeReceipt = async () => { await p.click("#receiptDone"); await wait(p, 250); };

  await p.goto(PAGE); await p.waitForSelector("#introEnter", { timeout: 20000 });
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await p.waitForSelector(".shell", { timeout: 90000 });
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); });

  console.log("Cash, as it always was");
  await ring(["0850001000017"]);
  ok(await p.locator(".reg-pick .cam-key").isHidden(), "with no camera on this device, the camera key stays hidden");
  ok((await p.textContent("#takeCash")).includes("Take payment"), "the key is Take payment");
  await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  ok(await p.getAttribute("#payWay-cash", "aria-checked") === "true" && await p.locator("#payWays .pay-way").count() === 5, "cash is chosen first, beside Card, Apple Pay, Google Pay and Other");
  ok(await p.locator("#payLeft").isHidden() && await p.locator("#payPart").isHidden(), "nothing about parts shows until a part is taken");
  await p.fill("#cashIn", "10"); await wait(p, 100);
  ok(await p.$eval("#cashDone", b => b.disabled), "too little cash cannot complete the sale");
  await p.fill("#cashIn", "20"); await wait(p, 100);
  const t1 = await total();
  ok((await p.textContent("#cashChange")).includes(money(2000 - t1)), "the change to give is shown: " + money(2000 - t1));
  await done();
  let s = await lastSale();
  ok(s.pay.length === 1 && s.pay[0].method === "cash" && s.pay[0].tendered === 2000 && s.pay[0].change === 2000 - t1 && s.pay[0].amount === t1, "the sale records the cash received, the change and what it paid");
  ok((await p.textContent(".receipt")).includes("Cash") && (await p.textContent("#receiptChange")).includes(money(2000 - t1)), "the receipt shows the cash and the change");
  await closeReceipt();

  console.log("A card, Apple Pay, Google Pay, another way");
  await ring(["0850003000039"]);
  const t2 = await total();
  await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#payWay-card"); await wait(p, 200);
  ok(await p.inputValue("#payAmount") === (t2 / 100).toFixed(2), "the card's amount starts at what is left to pay");
  ok((await p.textContent("#payHow")).includes("Charge " + money(t2) + " on the card machine"), "Lakay says how much to charge on the card machine");
  ok(await p.locator("#payLast4").isVisible() && await p.locator("#payName").isHidden(), "it asks for the card's last four digits (the practice store asks for them)");
  await p.fill("#payCode", "4242 4242 4242 4242"); await wait(p, 150);
  ok((await p.textContent("#payWarn")).includes("Never type a card's number") && await p.$eval("#cashDone", b => b.disabled), "a card's full number typed anywhere is refused");
  await p.fill("#payCode", "081245"); await p.fill("#payLast4", "42"); await wait(p, 150);
  ok(await p.$eval("#cashDone", b => b.disabled), "the last four must be four digits");
  await p.fill("#payLast4", "4242"); await wait(p, 150);
  await done();
  s = await lastSale();
  ok(s.pay.length === 1 && s.pay[0].method === "card" && s.pay[0].amount === t2 && s.pay[0].ref === "081245" && s.pay[0].last4 === "4242", "the card is recorded with its approval code and last four digits, nothing more");
  ok((await p.textContent(".receipt")).includes("Card ···· 4242") && (await p.textContent(".receipt")).includes("Approval 081245"), "the receipt names the card and its approval");
  ok((await p.textContent("#receiptChange")).includes("Paid by Card"), "and no change is spoken of");
  await closeReceipt();
  for (const way of ["applepay", "googlepay"]) {
    await ring(["0850005000013"]); await p.click("#takeCash"); await p.waitForSelector("#cashIn");
    await p.click("#payWay-" + way); await wait(p, 150);
    ok(await p.locator("#payLast4").isHidden(), (way === "applepay" ? "Apple Pay" : "Google Pay") + " asks for no card digits");
    await p.fill("#payCode", "77" + way.length); await done();
    s = await lastSale(); ok(s.pay[0].method === way && !s.pay[0].last4, "and is recorded as " + (way === "applepay" ? "Apple Pay" : "Google Pay"));
    await closeReceipt();
  }
  await ring(["0850005000020"]); await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#payWay-other"); await wait(p, 150);
  ok(await p.locator("#payName").isVisible() && (await p.textContent("#payHow")).includes("by Zelle"), "Other offers the owner's own ways: Zelle first");
  await p.click("#payName"); await p.click('.sel-opt:has-text("Cash App")'); await wait(p, 150);
  await p.fill("#payCode", "CA-7781"); await done();
  s = await lastSale();
  ok(s.pay[0].method === "other" && s.pay[0].name === "Cash App" && s.pay[0].ref === "CA-7781", "another way is recorded by its name and reference");
  ok((await p.textContent(".receipt")).includes("Cash App"), "and named on the receipt");
  await closeReceipt();

  console.log("Paid in parts");
  await ring(["0850001000017", "0850003000039", "0850005000013"]);
  const t3 = await total();
  await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#payWay-card"); await p.fill("#payAmount", (t3 / 100 + 5).toFixed(2)); await wait(p, 150);
  ok((await p.textContent("#payWarn")).includes("No more than what is left") && await p.$eval("#cashDone", b => b.disabled), "no part may be more than what is left");
  await p.fill("#payAmount", "30.00"); await p.fill("#payCode", "100200"); await p.fill("#payLast4", "1111"); await wait(p, 150);
  ok(!(await p.$eval("#payPart", b => b.disabled)) && await p.$eval("#cashDone", b => b.disabled), "part of the total on a card: the key to take this part, then the rest");
  await p.click("#payPart"); await wait(p, 250);
  ok(await p.locator("#payParts li").count() === 1 && (await p.textContent("#payLeftN")) === money(t3 - 3000), "the part is listed and what is left is shown: " + money(t3 - 3000));
  ok(await p.getAttribute("#payWay-cash", "aria-checked") === "true", "after a card, cash is chosen for the rest");
  await p.click("#payParts li .icon-key"); await wait(p, 200);
  ok(await p.locator("#payParts li").count() === 0 && await p.locator("#payLeft").isHidden(), "a part can be taken back before the sale is done");
  await p.click("#payWay-card"); await p.fill("#payAmount", "30.00"); await p.fill("#payCode", "100200"); await p.fill("#payLast4", "1111"); await p.click("#payPart"); await wait(p, 200);
  await p.fill("#cashIn", "40"); await wait(p, 150);
  ok((await p.textContent("#cashChange")).includes(money(4000 - (t3 - 3000))), "the cash for the rest gives its own change");
  await done();
  s = await lastSale();
  ok(s.pay.length === 2 && s.pay[0].method === "card" && s.pay[0].amount === 3000 && s.pay[1].method === "cash" && s.pay[1].amount === t3 - 3000 && s.pay[1].tendered === 4000 && s.pay[1].change === 4000 - (t3 - 3000),
    "the sale records both parts: the card, then the cash with its change");
  const rc = await p.textContent(".receipt");
  ok(rc.includes("Card ···· 1111") && rc.includes("Change"), "the receipt lists both");
  await closeReceipt();
  await ring(["0850003000015"]);
  const t4 = await total();
  await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#payWay-card"); await p.fill("#payAmount", "5.00"); await p.fill("#payCode", "1"); await p.click("#payPart"); await wait(p, 200);
  await p.click("#payWay-applepay"); await wait(p, 150);
  ok(await p.inputValue("#payAmount") === ((t4 - 500) / 100).toFixed(2), "the next way starts at what is left");
  await p.fill("#payCode", "2"); await done();
  s = await lastSale();
  ok(s.pay.map(x => x.method + ":" + x.amount).join() === "card:500,applepay:" + (t4 - 500), "two ways and no cash: a card and Apple Pay");
  await closeReceipt();

  console.log("The books keep the rules too");
  const books = await p.evaluate(async () => {
    const B = E.books, it = Object.values(B.state().items).find(x => x.name.indexOf("Malta") === 0), lines = [{ itemId: it.id, qty: 1 }], tot = B.priceTicket(lines).total;
    const tryIt = (pays) => B.completeSale(lines, pays).then(() => "ok", e => e.code);
    return {
      pan: await tryIt([{ method: "card", amount: tot, ref: "4111 1111 1111 1111" }]),
      over: await tryIt([{ method: "card", amount: tot + 1 }]),
      short: await tryIt([{ method: "card", amount: tot - 1 }]),
      off: await tryIt([{ method: "bitcoin", amount: tot }]),
      old: await tryIt(tot + 1000)
    };
  });
  ok(books.pan === "cardNumber", "the books refuse a card's number, whatever the page lets through");
  ok(books.over === "over" && books.short === "short" && books.off === "method", "and payments that come to more or less than the total, or a way the store does not take");
  ok(books.old === "ok", "the cash received alone, as before Build 16, still completes a sale");

  console.log("The owner's choices in Settings");
  await go("settings");
  await p.click('#setPayWays [data-m="googlepay"]');
  await p.fill("#setPayMachine", "Square");
  await p.click('#setPayCode [data-v="required"]');
  await p.click('#setPayLast4 [data-v="no"]');
  await p.click("#setPaySave"); await wait(p, 500);
  const prefs = await p.evaluate(() => E.books.payPrefs());
  ok(prefs.methods.join() === "cash,card,applepay" && prefs.machine === "Square" && prefs.askCode === "required" && prefs.askLast4 === "no", "the ways, the machine's name and what to ask for are saved");
  await p.fill("#setPayOthers", "Zelle, 4111111111111111"); await p.click("#setPaySave"); await wait(p, 300);
  ok((await p.textContent("#setPayOthers-e")).includes("Never type a card's number"), "a card's number is refused there too");
  await p.fill("#setPayOthers", "Zelle, Cash App"); await p.click("#setPaySave"); await wait(p, 300);
  await ring(["0850005000013"]); await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  ok(await p.locator("#payWay-googlepay").count() === 0, "a way turned off is not offered at the counter");
  await p.click("#payWay-card"); await wait(p, 150);
  ok((await p.textContent("#payHow")).includes("on Square"), "the machine is named: Charge on Square");
  ok(await p.locator("#payLast4").isHidden() && await p.$eval("#cashDone", b => b.disabled), "with the approval code required, the sale waits for it, and no digits are asked for");
  await p.fill("#payCode", "55301"); await wait(p, 100);
  ok(!(await p.$eval("#cashDone", b => b.disabled)), "and completes once it is typed");
  await done(); await closeReceipt();

  console.log("A cashier takes payment, and the day's reports");
  await p.evaluate(() => E.books.practiceAs("u_practice_marie"));
  await ring(["0850005000013"]); await p.click("#takeCash"); await p.waitForSelector("#cashIn");
  await p.click("#payWay-applepay"); await p.fill("#payCode", "9911"); await done(); await closeReceipt();
  s = await lastSale(); ok(s.by === "u_practice_marie" && s.pay[0].method === "applepay", "a cashier takes a phone payment too");
  await p.evaluate(() => E.books.practiceAs("owner"));
  await p.evaluate(() => { E.reports.period = "today"; }); await go("reports");
  const rep = await p.evaluate(() => { const k = E.util.dayKey(), r = E.books.report(k, k); return { gross: r.gross, sum: Object.values(r.byMethod).reduce((a, b) => a + b, 0), split: r.split, ways: Object.keys(r.byMethod) }; });
  ok(rep.sum === rep.gross, "every cent of the day's takings is accounted for by the ways it was paid (" + money(rep.sum) + ")");
  ok(rep.split >= 2 && ["cash", "card", "applepay", "googlepay", "other:Cash App"].every(w => rep.ways.indexOf(w) >= 0), "each way is counted on its own, and the sales paid in parts");
  const sec = await p.textContent(".report");
  ok(sec.includes("How it was paid") && sec.includes("Apple Pay") && sec.includes("Cash App") && /sales? paid in parts/.test(sec), "the Reports show how the day was paid");
  const verify = await p.evaluate(() => E.books.verify().then(r => r.ok));
  ok(verify, "the books verify");

  console.log("Every word in French and Kreyòl");
  for (const l of ["fr", "ht"]) {
    await p.evaluate(x => { E.setLang(x); E.ui.shell(); }, l);
    await ring(["0850005000013"]); await p.click("#takeCash"); await p.waitForSelector("#cashIn");
    for (const w of ["card", "other"]) { await p.click("#payWay-" + w); await wait(p, 100); }
    await p.keyboard.press("Escape"); await wait(p, 200); await go("settings"); await go("guide");
  }
  const missing = await p.evaluate(() => Object.keys(E.missing || {}));
  const langs = await p.evaluate(() => { const d = E.dict, en = Object.keys(d.en); return en.filter(k => d.fr[k] === undefined || d.ht[k] === undefined); });
  ok(missing.length === 0 && langs.length === 0, "nothing is missing a word in any language" + (missing.concat(langs).length ? ": " + missing.concat(langs).slice(0, 6).join(", ") : ""));
  await p.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  await go("guide");
  ok((await p.textContent("#room")).includes("Taking payment: cash, cards and phones"), "the Guidebook has a chapter on taking payment");

  ok(errors.length === 0, "no errors in the page" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "the page's security policy refused nothing");
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
