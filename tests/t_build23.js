/* LAKAY | Build 23 test: who keeps the customer's fee on a transfer. For each provider the owner chooses the provider
   (as since Build 15) or the store. When the store keeps it, the fees count in Earnings with the commission, and they
   are no longer part of what is held for the provider. The choice is the owner's alone, and a ledger line.
   Run: node tests/t_build23.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
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
  const tab = async (t) => { await p.evaluate(t => { E.earnings.tab = t; E.earnings.period = "month"; E.ui.go("earnings", true); }, t); await wait(p, 300); };
  const acct = (id) => p.evaluate(id => E.books.providerAccount(id), id);
  const lastLine = () => p.evaluate(() => E.books.lines().then(l => ({ type: l[0].type, data: l[0].data })));

  await p.goto(PAGE); await p.waitForSelector("#introEnter", { timeout: 20000 });
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await p.waitForSelector(".shell", { timeout: 90000 });

  console.log("Who keeps the customer's fee");
  const before = await p.evaluate(() => E.books.PROVIDERS.map(id => (E.books.provSetup(id) || {}).fee || "provider").join(","));
  ok(/^(provider,){4}provider$/.test(before), "at first, every provider keeps its customers' fees, as since Build 15 (" + before + ")");
  const cam0 = await acct("cam");
  ok(cam0.fees > 0 && cam0.feeKept === 0, "CAM's customers paid " + (cam0.fees / 100).toFixed(2) + " in fees, all held for CAM");
  await tab("providers");
  await p.click("#eaSetup-cam"); await wait(p, 300);
  ok(await p.getAttribute('#psFee [data-v="provider"]', "aria-checked") === "true" && /goes to the provider/.test(await p.textContent("#psFeeD")), "How it settles asks who keeps the customer's fee, and explains it");
  await p.click('#psFee [data-v="store"]'); await wait(p, 100);
  ok(/The store keeps the fee a customer pays/.test(await p.textContent("#psFeeD")), "each choice is explained as it is chosen");
  await p.click("#psSave"); await wait(p, 600);
  const ln = await lastLine(), cam1 = await acct("cam");
  ok(ln.type === "provider.setup" && ln.data.fee === "store" && ln.data.how === cam0.setup.how, "the owner's choice is one ledger line, and the rest of the setup stays");
  ok(cam1.feeKept === cam0.fees && cam1.held === cam0.held - cam0.fees, "the fees are no longer held for CAM: what is held goes down by $" + (cam0.fees / 100).toFixed(2));
  ok(/The store keeps the fee/.test(await p.textContent("#eaProv-cam")) && /fees kept by the store/.test(await p.textContent("#eaProv-cam")), "CAM's card says so, with the fees kept");
  await tab("store");
  const ea = await p.evaluate(() => { const rg = E.reports.range("month"), r = E.books.report(rg.from, rg.to), bk = E.books.bookingEarned(rg.from, rg.to);
    return { apart: r.services.commission + bk.fees + (r.services.byProvider.cam ? r.services.byProvider.cam.fees : 0), camFees: r.services.byProvider.cam ? r.services.byProvider.cam.fees : 0 }; });
  ok((await p.textContent("#eaApart")).replace(/[^0-9.]/g, "") === (ea.apart / 100).toFixed(2), "Earned apart from sales now counts CAM's customers' fees");
  ok(/customers' fees the store keeps \(CAM\)/.test(await p.textContent("#eaApartFee")) && /except for CAM/.test(await p.textContent("#eaApartCard")), "and says whose fees they are");
  ok(await p.locator("#eaByProv .ea-mine").count() === 1, "the table marks CAM's fees as the store's");
  const denied = await p.evaluate(() => { E.books.user = E.books.state().users.u_practice_jean; return E.books.setProvSetup("ria", { how: "deposit", com: "monthly", fee: "store" }).then(() => "done", e => e.code).then(r => { E.books.user = E.books.state().users.owner; return r; }); });
  ok(denied === "denied", "the choice is the owner's alone");
  const bad = await p.evaluate(() => E.books.setProvSetup("ria", { how: "deposit", com: "monthly", fee: "half" }).then(() => "done", e => e.code));
  ok(bad === "how", "only the provider or the store");
  const v = await p.evaluate(() => E.books.verify().then(r => ({ ok: r.ok, n: r.problems.length })));
  ok(v.ok && v.n === 0, "Verify finds nothing wrong");

  console.log("The keys at the right edge");
  ok(!(await p.evaluate(() => document.getElementById("rail").classList.contains("down"))), "on a computer, the three keys stand at the right edge, as before");
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const q = await ph.newPage(); q.on("pageerror", e => errors.push(e.message));
  await q.goto(PAGE); await q.waitForSelector("#introEnter", { timeout: 20000 });
  await q.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await q.waitForSelector(".shell", { timeout: 90000 });
  ok(await q.evaluate(() => document.getElementById("rail").classList.contains("down")) && await q.locator("#railChevron").isVisible(), "on a phone they start laid down, with the small key at the edge");
  await q.click("#railChevron"); await wait(q, 400);
  ok(!(await q.evaluate(() => document.getElementById("rail").classList.contains("down"))) && await q.locator("#rail-find").isVisible(), "one press stands them up");
  await q.reload(); await q.waitForSelector("#introEnter", { timeout: 20000 });
  await q.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await q.waitForSelector(".shell", { timeout: 90000 });
  ok(!(await q.evaluate(() => document.getElementById("rail").classList.contains("down"))), "and the phone remembers the choice");
  await ph.close();

  console.log("Three languages");
  const keysOk = await p.evaluate(() => {
    const d = E.dict, miss = [], same = [];
    Object.keys(d.en).filter(k => /^ea\.(fee|feesKept|apartFee|feeMine|feesNoteSome)/.test(k)).forEach(k => { ["fr", "ht"].forEach(l => { if (!d[l][k]) miss.push(l + ":" + k); else if (d[l][k] === d.en[k]) same.push(l + ":" + k); }); });
    return { miss, same };
  });
  ok(keysOk.miss.length === 0 && keysOk.same.length === 0, "every new word is in French and Kreyòl" + (keysOk.miss.length + keysOk.same.length ? " " + keysOk.miss.concat(keysOk.same).slice(0, 6).join(", ") : ""));
  ok(Object.keys(await p.evaluate(() => E.missing || {})).length === 0, "no word missing anywhere");
  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
