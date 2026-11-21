/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Playwright's Chromium, for the suites written before Build 26. Those suites test the rooms, not the terms: so each browser
   they open has already agreed to this version of the terms, as a device does once (src/js/31-terms.js), and the agreement
   sheet does not stand over the rooms they test. The record is put in before the page runs, only where none is kept, so a
   suite that changes it sees its own change. tests/t_build26_terms.js tests the sheet itself, with Playwright as it is. */
"use strict";
const path = require("path");
const pw = require("playwright");
const terms = require(path.join(__dirname, "..", "src", "terms", "terms.json"));
const RECORD = JSON.stringify({ v: terms.version.en, at: Date.UTC(2026, 10, 21, 9, 0), build: "tests" });

async function agreeIn(ctx) {
  await ctx.addInitScript(r => { try { if (!localStorage.getItem("emporium.terms")) localStorage.setItem("emporium.terms", r); } catch (e) { } }, RECORD);
  return ctx;
}
function wrap(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async function (opts) { return agreeIn(await newContext(opts)); };
  browser.newPage = async function (opts) {
    const ctx = await browser.newContext(opts), page = await ctx.newPage();
    page.on("close", () => { ctx.close().catch(() => { }); });
    return page;
  };
  return browser;
}
const chromium = {
  launch: async function (opts) { return wrap(await pw.chromium.launch(opts)); },
  executablePath: function () { return pw.chromium.executablePath(); }
};
module.exports = { chromium, RECORD };
