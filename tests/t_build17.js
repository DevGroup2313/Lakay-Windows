/* LAKAY | Build 17 test: Learning. A room of lessons in the menu, each with its tour, its chapter and two questions;
   a guided tour that lights one thing at a time and, where a lesson shows the work, presses Lakay's own keys and types
   as a person would. In the practice store a tour finishes the sale; in the store itself it stops before anything is
   written in the books, closes what it opened and puts the sale at the Register back as it was. Answering a lesson's
   questions keeps a mark in the books, which Verify replays; the owner sees the team's marks. Show me in the rooms'
   headings; a tip at the foot of each room, which Display can hide; a cashier's own lessons and the Home's reminder of
   them. Every word is in French and Kreyòl; the room fits a phone.
   Run: node tests/t_build17.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
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
  const go = async (room) => { await p.evaluate(r => E.ui.go(r), room); await wait(p, 300); };
  const seq = () => p.evaluate(() => E.books.state().head.seq);
  /* waits until the tour can go on (its demonstration done), then answers where it is */
  const settle = (pg) => (pg || p).waitForFunction(() => !E.tour.active() || !document.getElementById("tourNext").disabled, null, { timeout: 20000 }).then(() => (pg || p).evaluate(() => E.tour.current()));
  /* runs a tour to its end with Next, noting the steps; returns them */
  async function through(pg, id, onStep) {
    await pg.evaluate(i => E.tour.start(i), id);
    const steps = [];
    for (let k = 0; k < 30; k++) {
      const cur = await settle(pg); if (!cur) break;
      steps.push(cur.step);
      if (onStep) await onStep(cur);
      if (!(await pg.evaluate(() => E.tour.active()))) break;
      await pg.evaluate(() => E.tour.next()); await pg.waitForTimeout(120);
    }
    await pg.waitForTimeout(300);
    return steps;
  }
  /* answers a lesson's questions: first a wrong answer, then the right one, as told */
  async function answer(pg, id, wrongFirst) {
    for (let n = 1; n <= 2; n++) {
      const right = await pg.evaluate(k => E.t(k), "quiz." + id + "." + n + ".a"), wrong = await pg.evaluate(k => E.t(k), "quiz." + id + "." + n + ".b");
      if (wrongFirst && n === 1) { await pg.locator(".quiz-opt", { hasText: wrong }).click(); await pg.waitForTimeout(120); }
      await pg.locator(".quiz-opt", { hasText: right }).click(); await pg.waitForTimeout(120);
      await pg.click("#quizNext"); await pg.waitForTimeout(250);
    }
  }

  await p.goto(PAGE); await p.waitForSelector("#introEnter", { timeout: 20000 });
  await p.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await p.waitForSelector(".shell", { timeout: 90000 });
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); E.tour.speed = 0.25; });

  console.log("The Learning room");
  ok(await p.locator('.nav-btn[data-room="learn"]').count() === 1, "the menu has Learning");
  ok(await p.evaluate(() => { const b = document.querySelector('.nav-btn[data-room="learn"]'), g = document.querySelector('.nav-btn[data-room="guide"]'); return b.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING; }), "under Learn, before the Guidebook");
  await go("learn");
  ok((await p.textContent("main#room h1")).includes("Learning"), "the room is called Learning");
  ok(await p.locator("#learnList .lesson").count() === 8, "the owner has eight lessons");
  ok(/0 of 8 done/.test(await p.textContent("#learnCount")), "none done yet: 0 of 8");
  ok(await p.locator('#learnList .lesson [data-act="tour"]').count() === 8 && await p.locator('#learnList .lesson [data-act="read"]').count() === 8 && await p.locator('#learnList .lesson [data-act="quiz"]').count() === 8,
    "each lesson has Show me, Read and Questions");
  ok(await p.locator("#learnNext").getAttribute("data-lesson") === "welcome", "the next lesson is the welcome");
  /* Build 19: the team's table is under its own tab */
  await p.click("#lrnTab-team"); await wait(p, 250);
  const team = await p.$$eval("#learnPeople tbody tr", rs => rs.map(r => r.textContent));
  ok(team.length === 3 && team.some(x => /Marie/.test(x) && /2 \/ 5/.test(x)) && team.some(x => /Jean/.test(x) && /6 \/ 7/.test(x)), "the team's lessons: Marie 2 of 5, Jean 6 of 7 (" + team.length + " people)");
  ok(await p.locator("#learnPeople .learn-mark.on").count() === 8, "each finished lesson is marked, the rest are not");
  await p.click("#lrnTab-lessons"); await wait(p, 250);
  ok(await p.locator("#learnTips details").count() >= 8, "every tip, room by room");
  await p.click('#learnList .lesson[data-lesson="sale"] [data-act="read"]'); await p.waitForSelector(".learn-read");
  ok((await p.textContent(".layer h2")).includes(await p.evaluate(() => E.t("guide.sale.t"))), "Read opens the lesson's chapter of the Guidebook");
  await p.keyboard.press("Escape"); await wait(p, 200);
  await go("home");
  const tiles = await p.$$eval(".hm-tile", t => t.map(x => x.getAttribute("data-room")));
  ok(tiles.indexOf("learn") >= 0 && /lessons done/.test(await p.textContent('.hm-tile[data-room="learn"]')), "the Home has a drawer for Learning, with the lessons done");

  console.log("Show me, and the tip at the foot of each room");
  const keys = {};
  for (const r of ["register", "inventory", "reports", "team", "settings", "guide", "studio"]) { await go(r); keys[r] = await p.evaluate(() => { const k = document.querySelector(".room-head #showMe"); return k ? k.getAttribute("data-tour") : null; }); }
  ok(keys.register === "sale" && keys.inventory === "stock" && keys.reports === "reports" && keys.team === "clock" && keys.settings === "safe" && !keys.guide && !keys.studio,
    "Show me in the headings of the rooms that have a tour (" + JSON.stringify(keys) + ")");
  await go("register");
  ok(await p.locator("main#room #tipStrip").count() === 1, "a tip at the foot of the Register");
  const tip1 = await p.textContent("#tipText"); await p.click("#tipMore"); const tip2 = await p.textContent("#tipText");
  ok(tip1 !== tip2 && tip2.length > 10, "Another tip shows the next one");
  await go("inventory"); const tipA = await p.textContent("#tipText");
  await p.click("#invTab-music"); await wait(p, 250);
  ok(await p.textContent("#tipText") === tipA, "a room drawn again keeps its tip");
  await p.click("#tipHide"); await wait(p, 250);
  ok(await p.locator("#tipStrip").count() === 0, "the cross hides the tips");
  await go("home"); ok(await p.locator("#tipStrip").count() === 0, "in every room");
  await p.click("#displayBtn"); await p.waitForSelector(".display-rows");
  const tipsRow = p.locator(".display-row", { hasText: "Tips in each room" });
  ok(await tipsRow.count() === 1, "Display has Tips in each room");
  await tipsRow.locator('[data-v="1"]').click(); await p.keyboard.press("Escape"); await wait(p, 300);
  ok(await p.locator("#tipStrip").count() === 1, "and turns them on again");

  console.log("A tour in the practice store: Making a sale");
  await go("register");
  await p.evaluate(() => E.register.setLines([]));
  const before = await seq();
  let handSeen = false, receiptLit = false, realNote = 0;
  await p.evaluate(() => E.tour.start("sale"));
  ok(await p.locator("#tour .tour-bubble").count() === 1 && await p.locator("#tour .tour-spot").count() === 1, "the tour lights one thing and says what it is");
  ok(await p.getAttribute("#tourBubble", "role") === "dialog" && /Step 1 of/.test(await p.textContent("#tourTitle")), "its bubble is a labelled dialog that counts the steps");
  for (let k = 0; k < 6; k++) { await wait(p, 120); if (await p.evaluate(() => !document.querySelector(".tour-hand").hidden)) { handSeen = true; break; } }
  ok(handSeen, "a pointer moves to the keys and does the work");
  for (let k = 0; k < 20; k++) {
    const cur = await settle(); if (!cur) break;
    const text = await p.textContent("#tourText");
    if (/receipt shows each item/.test(text)) receiptLit = await p.evaluate(() => { const s = document.querySelector(".tour-spot"); return !s.classList.contains("none") && !!document.querySelector(".layer .receipt"); });
    realNote += await p.locator("#tourReal").count();
    if (await p.locator("#tourTurn").count()) {
      ok(/Skip/.test(await p.textContent("#tourNext")) && /Your turn/.test(await p.textContent("#tourTurn")), "the person's turn: the key says Skip until it is done");
      const it = await p.evaluate(() => Object.keys(E.books.state().items).find(k => E.books.state().items[k].stock > 2));
      await p.evaluate(id => E.register.add(id), it); await wait(p, 500);
      ok(/Well done/.test(await p.textContent("#tourTurn")) && /Finish/.test(await p.textContent("#tourNext")), "and says Well done once it is");
    }
    await p.evaluate(() => E.tour.next()); await wait(p, 120);
  }
  await wait(p, 400);
  ok(await seq() === before + 1, "in the practice store, the tour finished the sale: one line in the books");
  const sale = await p.evaluate(() => { const s = E.books.state().sales; return s[s.length - 1]; });
  ok(sale.lines.length === 1 && sale.lines[0].qty === 2 && sale.pay[0].method === "cash", "two of one item, paid in cash");
  ok(receiptLit, "the receipt was lit");
  ok(realNote === 0, "no 'nothing is written' note in the practice store");
  ok(await p.evaluate(() => E.register.ticket.lines.length) === 0, "the sale at the Register is back as it was: empty");
  ok(await p.locator("#tourQuiz").count() === 1, "at the end, the questions are offered");

  console.log("The questions");
  await p.click("#tourQuiz"); await p.waitForSelector("#quizQ");
  ok(/Question 1 of 2/.test(await p.textContent(".quiz-n")) && await p.locator(".quiz-opt").count() === 3, "two questions, three answers each");
  ok(await p.$eval("#quizNext", b => b.disabled), "Next waits for the right answer");
  await p.locator(".quiz-opt", { hasText: await p.evaluate(() => E.t("quiz.sale.1.b")) }).click(); await wait(p, 150);
  ok(await p.locator(".quiz-opt.wrong").count() === 1 && /Not quite/.test(await p.textContent("#quizWhy")) && await p.$eval("#quizNext", b => b.disabled), "a wrong answer: Not quite, try again");
  await p.locator(".quiz-opt", { hasText: await p.evaluate(() => E.t("quiz.sale.1.a")) }).click(); await wait(p, 150);
  ok(await p.locator(".quiz-opt.right").count() === 1 && /^Right\./.test(await p.textContent("#quizWhy")) && !(await p.$eval("#quizNext", b => b.disabled)), "the right answer says why, and opens the next");
  await p.click("#quizNext"); await wait(p, 200);
  ok(/Question 2 of 2/.test(await p.textContent(".quiz-n")) && /Finish the lesson/.test(await p.textContent("#quizNext")), "the last question finishes the lesson");
  const b2 = await seq();
  await p.locator(".quiz-opt", { hasText: await p.evaluate(() => E.t("quiz.sale.2.a")) }).click(); await wait(p, 120);
  await p.click("#quizNext"); await wait(p, 500);
  ok(await seq() === b2 + 1 && await p.locator("#quiz").count() === 0, "the lesson's mark is written in the books");
  const mark = await p.evaluate(() => E.books.trainingOf().done.sale);
  ok(mark && mark.score === 1 && mark.of === 2, "1 of 2 right the first time (" + JSON.stringify(mark) + ")");
  const line = await p.evaluate(() => E.books.lines(l => l.type === "training.completed").then(ls => ls[0]));
  ok(line && line.data.lesson === "sale" && line.data.user === "owner" && line.data.score === 1, "the ledger says who finished which lesson");
  await go("learn");
  ok(/1 of 8 done/.test(await p.textContent("#learnCount")) && await p.locator('.lesson[data-lesson="sale"].done .lesson-state').count() === 1, "the room counts it: 1 of 8, Making a sale done");
  const v = await p.evaluate(() => E.books.verify().then(r => r.ok ? "ok" : JSON.stringify(r.problems.slice(0, 3))));
  ok(v === "ok", "Verify replays the lessons' marks with the rest (" + v + ")");
  const forged = await p.evaluate(() => { const st = E.books.state(); st.train.owner.done.sale.score = 2; return E.books.verify().then(r => { st.train.owner.done.sale.score = 1; return r.problems.some(x => x.train === "owner" && x.what === "differs"); }); });
  ok(forged, "a mark changed outside the ledger is found by Verify");
  const bad = await p.evaluate(() => E.books.trainDone("sale", 3, 2).then(() => "kept", e => e.code));
  ok(bad === "lesson", "the books refuse a mark that cannot be");

  console.log("Escape, the keys, and what a tour leaves behind");
  await go("register");
  const it0 = await p.evaluate(() => Object.keys(E.books.state().items).find(k => E.books.state().items[k].stock > 3));
  await p.evaluate(id => E.register.setLines([{ itemId: id, qty: 3 }]), it0);
  await p.evaluate(() => E.tour.start("pay"));
  for (let k = 0; k < 3; k++) { await settle(); await p.evaluate(() => E.tour.next()); await wait(p, 120); }
  await settle();
  ok(await p.locator(".layer #cashDue").count() === 1, "the tour opened the payment window");
  await p.keyboard.press("Escape"); await wait(p, 400);
  ok(!(await p.evaluate(() => E.tour.active())) && await p.locator("#tour").count() === 0, "Escape stops the tour");
  ok(await p.locator(".layer").count() === 0, "and closes what it opened");
  const back = await p.evaluate(() => E.register.ticket.lines);
  ok(back.length === 1 && back[0].itemId === it0 && back[0].qty === 3, "the sale at the Register is put back as it was");
  await go("learn");
  await p.evaluate(() => E.tour.start("welcome")); await settle();
  await p.focus("#tourNext"); await p.keyboard.press("ArrowRight"); await settle();
  ok((await p.evaluate(() => E.tour.current())).step === 1, "the right arrow goes on");
  await p.keyboard.press("ArrowLeft"); await settle();
  ok((await p.evaluate(() => E.tour.current())).step === 0, "the left arrow goes back");
  await p.click("#tourClose"); await wait(p, 300);
  ok(!(await p.evaluate(() => E.tour.active())), "the cross closes it");
  const allSteps = await through(p, "welcome", async (cur) => {
    if (await p.locator("#tourTurn").count()) { await p.click('.nav-btn[data-room="learn"]'); await wait(p, 600); }
  });
  ok(allSteps.length === 9, "the welcome tour has nine steps (" + allSteps.length + ")");
  await p.keyboard.press("Escape"); await wait(p, 200);

  console.log("Every tour, in the practice store");
  for (const id of ["clock", "pay", "svc", "stock", "reports", "safe"]) {
    await go("learn");
    const s0 = await seq(), steps = await through(p, id);
    const wrote = (await seq()) - s0, room = await p.evaluate(() => E.ui.current), end = await p.locator("#tourQuiz").count();
    const expect = ["pay", "svc", "stock"].indexOf(id) >= 0 ? 1 : 0;
    ok(steps.length >= 4 && wrote === expect && room === "learn" && end === 1, id + ": " + steps.length + " steps, " + wrote + " line(s) written, back in Learning, questions offered");
    await p.keyboard.press("Escape"); await wait(p, 200);
  }
  const card = await p.evaluate(() => { const s = E.books.state().sales; return s[s.length - 1].pay.map(x => x.method).join("+"); });
  ok(card === "card+cash", "the payments tour took a card part, then cash (" + card + ")");

  console.log("A cashier's lessons");
  await p.click("#statusPill"); await p.click('.as-keys [data-person="u_practice_marie"]'); await wait(p, 700);
  await go("learn"); await p.click("#lrnTab-lessons"); await wait(p, 250);
  ok(await p.locator("#learnList .lesson").count() === 5 && /2 of 5 done/.test(await p.textContent("#learnCount")), "Marie has five lessons, two done");
  ok(await p.locator("#learnTeam").count() === 0, "a cashier does not see the team's lessons");
  await go("inventory");
  ok(await p.getAttribute(".room-head #showMe", "data-tour") === "svc", "in Inventory, a cashier's tour is the money transfers");
  await go("home");
  /* Build 19: Marie's onboarding holds her lessons, so the Home counts her training */
  ok(/Your training: 8 to do/.test(await p.textContent(".hm-needs")), "the Home reminds her: her training, 8 to do");
  await p.locator(".hm-need", { hasText: "Your training" }).locator(".hm-need-k").click(); await wait(p, 400);
  ok(await p.evaluate(() => E.ui.current) === "learn", "its key opens Learning");
  const deniedTour = await p.evaluate(() => E.tour.start("safe"));
  ok(deniedTour === false, "a lesson her access does not open does not start");
  await p.click("#statusPill"); await p.click('.as-keys [data-person="owner"]'); await wait(p, 700);

  console.log("Three languages, and calm");
  const keysOk = await p.evaluate(() => {
    const d = E.dict, miss = [];
    Object.keys(d.en).filter(k => /^(learn|tour|quiz|tips)\.|^(room|lede)\.learn$|^tip\.learn|^guide\.learn|^disp\.tips$|^km\.lessons$/.test(k))
      .forEach(k => { ["fr", "ht"].forEach(l => { if (!d[l][k]) miss.push(l + ":" + k); }); });
    return miss;
  });
  ok(keysOk.length === 0, "every word of Learning is in French and Kreyòl" + (keysOk.length ? " (missing " + keysOk.slice(0, 5).join(", ") + ")" : ""));
  const counts = await p.evaluate(() => Object.keys(E.dict.en).filter(k => /^tour\./.test(k)).length);
  ok(counts >= 60, "the tours say " + counts + " things");
  for (const [lang, title, word] of [["fr", "Formation", "Montrez-moi"], ["ht", "Fòmasyon", "Montre m"]]) {
    await p.evaluate(l => { E.setLang(l); E.ui.shell(); }, lang); await go("learn");
    ok((await p.textContent("main#room h1")).includes(title) && (await p.textContent("#learnList")).includes(word), lang + ": " + title + ", " + word);
    await p.evaluate(() => E.tour.start("sale")); await settle();
    ok((await p.textContent("#tourText")).length > 20 && !/tour\./.test(await p.textContent("#tourBubble")), lang + ": the tour speaks it");
    await p.keyboard.press("Escape"); await wait(p, 300);
  }
  await p.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  ok(Object.keys(await p.evaluate(() => E.missing || {})).length === 0, "no word missing anywhere");
  await p.evaluate(() => { E.util.prefSet("calm", "1"); E.ui.applyLook(); });
  await go("learn"); await p.evaluate(() => E.tour.start("welcome")); await settle();
  ok(await p.locator("#tour.still").count() === 1 && await p.$eval(".tour-spot", n => getComputedStyle(n).transitionDuration.split(",").every(x => parseFloat(x) === 0)), "in Calm, the light and the pointer do not travel");
  await p.keyboard.press("Escape"); await wait(p, 200);
  await p.evaluate(() => { E.util.prefSet("calm", "0"); E.ui.applyLook(); });

  console.log("On a phone");
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const q = await ph.newPage(); q.on("pageerror", e => errors.push(e.message));
  await q.goto(PAGE); await q.waitForSelector("#introEnter", { timeout: 20000 });
  await q.evaluate(() => E.books.openPractice().then(() => E.app.opened(true)));
  await q.waitForSelector(".shell", { timeout: 90000 });
  await q.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); E.tour.speed = 0.25; E.ui.go("learn"); }); await wait(q, 400);
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the Learning room fits a phone's width");
  await q.evaluate(() => E.tour.start("sale")); await settle(q); await settle(q);
  const bb = await q.$eval("#tourBubble", n => { const r = n.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; });
  ok(bb[0] >= 8 && bb[1] <= 382 && bb[2] >= 8 && bb[3] <= 836, "the tour's bubble stays on the screen (" + bb.map(Math.round).join(", ") + ")");
  await q.keyboard.press("Escape"); await ph.close();

  console.log("The store itself: nothing written by a tour");
  const real = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const r = await real.newPage(); r.on("pageerror", e => errors.push(e.message));
  await r.goto(PAGE); await r.waitForSelector("#introProtect", { timeout: 20000 });
  await r.click("#introProtect");
  await r.fill("#ldStore", "Lakay Lesson Test"); await r.fill("#ldUser", "Yannie");
  await r.fill("#ldP1", "kreyol and coffee 2026"); await r.fill("#ldP2", "kreyol and coffee 2026");
  await r.click("#ldNext");
  await r.waitForSelector(".ild-words li", { timeout: 60000 });
  const groups = await r.$$eval(".ild-words li", lis => lis.map(li => li.textContent.slice(li.querySelector("b").textContent.length).trim()));
  await r.click("#ldWrote"); await r.waitForSelector("#ldG1");
  const labels = await r.locator("form#ldCf label").allTextContents(), nums = labels.map(s => parseInt((s.match(/\d+/) || ["0"])[0], 10));
  await r.fill("#ldG1", groups[nums[0] - 1]); await r.fill("#ldG2", groups[nums[1] - 1]);
  await r.click("#ldSeal"); await r.waitForSelector(".shell", { timeout: 60000 });
  await r.evaluate(() => { E.tour.speed = 0.25; return E.books.addItem({ name: "Kompa classics, volume 2 (CD)", cat: "music", price: 1299, cost: 650, openingStock: 20, reorderAt: 4, taxId: null, barcode: "0850001000093" }); });
  await r.evaluate(() => E.books.addItem({ name: "Malta, 12 oz", cat: "drinks", price: 199, cost: 85, openingStock: 48, reorderAt: 12, taxId: null, barcode: "" }));
  const rseq = () => r.evaluate(() => E.books.state().head.seq);
  for (const id of ["sale", "pay", "svc", "stock"]) {
    await r.evaluate(() => E.ui.go("learn")); await wait(r, 300);
    const s0 = await rseq(); let note = 0, realText = "";
    await through(r, id, async () => {
      if (await r.locator("#tourReal").count()) { note++; realText = await r.textContent("#tourText"); }
      if (await r.locator("#tourTurn").count() && id === "sale") { await r.evaluate(() => E.register.add(Object.keys(E.books.state().items)[0])); await wait(r, 400); }
    });
    ok(await rseq() === s0 && note === 1 && /would/.test(realText), id + ": nothing written in the books; at the last key the tour says what it would do, and stops");
    ok(await r.locator(".layer #tourQuiz").count() === 1 && await r.locator(".layer").count() === 1, id + ": what the tour opened is closed");
    await r.keyboard.press("Escape"); await wait(r, 200);
  }
  ok(await r.evaluate(() => E.register.ticket.lines.length) === 0, "the Register's sale is empty again, as it was");
  ok(await r.evaluate(() => E.books.state().sales.length) === 0 && await r.evaluate(() => (E.books.state().services || []).length) === 0, "no sale and no transfer was made");
  const s1 = await rseq();
  await r.evaluate(() => E.learn.quiz("welcome")); await r.waitForSelector("#quizQ");
  await answer(r, "welcome", false); await wait(r, 400);
  ok(await rseq() === s1 + 1 && (await r.evaluate(() => E.books.trainingOf().done.welcome)).score === 2, "the questions keep the owner's mark in the store's own books: 2 of 2");
  ok(await r.evaluate(() => E.books.verify().then(x => x.ok)), "and Verify passes");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
