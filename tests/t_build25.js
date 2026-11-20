/* LAKAY | Build 25 test: devices in step, stage 2, through the screens. The owner adds a device in Settings (a letter
   reserved, a joining file saved, a pairing code shown once); a second browser, standing for a new device, joins at the
   door with the file and the code, and the owner signs in there with the owner's own password. The two devices carry
   their changes to each other by sealed files (saved by one, taken in by the other), with a plain report, the changes
   made on both while apart named, and the count of changes still to carry. An invitation cancelled, a device removed, a
   joining file out of date or changed, a code mistyped or wrong: each is refused, and says why.
   Run: node tests/t_build25.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, ".."), PAGE = process.argv[2] || "file://" + path.join(ROOT, "app", "Lakay.html");
let failed = 0, passed = 0;
function ok(cond, what) { if (cond) { passed++; console.log("  ok   " + what); } else { failed++; console.log("  FAIL " + what); } }
const wait = (p, ms) => p.waitForTimeout(ms);
const OWNER_PW = "a long owner sentence for the store", MARIE_FIRST = "Marie's first password here";

(async () => {
  const browser = await chromium.launch();
  const errors = [], csp = [];
  const TMP = fs.mkdtempSync(path.join(require("os").tmpdir(), "lakay25-"));
  async function device(w) {
    const ctx = await browser.newContext({ viewport: { width: w || 1280, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
    await p.goto(PAGE); await p.waitForSelector("#introProtect", { timeout: 20000 });
    await p.evaluate(() => { E.util.prefSet("tips", "0"); });
    return p;
  }
  /* a file the page saves, caught as the browser saves it */
  async function saved(p, click, name) {
    const [dl] = await Promise.all([p.waitForEvent("download"), click()]);
    const to = path.join(TMP, name + "-" + dl.suggestedFilename());
    await dl.saveAs(to);
    return { path: to, name: dl.suggestedFilename(), text: fs.readFileSync(to, "utf8") };
  }
  const settings = async (p) => { await p.evaluate(() => E.ui.go("settings")); await p.waitForSelector("#set-devices"); await wait(p, 200); };
  const rows = (p) => p.$$eval("#devList .dev-row", rs => rs.map(r => r.getAttribute("data-dev") + ":" + r.querySelector(".dev-t").innerText.replace(/\s+/g, " ").trim()));
  async function takeIn(p, file) {
    await settings(p);
    await p.setInputFiles("#devTakeFile", file.path);
    await p.waitForSelector("#devTook, #devErr", { timeout: 20000 });
    const txt = await p.textContent("#devTook, #devErr");
    const clashes = await p.$$eval("#devClashes li", ls => ls.map(l => l.textContent));
    await p.click(".layer .dialog button.primary"); await wait(p, 200);
    return { txt, clashes };
  }
  async function saveFor(p, code, name) {
    await settings(p);
    return saved(p, () => p.click('#devList [data-save="' + code + '"]'), name);
  }

  console.log("Device A: the owner adds a device");
  const A = await device();
  await A.evaluate(pw => E.books.prepareSetup({ storeName: "Lakay Pairing Test", ownerName: "Yannie", password: pw, currency: "USD" }).then(h => h.finish()).then(() => E.app.opened()), OWNER_PW);
  await A.waitForSelector(".shell", { timeout: 60000 });
  const cd = await A.evaluate(([pw, mpw]) => E.books.addItem({ name: "Kompa classics, volume 3 (CD)", cat: "music", price: 1299, cost: 650, openingStock: 20, reorderAt: 4, taxId: null, barcode: "" })
    .then(i => E.books.addPerson({ name: "Marie", access: ["sell"], preset: "cashier", password: mpw }, pw).then(() => i.id)), [OWNER_PW, MARIE_FIRST]);
  await settings(A);
  ok(await A.locator('.set-nav button:has-text("Devices in step")').count() === 1, "Settings has a Devices in step section, with its key in the section bar");
  let list = await rows(A);
  ok(list.length === 1 && /^A:Device A · This device/.test(list[0]), "at first the store has one device: this one, A (" + list.join(" | ") + ")");
  await A.click("#devAdd"); await A.waitForSelector("#devName");
  await A.fill("#devName", "Mac mini"); await A.fill("#devPw", "not the owner's password");
  await A.click("#devPrepare"); await A.waitForSelector("#devPw[aria-invalid=true]", { timeout: 30000 });
  ok(true, "a wrong password prepares nothing");
  await A.fill("#devPw", OWNER_PW); await A.click("#devPrepare");
  await A.waitForSelector("#devCode", { timeout: 30000 });
  const code = (await A.$$eval("#devCode .mg-g", gs => gs.map(g => g.textContent))).join("-");
  ok(/^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/.test(code), "the pairing code is shown once: six groups of four, in the Master Key's letters (" + code + ")");
  ok(/Device B is invited/.test(await A.textContent(".layer .dialog")), "the new device is B, its letter reserved in the books");
  const joinFile = await saved(A, () => A.click("#devSaveJoin"), "join");
  ok(/^Lakay join Lakay Pairing Test B\.lakay$/.test(joinFile.name) && JSON.parse(joinFile.text).format === "lakay-join", "the joining file is saved, named for the store and the letter (" + joinFile.name + ")");
  ok(joinFile.text.indexOf(code.replace(/-/g, "")) < 0 && !/Kompa|Thank you/.test(joinFile.text), "the file holds neither the code nor anything readable of the books (only the door's names, as in a backup)");
  await A.click("#devDone"); await wait(A, 300);
  list = await rows(A);
  ok(list.length === 2 && /^B:Device B · Mac mini Invited, until/.test(list[1]), "the list shows B, invited until tomorrow (" + list[1] + ")");
  const line = await A.evaluate(() => E.books.lines().then(l => l[0]));
  ok(line.type === "device.invited" && line.data.code === "B" && !JSON.stringify(line).includes("secret"), "the invitation is a line in the ledger, with the letter and nothing secret");

  console.log("Device B joins at the door");
  const Bp = await device();
  await Bp.click("#introJoin"); await Bp.waitForSelector("#joinPick");
  ok(/Join a store from another device/.test(await Bp.textContent("#lockDoor")), "a new device's door offers to join a store from another device");
  const old = Object.assign({}, joinFile, { path: path.join(TMP, "old.lakay") });
  const o = JSON.parse(joinFile.text); o.expires = new Date(Date.now() - 60000).toISOString(); fs.writeFileSync(old.path, JSON.stringify(o));
  await Bp.setInputFiles("#joinFile", old.path); await wait(Bp, 400);
  ok(/expired/.test(await Bp.textContent("#lockDoor .ild-err")), "a joining file out of date is refused, and says so");
  const longer = path.join(TMP, "longer.lakay"); o.expires = new Date(Date.now() + 9 * 864e5).toISOString(); fs.writeFileSync(longer, JSON.stringify(o));
  await Bp.setInputFiles("#joinFile", longer); await Bp.waitForSelector("#joinCode");
  await Bp.fill("#joinCode", code); await Bp.click("#joinGo"); await wait(Bp, 900);
  ok(/does not open this joining file/.test(await Bp.textContent("#lockDoor .ild-err")), "a file whose time was lengthened by hand no longer opens with the right code");
  await Bp.setInputFiles("#joinFile", joinFile.path); await Bp.waitForSelector("#joinCode");
  ok(/Lakay Pairing Test: this device will be device B \(Mac mini\)/.test(await Bp.textContent("#joinSummary")), "the right file says which store, and that this device will be B (Mac mini)");
  await Bp.fill("#joinCode", code.slice(0, 20)); await Bp.click("#joinGo"); await wait(Bp, 400);
  ok(/not complete, or has a typing mistake/.test(await Bp.textContent("#lockDoor .ild-err")), "a code cut short is caught at once");
  const other = code.split("-"); other[5] = other[5] === "0000" ? "1111" : "0000";
  await Bp.fill("#joinCode", other.join("-")); await Bp.click("#joinGo"); await wait(Bp, 400);
  ok(/not complete, or has a typing mistake|does not open/.test(await Bp.textContent("#lockDoor .ild-err")), "a code with a group changed is refused");
  await Bp.fill("#joinCode", code.toLowerCase().replace(/-/g, " ")); await Bp.click("#joinGo");
  await Bp.waitForSelector("#ldName", { timeout: 60000 });
  ok(/device B of Lakay Pairing Test/.test(await Bp.textContent("#lockDoor")), "the code typed in small letters with spaces joins too, and the door says this device is now B");
  ok(await Bp.evaluate(() => !E.books.isOpen), "joining opens no books: the door asks for a password");
  await Bp.fill("#ldName", "Yannie"); await Bp.fill("#ldPw", OWNER_PW); await Bp.click("#ldGo");
  await Bp.waitForSelector(".shell", { timeout: 60000 });
  ok(await Bp.evaluate(() => E.books.device.code + " " + E.books.user.name) === "B Yannie", "the owner signs in on B with the owner's own password");
  ok(await Bp.evaluate(() => E.books.state().items && Object.values(E.books.state().items).some(i => /Kompa/.test(i.name))), "B holds the store's goods");
  await settings(Bp);
  list = await rows(Bp);
  ok(list.length === 2 && /^A:Device A/.test(list[0]) && /^B:Device B · Mac mini · This device/.test(list[1]), "B's Settings list the two devices, B as this one (" + list.join(" | ") + ")");
  const v1 = await Bp.evaluate(() => E.books.verify().then(r => r.ok && r.devices === 2));
  ok(v1, "Verify passes on B, over both chains");

  console.log("Carrying the changes by file");
  await Bp.evaluate(id => E.books.completeSale([{ itemId: id, qty: 3 }], 5000), cd);
  await Bp.evaluate(() => E.books.updateSettings({ receiptNote: "Thank you, from the Mac mini" }));
  await A.evaluate(id => E.books.completeSale([{ itemId: id, qty: 1 }], 5000), cd);
  await wait(A, 30);
  await A.evaluate(() => E.books.updateSettings({ receiptNote: "Thank you, from the counter" }));
  const bToA = await saveFor(Bp, "A", "b2a");
  ok(/^Lakay changes B for A \d{4}-\d{2}-\d{2} \d{2}h\d{2}\.lakay$/.test(bToA.name), "Save changes for A makes one sealed file (" + bToA.name + ")");
  let r = await takeIn(A, bToA);
  ok(/changes taken in, from device B/.test(r.txt), "A takes it in: " + r.txt);
  ok(r.clashes.length === 1 && /The store's settings \(receipt note\): device A's change, the later one, is kept/.test(r.clashes[0]), "the receipt note, changed on both while apart, is named, with the later change kept (" + r.clashes.join(" | ") + ")");
  list = await rows(A);
  ok(/^B:Device B · Mac mini In the store since .* Last change taken in from it: .* 1 change to carry to it$/.test(list[1]) || /^B:Device B · Mac mini In the store since .* changes? to carry to it$/.test(list[1]), "A now lists B as in the store, when it was last heard from, and what A has for it (" + list[1] + ")");
  const aToB = await saveFor(A, "B", "a2b");
  r = await takeIn(Bp, aToB);
  ok(/taken in, from device A/.test(r.txt), "B takes A's changes in: " + r.txt);
  const stock = await Promise.all([A, Bp].map(p => p.evaluate(id => E.books.state().items[id].stock, cd)));
  ok(stock[0] === 16 && stock[1] === 16, "both count 16 CDs: 20, less A's sale of 1 and B's sale of 3 (" + stock.join(", ") + ")");
  const note = await Promise.all([A, Bp].map(p => p.evaluate(() => E.books.state().settings.receiptNote)));
  ok(note[0] === note[1], "both keep the same receipt note (" + note[0] + ")");
  r = await takeIn(Bp, aToB);
  ok(/Nothing new/.test(r.txt), "the same file taken in twice brings nothing new");
  await settings(Bp);
  const bRow = (await rows(Bp))[0];
  ok(/has every change this device holds/i.test(bRow) || /changes? to carry/.test(bRow), "B says what A still lacks of B's (" + bRow + ")");
  r = await takeIn(A, joinFile);
  ok(/joining file/.test(r.txt), "a joining file taken in as changes is turned away, with where to open it");
  const bTo2 = await saveFor(Bp, "A", "b2a2");
  r = await takeIn(A, bTo2);
  list = await rows(A);
  ok(/It has every change this device holds/.test(list[1]), "once B has sent back what it took, A sees B in step with it (" + list[1] + ")");

  console.log("Naming, cancelling an invitation, removing a device");
  await settings(A);
  await A.click('#devList [data-name="A"]'); await A.waitForSelector("#devRename");
  await A.fill("#devRename", "Counter PC"); await A.click("#devRenameSave"); await wait(A, 400);
  ok(/^A:Device A · Counter PC · This device/.test((await rows(A))[0]), "the owner names this device: Counter PC");
  await A.click("#devAdd"); await A.waitForSelector("#devName");
  await A.fill("#devName", "Spare tablet"); await A.fill("#devPw", OWNER_PW); await A.click("#devPrepare");
  await A.waitForSelector("#devCode", { timeout: 30000 });
  const code2 = (await A.$$eval("#devCode .mg-g", gs => gs.map(g => g.textContent))).join("");
  const join2 = await saved(A, () => A.click("#devSaveJoin"), "join2");
  await A.click("#devDone"); await wait(A, 300);
  ok(/^C:Device C · Spare tablet Invited/.test((await rows(A))[2]), "a second invitation reserves the next letter, C");
  await A.click('#devList [data-remove="C"]'); await A.waitForSelector(".layer .dialog");
  await A.click(".layer .dialog button.danger, .layer .dialog .key.danger"); await wait(A, 500);
  ok(/^C:Device C · Spare tablet Invitation cancelled/.test((await rows(A))[2]), "the owner cancels it");
  const Cp = await device();
  await Cp.click("#introJoin"); await Cp.waitForSelector("#joinPick");
  await Cp.setInputFiles("#joinFile", join2.path); await Cp.waitForSelector("#joinCode");
  await Cp.fill("#joinCode", code2); await Cp.click("#joinGo"); await Cp.waitForSelector("#ldName", { timeout: 60000 });
  await Cp.fill("#ldName", "Yannie"); await Cp.fill("#ldPw", OWNER_PW); await Cp.click("#ldGo"); await Cp.waitForSelector(".shell", { timeout: 60000 });
  const cToA = await saveFor(Cp, "A", "c2a");
  r = await takeIn(A, cToA);
  ok(/was removed from the store/.test(r.txt), "a device that joined with a cancelled invitation (it could not know) is refused when its changes come: " + r.txt);
  await settings(A);
  await A.click('#devList [data-remove="B"]'); await A.waitForSelector(".layer .dialog");
  ok(/Remove device B\?/.test(await A.textContent(".layer .dialog")), "removing B asks first");
  await A.click(".layer .dialog button.danger, .layer .dialog .key.danger"); await wait(A, 500);
  ok(/^B:Device B · Mac mini Removed on/.test((await rows(A))[1]), "B is removed");
  await Bp.evaluate(id => E.books.completeSale([{ itemId: id, qty: 1 }], 5000), cd);
  const bLate = await saveFor(Bp, "A", "b-late");
  r = await takeIn(A, bLate);
  ok(/Device B was removed from the store/.test(r.txt), "B's changes are no longer taken in: " + r.txt);
  ok(await A.evaluate(() => E.books.verify().then(x => x.ok)), "and A's books stay whole: Verify passes");

  console.log("The practice store, three languages, a phone");
  const P = await device();
  await P.evaluate(() => E.books.openPractice().then(() => E.app.opened(true))); await P.waitForSelector(".shell", { timeout: 90000 });
  await P.evaluate(() => E.ui.go("settings")); await P.waitForSelector("#set-devices");
  ok(await P.locator("#devAdd").count() === 0 && /practice store stays on each device alone/.test(await P.textContent("#set-devices")), "the practice store explains, and offers no device to add");
  for (const l of ["fr", "ht"]) {
    await A.evaluate(l => { E.setLang(l); E.ui.shell(); E.ui.go("settings"); }, l); await wait(A, 300);
    await A.evaluate(() => E.ui.go("guide"));
    await A.evaluate(() => { const b = document.querySelector('.guide-key[data-a="devices"]'); if (b) b.click(); }); await wait(A, 200);
  }
  await A.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  const missing = await A.evaluate(() => Object.keys(E.missing));
  ok(missing.length === 0, "every word is in French and Kreyòl" + (missing.length ? ": " + missing.slice(0, 5).join(", ") : ""));
  ok(await A.evaluate(() => { E.ui.go("guide"); return !!document.querySelector('.guide-key[data-a="devices"]'); }), "the Guidebook has a chapter, Devices in step");
  const Ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const ph = await Ph.newPage(); ph.on("pageerror", e => errors.push(e.message));
  await ph.goto(PAGE); await ph.waitForSelector("#introProtect", { timeout: 20000 });
  ok(await ph.locator("#introJoin").isVisible(), "on a phone the door offers to join too");
  await ph.click("#introJoin"); await ph.waitForSelector("#joinPick");
  ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "and nothing is wider than the phone");
  await A.setViewportSize({ width: 390, height: 844 }); await settings(A);
  ok(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth && Array.prototype.every.call(document.querySelectorAll("#devList .dev-keys button"), b => b.getBoundingClientRect().right <= innerWidth + 1)),
    "the Devices section fits a phone, its keys inside the screen");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
