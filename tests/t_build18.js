/* LAKAY | Build 18 test: the Author Studio made new. Six tabs, as Inventory's; At a glance shows how everything stands
   and opens each part; Names shows the door, the menu and the window changing as the owner types, and saves them; the
   phrase book finds a phrase as it reads, by place, keeps changed phrases apart until saved, refuses to lose the blanks
   Lakay fills in, and works in each language; the colour sets are drawn by day and by night and Amethyst now has its
   own colours; the spacing; the receipt on its paper, live; Safekeeping saves a copy, brings it back (cleaned), puts
   back every original, and shows what was changed and by whom. A change not yet saved is shown, and leaving asks first.
   Every word is in French and Kreyòl; each tab fits a phone.
   Run: node tests/t_build18.js [url]   (default: the built page, app/Lakay.html, opened from disk) */
"use strict";
const { chromium } = require("./_agreed");  /* each browser has agreed to the terms (Build 26) */
const path = require("path");
const fs = require("fs");
const os = require("os");
const ROOT = path.resolve(__dirname, ".."), PAGE = process.argv[2] || "file://" + path.join(ROOT, "app", "Lakay.html");
let failed = 0, passed = 0;
function ok(cond, what) { if (cond) { passed++; console.log("  ok   " + what); } else { failed++; console.log("  FAIL " + what); } }
const wait = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  const errors = [], csp = [];
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
  const tab = async (r) => { await p.click("#stdTab-" + r); await wait(p, 300); };
  const studio = async (r) => { await p.evaluate(x => { E.studio.room = x; E.ui.go("studio"); }, r || "overview"); await wait(p, 350); };
  const seq = () => p.evaluate(() => E.books.state().head.seq);
  const type = async (sel, text) => { await p.fill(sel, ""); await p.type(sel, text, { delay: 5 }); await wait(p, 120); };

  /* Build 24: the Author Studio opens only in the store's own books, for the owner; this test sets one up */
  await p.goto(PAGE); await p.waitForSelector("#introProtect", { timeout: 20000 });
  await p.evaluate(() => E.books.prepareSetup({ storeName: "Lakay Author Test", ownerName: "Yannie", password: "a long owner sentence for the studio", currency: "USD" }).then(h => h.finish()).then(() => E.app.opened()));
  await p.waitForSelector(".shell", { timeout: 90000 });
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.util.prefSet("tips", "0"); E.ui.applyLook(); });

  console.log("The tabs, and At a glance");
  await studio();
  const tabs = await p.$$eval("#studioPane, .std-tabs [role=tab]", ns => ns.filter(n => n.getAttribute("role") === "tab").map(n => n.getAttribute("data-r")));
  ok(tabs.join() === "overview,names,words,look,receipt,safe", "six tabs: " + tabs.join(", "));
  ok(await p.getAttribute("#stdTab-overview", "aria-selected") === "true" && await p.locator("#studioPane[role=tabpanel]").count() === 1, "At a glance first, in a tab panel");
  ok(await p.textContent("#stdName") === "Lakay" && /store's own books/.test(await p.textContent("#stdTag")), "the calling card: Lakay and the line under it");
  ok(await p.locator("#stdFacts .std-fact").count() === 4, "how the names, words, look and receipt stand");
  await p.click('#stdFacts [data-go="look"]'); await wait(p, 300);
  ok(await p.getAttribute("#stdTab-look", "aria-selected") === "true", "each opens its tab");
  await p.focus("#stdTab-look"); await p.keyboard.press("ArrowRight"); await wait(p, 300);
  ok(await p.getAttribute("#stdTab-receipt", "aria-selected") === "true", "the arrow keys move between the tabs");
  ok(await p.textContent("#studioStatus") === "All changes kept", "the chip says every change is kept");

  console.log("Names, and where they show");
  await tab("names");
  await type("#stApp", "Kafe Lakay");
  ok((await p.textContent(".std-pv-door .pv-name")) === "Kafe Lakay" && (await p.textContent(".std-pv-menu .pv-word")) === "Kafe Lakay" && (await p.textContent(".std-pv-win .pv-title")) === "Kafe Lakay",
    "the door, the menu and the window show the name as it is typed");
  ok(/Not saved yet/.test(await p.textContent("#studioStatus")), "the chip says it is not saved yet");
  ok(/10 \/ 40/.test(await p.textContent("#stApp + .std-count")), "the count of letters: 10 / 40");
  await type("#stTag-en", "The neighbourhood's own store");
  ok(/neighbourhood's own store/.test(await p.textContent(".std-pv-door .pv-tag")), "the line under the name, live");
  await p.click("#stdTab-look"); await p.waitForSelector(".layer .dialog");
  ok(/Leave without saving/.test(await p.textContent(".layer")), "leaving with changes not saved asks first");
  await p.locator(".layer .dialog-foot .key", { hasText: "Cancel" }).click(); await wait(p, 250);
  ok(await p.getAttribute("#stdTab-names", "aria-selected") === "true" && await p.inputValue("#stApp") === "Kafe Lakay", "Cancel stays, with what was typed");
  const s0 = await seq();
  await p.click("#stNamesSave"); await wait(p, 1200);
  ok(await p.evaluate(() => E.appName()) === "Kafe Lakay" && await p.evaluate(() => document.title) === "Kafe Lakay", "saved: the app is called Kafe Lakay, the window too");
  ok((await p.textContent(".brand .wordmark")).trim() === "Kafe Lakay", "the menu carries the new name");
  ok(await seq() > s0, "the change is written in the ledger");
  ok(await p.evaluate(() => E.made() === "Kafe Lakay · Lakay Build " + E.BUILD.number), "Lakay's own name and build stay in small print");

  console.log("The phrase book");
  await studio("words");
  ok(await p.locator("#wordList .std-word").count() === 25 && /1 to 25 of/.test(await p.textContent("#wordPager")), "the phrases, 25 to a page");
  ok(!(await p.textContent("#wordList")).includes("reg.takeCash"), "no internal names are shown");
  await type("#wordSearch", "Take payment"); await wait(p, 300);
  const row = p.locator('#wordList .std-word[data-k="reg.takeCash"]');
  ok(await row.count() === 1 && /Register/i.test(await row.locator(".std-word-place").textContent()), "found as it reads, with its place: Register");
  await row.locator('[data-act="edit"]').click(); await wait(p, 250);
  ok(await p.locator("#wordEdit").count() === 1 && /Take payment/.test(await p.textContent(".std-word.open .std-word-orig.ref")), "Edit opens it, with Lakay's words above");
  await p.fill("#wordEdit", "Take the money"); await p.click("#wordKeep"); await wait(p, 250);
  ok(await p.locator('#wordList .std-word.pending[data-k="reg.takeCash"]').count() === 1 && /1 phrase not saved yet/.test(await p.textContent("#wordBar")), "kept apart, marked, until saved");
  ok(!(await p.locator("#wordBar").isHidden()), "the bar to save them shows");
  await p.click("#wordsUndo"); await wait(p, 250);
  ok(await p.locator("#wordBar").isHidden() && await p.locator('#wordList .std-word.pending').count() === 0, "Undo puts them back");
  await row.locator('[data-act="edit"]').click(); await wait(p, 200);
  await p.fill("#wordEdit", "Take the money"); await p.click("#wordKeep"); await wait(p, 200);
  await p.click("#wordsSave"); await wait(p, 1200);
  ok(await p.evaluate(() => E.t("reg.takeCash")) === "Take the money", "saved: Lakay says it the owner's way");
  await p.evaluate(() => E.ui.go("register")); await wait(p, 400);
  ok((await p.textContent("#takeCash")).includes("Take the money"), "and the Register's key shows it");
  await studio("words");
  await p.click('#wordOnly [data-v="changed"]'); await wait(p, 250);
  ok(await p.locator("#wordList .std-word").count() === 1 && await p.locator('#wordList .std-word.changed[data-k="reg.takeCash"]').count() === 1, "Changed shows only the owner's phrases");
  /* the blanks Lakay fills in cannot be lost */
  await p.click('#wordOnly [data-v="all"]'); await type("#wordSearch", "of done"); await wait(p, 300);
  await p.locator('#wordList .std-word[data-k="learn.progress"] [data-act="edit"]').click(); await wait(p, 200);
  ok(/\{n\} \{m\}/.test(await p.textContent(".std-word-blanks")), "it names the blanks to keep: {n} {m}");
  await p.fill("#wordEdit", "{n} lessons finished"); await p.click("#wordKeep"); await wait(p, 200);
  ok(/Keep \{m\}/.test(await p.textContent(".std-word-warn")) && await p.locator("#wordEdit").count() === 1, "a phrase that drops a blank is refused, and says which");
  await p.fill("#wordEdit", "{n} of your {m} lessons finished"); await p.click("#wordKeep"); await wait(p, 200);
  ok(await p.locator('#wordList .std-word.pending[data-k="learn.progress"]').count() === 1, "with the blanks kept, it is taken");
  await p.click("#wordsUndo"); await wait(p, 200);
  /* French */
  await p.click('#wordLang [data-v="fr"]'); await wait(p, 300);
  await type("#wordSearch", "Encaisser"); await wait(p, 300);
  await p.locator('#wordList .std-word[data-k="reg.takeCash"] [data-act="edit"]').click(); await wait(p, 200);
  await p.fill("#wordEdit", "Prendre l'argent"); await p.click("#wordKeep"); await wait(p, 200); await p.click("#wordsSave"); await wait(p, 1200);
  const custom = await p.evaluate(() => E.custom.words);
  ok(custom.fr["reg.takeCash"] === "Prendre l'argent" && custom.en["reg.takeCash"] === "Take the money" && !custom.ht["reg.takeCash"], "each language keeps its own phrases");

  console.log("The look");
  await studio("look");
  ok(await p.locator(".std-pals .palette-card").count() === 6 && await p.locator(".std-pals .pal-mini .pm-day").count() === 6 && await p.locator(".std-pals .pal-mini .pm-night").count() === 6,
    "six colour sets, each drawn by day and by night");
  const names = await p.$$eval(".std-pals .pal-t b", bs => bs.map(b => b.textContent));
  ok(names.join() === "Dawn,Amethyst,Indigo,Royal blue,Burgundy,Graphite" && !(await p.textContent(".std-pals")).match(/brass|Build \d/i), "named for their colours, with no talk of brass or of old builds");
  await p.click('.palette-card[data-p="amethyst"]'); await wait(p, 900);
  const pri = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pri").trim());
  ok(await p.evaluate(() => document.documentElement.getAttribute("data-palette")) === "amethyst" && pri.toLowerCase() === "#5b3fa8", "Amethyst is worn, with its own colours at last (" + pri + ")");
  ok(await p.getAttribute('.palette-card[data-p="amethyst"]', "aria-checked") === "true", "and it is marked as chosen");
  await p.click('.std-space-k[data-d="comfortable"]'); await wait(p, 900);
  ok(await p.evaluate(() => document.documentElement.getAttribute("data-density")) === "comfortable", "the spacing: comfortable");
  await p.click('.palette-card[data-p="dawn"]'); await wait(p, 900); await p.click('.std-space-k[data-d="compact"]'); await wait(p, 900);
  ok(await p.evaluate(() => document.documentElement.getAttribute("data-palette")) === "dawn", "and back to Dawn");

  console.log("The receipt");
  await studio("receipt");
  await type("#stLines", "Little Haiti, Miami\n(305) 555 0100");
  ok(/Little Haiti, Miami/.test(await p.textContent("#receiptPreview .receipt")), "the paper shows the lines as they are typed");
  await type("#stThanks-en", "Mesi anpil, come again!");
  ok(/Mesi anpil, come again!/.test(await p.textContent("#receiptPreview .receipt")), "and the thank you");
  ok(await p.locator("#stPrintTest").count() === 1, "a test receipt can be printed");
  await p.click("#stReceiptSave"); await wait(p, 1200);
  ok((await p.evaluate(() => E.receiptLines())).join("|") === "Little Haiti, Miami|(305) 555 0100" && await p.evaluate(() => E.thanks()) === "Mesi anpil, come again!", "saved: the receipt's lines and the thank you");

  console.log("Safekeeping and the history");
  await studio("safe");
  await p.click("#studioHistory"); await p.waitForSelector("#studioLog li", { timeout: 10000 });
  const log = await p.textContent("#studioLog");
  ok(/The app's name/.test(log) && /phrases? \(English\)/.test(log) && /The colours/.test(log) && /The receipt's lines/.test(log), "the history says what was changed");
  ok(/Yannie/.test(log), "and by whom (the owner, by name)");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#studioExport")]);
  const file = path.join(os.tmpdir(), "lakay-studio-" + Date.now() + ".json"); await dl.saveAs(file);
  const body = JSON.parse(fs.readFileSync(file, "utf8"));
  ok(body.format === "emporium-author" && body.custom.names.app === "Kafe Lakay" && body.custom.words.fr["reg.takeCash"] === "Prendre l'argent", "a copy of the choices, in one file");
  await p.click("#studioReset"); await p.waitForSelector(".layer .dialog-foot .key.danger"); await p.click(".layer .dialog-foot .key.danger"); await wait(p, 1200);
  ok(await p.evaluate(() => E.appName()) === "Lakay" && await p.evaluate(() => E.t("reg.takeCash")) === "Take payment", "every original is back");
  await studio("safe");
  const hostile = path.join(os.tmpdir(), "lakay-studio-hostile-" + Date.now() + ".json");
  const bad = JSON.parse(JSON.stringify(body)); bad.custom.names.app = "Kafe Lakay"; bad.custom.words.en["no.such.key"] = "x"; bad.custom.look.palette = "neon"; bad.custom.extra = { code: "alert(1)" };
  fs.writeFileSync(hostile, JSON.stringify(bad));
  await p.setInputFiles("#studioFile", hostile); await p.waitForSelector(".layer .dialog-foot .key.primary"); await p.click(".layer .dialog-foot .key.primary"); await wait(p, 1200);
  const c2 = await p.evaluate(() => E.custom);
  ok(c2.names.app === "Kafe Lakay" && !c2.words.en["no.such.key"] && c2.look.palette === "dawn" && c2.extra === undefined, "a copy brought back is checked: unknown phrases, colours and fields are left out");
  await p.click("#studioReset"); await p.waitForSelector(".layer .dialog-foot .key.danger"); await p.click(".layer .dialog-foot .key.danger"); await wait(p, 1200);
  const v = await p.evaluate(() => E.books.verify().then(r => r.ok));
  ok(v, "Verify passes after all of it");

  console.log("Three languages, night, a phone");
  const miss = await p.evaluate(() => Object.keys(E.dict.en).filter(k => /^studio\./.test(k)).filter(k => !E.dict.fr[k] || !E.dict.ht[k]));
  ok(miss.length === 0, "every word of the Studio is in French and Kreyòl" + (miss.length ? " (missing " + miss.slice(0, 4).join(", ") + ")" : ""));
  for (const [lang, word] of [["fr", "En un coup d'œil"], ["ht", "Yon kout je"]]) {
    await p.evaluate(l => { E.setLang(l); E.ui.shell(); }, lang); await studio();
    ok((await p.textContent("#stdTab-overview")).includes(word), lang + ": " + word);
  }
  await p.evaluate(() => { E.setLang("en"); E.ui.shell(); });
  await p.evaluate(() => { E.util.prefSet("theme", "night"); E.ui.applyLook(); }); await studio("look");
  const night = await p.$eval(".std-block", n => getComputedStyle(n).backgroundColor);
  ok(night !== "rgb(255, 255, 255)", "by night the slabs are dark (" + night + ")");
  await p.evaluate(() => { E.util.prefSet("theme", "day"); E.ui.applyLook(); });
  await p.setViewportSize({ width: 390, height: 844 });
  const wide = [];
  for (const r of ["overview", "names", "words", "look", "receipt", "safe"]) { await studio(r); if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) wide.push(r); }
  ok(wide.length === 0, "each tab fits a phone's width" + (wide.length ? " (too wide: " + wide.join(", ") + ")" : ""));
  await p.setViewportSize({ width: 1280, height: 860 });
  ok(Object.keys(await p.evaluate(() => E.missing || {})).length === 0, "no word missing anywhere");
  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  ok(csp.length === 0, "nothing refused by the page's security policy" + (csp.length ? ": " + csp[0] : ""));
  await browser.close();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
