/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Devices in step, stage 2 (Build 25): the Devices section of Settings. The store's devices, each with its letter, its
   name and its state; how many of this device's changes each has yet to take; and the owner's keys: Add a device (a
   joining file and a pairing code shown once), Save changes for a device (a sealed file to carry to it), Take in
   changes (a file from another device, with a plain report of what came in and of any field changed on two devices
   while they were apart), Name, Cancel the invitation, Remove. The books' side is in 04-books.js (prepareInvite,
   makeBundleFor, takeBundle, renameDevice, removeDevice, devices); the door's side, joining with the file and the code,
   is in 11-door.js. */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, ui = E.ui;
  var V = E.devices = {};
  function when(iso) { if (!iso) return ""; var d = new Date(iso); return E.fmtDate(d, "short") + " " + E.fmtTime(d); }
  function day(iso) { return iso ? E.fmtDate(new Date(iso), "short") : ""; }
  function count(n, one, many, extra) { var v = { n: n }; Object.keys(extra || {}).forEach(function (k) { v[k] = extra[k]; }); return t(n === 1 ? one : many, v); }
  function stamp() { var d = new Date(); return U.dayKey(d) + " " + U.pad2(d.getHours()) + "h" + U.pad2(d.getMinutes()); }
  function fileName(parts) { return parts.join(" ").replace(/[\\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() + ".lakay"; }
  var ERRS = { notbundle: "dev.err.notbundle", otherstore: "dev.err.otherstore", mine: "dev.err.mine", gap: "dev.err.gap", fork: "dev.err.fork", chain: "dev.err.fork",
    old: "dev.err.old", letter: "dev.err.letter", removed: "dev.err.removed" };
  function failed(e) {
    var k = e && ERRS[e.code];
    if (!k) return ui.failed(e);
    ui.dialog({ title: t("dev.takeIn"), emoji: "⚠️", body: [h("p#devErr", null, t(k, { c: e.extra || "?" }))], actions: [{ label: t("close"), kind: "primary" }] });
  }

  /* what a field changed on two devices belongs to, in words */
  function what(k) {
    var i = k.indexOf(":"), kind = k.slice(0, i), id = k.slice(i + 1), st = B.state();
    if (kind === "item" && st.items[id]) return t("dev.k.item", { n: st.items[id].name });
    if (kind === "settings") return t("dev.k.settings");
    if (kind === "user" && st.users[id]) return t("dev.k.user", { n: st.users[id].name });
    if (kind === "booking") { var b = (st.bookings || []).filter(function (x) { return x.id === id; })[0]; if (b) return t("dev.k.booking", { n: b.no }); }
    return t("dev.k.other", { k: kind });
  }
  function field(f) { return String(f).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(); }

  /* the pairing code, in its groups of four, as the Master Key is shown */
  function codeGrid(code) {
    return h("ol.master-grid.dev-code#devCode", { "aria-label": t("dev.codeAria") }, E.crypto.groups(code).map(function (g, i) {
      return h("li", null, [h("span.mg-n", null, String(i + 1)), h("span.mg-g.mono", null, g)]);
    }));
  }

  V.section = function (sec) {
    if (B.mode === "practice") return sec("set-devices", "set.devices", "tip.devices", [h("p.hint", null, t("dev.practice"))]);
    var list = h("ul.dev-list#devList");
    var file = h("input#devTakeFile", { type: "file", accept: ".lakay,.json,application/json", hidden: true });
    function draw() {
      U.clear(list);
      B.devices().forEach(function (d) { list.appendChild(row(d)); });
    }
    function row(d) {
      var expired = d.status === "invited" && d.expires && Date.parse(d.expires) < Date.now();
      var state = d.status === "invited" ? (expired ? t("dev.st.expired", { d: when(d.expires) }) : t("dev.st.invited", { d: when(d.expires) }))
        : d.status === "cancelled" ? t("dev.st.cancelled") : d.status === "removed" ? t("dev.st.removed", { d: day(d.removed) })
        : d.joined ? t("dev.st.joined", { d: day(d.joined) }) : "";
      var facts = [h("b", null, [t("dev.letter", { c: d.code }), d.name ? " · " + d.name : "", d.me ? " · " + t("dev.this") : ""])];
      if (state) facts.push(h("small" + (expired ? ".warn" : ""), null, state));
      if (!d.me && d.status === "joined") {
        facts.push(h("small", null, d.at ? t("dev.heard", { d: when(d.at) }) : t("dev.never")));
        var n = (d.behind || 0) + (d.behindOthers || 0);
        facts.push(h("small" + (n ? ".dev-carry" : ""), { "data-behind": String(n) }, n ? count(n, "dev.carry1", "dev.carry") : t("dev.inStep")));
      }
      var keys = [];
      var live = d.status === "joined" || (d.status === "invited" && !expired);
      if (!d.me && live) keys.push(h("button.key.sm.primary", { type: "button", "data-save": d.code, onclick: function () { saveFor(d); } }, [ui.emo("💾"), t("dev.saveFor", { c: d.code })]));
      if (d.status === "joined" || d.status === "invited") keys.push(h("button.key.sm", { type: "button", "data-name": d.code, onclick: function () { rename(d); } }, [ui.emo("🏷️"), t("dev.rename")]));
      if (!d.me && (d.status === "joined" || d.status === "invited")) keys.push(h("button.key.sm.danger", { type: "button", "data-remove": d.code, onclick: function () { remove(d); } },
        d.status === "invited" ? t("dev.cancelInv") : t("dev.remove")));
      return h("li.dev-row" + (d.me ? ".me" : "") + (d.status === "removed" || d.status === "cancelled" || expired ? ".off" : ""), { "data-dev": d.code },
        [h("span.dev-jewel" + (d.me ? ".me" : ""), { "aria-hidden": "true" }, d.code), h("div.dev-t", null, facts), keys.length ? h("div.dev-keys", null, keys) : null]);
    }
    function saveFor(d) {
      B.makeBundleFor(d.id).then(function (text) {
        return ui.saveFile(fileName(["Lakay changes", B.device.code, "for", d.code, stamp()]), "application/json", text);
      }).then(function () { ui.toast(t("dev.saved", { c: d.code }), "good"); }, failed);
    }
    function rename(d) {
      var input = ui.input({ id: "devRename", type: "text", maxlength: "40", autocomplete: "off", value: d.name || "" });
      ui.dialog({ title: t("dev.renameH", { c: d.code }), emoji: "🏷️", body: [ui.field("dev.nameShort", input)], focus: "#devRename",
        actions: [{ label: t("cancel") }, { label: t("save"), kind: "primary", id: "devRenameSave", onClick: function (close) {
          B.renameDevice(d.id, input.value).then(function () { close(); ui.toast(t("dev.renamed"), "good"); draw(); }, ui.failed);
          return false;
        } }] });
    }
    function remove(d) {
      var inv = d.status === "invited";
      ui.confirm(t(inv ? "dev.cancelQ" : "dev.removeQ", { c: d.code }), t(inv ? "dev.cancelP" : "dev.removeP"), t(inv ? "dev.cancelInv" : "dev.remove"), "danger").then(function (yes) {
        if (!yes) return;
        B.removeDevice(d.id).then(function () { ui.toast(t(inv ? "dev.cancelledT" : "dev.removedT", { c: d.code }), "good"); draw(); }, ui.failed);
      });
    }
    function addDevice() {
      var name = ui.input({ id: "devName", type: "text", maxlength: "40", autocomplete: "off" });
      var pw = ui.input({ id: "devPw", type: "password", autocomplete: "current-password" });
      ui.dialog({ title: t("dev.addH"), emoji: "📲", wide: true, focus: "#devName", body: [h("p", null, t("dev.addP")), ui.field("dev.nameL", name), ui.field("dev.pwL", pw, { required: true })],
        actions: [{ label: t("cancel") }, { label: t("dev.prepare"), kind: "primary", id: "devPrepare", onClick: function (close, btn) {
          ui.fieldError(pw, "");
          if (!pw.value) { ui.fieldError(pw, t("door.needPassword")); return false; }
          btn.disabled = true; btn.textContent = t("dev.preparing");
          B.prepareInvite(pw.value, name.value).then(function (r) { pw.value = ""; close(); draw(); ready(r); }, function (e) {
            btn.disabled = false; btn.textContent = t("dev.prepare");
            if (e && e.code === "wrong") ui.fieldError(pw, t("ld.wrongPw")); else ui.failed(e);
          });
          return false;
        } }] });
    }
    /* the invitation made: the joining file to save, and the code, shown this once */
    function ready(r) {
      var store = (B.state() && B.state().settings.storeName) || "Lakay", fname = fileName(["Lakay join", store, r.device.code]);
      function saveIt() { ui.saveFile(fname, "application/json", r.file).then(function () { ui.toast(t("dev.joinSaved"), "good"); }); }
      ui.dialog({ title: t("dev.readyH", { c: r.device.code }), emoji: "📲", wide: true, body: [
        h("p", null, t("dev.step1")),
        h("div.row-keys", null, h("button.key.primary#devSaveJoin", { type: "button", onclick: saveIt }, [ui.emo("💾"), t("dev.saveJoin")])),
        h("p", null, t("dev.step2")), codeGrid(r.code),
        h("p.hint", null, t("dev.codeOnce", { d: when(r.expires) })), h("p.hint", null, t("dev.step3"))],
        actions: [{ label: t("gotIt"), kind: "primary", id: "devDone" }] });
    }
    /* what came in: from whom, how many changes, and anything changed on two devices while they were apart */
    function report(r) {
      var body = [];
      if (!r.lines) body.push(h("p#devTook", null, t("dev.nothing")));
      else {
        body.push(h("p#devTook", null, count(r.lines, "dev.tookN1", "dev.tookN", { c: r.from })));
        var codes = Object.keys(r.chains || {});
        if (codes.length > 1 || (codes[0] && codes[0] !== r.from)) body.push(h("ul.dev-took", null, codes.map(function (c) { return h("li", null, t("dev.tookFrom", { c: c, n: r.chains[c] })); })));
      }
      if (r.clashes && r.clashes.length) {
        body.push(h("h3.status-h", null, t("dev.clashesH")));
        body.push(h("ul.dev-clash#devClashes", null, r.clashes.slice(0, 30).map(function (x) { return h("li", null, t("dev.clashLine", { what: what(x.k) + " (" + field(x.f) + ")", w: x.won })); })));
      }
      if (r.setAside && r.setAside.length) body.push(h("p.hint", null, t("dev.setAside", { c: r.setAside.join(", ") })));
      ui.dialog({ title: t("dev.tookH"), emoji: "📥", wide: true, body: body, actions: [{ label: t("close"), kind: "primary", id: "devTookOk" }] });
      draw();
    }
    file.addEventListener("change", function () {
      var f = file.files && file.files[0]; if (!f) return;
      f.text().then(function (text) {
        file.value = "";
        var kind = null; try { kind = JSON.parse(text).format; } catch (e) { }
        if (kind === "lakay-join") { failedJoin(); return; }
        return B.takeBundle(text).then(function (r) { report(r); if (ui.refreshTop) ui.refreshTop(); }, failed);
      });
    });
    function failedJoin() { ui.dialog({ title: t("dev.takeIn"), emoji: "⚠️", body: [h("p#devErr", null, t("dev.err.joinfile"))], actions: [{ label: t("close"), kind: "primary" }] }); }
    draw();
    return sec("set-devices", "set.devices", "tip.devices", [h("p", null, t("dev.intro")), list,
      h("div.row-keys", null, [file,
        h("button.key.primary", { type: "button", id: "devAdd", onclick: addDevice }, [ui.emo("📲"), t("dev.add")]),
        h("button.key", { type: "button", id: "devTake", onclick: function () { file.click(); } }, [ui.emo("📥"), t("dev.takeIn")])])]);
  };
})();
