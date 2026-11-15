/* LAKAY | Build 24 test: devices in step, stage 1 (the books join, with no network), and the door made sure.
   Two devices (two browsers, each with its own storage) keep one store's books. The second joins from a sealed copy of
   the first, takes a letter of its own, and starts its own chain. Both work apart, then trade sealed bundles of lines.
   Afterwards both hold the same books: stock counted by every device's moves, each field's later change kept (and the
   owner told of a field changed on both), a booking's payments from both, the people who sign in on either, and Verify
   passing on each. A third device joins from the second; a bundle carries the lines it holds of the others.
   Run: node tests/t_build24.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const ROOT = path.resolve(__dirname, ".."), PAGE = process.argv[2] || "file://" + path.join(ROOT, "app", "Lakay.html");
let failed = 0, passed = 0;
function ok(cond, what) { if (cond) { passed++; console.log("  ok   " + what); } else { failed++; console.log("  FAIL " + what); } }
const wait = (p, ms) => p.waitForTimeout(ms);
const OWNER_PW = "a long owner sentence for two devices", JEAN_PW = "Jean counts the deliveries twice";

(async () => {
  const browser = await chromium.launch();
  const errors = [], csp = [];
  async function device() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
    await p.goto(PAGE); await p.waitForSelector("#introProtect", { timeout: 20000 });
    return p;
  }
  const verify = (p) => p.evaluate(() => E.books.verify().then(r => ({ ok: r.ok, devices: r.devices, lines: r.lines, problems: r.problems.slice(0, 5) })));
  const item = (p, id) => p.evaluate(id => { const i = E.books.state().items[id]; return { stock: i.stock, price: i.price, name: i.name, cost: i.cost }; }, id);
  const info = (p) => p.evaluate(() => E.books.syncInfo());
  const trade = async (from, to) => {
    const have = (await info(to)).have;
    const text = await from.evaluate(h => E.books.makeBundle(h), have);
    return { text, rep: await to.evaluate(t => E.books.takeBundle(t).then(r => r, e => ({ error: e.code, extra: e.extra })), text) };
  };
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  /* the store as both devices should agree on it */
  const books = (p) => p.evaluate(() => {
    const st = E.books.state(), pick = (o, ks) => ks.reduce((m, k) => (m[k] = o[k], m), {});
    return JSON.stringify({
      items: Object.keys(st.items).sort().map(k => pick(st.items[k], ["id", "name", "price", "cost", "stock", "archived"])),
      sales: st.sales.map(s => s.no).sort(),
      users: Object.keys(st.users).sort().map(k => pick(st.users[k], ["id", "no", "name", "access", "active"])),
      bookings: (st.bookings || []).map(b => ({ id: b.id, status: b.status, pays: (b.pays || []).map(x => x.id + ":" + x.status).sort() })).sort((a, b) => a.id < b.id ? -1 : 1),
      receiptNote: st.settings.receiptNote, storeName: st.settings.storeName,
      devices: Object.keys(st.devices || {}).sort().map(k => st.devices[k].code) });
  });

  console.log("Device A: a store of its own, with the stamps of Build 24");
  const A = await device();
  await A.evaluate(pw => E.books.prepareSetup({ storeName: "Lakay Two Devices", ownerName: "Yannie", password: pw, currency: "USD" }).then(h => h.finish()).then(() => E.app.opened()), OWNER_PW);
  await A.waitForSelector(".shell", { timeout: 60000 });
  const ids = await A.evaluate(pw => {
    const B = E.books, out = {};
    return B.addItem({ name: "Kompa classics, volume 3 (CD)", cat: "music", price: 1299, cost: 650, openingStock: 20, reorderAt: 4, taxId: null, barcode: "" }).then(i => { out.cd = i.id;
      return B.addItem({ name: "Vetiver eau de parfum", cat: "perfume", price: 3500, cost: 1800, openingStock: 10, reorderAt: 2, taxId: null, barcode: "" }); }).then(i => { out.pf = i.id;
      return B.addPerson({ name: "Marie", access: ["sell"], preset: "cashier", password: "Marie's first password here" }, pw); }).then(u => { out.marie = u.id;
      return B.completeSale([{ itemId: out.cd, qty: 1 }], 5000); }).then(() =>
      B.addBooking({ from: "MIA", to: "PAP", depart: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10), ret: null, pax: 1, site: "an airline's site", code: "QX7P2M", ticket: 40000, fee: 3000, note: "" }, { amount: 10000, method: "cash" })).then(b => { out.bk = b.id; return out; });
  }, OWNER_PW);
  const ln = await A.evaluate(() => E.books.lines().then(l => l.find(x => x.type === "sale.completed")));
  ok(ln && ln.ts > 0 && Array.isArray(ln.w) && ln.w.some(e => /^sale:/.test(e[0])) && ln.sd && ln.sd[Object.keys(ln.sd)[0]] === -1, "a line now carries its time, the records it wrote, and the stock it moved (" + JSON.stringify(ln && ln.sd) + ")");
  ok(ln && !ln.w.some(e => /^counter:/.test(e[0])), "but never the device's own counters");
  const iA = await info(A);
  ok(iA.device.code === "A" && iA.devices.length === 1, "this device is A, alone in the store's books");
  const v0 = await verify(A);
  ok(v0.ok && v0.devices === 1, "Verify passes, one device (" + v0.lines + " lines)");
  const backup = await A.evaluate(() => E.books.makeBackup());
  ok(JSON.parse(backup).device && JSON.parse(backup).device.code === "A", "a sealed backup says which device made it");

  console.log("Device B joins from the copy");
  const B = await device();
  const joined = await B.evaluate(([t, pw]) => E.books.readBackup(t).then(body => E.books.joinFromBackup(body, pw, false, "Mac mini")).then(() => { E.app.opened(); return { code: E.books.device.code, user: E.books.user.id }; }, e => ({ error: e.code })), [backup, OWNER_PW]);
  ok(joined.code === "B" && joined.user === "owner", "B joins with the owner's password, takes the letter B, and opens as the owner (" + JSON.stringify(joined) + ")");
  await B.waitForSelector(".shell", { timeout: 60000 });
  const iB = await info(B);
  ok(iB.devices.map(d => d.code).join() === "A,B" && iB.devices.find(d => d.code === "B").name === "Mac mini", "B's books know both devices, B by the name it was given");
  const first = await B.evaluate(() => E.books.lines().then(l => l.filter(x => x.code === "B").map(x => x.type)));
  ok(first.length === 1 && first[0] === "device.joined", "B's own chain starts with one line saying where it came from");
  const vB = await verify(B);
  ok(vB.ok && vB.devices === 2, "Verify on B checks A's chain and its own (" + JSON.stringify(vB.problems) + ")");
  ok(JSON.stringify(await item(B, ids.cd)) === JSON.stringify(await item(A, ids.cd)), "B holds the same stock as A: 19 CDs");
  const again = await B.evaluate(([t, pw]) => E.books.readBackup(t).then(body => E.books.joinFromBackup(body, pw, false, "x")).then(() => "joined", e => e.code), [backup, OWNER_PW]);
  ok(again === "hasstore", "a device that already holds a store cannot join over it");

  console.log("Working apart");
  /* A: sells 2 CDs, changes the CD's price, takes a payment on the booking, writes the receipt note */
  await A.evaluate(([ids]) => { const B = E.books;
    return B.completeSale([{ itemId: ids.cd, qty: 2 }], 5000).then(() => B.editItem(ids.cd, { price: 1399 })).then(() => B.payBooking(ids.bk, { amount: 5000, method: "cash", ref: "" }))
      .then(() => B.updateSettings({ receiptNote: "Mèsi anpil from A" })); }, [ids]);
  await wait(A, 30);
  /* B: sells 3 CDs, receives 5 perfumes, renames the CD, takes another payment on the booking, adds Jean, and writes
     the receipt note a moment later */
  const jean = await B.evaluate(([ids, pw, jpw]) => { const B = E.books; let jean;
    return B.completeSale([{ itemId: ids.cd, qty: 3 }], 5000).then(() => B.receive(ids.pf, 5, 1700, "Port-au-Prince supplier", "")).then(() => B.editItem(ids.cd, { name: "Kompa classics 3 (CD)" }))
      .then(() => B.payBooking(ids.bk, { amount: 7000, method: "cash", ref: "" })).then(() => B.addPerson({ name: "Jean", access: ["sell", "receive"], preset: "custom", password: jpw }, pw)).then(u => { jean = u.id; })
      .then(() => B.updateSettings({ receiptNote: "Mèsi anpil from B" })).then(() => jean); }, [ids, OWNER_PW, JEAN_PW]);
  const saleNos = await Promise.all([A, B].map(p => p.evaluate(() => E.books.state().sales.map(s => s.no).sort())));
  ok(saleNos[0].join() === "A-000001,A-000002" && saleNos[1].join() === "A-000001,B-000002", "receipt numbers carry each device's letter, so they never meet (" + saleNos.join(" | ") + ")");
  await A.evaluate(() => { E.books.state().notes.owner = [{ id: "n1", text: "A's own sticky note", at: new Date().toISOString() }]; return E.books.saveNotes(true); });

  console.log("Trading bundles");
  const ab = await trade(A, B);
  ok(ab.rep.lines === 4 && ab.rep.chains.A === 4, "B takes A's four new lines (a sale, a price, a payment, the note) (" + JSON.stringify(ab.rep.chains || ab.rep) + ")");
  const ba = await trade(B, A);
  ok(ba.rep.lines >= 7 && ba.rep.chains.B >= 7, "A takes B's lines, from its first, and B's line saying what it took (" + JSON.stringify(ba.rep.chains || ba.rep) + ")");
  const clashA = ba.rep.clashes || [];
  ok(clashA.some(c => c.k === "settings:main" && c.f === "receiptNote" && c.won === "B"), "the receipt note, written on both while apart, is reported, and the later one (B's) stays");
  ok(!clashA.some(c => c.k === "item:" + ids.cd), "the CD's price (on A) and its name (on B) do not clash: each field keeps its own change");
  const ab2 = await trade(A, B);
  ok(ab2.rep.lines === 1, "B then takes A's one line saying what A took (" + ab2.rep.lines + ")");
  const [bkA, bkB] = await Promise.all([books(A), books(B)]);
  ok(bkA === bkB, "A and B now hold the same books");
  const cdA = await item(A, ids.cd), pfA = await item(A, ids.pf);
  ok(cdA.stock === 14 && pfA.stock === 15, "stock is counted by both devices' moves: 20 − 1 − 2 − 3 = 14 CDs, 10 + 5 = 15 perfumes (" + cdA.stock + ", " + pfA.stock + ")");
  ok(cdA.price === 1399 && cdA.name === "Kompa classics 3 (CD)", "A's new price and B's new name both stand");
  const bk = await A.evaluate(id => { const b = E.books.booking(id); return { n: b.pays.length, m: E.books.bookingMoney(b) }; }, ids.bk);
  ok(bk.n === 3 && bk.m.paid === 22000, "the booking holds the payments taken on both devices: $100 + $50 + $70 (" + bk.m.paid / 100 + ")");
  ok(JSON.parse(bkA).receiptNote === "Mèsi anpil from B", "the later receipt note is the one both keep");
  const vA2 = await verify(A), vB2 = await verify(B);
  ok(vA2.ok && vA2.devices === 2, "Verify passes on A, replaying both chains together (" + JSON.stringify(vA2.problems) + ")");
  ok(vB2.ok && vB2.devices === 2, "Verify passes on B (" + JSON.stringify(vB2.problems) + ")");
  const notesB = await B.evaluate(() => (E.books.state().notes.owner || []).length);
  ok(notesB === 0, "a person's sticky notes stay on the device where they were written");
  const doorA = await A.evaluate(() => E.db.get("meta", "door").then(d => (d.people || []).map(x => x.name).join()));
  ok(/Jean/.test(doorA), "A's door knows Jean, added on B");
  const jeanIn = await A.evaluate(([jpw]) => E.books.lock("test").then(() => E.books.signIn("Jean", jpw)).then(() => E.books.user.name, e => e.code), [JEAN_PW]);
  ok(jeanIn === "Jean", "Jean signs in on A with the first password given him on B");
  await A.evaluate(pw => E.books.lock("test").then(() => E.books.signIn("Yannie", pw)).then(() => E.app.opened()), OWNER_PW);
  await A.waitForSelector(".shell", { timeout: 60000 });

  console.log("What a bundle refuses");
  const same = await B.evaluate(t => E.books.takeBundle(t).then(r => r.lines, e => e.code), ab.text);
  ok(same === 0, "the same bundle taken twice: nothing is taken twice");
  const bad = await B.evaluate(t => { const b = JSON.parse(t); b.ct = b.ct.slice(0, -8) + "AAAAAAA="; return E.books.takeBundle(JSON.stringify(b)).then(() => "taken", e => e.code); }, ab.text);
  ok(bad === "notbundle", "a bundle changed on its way is refused");
  await A.evaluate(id => E.books.completeSale([{ itemId: id, qty: 1 }], 5000).then(() => E.books.completeSale([{ itemId: id, qty: 1 }], 5000)), ids.pf);
  const hB = (await info(B)).have, aDev = (await info(A)).device.id, pretend = Object.assign({}, hB);
  pretend[aDev] = hB[aDev] + 1;
  const gapText = await A.evaluate(h => E.books.makeBundle(h), pretend);
  ok(JSON.parse(gapText).format === "lakay-changes" && !/Lakay Two Devices|Kompa/.test(gapText), "a bundle is one sealed file of Lakay's own: nothing in it can be read without the Store Key");
  const gap = await B.evaluate(t => E.books.takeBundle(t).then(r => "taken " + r.lines, e => e.code), gapText);
  ok(gap === "gap", "a bundle that skips a line B never took is refused (" + gap + ")");
  const fill = await trade(A, B);
  ok(fill.rep.lines === 2, "a bundle made for what B holds brings exactly the two lines it lacks (" + fill.rep.lines + ")");
  const notOne = await B.evaluate(() => E.books.takeBundle("{}").then(() => "taken", e => e.code));
  ok(notOne === "notbundle", "what is not a bundle is refused");

  console.log("A third device, C, joins from B and trades with A directly");
  const copyB = await B.evaluate(() => E.books.makeBackup());
  const Cd = await device();
  const cj = await Cd.evaluate(([t, pw]) => E.books.readBackup(t).then(body => E.books.joinFromBackup(body, pw, false, "the owner's iPhone")).then(() => { E.app.opened(); return E.books.device.code; }, e => "error " + e.code), [copyB, OWNER_PW]);
  ok(cj === "C", "C takes the next letter (" + cj + ")");
  await Cd.waitForSelector(".shell", { timeout: 60000 });
  const vC = await verify(Cd);
  ok(vC.ok && vC.devices === 3, "C holds A's chain and B's, and its own; Verify passes (" + JSON.stringify(vC.problems) + ")");
  await Cd.evaluate(id => E.books.completeSale([{ itemId: id, qty: 4 }], 9000), ids.cd);
  const ca = await trade(Cd, A);
  ok(ca.rep.chains && ca.rep.chains.C >= 2, "A, which has never seen C, takes C's chain from its first line (" + JSON.stringify(ca.rep.chains || ca.rep) + ")");
  const ab3 = await trade(A, B);
  ok(ab3.rep.chains && ab3.rep.chains.C >= 2, "B takes C's lines from A: a bundle carries the lines a device holds of the others (" + JSON.stringify(ab3.rep.chains || ab3.rep) + ")");
  const bc = await trade(B, Cd);
  ok(!bc.rep.error, "C takes what it lacks from B" + (bc.rep.error ? ": " + bc.rep.error : ""));
  const all3 = await Promise.all([A, B, Cd].map(books));
  ok(all3[0] === all3[1] && all3[1] === all3[2], "A, B and C hold the same books");
  ok((await item(Cd, ids.cd)).stock === 10, "10 CDs left on every device");
  const v3 = await Promise.all([A, B, Cd].map(verify));
  ok(v3.every(v => v.ok && v.devices === 3), "Verify passes on all three (" + v3.map(v => v.devices + ":" + JSON.stringify(v.problems)).join(" | ") + ")");

  console.log("Two devices joined from the same copy");
  const copyA = await A.evaluate(() => E.books.makeBackup());
  const join = (p, t) => p.evaluate(([t, pw]) => E.books.readBackup(t).then(body => E.books.joinFromBackup(body, pw, false, "")).then(() => E.books.device.code, e => "error " + e.code), [t, OWNER_PW]);
  const D1 = await device(), D2 = await device();
  const j1 = await join(D1, copyA), j2 = await join(D2, copyA);
  ok(j1 === "D" && j2 === "D", "each takes the next letter it can see, D, since neither knows of the other (" + j1 + ", " + j2 + ")");
  const t1 = await trade(D1, A);
  ok(!t1.rep.error && t1.rep.chains && t1.rep.chains.D === 1, "A takes the first one's line");
  const t2 = await trade(D2, A);
  ok(t2.rep.error === "letter" && t2.rep.extra === "D", "A refuses the second: two devices may never share a letter (" + JSON.stringify(t2.rep) + ")");
  ok((await verify(A)).ok, "and A's books stay whole");

  console.log("The door: the store opens even when the clock in fails");
  const opened = await A.evaluate(() => {
    const B = E.books, real = B.clockIn;
    B.clockIn = () => Promise.reject(new Error("the clock in failed, on purpose"));
    return E.door.arrive().then(() => { B.clockIn = real; return !!document.querySelector(".shell"); }, e => { B.clockIn = real; return "rejected " + e.message; });
  });
  ok(opened === true, "a clock in that fails no longer keeps the store shut");
  const t0 = Date.now();
  const opened2 = await A.evaluate(() => {
    const B = E.books, real = B.clockIn, isOwner = B.isOwner;
    B.clockIn = () => new Promise(() => { }); B.isOwner = () => false;
    return E.door.arrive().then(() => { B.clockIn = real; B.isOwner = isOwner; return true; });
  });
  ok(opened2 === true && Date.now() - t0 < 20000, "a clock in that never answers waits fifteen seconds at most (" + Math.round((Date.now() - t0) / 1000) + " s)");

  console.log("The cursor stays where the person types");
  const keep = await A.evaluate(() => new Promise(res => {
    const ui = E.ui, U = E.util;
    const d = ui.dialog({ title: "Test", body: [U.h("input#tA"), U.h("input#tB")], actions: [{ label: "OK" }], focus: "#tA" });
    const b = document.getElementById("tB"); b.focus();
    setTimeout(() => { const where = document.activeElement && document.activeElement.id; d.close(); res(where); }, 120);
  }));
  ok(keep === "tB", "a window that opens does not pull the cursor back to its first field once the person has moved on (" + keep + ")");

  console.log("The owner's requests of 15 November: the papers, the rail, the Studio, the Home");
  const P = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pp = await P.newPage(); pp.on("pageerror", e => errors.push(e.message));
  await pp.goto(PAGE); await pp.waitForSelector("#introEnter", { timeout: 20000 });
  await pp.evaluate(() => { E.util.prefSet("theme", "day"); E.util.prefSet("tips", "0"); });
  await pp.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await pp.waitForSelector(".shell", { timeout: 90000 });
  await pp.evaluate(() => E.ui.go("home")); await wait(pp, 900);
  /* the papers */
  await pp.click("#rail-notes"); await pp.waitForSelector(".sn-panel");
  const made = await pp.evaluate(() => { const b = Array.prototype.find.call(document.querySelectorAll(".sn-panel button"), x => /New note/.test(x.textContent)); if (b) b.click(); return !!b; });
  await wait(pp, 400); await pp.keyboard.press("Escape"); await wait(pp, 300);
  await pp.click('.sticky-note .sn-iconbtn[aria-label="Menu"]'); await pp.waitForSelector(".sn-menu");
  const dots = await pp.$$eval(".sn-menu .sn-dot", ds => ds.map(d => d.getAttribute("data-sn-col")));
  ok(made && dots.join() === "citrine,larimar,aquamarine,rosequartz,jade,moonstone,pearl", "seven papers: Carpe Diem's light blue is back, as Larimar, beside Citrine (" + dots.join(", ") + ")");
  await pp.click('.sn-menu .sn-dot[data-sn-col="larimar"]'); await wait(pp, 300);
  const lar = await pp.evaluate(() => getComputedStyle(document.querySelector(".sticky-note")).backgroundImage);
  ok(/rgb\(220, 239, 255\)/.test(lar) && /rgb\(182, 224, 255\)/.test(lar), "a Larimar note wears Carpe Diem's own light blue by day, #dcefff to #b6e0ff");
  await pp.hover('.sn-menu .sn-dot[data-sn-col="larimar"]'); await wait(pp, 300);
  const tipDay = await pp.evaluate(() => { const t = document.getElementById("name-tip"); return t && getComputedStyle(t).display !== "none" ? { text: t.innerText.replace(/\s+/g, " ").trim(), chip: !!t.querySelector(".nt-chip") } : null; });
  ok(tipDay && tipDay.text === "Larimar sky blue" && tipDay.chip, "resting the pointer on a swatch shows its name and its colour, with a chip of the paper, as in Carpe Diem (" + JSON.stringify(tipDay) + ")");
  ok(await pp.getAttribute('.sn-menu .sn-dot[data-sn-col="larimar"]', "title") === null, "and the browser's own small tooltip does not show over it");
  await pp.evaluate(() => { E.util.prefSet("theme", "night"); E.ui.applyLook(); }); await wait(pp, 200);
  await pp.mouse.move(5, 5); await wait(pp, 100); await pp.hover('.sn-menu .sn-dot[data-sn-col="larimar"]'); await wait(pp, 300);
  const night = await pp.evaluate(() => ({ note: getComputedStyle(document.querySelector(".sticky-note")).backgroundColor, tip: (document.getElementById("name-tip") || {}).innerText }));
  ok(night.note === "rgb(31, 42, 61)" && /midnight blue/.test(night.tip || ""), "by night the note is Carpe Diem's midnight paper #1f2a3d, and the tip says midnight blue (" + night.note + ")");
  await pp.keyboard.press("Escape"); await pp.mouse.click(700, 300); await wait(pp, 200);
  await pp.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); E.ui.refreshTop(); E.ui.go("home"); }); await wait(pp, 700);
  /* the rail */
  const railKeys = await pp.$$eval("#rail .rail-btn", bs => bs.map(b => b.id));
  ok(railKeys.join() === "rail-notes,rail-calc,rail-sale,rail-find,rail-theme", "the rail, from its foot: the notes, the calculator directly under the cart, the cart, price check, and the Sun and Moon (" + railKeys.join(", ") + ")");
  ok(await pp.locator("#topCluster #calcBtn").count() === 0, "the calculator is no longer in the top bar");
  ok((await pp.textContent("#rail-theme")).trim() === "🌙", "by day the lamp key shows the Moon");
  await pp.click("#rail-theme"); await wait(pp, 300);
  ok(await pp.evaluate(() => document.documentElement.getAttribute("data-theme")) === "night" && (await pp.textContent("#rail-theme")).trim() === "☀️", "a press brings the night, and the key then shows the Sun");
  await pp.click("#rail-theme"); await wait(pp, 300);
  ok(await pp.evaluate(() => document.documentElement.getAttribute("data-theme")) === "day", "and a second press brings the day back");
  await pp.hover("#rail-calc"); await wait(pp, 300);
  ok(/Calculator/.test(await pp.evaluate(() => (document.getElementById("name-tip") || {}).innerText || "")), "the side keys show their names in the same tip");
  await pp.mouse.move(5, 5);
  /* the Author Studio */
  ok(await pp.locator('.nav-btn[data-room="studio"]').count() === 0 && await pp.locator('.hm-tile[data-room="studio"]').count() === 0, "the practice store (and so the website) shows no Author Studio");
  ok(await pp.evaluate(() => { E.ui.go("studio"); return E.ui.current; }) === "home", "and its address leads home");
  ok(await pp.evaluate(() => E.books.saveCustom({ names: { app: "Not mine" } }, ["names.app"]).then(() => "saved", e => e.code)) === "denied", "the books refuse the Studio's changes from the practice store");
  ok(await pp.evaluate(() => { E.ui.go("guide"); return !document.querySelector('.guide-key[data-a="studio"]'); }), "and the Guidebook leaves out its chapter");
  ok(await A.locator('.nav-btn[data-room="studio"]').count() === 1, "the owner of the store's own books still has it");
  const staffSees = await A.evaluate(([jpw, pw]) => E.books.lock("test").then(() => E.books.signIn("Jean", jpw)).then(() => { const r = E.ui.allowed("studio"); return E.books.lock("test").then(() => E.books.signIn("Yannie", pw)).then(() => r); }), [JEAN_PW, OWNER_PW]);
  ok(staffSees === false, "no one on the staff may open it");
  /* the Home */
  await pp.evaluate(() => E.ui.go("home")); await wait(pp, 900);
  const reads = await pp.$$eval(".ct-window .ct-read", rs => rs.map(r => r.tagName + "#" + r.id));
  ok(reads.join() === "BUTTON#hxTaken,BUTTON#hxSales,BUTTON#hxProfit,BUTTON#hxLow", "every figure on the card is a key (" + reads.join(", ") + ")");
  ok(await pp.$$eval(".hm-chips button.hm-chip", b => b.length) === 2 && await pp.locator(".ct-hero button.hx-date").count() === 1, "and so are the chips and the date");
  const win = await pp.locator(".ct-window").boundingBox();
  await pp.mouse.move(win.x + win.width * .85, win.y + win.height * .2); await wait(pp, 300);
  const leanT = await pp.evaluate(() => { const w = document.querySelector(".ct-window"); return { lean: w.classList.contains("leaning"), ry: parseFloat(w.style.getPropertyValue("--ry")), tf: getComputedStyle(w).transform }; });
  ok(leanT.lean && leanT.ry > 1 && /matrix3d/.test(leanT.tf), "the card of the figures stands out in depth and leans toward the pointer (" + leanT.ry + "°)");
  await pp.mouse.move(5, 5); await wait(pp, 600);
  await pp.click("#hxTaken"); await wait(pp, 500);
  ok(await pp.evaluate(() => E.ui.current + ":" + E.reports.period) === "reports:today", "Taken today opens the day's report");
  await pp.evaluate(() => E.ui.go("home")); await wait(pp, 700);
  await pp.click("#hxLow"); await wait(pp, 500);
  ok(await pp.evaluate(() => E.ui.current + ":" + E.inventory.filter) === "inventory:low", "Low on stock opens the items running low");
  await pp.evaluate(() => E.ui.go("home")); await wait(pp, 700);
  await pp.click(".ct-hero button.hx-date"); await wait(pp, 500);
  ok(await pp.evaluate(() => E.ui.current) === "schedule", "the date opens the Schedule");
  await pp.evaluate(() => E.ui.go("home")); await wait(pp, 700);
  await pp.click(".hm-chips li:nth-child(2) button.hm-chip"); await wait(pp, 500);
  ok(await pp.evaluate(() => E.ui.current) === "team", "the clock chip opens the Team");
  await pp.evaluate(() => E.ui.go("home")); await wait(pp, 700);
  await pp.click("#hxSales"); await wait(pp, 900);
  ok(await pp.evaluate(() => { const s = document.querySelector(".hm-sales"), r = s.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), "Sales today brings the latest sales into view");
  const keys = await pp.evaluate(() => { const f = getComputedStyle(document.querySelector("#homeSale .ct-key-face")), e = getComputedStyle(document.querySelector("#homeSale .ct-key-emo")), k = getComputedStyle(document.querySelector("#homeSale"), "::before");
    return { radius: f.borderTopLeftRadius, skirt: k.content, ring: e.borderTopWidth, emoBg: e.backgroundImage, ledge: /0px 2\.5px 0px/.test(f.boxShadow) }; });
  ok(keys.radius === "12px" && (keys.skirt === "none" || keys.skirt === "normal") && keys.ledge, "the keys are sharp acrylic: a 12-point corner, a thin ledge, no soft skirt beneath (" + JSON.stringify(keys) + ")");
  ok(keys.ring === "2px" && /rgb\(255, 255, 255\)/.test(keys.emoBg), "the cart sits in a pale pearl window ringed in periwinkle, so that it shows clearly");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
