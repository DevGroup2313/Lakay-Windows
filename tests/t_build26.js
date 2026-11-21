/* LAKAY | Build 26 test: devices in step, stage 3, the relays. Two copies of Lakay Relay (relay/lakay_relay.py) run on
   this computer, as the two Mac minis at home would; a copy of the built page is pointed at them (its policy's
   connect-src, as build.py writes it from build.json); three browsers stand for three devices: the counter (A), a Mac
   mini holding the books (B), and the owner's phone (C). The owner claims each relay with its claim code and connects
   each device with the owner's password; the changes then travel by themselves, through either relay; a field changed
   on two devices while apart is reported; nothing grows when there is nothing new; a removed device's key is closed at
   both relays; the relays hold only sealed bundles.
   Run: node tests/t_build26.js */
"use strict";
const { chromium } = require("./_agreed");  /* each browser has agreed to the terms (Build 26) */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
let failed = 0, passed = 0;
function ok(cond, what) { if (cond) { passed++; console.log("  ok   " + what); } else { failed++; console.log("  FAIL " + what); } }
const wait = (p, ms) => p.waitForTimeout(ms);
const OWNER_PW = "a long owner sentence for the store";
const PORTS = [18771, 18772];

(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lakay26-"));
  function startRelay(i) {
    const dir = path.join(TMP, "relay" + i);
    fs.mkdirSync(dir, { recursive: true });
    const proc = spawn("python3", ["-I", path.join(ROOT, "relay", "lakay_relay.py"), "--data", dir, "--port", String(PORTS[i])], { stdio: "ignore" });
    return { i, dir, proc, addr: "http://127.0.0.1:" + PORTS[i] };
  }
  const relays = [startRelay(0), startRelay(1)];
  await new Promise(r => setTimeout(r, 1200));
  const claimOf = (R) => (fs.readFileSync(path.join(R.dir, "claim.txt"), "utf8").match(/is ([0-9A-Z-]{19})/) || [])[1];
  const claims = relays.map(claimOf);

  const html = fs.readFileSync(path.join(ROOT, "app", "Lakay.html"), "utf8");
  ok(html.includes("connect-src 'none'"), "the built page reaches nowhere while build.json lists no relay");
  const PAGE = path.join(TMP, "Lakay-relays.html");
  fs.writeFileSync(PAGE, html.replace("connect-src 'none'", "connect-src " + relays.map(r => r.addr).join(" ")));

  const browser = await chromium.launch();
  const errors = [], csp = [];
  async function device(w, page) {
    const ctx = await browser.newContext({ viewport: { width: w || 1280, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
    await p.goto("file://" + (page || PAGE)); await p.waitForSelector("#introProtect", { timeout: 20000 });
    await p.evaluate(() => { E.util.prefSet("tips", "0"); });
    return p;
  }
  const settings = async (p) => { await p.evaluate(() => E.ui.go("settings")); await p.waitForSelector("#relBlock"); await wait(p, 200); };
  const relRows = (p) => p.$$eval("#relList .rel-row", rs => rs.map(r => r.querySelector(".rel-t").innerText.replace(/\s+/g, " ").trim()));
  const stock = (p, id) => p.evaluate(id => E.books.state().items[id].stock, id);
  async function until(fn, ms) { const end = Date.now() + (ms || 15000); while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 250)); } return false; }
  async function connect(p, codes, pw) {
    await settings(p);
    await p.click("#relConnect");
    await p.waitForSelector("#relPw");
    await until(async () => !(await p.$("#relClaims .hint")), 10000);
    for (const [i, code] of (codes || []).entries()) { if (code != null) await p.fill('#relClaims input[data-relay="' + relays[i].addr + '"]', code); }
    await p.fill("#relPw", pw || OWNER_PW);
    await p.click("#relGo");
    await until(async () => !(await p.$("#relPw")) || (await p.$$eval("#relResults li", l => l.length)) > 0 || !!(await p.$("#relPw-e:not(:empty)")), 30000);
    await wait(p, 300);
  }
  async function exchangeNow(p) { await p.evaluate(() => E.relay.run()); }
  async function join(p, inv) {
    const f = path.join(TMP, "join-" + inv.device.code + ".lakay");
    fs.writeFileSync(f, inv.file);
    await p.click("#introJoin"); await p.waitForSelector("#joinPick");
    await p.setInputFiles("#joinFile", f); await wait(p, 500); await p.waitForSelector("#joinCode");
    await p.fill("#joinCode", inv.code); await p.click("#joinGo");
    await p.waitForSelector("#ldName", { timeout: 60000 });
    await p.fill("#ldName", "Yannie"); await p.fill("#ldPw", OWNER_PW); await p.click("#ldGo");
    await p.waitForSelector(".shell", { timeout: 60000 });
  }

  console.log("The counter (A): claiming the relays and connecting");
  const A = await device();
  await A.evaluate(pw => E.books.prepareSetup({ storeName: "Lakay Relay Test", ownerName: "Yannie", password: pw, currency: "USD" }).then(h => h.finish()).then(() => E.app.opened()), OWNER_PW);
  await A.waitForSelector(".shell", { timeout: 60000 });
  const cd = await A.evaluate(() => E.books.addItem({ name: "Kompa classics, volume 3 (CD)", cat: "music", price: 1299, cost: 650, openingStock: 20, reorderAt: 4, taxId: null, barcode: "" }).then(i => i.id));
  await settings(A);
  let rows = await relRows(A);
  ok(rows.length === 2 && rows.every(r => /not connected/.test(r)) && rows[0].includes("127.0.0.1:" + PORTS[0]), "Settings lists the two relays, this device not yet connected (" + rows.join(" | ") + ")");
  ok(await A.locator("#relaySign").count() === 0, "no sign in the top bar before this device is connected");
  await connect(A, claims, "not the password at all");
  ok(/password/i.test(await A.textContent("#relPw-e")) && await A.evaluate(() => !E.relay.connected()), "a wrong password connects nothing");
  await A.fill('#relClaims input[data-relay="' + relays[1].addr + '"]', "0000-0000-0000-0000");
  await A.fill('#relClaims input[data-relay="' + relays[0].addr + '"]', claims[0].toLowerCase().replace(/-/g, " "));
  await A.fill("#relPw", OWNER_PW); await A.click("#relGo");
  await until(async () => (await A.$$eval("#relResults li", l => l.length)) === 2, 30000);
  const res1 = await A.$$eval("#relResults li", l => l.map(x => x.textContent));
  ok(/connected/.test(res1[0]) && /claim code is not right/.test(res1[1]), "the right claim code (small letters, spaces) claims the first relay; a wrong one is refused (" + res1.join(" | ") + ")");
  await A.fill('#relClaims input[data-relay="' + relays[1].addr + '"]', claims[1]);
  await A.fill("#relPw", OWNER_PW); await A.click("#relGo");
  ok(await until(async () => !(await A.$("#relPw")), 30000), "with the second code, both relays are connected and the window closes");
  ok(!fs.existsSync(path.join(relays[0].dir, "claim.txt")) && !fs.existsSync(path.join(relays[1].dir, "claim.txt")), "each relay's claim code is spent");
  ok(await until(async () => (await A.locator("#relaySign.ok").count()) === 1, 15000), "the sign in the top bar says In step");
  await settings(A);
  rows = await relRows(A);
  ok(rows.length === 2 && rows.every(r => /Last exchange at|no exchange yet/.test(r)), "Settings shows both relays connected (" + rows.join(" | ") + ")");

  console.log("A Mac mini at home (B) joins and connects");
  const inv = await A.evaluate(pw => E.books.prepareInvite(pw, "Mac mini").then(r => ({ code: r.code, file: r.file, device: r.device })), OWNER_PW);
  const B = await device();
  await join(B, inv);
  ok(await B.evaluate(() => E.books.device.code) === "B", "the Mac mini joins as device B, and the owner signs in there");
  await connect(B, [], OWNER_PW);
  ok(await until(async () => (await B.locator("#relaySign.ok").count()) === 1, 15000) && await B.evaluate(() => E.relay.connected()), "B connects with the password alone: the relays are already the store's");

  console.log("The changes travel by themselves");
  const leftAt = () => [0, 1].map(i => JSON.parse(fs.readFileSync(path.join(relays[i].dir, "index.json"), "utf8")).items.length);
  const l0 = leftAt();
  await A.evaluate(id => E.books.completeSale([{ itemId: id, qty: 1 }], 5000), cd);
  ok(await until(async () => leftAt().every((n, i) => n > l0[i]), 15000), "A's sale goes to both relays by itself, soon after it is made");
  await B.evaluate(id => E.books.completeSale([{ itemId: id, qty: 3 }], 5000), cd);
  ok(await until(async () => (await stock(B, cd)) === 16, 20000), "B's own sale sets off B's exchange, which takes A's sale by itself (B: " + await stock(B, cd) + ")");
  await A.click("#relaySign"); await A.waitForSelector("#relNow");
  await A.click("#relNow");
  ok(await until(async () => (await stock(A, cd)) === 16, 20000), "Exchange now, on A's sign: A takes B's sale (A: " + await stock(A, cd) + ")");
  await A.evaluate(() => { const c = document.querySelector(".layer .dialog button:not(.primary)"); if (c) c.click(); }); await wait(A, 200);
  const sealedOnly = [0, 1].every(i => fs.readdirSync(path.join(relays[i].dir, "bundles")).every(f => !/Kompa|Yannie|receipt/i.test(fs.readFileSync(path.join(relays[i].dir, "bundles", f), "utf8"))));
  ok(sealedOnly, "the relays hold only sealed bundles: no item, no name in their files");
  ok(await A.evaluate(() => E.books.verify().then(r => r.ok)) && await B.evaluate(() => E.books.verify().then(r => r.ok)), "Verify passes on both");

  console.log("Nothing grows when there is nothing new");
  const seqs = async () => [await A.evaluate(() => E.books.state().head.seq), await B.evaluate(() => E.books.state().head.seq)];
  const idx = () => [0, 1].map(i => JSON.parse(fs.readFileSync(path.join(relays[i].dir, "index.json"), "utf8")).items.length);
  for (let k = 0; k < 2; k++) { await exchangeNow(A); await exchangeNow(B); }
  const s1 = await seqs(), i1 = idx();
  for (let k = 0; k < 6; k++) { await exchangeNow(A); await exchangeNow(B); }
  const s2 = await seqs(), i2 = idx();
  ok(s2[0] === s1[0] && s2[1] === s1[1] && i2[0] === i1[0] && i2[1] === i1[1],
    "six rounds with nothing new: no line written on either device, no bundle left at either relay (lines " + s1.join("/") + " → " + s2.join("/") + "; bundles " + i1.join("/") + " → " + i2.join("/") + ")");

  console.log("Either relay will do");
  relays[0].proc.kill(); await new Promise(r => setTimeout(r, 400));
  await A.evaluate(id => E.books.completeSale([{ itemId: id, qty: 2 }], 5000), cd);
  await until(async () => (await A.evaluate(() => E.relay.status()[1].ok)) !== null, 8000);
  await new Promise(r => setTimeout(r, 3500));
  await exchangeNow(B);
  ok(await until(async () => (await stock(B, cd)) === 14, 15000), "with the first relay off, B takes A's next sale through the second (B: " + await stock(B, cd) + ")");
  const st0 = await A.evaluate(() => E.relay.status().map(s => !!s.err));
  ok(st0[0] === true && st0[1] === false && (await A.locator("#relaySign.ok").count()) === 1, "A notes the first relay out of reach, and stays In step through the second");
  relays[0] = (() => { const proc = spawn("python3", ["-I", path.join(ROOT, "relay", "lakay_relay.py"), "--data", relays[0].dir, "--port", String(PORTS[0])], { stdio: "ignore" }); return Object.assign(relays[0], { proc }); })();
  await new Promise(r => setTimeout(r, 1200));
  await exchangeNow(A); await exchangeNow(B);
  ok(await A.evaluate(() => E.relay.status().every(s => s.on && !s.err)), "the first relay back: A catches it up, with no error");

  console.log("Changed on two devices while apart");
  await B.evaluate(() => E.books.updateSettings({ receiptNote: "Thank you, from the Mac mini" }));
  await new Promise(r => setTimeout(r, 30));
  await A.evaluate(() => E.books.updateSettings({ receiptNote: "Thank you, from the counter" }));
  await new Promise(r => setTimeout(r, 2600));
  await exchangeNow(B); await exchangeNow(A);
  ok(await until(async () => (await A.locator("#relaySign.note").count()) === 1, 10000), "A's sign shows something to see");
  await A.click("#relaySign"); await A.waitForSelector("#relNow");
  const clash = await A.$$eval("#relClashes li", l => l.map(x => x.textContent));
  ok(clash.length === 1 && /receipt note/.test(clash[0]) && /device A's change, the later one, is kept/.test(clash[0]), "the window names the receipt note, changed on both, the later change kept (" + clash.join(" | ") + ")");
  await A.evaluate(() => { const c = document.querySelector(".layer .dialog button:not(.primary)"); if (c) c.click(); }); await wait(A, 200);
  await exchangeNow(B);
  ok(await B.evaluate(() => E.books.state().settings.receiptNote) === "Thank you, from the counter", "both keep the same receipt note");

  console.log("The owner's phone (C) joins, connects, and is removed");
  const inv2 = await A.evaluate(pw => E.books.prepareInvite(pw, "iPhone").then(r => ({ code: r.code, file: r.file, device: r.device })), OWNER_PW);
  await exchangeNow(A);
  const Cp = await device(390);
  await join(Cp, inv2);
  await connect(Cp, [], OWNER_PW);
  await exchangeNow(Cp);
  ok(await stock(Cp, cd) === 14 && await Cp.evaluate(() => E.books.device.code) === "C", "the phone joins as C, connects, and holds the same stock (14)");
  ok(await Cp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "on the phone, nothing is wider than the screen");
  await settings(Cp);
  ok(await Cp.evaluate(() => Array.prototype.every.call(document.querySelectorAll("#relBlock .rel-row, #relBlock button"), b => b.getBoundingClientRect().right <= innerWidth + 1)), "the relays' block fits the phone");
  await Cp.evaluate(id => E.books.completeSale([{ itemId: id, qty: 1 }], 5000), cd);
  await new Promise(r => setTimeout(r, 2600));
  await exchangeNow(A);
  ok(await until(async () => (await stock(A, cd)) === 13, 10000), "a sale on the phone reaches the counter (A: " + await stock(A, cd) + ")");
  await settings(A);
  await A.click('#devList [data-remove="C"]');
  await A.waitForSelector(".layer .dialog button.danger, .layer .dialog .key.danger");
  await A.click(".layer .dialog button.danger, .layer .dialog .key.danger");
  await A.waitForSelector("#relClosePw", { timeout: 15000 });
  await A.fill("#relClosePw", OWNER_PW); await A.click("#relCloseGo");
  ok(await until(async () => !(await A.$("#relClosePw")), 30000), "removing the phone asks for the password, and closes its key at the relays");
  const closed = [0, 1].every(i => { const d = JSON.parse(fs.readFileSync(path.join(relays[i].dir, "devices.json"), "utf8")); return Object.values(d).filter(x => x.closed).length === 1; });
  ok(closed, "both relays hold the phone's key as closed");
  await exchangeNow(Cp);
  ok(await until(async () => (await Cp.locator("#relaySign.closed").count()) === 1, 10000), "the phone's next exchange is refused, and its sign says Disconnected");

  console.log("What never travels, the practice store, three languages");
  const backup = JSON.parse(await A.evaluate(() => E.books.makeBackup()));
  ok(!("relay" in backup) && Object.keys(backup).sort().join(",") === "at,build,custom,device,door,format,journal,rec,sum,v,vault", "a backup carries no relay key (its parts: " + Object.keys(backup).sort().join(",") + ")");
  const P = await device();
  await P.evaluate(() => E.books.openPractice().then(() => E.app.opened(true))); await P.waitForSelector(".shell", { timeout: 90000 });
  await P.evaluate(() => E.ui.go("settings")); await P.waitForSelector("#set-devices");
  ok(await P.locator("#relBlock").count() === 0 && await P.locator("#relaySign").count() === 0, "the practice store has no relays and no sign");
  const Z = await device(1280, path.join(ROOT, "app", "Lakay.html"));
  await Z.evaluate(pw => E.books.prepareSetup({ storeName: "No Relay", ownerName: "Yannie", password: pw, currency: "USD" }).then(h => h.finish()).then(() => E.app.opened()), OWNER_PW);
  await Z.waitForSelector(".shell", { timeout: 60000 });
  await settings(Z);
  ok(/no relays yet/.test(await Z.textContent("#relBlock")) && await Z.locator("#relConnect").count() === 0, "the released page, with no relay in build.json, says so and offers nothing to connect");
  for (const l of ["fr", "ht"]) {
    await A.evaluate(l => { E.setLang(l); E.ui.shell(); E.ui.go("settings"); }, l); await wait(A, 300);
    await A.click("#relaySign"); await A.waitForSelector("#relNow"); await wait(A, 150);
    await A.evaluate(() => { const c = document.querySelector(".layer .dialog button:not(.primary)"); if (c) c.click(); });
    await A.evaluate(() => E.ui.go("guide"));
    await A.evaluate(() => { const b = document.querySelector('.guide-key[data-a="relays"]'); if (b) b.click(); }); await wait(A, 200);
  }
  await A.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  const missing = await A.evaluate(() => Object.keys(E.missing));
  ok(missing.length === 0, "every word is in French and Kreyòl" + (missing.length ? ": " + missing.slice(0, 5).join(", ") : ""));
  ok(await A.evaluate(() => !!document.querySelector('.guide-key[data-a="relays"]') || E.has("guide.relays.t")), "the Guidebook has a chapter, The relays at home");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  relays.forEach(r => { try { r.proc.kill(); } catch (e) { } });
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
