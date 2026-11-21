/* LAKAY | Build 22 test: Travel. A short record of each flight the store books for a client on a website: the trip,
   the confirmation code, the ticket's price and the store's fee, and the client's payments until it is paid in full.
   Payments voided and bookings cancelled with a reason; the fee counted in Earnings; never a passport or card number;
   a client's name and phone only when the owner turns that on, never in the ledger, and erased when it is turned off.
   In the practice store: Marie (a cashier) and Jean (a manager). Every word in French and Kreyòl; it fits a phone.
   Run: node tests/t_build22.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
"use strict";
const { chromium } = require("./_agreed");  /* each browser has agreed to the terms (Build 26) */
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
  const show = async (f) => { await p.evaluate(f => { E.travel.show = f; E.ui.go("travel", true); }, f); await wait(p, 300); };
  const as = async (id) => { await p.click("#statusPill"); await p.click('.as-keys [data-person="' + id + '"]'); await wait(p, 700); };
  const lastLine = () => p.evaluate(() => E.books.lines().then(l => ({ type: l[0].type, by: l[0].by, data: l[0].data })));
  const money = (id) => p.evaluate(id => E.books.bookingMoney(E.books.booking(id)), id);
  const day = (n) => p.evaluate(n => E.util.dayKey(E.util.addDays(new Date(), n)), n);
  const MARIE = "u_practice_marie", JEAN = "u_practice_jean";

  await p.goto(PAGE); await p.waitForSelector("#introEnter", { timeout: 20000 });
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await p.waitForSelector(".shell", { timeout: 90000 });
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); });

  console.log("The Travel room");
  const nav = await p.$$eval(".nav-btn", b => b.map(x => x.getAttribute("data-room")));
  ok(nav.indexOf("travel") === nav.indexOf("inventory") + 1, "the menu has Travel, after Inventory");
  await go("travel");
  ok((await p.textContent("main#room h1")).includes("Travel"), "the room is called Travel");
  const seed = await p.evaluate(() => E.books.bookings().map(b => b.from + ">" + b.to + ":" + b.status + ":" + E.books.bookingMoney(b).balance).join(","));
  ok(/MIA>PAP:on:0/.test(seed) && /FLL>CAP:on:21400/.test(seed) && /JFK>PAP:on:0/.test(seed) && /MIA>SDQ:cancelled:0/.test(seed), "the practice store's four bookings: paid, a balance to pay, travelled, cancelled (" + seed + ")");
  ok(await p.getAttribute('.tv-filters [data-f="due"]', "aria-pressed") === "true" && await p.locator(".tv-card").count() === 1, "it opens on To pay, with the one booking that has a balance");
  ok((await p.textContent("#tvDueSum")).includes("214.00"), "Still to pay: $214.00");
  await show("coming");
  ok(await p.locator(".tv-card").count() === 2 && await p.locator(".tv-card.is-paid").count() === 1, "Coming up: the two trips to come, one paid in full");
  await show("cancelled");
  ok(await p.locator(".tv-card.is-cancelled").count() === 1 && /Cancelled/.test(await p.textContent(".tv-card.is-cancelled")), "Cancelled: the one to Santo Domingo");
  await show("all");
  ok(await p.locator(".tv-card").count() === 4 && /Travelled/.test(await p.textContent("#tvList")), "All, with the trip already made");
  ok(/never keeps a passport number or a card number/.test(await p.textContent(".tv-never")), "the room says it never keeps a passport or card number");
  ok(!await p.evaluate(() => E.books.bookings().some(b => b.client)), "no client's name or phone: the owner has not turned that on");

  console.log("A new booking");
  await p.click("#tvNew"); await wait(p, 350);
  ok(await p.locator("#bkClient").count() === 0 && await p.locator("#bkPhone").count() === 0, "the window asks for no name and no phone");
  await p.click("#bkSave"); await wait(p, 200);
  ok((await p.textContent("#bkFrom-e")).length > 0, "where it leaves from is needed");
  await p.fill("#bkFrom", "MIA"); await p.fill("#bkTo", "PAP"); await p.click("#bkSave"); await wait(p, 200);
  ok((await p.textContent("#bkDepart-e")).length > 0, "and the day it leaves");
  await p.fill("#bkDepart", await day(3)); await p.click("#bkSave"); await wait(p, 200);
  ok((await p.textContent("#bkReturn-e")).length > 0, "and the day it comes back, or One way");
  await p.fill("#bkReturn", await day(1)); await p.fill("#bkTicket", "350.00"); await p.click("#bkSave"); await wait(p, 400);
  ok(await p.locator(".layer #bkSave").count() === 1, "a return before the departure is refused");
  await p.check("#bkOneWay"); await wait(p, 100);
  ok(await p.locator("#bkReturn").isHidden(), "One way hides the return");
  await p.fill("#bkPax", "12"); await p.click("#bkSave"); await wait(p, 400);
  ok((await p.textContent("#bkPax-e")).length > 0, "from one to nine travelling");
  await p.fill("#bkPax", "2"); await p.fill("#bkFee", "30.00"); await wait(p, 100);
  ok(/\$380\.00/.test(await p.textContent("#bkTotal")), "the window says what the client pays in all: $380.00");
  await p.fill("#bkNote", "Card 4111 1111 1111 1111"); await p.click("#bkSave"); await wait(p, 400);
  ok(/card number/.test(await p.textContent("#bkNote-e")), "a card number in the note is refused");
  await p.fill("#bkNote", "Passport A12345678"); await p.click("#bkSave"); await wait(p, 400);
  ok(/passport/.test(await p.textContent("#bkNote-e")), "so is what looks like a passport number");
  await p.fill("#bkNote", "Window seat"); await p.fill("#bkCode", "pk4r9a"); await p.fill("#bkSite", "the airline's website");
  await p.fill("#bkDeposit", "100.00"); await p.click('#bkDepMethod [data-v="cash"]');
  await p.click("#bkSave"); await wait(p, 700);
  let ln = await lastLine();
  const nb = await p.evaluate(() => E.books.bookings().sort((a, b) => a.at < b.at ? 1 : -1)[0]);
  ok(ln.type === "booking.made" && nb.from === "MIA" && nb.to === "PAP" && nb.ret === null && nb.pax === 2 && nb.code === "PK4R9A" && nb.ticket === 35000 && nb.fee === 3000,
    "written: Miami to Port-au-Prince, one way, two travelling, the code in capitals, $350.00 and a $30.00 fee");
  ok(/^A-T\d{4}$/.test(nb.no) && nb.pays.length === 1 && nb.pays[0].amount === 10000 && nb.pays[0].method === "cash", "its number, " + nb.no + ", and the $100.00 deposit in cash");
  ok(!("client" in ln.data.booking), "the ledger's line holds no client");
  await show("due");
  ok(await p.locator(`#tvCard-${nb.id}`).count() === 1 && /\$280\.00 to pay/.test(await p.textContent(`#tvCard-${nb.id}`)), "To pay shows it: $280.00 to pay");
  ok((await p.$$eval(".tv-card", c => c.map(x => x.getAttribute("data-id"))))[0] === nb.id, "the soonest trip first");

  console.log("Payments");
  await p.click(`#tvPay-${nb.id}`); await wait(p, 300);
  ok(await p.inputValue("#tpAmount") === "280.00", "Take a payment starts at what is left to pay");
  await p.fill("#tpAmount", "300.00"); await p.click("#tpSave"); await wait(p, 300);
  ok(/more than the \$280\.00/.test(await p.textContent("#tpAmount-e")), "more than is left is refused");
  await p.fill("#tpAmount", "80.00"); await p.click('#tpMethod [data-v="card"]'); await wait(p, 100);
  ok(await p.locator("#tpRef").isVisible(), "a card asks for the machine's approval code");
  await p.fill("#tpRef", "4111111111111111"); await p.click("#tpSave"); await wait(p, 400);
  ok(/card number/.test(await p.textContent("#tpRef-e")), "never the card's number");
  await p.fill("#tpRef", "271828"); await p.click("#tpSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "booking.paid" && ln.data.pay.amount === 8000 && ln.data.pay.method === "card" && ln.data.pay.ref === "271828" && (await money(nb.id)).balance === 20000, "$80.00 by card, with its code: $200.00 left");
  const over = await p.evaluate(id => E.books.payBooking(id, { amount: 99999, method: "cash" }).then(() => "done", e => e.code), nb.id);
  ok(over === "over", "the books refuse more than the balance too");
  await p.click(`#tvPay-${nb.id}`); await wait(p, 300); await p.click("#tpSave"); await wait(p, 600);
  ok((await money(nb.id)).balance === 0 && await p.locator(`#tvCard-${nb.id}`).count() === 0, "the rest in cash: paid in full, and it leaves To pay");
  await show("coming");
  ok(/Paid in full/.test(await p.textContent(`#tvCard-${nb.id}`)), "Coming up shows it paid in full");
  /* voiding a payment typed by mistake */
  await p.click(`#tvOpen-${nb.id}`); await wait(p, 350);
  ok(await p.locator("#tvPays tbody tr").count() === 3, "the booking's window lists its three payments");
  await p.click("#tvPays tbody tr:nth-child(2) .row-key"); await wait(p, 300);
  await p.click("#tvVoidSave"); await wait(p, 200);
  ok((await p.textContent("#tvWhy-e")).length > 0, "voiding asks why");
  await p.fill("#tvWhy", "Charged twice on the machine"); await p.click("#tvVoidSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "booking.payVoided" && (await money(nb.id)).balance === 8000, "voided: $80.00 is to pay again, and the payment stays in the books");
  ok(await p.locator(".layer #tvPays tr.voided").count() === 1 && await p.locator(".layer").count() === 1, "the booking's window comes back, the payment struck through");
  await p.keyboard.press("Escape"); await wait(p, 250);
  /* changing the trip */
  await p.click(`#tvOpen-${nb.id}`); await wait(p, 350); await p.click("#tvChange"); await wait(p, 350);
  await p.fill("#bkDepart", await day(4)); await p.click("#bkSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "booking.changed" && (await p.evaluate(id => E.books.booking(id).depart, nb.id)) === await day(4), "the day it leaves is changed: one ledger line");
  const below = await p.evaluate(id => { const b = E.books.booking(id); return E.books.changeBooking(id, { from: b.from, to: b.to, depart: b.depart, ret: b.ret, pax: b.pax, site: b.site, code: b.code, note: b.note, ticket: 100, fee: 0 }).then(() => "done", e => e.code); }, nb.id);
  ok(below === "below", "the total cannot fall below what the client has paid");

  console.log("Cancelling");
  await p.click(`#tvOpen-${nb.id}`); await wait(p, 350); await p.click("#tvCancel"); await wait(p, 350);
  const m0 = await money(nb.id);
  ok(await p.inputValue("#bcKept") === "30.00" && await p.inputValue("#bcRefund") === ((m0.paid - 3000) / 100).toFixed(2), "the window starts at the store's fee kept, and the rest of what was paid given back");
  await p.fill("#bcKept", "45.00"); await p.click("#bcSave"); await wait(p, 300);
  ok(/At most \$30\.00/.test(await p.textContent("#bcKept-e")), "the store keeps at most its fee");
  await p.fill("#bcKept", "30.00"); await p.fill("#bcRefund", "999.00"); await p.click("#bcSave"); await wait(p, 300);
  ok(/At most/.test(await p.textContent("#bcRefund-e")), "and gives back at most what was paid");
  await p.fill("#bcRefund", ((m0.paid - 3000) / 100).toFixed(2)); await p.click("#bcSave"); await wait(p, 300);
  ok((await p.textContent("#bcWhy-e")).length > 0, "cancelling asks why");
  const before = await p.evaluate(() => { const k = E.util.dayKey(); return E.books.bookingEarned(k, k).fees; });
  await p.fill("#bcWhy", "The flight was cancelled"); await p.click("#bcSave"); await wait(p, 700);
  ln = await lastLine();
  const m1 = await money(nb.id), after = await p.evaluate(() => { const k = E.util.dayKey(); return E.books.bookingEarned(k, k); });
  ok(ln.type === "booking.cancelled" && m1.refunded === m0.paid - 3000 && m1.balance === 0, "cancelled: what went back is written, nothing is left to pay");
  ok(after.fees === before && after.cancelled >= 1, "the store's fee kept still counts in the earnings");
  ok(await p.evaluate(id => E.books.payBooking(id, { amount: 100, method: "cash" }).then(() => "done", e => e.code), nb.id) === "closed", "a cancelled booking takes no payment");

  console.log("Earnings");
  await p.evaluate(() => { E.earnings.tab = "store"; E.earnings.period = "month"; E.ui.go("earnings"); }); await wait(p, 400);
  const ea = await p.evaluate(() => { const rg = E.reports.range("month"), r = E.books.report(rg.from, rg.to), bk = E.books.bookingEarned(rg.from, rg.to); return { apart: r.services.commission + bk.fees, n: bk.count + bk.cancelled }; });
  ok((await p.textContent("#eaApart")).replace(/[^0-9.]/g, "") === (ea.apart / 100).toFixed(2) && new RegExp("on " + ea.n + " travel bookings").test(await p.textContent("#eaApartBk")),
    "Earned apart from sales counts the bookings' fees with the commission (" + ea.n + " bookings)");

  console.log("Reports");
  await p.evaluate(() => { E.reports.period = "today"; E.reports.person = "all"; E.ui.go("reports"); }); await wait(p, 400);
  const rb = await p.evaluate(() => { const k = E.util.dayKey(); let n = 0, cash = 0, other = 0, back = 0;
    E.books.bookings().forEach(b => b.pays.forEach(q => { if (q.status === "void" || E.util.dayKey(new Date(q.at)) !== k) return; if (q.kind === "refund") back += q.amount; else { n++; if (q.method === "cash") cash += q.amount; else other += q.amount; } }));
    return { n, cash, other, back }; });
  const rtxt = await p.textContent("#repBkCash");
  ok(rtxt.includes(rb.n + " payment") && rtxt.includes((rb.cash / 100).toFixed(2)) && rtxt.includes((rb.back / 100).toFixed(2)) && /not part of the sales/.test(await p.textContent("main#room")),
    "Reports: today's payments for bookings and what went back, kept out of the sales (" + rtxt + ")");

  console.log("A client's name and phone, only if the owner says so");
  await go("settings");
  ok(await p.isChecked("#setBkKeep") === false, "Settings, Travel bookings: keeping the client's name and phone is off at first");
  await p.fill("#setBkFee", "25.00"); await p.check("#setBkKeep"); await p.click("#setBkSave"); await wait(p, 600);
  ln = await lastLine();
  ok(ln.type === "settings.bookings" && ln.data.keepClient === true && ln.data.fee === 2500, "the owner turns it on, with a usual fee of $25.00: one ledger line");
  await go("travel"); await p.click("#tvNew"); await wait(p, 350);
  ok(await p.locator("#bkClient").count() === 1 && await p.inputValue("#bkFee") === "25.00", "the window now asks for a name and a phone, and offers the usual fee");
  await p.fill("#bkFrom", "MIA"); await p.fill("#bkTo", "CAP"); await p.fill("#bkDepart", await day(2)); await p.check("#bkOneWay");
  await p.fill("#bkTicket", "210.00"); await p.fill("#bkClient", "Rose 123456789"); await p.click("#bkSave"); await wait(p, 400);
  ok(/passport/.test(await p.textContent("#bkClient-e")), "a number like a passport's is refused in the name too");
  await p.fill("#bkClient", "Rose D."); await p.fill("#bkPhone", "(305) 555-0134"); await p.click("#bkSave"); await wait(p, 700);
  ln = await lastLine();
  const withClient = await p.evaluate(() => E.books.bookings().sort((a, b) => a.at < b.at ? 1 : -1)[0]);
  ok(withClient.client && withClient.client.name === "Rose D." && withClient.client.phone === "(305) 555-0134" && !("client" in ln.data.booking), "the name and phone are kept in the booking, and not in the ledger");
  ok(/Rose D\./.test(await p.textContent(`#tvCard-${withClient.id}`)), "and shown on its card");
  await go("home");
  ok(/A trip in the next seven days with a balance to pay/.test(await p.textContent(".hm-needs")), "the Home reminds of a trip in the next seven days with a balance to pay");
  await go("settings"); await p.uncheck("#setBkKeep"); await p.click("#setBkSave"); await wait(p, 300);
  ok(await p.locator(".layer").count() === 1 && /Erase/.test(await p.textContent(".layer")), "turning it off asks first: the names and phones will be erased");
  await p.click(".layer .key.danger"); await wait(p, 700);
  ln = await lastLine();
  ok(ln.type === "settings.bookings" && ln.data.erased >= 1 && !await p.evaluate(() => E.books.bookings().some(b => b.client)), "erased from every booking (" + ln.data.erased + ")");

  console.log("Marie, a cashier");
  await as(MARIE);
  await go("travel");
  ok(await p.locator("#tvNew").count() === 1, "Marie makes bookings at the counter");
  await show("due");
  /* a booking with a deposit and a balance (Fort Lauderdale to Cap-Haitien) */
  const dueId = await p.evaluate(() => E.books.bookings(b => b.status !== "cancelled" && b.pays.length && E.books.bookingMoney(b).balance > 0)[0].id);
  await p.click(`#tvOpen-${dueId}`); await wait(p, 350);
  ok(await p.locator("#tvCancel").count() === 0 && await p.locator("#tvPays .row-key").count() === 0 && !/Ticket price/.test(await p.textContent(".layer")), "she sees no Cancel, no void keys, and not the ticket's price or the fee");
  await p.keyboard.press("Escape"); await wait(p, 200);
  const den = await p.evaluate(id => Promise.all([E.books.cancelBooking(id, { feeKept: 0, refund: 0, reason: "x" }).then(() => "done", e => e.code),
    E.books.voidBookingPay(id, E.books.booking(id).pays[0].id, "x").then(() => "done", e => e.code)]), dueId);
  ok(den[0] === "denied" && den[1] === "denied", "the books refuse her cancelling or voiding");
  const keepPrice = await p.evaluate(id => { const b = E.books.booking(id); return E.books.changeBooking(id, { from: b.from, to: b.to, depart: b.depart, ret: b.ret, pax: b.pax, site: b.site, code: b.code, note: "Aisle seat", ticket: 1, fee: 0 }).then(x => x.ticket === b.ticket && x.fee === b.fee && x.note === "Aisle seat"); }, dueId);
  ok(keepPrice, "a change she makes leaves the price and the fee as they were");
  await as("owner");

  console.log("The books");
  const drill = await p.evaluate(() => { E.books.drillStart(function () { }); return E.books.addBooking({ from: "A", to: "B", depart: E.util.dayKey(), pax: 1, ticket: 100, fee: 0 }).then(() => "done", e => e.code).then(r => { E.books.drillEnd(); return r; }); });
  ok(drill === "drill", "nothing of the kind is written during an exercise");
  const v = await p.evaluate(() => E.books.verify().then(r => ({ ok: r.ok, n: r.problems.length, lines: r.lines })));
  ok(v.ok && v.n === 0, "Verify replays every booking, its payments and its cancelling, and finds nothing wrong (" + v.lines + " lines)");
  const tamper = await p.evaluate(() => { const b = E.books.state().bookings[0], was = b.fee; b.fee += 100;
    return E.books.verify().then(r => { b.fee = was; return r.problems.filter(q => q.booking && q.what === "differs").length; }); });
  ok(tamper === 1, "a fee changed outside the books is found");

  console.log("A practice store made before Build 22");
  const old = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const o = await old.newPage(); o.on("pageerror", e => errors.push(e.message));
  await o.goto(PAGE); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  await o.evaluate(() => E.db.entries("rec").then(es => E.db.write(es.filter(e => /^booking:|^counter:booking$/.test(e[0])).map(e => ({ store: "rec", key: e[0], del: true })))));
  await o.reload(); await o.waitForSelector("#introEnter", { timeout: 20000 });
  await o.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await o.waitForSelector(".shell", { timeout: 90000 });
  const up = await o.evaluate(() => ({ n: E.books.bookings().length, user: E.books.user.id }));
  ok(up.n === 4 && up.user === "owner", "as it opens, it is given the sample bookings once (" + JSON.stringify(up) + ")");
  await old.close();

  console.log("Three languages");
  const keysOk = await p.evaluate(() => {
    const d = E.dict, miss = [], same = [];
    Object.keys(d.en).filter(k => /^tv\.|^(room|lede)\.travel$|^tip\.travel(Set)?\.|^tips\.travel\.|^guide\.travel\.|^set\.travel|^ea\.apart(Com|Bk)/.test(k))
      .forEach(k => { ["fr", "ht"].forEach(l => { if (!d[l][k]) miss.push(l + ":" + k); else if (d[l][k] === d.en[k] && !/^tv\.(total|codeShort|note|clientWord)$/.test(k)) same.push(l + ":" + k); }); });
    return { miss: miss, same: same, n: Object.keys(d.en).filter(k => /^tv\./.test(k)).length };
  });
  ok(keysOk.miss.length === 0 && keysOk.same.length === 0, "every word of Travel is in French and Kreyòl (" + keysOk.n + " phrases)" + (keysOk.miss.length + keysOk.same.length ? " " + keysOk.miss.concat(keysOk.same).slice(0, 6).join(", ") : ""));
  for (const [lang, title] of [["fr", "Voyages"], ["ht", "Vwayaj"]]) {
    await p.evaluate(l => { E.setLang(l); E.ui.shell(); }, lang);
    await show("all");
    ok((await p.textContent("main#room h1")).includes(title) && !/\btv\./.test(await p.textContent("main#room")), lang + ": " + title + ", every word in place");
  }
  await p.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  ok(Object.keys(await p.evaluate(() => E.missing || {})).length === 0, "no word missing anywhere");

  console.log("On a phone");
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const q = await ph.newPage(); q.on("pageerror", e => errors.push(e.message));
  await q.goto(PAGE); await q.waitForSelector("#introEnter", { timeout: 20000 });
  await q.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await q.waitForSelector(".shell", { timeout: 90000 });
  await q.evaluate(() => { E.travel.show = "all"; E.ui.go("travel"); }); await wait(q, 500);
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the bookings fit the phone's width");
  await q.click("#tvNew"); await wait(q, 400);
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "and so does the booking's window");
  await ph.close();

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
