/* LAKAY | Build 26 test: Lakay's terms, its licence and its copyright, in parity with Ingenium 7.58 (its modules r320 and r326
   and its PermitCore card, and its own test of them, rig/t_741.js), made for Lakay (src/js/31-terms.js).
   A new device: the welcome door asks nothing; once it has opened, the sheet stands over everything (In short, the full Terms
   of use, the full Privacy notice, a tick, Decline and I agree); nothing behind it can be reached and no key reaches the rooms;
   Escape does not close it; Decline keeps Lakay closed and records nothing; Back to the welcome door reaches the door's
   Refresh and Reset; I agree keeps the version, the date and the build on this device; a new version asks again. About shows
   the licence and the terms to everyone; Settings, Ownership shows them to the owner, with the Draft chip and Your contact for
   the owner of the real store; Security links to the Privacy notice; the whole licence reads as a document and saves as it is;
   French and Kreyòl; a phone's width; night.
   Run: node tests/t_build26_terms.js */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
let failed = 0, passed = 0;
function ok(cond, what, detail) { if (cond) { passed++; console.log("  ok   " + what); } else { failed++; console.log("  FAIL " + what + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); } }
const wait = (p, ms) => p.waitForTimeout(ms);
const OWNER_PW = "a long owner sentence for the store";
const TERMS = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "terms", "terms.json"), "utf8"));
const LICENCE = fs.readFileSync(path.join(ROOT, "LICENCE.txt"), "utf8");
const V = TERMS.version.en;

(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lakay26t-"));
  const PAGE = "file://" + path.join(ROOT, "app", "Lakay.html");
  const html = fs.readFileSync(path.join(ROOT, "app", "Lakay.html"), "utf8");
  const browser = await chromium.launch();
  const errors = [], csp = [];
  async function device(o) {
    o = o || {};
    const ctx = await browser.newContext({ viewport: { width: o.w || 1280, height: o.h || 900 }, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
    await p.goto(PAGE); await p.waitForSelector("#introDoor", { timeout: 20000 });
    await p.evaluate(() => { E.util.prefSet("tips", "0"); });
    return p;
  }
  async function until(fn, ms) { const end = Date.now() + (ms || 15000); while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; }
  const sheet = (p) => p.evaluate(() => {
    const s = document.querySelector("#termsGate .tg"); if (!s) return null;
    return { chip: (s.querySelector(".tg-chip") || {}).textContent || "", h: (s.querySelector("h2") || {}).textContent || "", tabs: [...s.querySelectorAll(".tg-tab")].map(t => t.textContent),
      sel: (s.querySelector('.tg-tab[aria-selected="true"]') || {}).textContent || "", agreeOff: (document.getElementById("tgAgree") || {}).disabled, keys: [...s.querySelectorAll(".tg-key")].map(k => k.textContent), text: s.textContent };
  });
  const record = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem("emporium.terms") || "null"); } catch (e) { return "bad"; } });

  console.log("The built page");
  ok(html.includes("connect-src 'none'"), "the page still reaches nowhere (its policy is unchanged by the texts it carries)");
  ok(!/@@(TERMS|LICENCE|NOTICES)@@/.test(html), "the terms, the licence and the notices are in the page");
  const terms = fs.readFileSync(path.join(ROOT, "TERMS.txt"), "utf8"), privacy = fs.readFileSync(path.join(ROOT, "PRIVACY.txt"), "utf8");
  ok(terms.startsWith("LAKAY\nTERMS OF USE\n" + V + ". Made by Yannie D. Forest.") && TERMS.terms.every(x => terms.includes(x.h.en.toUpperCase())), "TERMS.txt: Ingenium's layout, every section of the Terms of use", terms.slice(0, 80));
  ok(privacy.startsWith("LAKAY\nPRIVACY NOTICE\n" + V + ".") && TERMS.privacy.every(x => privacy.includes(x.h.en.toUpperCase())), "PRIVACY.txt: every section of the Privacy notice");
  ok(Math.max(...(terms + privacy).split("\n").map(l => l.length)) <= 76, "their lines are wrapped at 76 characters, as the licence's are");

  console.log("A new device: the welcome door asks nothing");
  const A = await device();
  await wait(A, 3600);
  ok(!(await A.$("#termsGate")), "at the welcome door, no sheet: the terms are asked once the door has opened, as in Ingenium");
  ok(await A.evaluate(v => E.terms.versionEn === v && E.terms.need() === true && E.terms.record() === null, V), "this device has not agreed yet: Lakay will ask");

  console.log("The door opens: the sheet stands over everything");
  await A.click("#introEnter");
  await A.waitForSelector(".shell", { timeout: 90000 });
  ok(await until(async () => !!(await A.$("#termsGate .tg")), 8000), "the practice store opens, and the sheet stands over it");
  let g = await sheet(A);
  ok(g && g.chip === "Before you begin" && g.h === "Lakay's terms" && g.tabs.join() === "In short,Terms of use,Privacy notice" && g.agreeOff === true,
    "Before you begin, Lakay's terms: In short, Terms of use, Privacy notice; I agree waits for the tick", g);
  ok(g && TERMS.short.every(x => g.text.includes(x.t.en)) && /please read them before you agree/.test(g.text) && g.text.includes(V + ". Kept on this device; also in About, and in Settings, Ownership."),
    "In short: the six promises, and a word to read the full texts before agreeing", g && g.text.slice(0, 200));
  const full = await A.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    document.querySelectorAll(".tg-tab")[1].click(); await w(150);
    const terms = [...document.querySelectorAll(".tg-read .tp-sec h3")].map(x => x.textContent);
    document.querySelectorAll(".tg-tab")[2].click(); await w(150);
    const priv = [...document.querySelectorAll(".tg-read .tp-sec h3")].map(x => x.textContent);
    const blank = (document.querySelector(".tg-read .tp-blank") || {}).textContent || "";
    document.querySelectorAll(".tg-tab")[0].click(); await w(150);
    return { terms, priv, blank };
  });
  ok(full.terms.length === TERMS.terms.length && full.priv.length === TERMS.privacy.length && full.terms[0] === TERMS.terms[0].h.en,
    "the full Terms of use (" + TERMS.terms.length + " sections) and the full Privacy notice (" + TERMS.privacy.length + ") are read in the sheet", full);
  ok(full.blank === "the contact its maker adds", "with no contact yet, the notice says so plainly, as Ingenium's draft does", full.blank);
  const blocked = await A.evaluate(() => { const r = document.querySelector(".tg-veil").getBoundingClientRect(); const e = document.elementFromPoint(innerWidth - 30, innerHeight / 2);
    const z = +getComputedStyle(document.querySelector(".tg-veil")).zIndex; return { covers: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, topIsVeil: !!(e && e.closest(".tg-veil")), z }; });
  ok(blocked.covers && blocked.topIsVeil && blocked.z > 2750, "nothing behind the sheet can be reached until it is answered (above the dialogs, the tour and the toasts)", blocked);
  await A.keyboard.press("Escape"); await wait(A, 200);
  ok(!!(await A.$("#termsGate .tg")), "Escape does not close it");
  await A.evaluate(() => { window.__keysBehind = 0; document.addEventListener("keydown", () => { window.__keysBehind++; }); document.body.addEventListener("keydown", () => { window.__keysBehind++; }); });
  for (const k of ["a", "Enter", "/", "F2", "Escape", "ArrowDown"]) await A.keyboard.press(k);
  ok(await A.evaluate(() => window.__keysBehind === 0), "no key reaches the rooms behind the sheet (the register, the scanner, the rail's shortcuts)");
  let inside = true;
  for (let i = 0; i < 14; i++) { await A.keyboard.press(i % 5 === 4 ? "Shift+Tab" : "Tab"); if (!(await A.evaluate(() => !!(document.activeElement && document.activeElement.closest("#termsGate"))))) inside = false; }
  ok(inside, "Tab goes round the sheet's own keys only");

  console.log("Decline: Lakay stays closed");
  await A.click("#tgDecline"); await wait(A, 200);
  g = await sheet(A);
  ok(g && g.chip === "Declined" && g.h === "Lakay stays closed" && /Nothing on this device was changed or sent anywhere/.test(g.text) && g.keys.join() === "Back to the welcome door,Read the terms again",
    "Decline: Lakay stays closed, says why, and offers the terms again and the welcome door", g);
  ok((await record(A)) === null, "nothing is recorded when the terms are declined");
  await A.click("#tgAgain"); await wait(A, 200);
  g = await sheet(A);
  ok(g && g.sel === "Terms of use" && g.agreeOff === true, "Read the terms again: the full Terms of use, the tick still to give", g);
  await A.click("#tgDecline"); await wait(A, 150);
  await A.click("#tgBack");
  await A.waitForSelector("#introDoor", { timeout: 20000 }); await wait(A, 3600);
  ok(await A.evaluate(() => !E.books.isOpen && !document.getElementById("termsGate") && !!document.querySelector(".door-bar")),
    "Back to the welcome door: the practice store closes, the door's Refresh and Reset are there, and the door asks nothing (Lakay never locks anyone out)");

  console.log("I agree");
  await A.click("#introEnter");
  await A.waitForSelector(".shell", { timeout: 90000 });
  ok(await until(async () => !!(await A.$("#termsGate .tg")), 8000), "the door opens again: the sheet asks again, since nothing was agreed");
  await A.check("#tgTick");
  ok(await A.evaluate(() => document.getElementById("tgAgree").disabled === false), "the tick lets I agree be pressed");
  await A.click("#tgAgree"); await wait(A, 300);
  const rec = await record(A);
  ok(!(await A.$("#termsGate")) && rec && rec.v === V && rec.at > Date.now() - 60000 && rec.build === "26" && (await A.evaluate(() => E.terms.need())) === false,
    "I agree: the sheet closes; the version, the date and the build are kept on this device", rec);
  await A.reload(); await A.waitForSelector("#introDoor", { timeout: 20000 });
  await A.click("#introEnter"); await A.waitForSelector(".shell", { timeout: 90000 }); await wait(A, 3600);
  ok(!(await A.$("#termsGate")), "once agreed, this device is not asked again");

  console.log("About: the licence and the terms, for everyone");
  await A.evaluate(() => E.ui.about()); await A.waitForSelector("#aboutTerms");
  ok(await A.evaluate(() => /Designed and built by Yannie D\. Forest · © 2026 Yannie D\. Forest\. All rights reserved\./.test(document.querySelector(".about-foot").textContent)), "About keeps the line of authorship and the rights");
  await A.click("#aboutTerms"); await A.waitForSelector("#termsRead");
  const rd = await A.evaluate(() => { const c = document.getElementById("termsRead"); return { parts: [...c.querySelectorAll(".tp-part")].map(x => x.textContent), draft: !!c.querySelector("#termsDraft"),
    chips: [...c.querySelectorAll(".tp-chip")].map(x => x.textContent), agreed: (c.querySelector(".tp-agreed") || {}).textContent || "", abouts: document.querySelectorAll(".about-card").length }; });
  ok(rd.parts.join() === "In short,Privacy notice,Terms of use" && !rd.draft && rd.chips.join() === "Nothing sent to its maker,Works offline,Sealed with your passwords" && rd.abouts === 0,
    "Terms and privacy from About: In short, the Privacy notice and the Terms of use (About closes first; no Draft and no contact for anyone else)", rd);
  ok(new RegExp("^You agreed to these terms \\(" + V + "\\) on \\d+ \\w+ 2026 at \\d+:\\d\\d [AP]M\\. Kept on this device only\\.$").test(rd.agreed), "it says when this device agreed, kept on this device only", rd.agreed);
  await A.click(".layer .dialog-foot .key.primary"); await wait(A, 200);
  await A.evaluate(() => E.ui.about()); await A.waitForSelector("#aboutLicence"); await A.click("#aboutLicence"); await A.waitForSelector("#licenceRead");
  const lc = await A.evaluate(() => { const c = document.getElementById("licenceRead"); return { h: c.querySelector(".tp-title").textContent, copy: c.querySelector(".lic-copy").textContent,
    lines: [...c.querySelectorAll(".lic-line")].map(x => x.textContent), sum: c.querySelector("details.lic-text > summary").textContent, plainBox: !!c.querySelector(".lic-plainbox") }; });
  ok(lc.h === "Ownership, licence and permissions" && lc.copy === "Copyright © 2026 Yannie D. Forest. All rights reserved." && /^Lakay is the sole original work of Yannie D\. Forest, its owner\./.test(lc.lines[0]),
    "Ownership, licence and permissions: the copyright, and Lakay as the owner's sole original work", lc);
  ok(/^This copy: Lakay, build 26 \(21 November 2026\)\. A copy that did not come from the owner/.test(lc.lines[2]) && lc.sum === "Read the whole licence (version 3)" && !lc.plainBox,
    "this copy's build, and the whole licence to read (in English, its plain words are inside it)", lc);
  await A.click("#licenceRead details.lic-text > summary"); await wait(A, 200);
  const doc = await A.evaluate(() => { const d = document.querySelector("#licenceRead .lic-doc"); return { app: d.querySelector(".lcd-app").textContent, metas: [...d.querySelectorAll(".lcd-meta")].map(x => x.textContent),
    plain: d.querySelectorAll(".lcd-plain li").length, toc: d.querySelectorAll(".lcd-toc li").length, parts: [...d.querySelectorAll(".lcd-part")].map(x => x.textContent), heads: [...d.querySelectorAll(".lcd-h")].map(x => x.textContent),
    clauses: d.querySelectorAll(".lcd-cl").length, items: [...d.querySelectorAll("ol.lcd-list > li")].map(x => x.textContent), foot: [...d.querySelectorAll(".lcd-foot")].map(x => x.textContent) }; });
  ok(doc.app === "LAKAY" && doc.metas[0] === "Copyright (c) 2026 Yannie D. Forest. All rights reserved." && doc.metas[1] === "Version 3, 25 October 2026, made for Lakay on 21 November 2026. This notice replaces every earlier notice.",
    "the licence reads as a document: its name, its copyright, its version as one line", doc.metas);
  ok(doc.plain === TERMS.licence.length && doc.toc === 19 && doc.parts.length === 6 && doc.heads[2] === "3. The owner owns Lakay" && doc.clauses > 40,
    "In plain words, the contents (19 sections), parts A to F, sections and clauses, as Ingenium reads its own", { plain: doc.plain, toc: doc.toc, parts: doc.parts, h: doc.heads[2], cl: doc.clauses });
  ok(doc.items.some(x => /^\(d\)"make install packages of it".*only as \(e\) or \(f\) allows;$/.test(x)) && !doc.items.some(x => /^\(f\)allows;/.test(x)),
    "a wrapped line that begins with (f) stays in its clause (Lakay's reading counts a list item only at the margin)", doc.items.filter(x => /allows;$/.test(x)));
  ok(doc.foot.some(x => /^To ask for a permission, write to the owner\. Only the owner can give one\.$/.test(x)), "the licence's last line closes the document");
  const [dl] = await Promise.all([A.waitForEvent("download"), A.click("#licenceRead .lic-save")]);
  const saved = path.join(TMP, dl.suggestedFilename()); await dl.saveAs(saved);
  ok(dl.suggestedFilename() === "LICENCE.txt" && fs.readFileSync(saved, "utf8") === LICENCE, "Save the licence: LICENCE.txt, exactly as the repositories carry it");
  await A.click("#licenceRead .lic-notices"); await A.waitForSelector("#licNoticesText");
  const nt = await A.evaluate(() => document.getElementById("licNoticesText").textContent);
  ok(nt === fs.readFileSync(path.join(ROOT, "THIRD_PARTY_NOTICES.txt"), "utf8") && /carries no software, fonts or pictures made by\s+others/.test(nt) && /PyInstaller 6\.22\.3/.test(nt) && /Microsoft WebView2 SDK files/.test(nt) && /Bootloader Exception/.test(nt) && /Apache License/.test(nt),
    "the notices of others' software, exactly as THIRD_PARTY_NOTICES.txt: what each program carries, with the licences' own texts, and that the page carries none");
  await A.evaluate(() => document.querySelectorAll(".layer").forEach(l => l.remove()));

  console.log("Settings, Ownership: in the practice store");
  await A.evaluate(() => E.ui.go("settings")); await A.waitForSelector("#set-own");
  const pr = await A.evaluate(() => ({ nav: [...document.querySelectorAll(".set-nav .chip")].map(x => x.textContent.replace(/\p{Extended_Pictographic}|️/gu, "").trim()),
    order: [...document.querySelectorAll(".set-sec")].map(s => s.id), draft: !!document.getElementById("termsDraft"), parts: [...document.querySelectorAll("#termsCard .tp-part")].map(x => x.textContent) }));
  ok(pr.nav.indexOf("Ownership") === pr.nav.indexOf("About") - 1 && pr.order.indexOf("set-own") === pr.order.indexOf("set-about") - 1, "Ownership stands before About, in the list and on the page", pr.nav);
  ok(!pr.draft && pr.parts.join() === "In short,Privacy notice,Terms of use", "in the practice store, no Draft chip and no contact to add", pr);

  console.log("The owner's real store");
  await A.evaluate(() => E.books.lock("hand")); await A.waitForSelector("#introDoor");
  await A.evaluate(pw => E.books.prepareSetup({ storeName: "Lakay Terms Test", ownerName: "Yannie", password: pw, currency: "USD" }).then(h => h.finish()).then(() => E.app.opened()), OWNER_PW);
  await A.waitForSelector(".shell", { timeout: 60000 }); await wait(A, 600);
  ok(!(await A.$("#termsGate")), "this device agreed once: its own store opens with no sheet");
  await A.evaluate(() => E.ui.go("settings")); await A.waitForSelector("#termsCard");
  const own = await A.evaluate(() => ({ draft: (document.getElementById("termsDraft") || {}).textContent || "", parts: [...document.querySelectorAll("#termsCard .tp-part")].map(x => x.textContent), lic: !!document.getElementById("licenceCard") }));
  ok(own.draft === "Draft: a lawyer reads it before it is final" && own.parts.join() === "In short,Privacy notice,Terms of use,Your contact" && own.lic,
    "the owner of the real store sees the Draft chip and Your contact, beside the licence card", own);
  await A.click('#termsCard .tp-part[data-p="contact"]'); await A.waitForSelector("#tpContact");
  await A.fill("#tpContact", "lakay@example.org"); await A.click("#tpSave"); await wait(A, 300);
  await A.click('#termsCard .tp-part[data-p="privacy"]'); await wait(A, 150);
  const shown = await A.evaluate(() => ({ c: (document.querySelector("#termsCard .tp-contact") || {}).textContent || "", t: (document.querySelector("#toasts") || {}).textContent || "" }));
  ok(shown.c === "lakay@example.org" && /Saved\. The Privacy notice and the Terms now show it\./.test(shown.t), "Your contact, saved: the Privacy notice shows it", shown);
  await A.click('#termsCard .tp-part[data-p="contact"]'); await A.click("#tpClear"); await A.click('#termsCard .tp-part[data-p="privacy"]'); await wait(A, 150);
  ok(await A.evaluate(() => !document.querySelector("#termsCard .tp-contact") && /the contact its maker adds/.test(document.querySelector("#termsCard").textContent)), "cleared, the notice says so plainly again");
  await A.click('#termsCard .tp-part[data-p="short"]');
  await A.click("#privacyLink"); await wait(A, 500);
  ok(await A.evaluate(() => (document.querySelector('#termsCard .tp-part[aria-selected="true"]') || {}).textContent === "Privacy notice" && Math.abs(document.getElementById("termsCard").getBoundingClientRect().top) < 260),
    "Security, Read the Privacy notice: to Settings, Ownership, at the Privacy notice");

  console.log("A new version of the terms asks again; the sheet over the sign-in");
  await A.evaluate(() => localStorage.setItem("emporium.terms", JSON.stringify({ v: "Version 0, 1 January 2026", at: Date.now() - 86400000, build: "25" })));
  await A.evaluate(() => E.books.lock("hand")); await A.waitForSelector("#introDoor"); await wait(A, 400);
  ok(!(await A.$("#termsGate")), "at the door, still nothing asked");
  await A.click("#introEnter"); await A.waitForSelector("#lockDoor");
  ok(await until(async () => !!(await A.$("#termsGate .tg")), 8000), "an earlier version agreed to: the sign-in opens, and the sheet asks again over it");
  await A.click("#tgDecline"); await A.click("#tgBack"); await wait(A, 800);
  ok(await A.evaluate(() => !!document.getElementById("introDoor") && !document.getElementById("lockDoor") && !document.getElementById("termsGate")), "Back to the welcome door, from over the sign-in");
  await A.click("#introEnter"); await A.waitForSelector("#termsGate .tg", { timeout: 8000 });
  await A.check("#tgTick"); await A.click("#tgAgree"); await wait(A, 200);
  ok((await record(A)).v === V && !(await A.$("#termsGate")), "agreed to the new version: the sign-in is there to use");
  await A.fill("#ldName", "Yannie"); await A.fill("#ldPw", OWNER_PW); await A.click("#ldGo"); await A.waitForSelector(".shell", { timeout: 60000 });
  ok(!(await A.$("#termsGate")), "signed in, with nothing more to answer");

  console.log("French and Kreyòl");
  const langs = {};
  for (const l of ["fr", "ht"]) {
    langs[l] = await A.evaluate(async l => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      E.setLang(l); E.terms.gate.open(); await w(100);
      const s = document.querySelector("#termsGate .tg"); const out = { h: s.querySelector("h2").textContent, tabs: [...s.querySelectorAll(".tg-tab")].map(t => t.textContent), tick: s.querySelector(".tg-tick").textContent };
      s.querySelectorAll(".tg-tab")[1].click(); await w(100);
      out.governs = (document.querySelector("#termsGate .tp-governs") || {}).textContent || ""; out.first = (document.querySelector("#termsGate .tp-sec h3") || {}).textContent || "";
      E.terms.gate.close(); return out;
    }, l);
  }
  ok(langs.fr.h === "Les conditions de Lakay" && langs.fr.tabs.join() === "En bref,Conditions d'utilisation,Avis de confidentialité" && langs.fr.first === TERMS.terms[0].h.fr && /l'anglais qui s'applique/.test(langs.fr.governs), "in French, with the note that the English applies", langs.fr);
  ok(langs.ht.h === "Kondisyon Lakay yo" && langs.ht.tabs.join() === "An kout,Kondisyon itilizasyon,Avi sou vi prive" && langs.ht.first === TERMS.terms[0].h.ht && /se angle a ki aplike/.test(langs.ht.governs), "in Kreyòl, with the same note", langs.ht);
  const missing = await A.evaluate(() => { E.setLang("en"); return Object.keys(E.missing).filter(k => /^(terms|gate|lic|set\.own|tip\.own|about\.licence|set\.privacyLink)\b/.test(k)); });
  ok(missing.length === 0, "no phrase of the terms is missing", missing);
  const french = await A.evaluate(() => { E.setLang("fr"); const s = ["lic.sole", "lic.permit", "gate.noP", "terms.blankContact", "terms.chip.maker", "tip.own.b"].map(k => E.t(k)).join(" "); E.setLang("en"); return s; });
  const frTerms = (JSON.stringify(TERMS).match(/"fr":"(?:[^"\\]|\\.)*"/g) || []).join(" ");
  ok(/le propriétaire/.test(french) && /son auteur\b/.test(french) && !/\b(auteure|propriétaire\s+elle|prête|prêt)\b/.test(french + " " + frTerms), "the French names no gender: le propriétaire, son auteur", french.slice(0, 80));

  console.log("Where the browser keeps nothing");
  const N = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await N.addInitScript(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k) === "emporium.terms") throw new Error("refused"); return orig.call(this, k, v); }; });
  const Np = await N.newPage(); Np.on("pageerror", e => errors.push(e.message));
  await Np.goto(PAGE); await Np.waitForSelector("#introDoor", { timeout: 20000 }); await Np.evaluate(() => E.util.prefSet("tips", "0"));
  await Np.click("#introEnter"); await Np.waitForSelector(".shell", { timeout: 90000 }); await Np.waitForSelector("#termsGate .tg", { timeout: 8000 });
  await Np.check("#tgTick"); await Np.click("#tgAgree"); await wait(Np, 3800);
  ok(!(await Np.$("#termsGate")) && (await Np.evaluate(() => localStorage.getItem("emporium.terms"))) === null,
    "where the browser refuses to keep the record, the agreement holds for the session: the sheet does not come back every few seconds");
  await N.close();

  console.log("A phone's width, and night");
  const P = await device({ w: 390, h: 844 });
  await P.click("#introEnter"); await P.waitForSelector(".shell", { timeout: 90000 }); await P.waitForSelector("#termsGate .tg", { timeout: 8000 });
  const fit = await P.evaluate(() => { const r = document.querySelector("#termsGate .tg").getBoundingClientRect(); const k = document.getElementById("tgAgree").getBoundingClientRect();
    return { w: r.width, left: r.left, right: r.right, inner: innerWidth, sw: document.documentElement.scrollWidth, keyIn: k.bottom <= innerHeight && k.right <= innerWidth }; });
  ok(fit.left >= 15 && fit.right <= fit.inner - 15 && fit.sw <= fit.inner && fit.keyIn, "on a phone, the sheet fits inside the screen with its keys in reach", fit);
  await P.screenshot({ path: path.join(TMP, "sheet-phone.png") });
  await P.evaluate(() => { E.util.prefSet("theme", "night"); E.ui.applyLook(); });
  const night = await P.evaluate(() => { const c = getComputedStyle(document.querySelector("#termsGate h2")).color; const m = c.match(/\d+/g).map(Number); return { c, light: m[0] + m[1] + m[2] > 500 }; });
  ok(night.light, "at night, the sheet is dressed for night (light words on a dark sheet)", night);
  await P.context().close();

  ok(errors.length === 0, "no errors on the page", errors.slice(0, 5));
  ok(csp.length === 0, "nothing refused by the page's policy", csp.slice(0, 3));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
