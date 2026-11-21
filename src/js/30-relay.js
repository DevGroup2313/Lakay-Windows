/* LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   Devices in step, stage 3 (Build 26): the relays. Lakay Relay (relay/lakay_relay.py) runs on the owner's own Mac minis
   at home. Each device of the store leaves its new changes there, sealed, and takes the other devices' changes, by
   itself: when the store opens, every two minutes while it is open, two seconds after a change, and when the connection
   comes back. Every device uses every relay, so either Mac mini can be off; a change taken twice brings nothing new.
   The relays' addresses are the only ones the page's security policy lets it reach (connect-src, written by build.py
   from build.json); the page reads them back from its own policy. The owner connects each device with the owner's
   password (and, the first time, a relay's claim code); a device's own key never leaves it.
   The books' side is in 04-books.js (relayBundle, relayTake, relayState, saveRelayState, relayOwnerKey, relayFloor). */
"use strict";
(function () {
  var U = E.util, h = U.h, t = E.t, B = E.books, C = E.crypto;
  var R = E.relay = {};
  var EVERY = 120000, AFTER_CHANGE = 2000, GAP_DAYS = 7, FRESH = 6 * 60000;
  var rs = null, timer = null, soon = null, running = null, again = false;
  var last = { at: null, took: 0, clashes: [], problems: [], setAside: [], seen: true };

  /* the relays this copy of Lakay may reach: exactly the addresses its own security policy allows */
  R.addresses = function () {
    var m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'), c = m ? m.getAttribute("content") || "" : "";
    var d = /(?:^|;)\s*connect-src\s+([^;]*)/.exec(c);
    if (!d) return [];
    return d[1].trim().split(/\s+/).filter(function (x) { return /^https?:\/\/[A-Za-z0-9.\-:\[\]]+$/.test(x); }).map(function (x) { return x.replace(/\/+$/, ""); });
  };
  R.label = function (a) { return String(a).replace(/^https?:\/\//, ""); };
  function usable() { return B.isOpen && B.mode !== "practice" && !(B.drilling && B.drilling()) && !!B.storeId(); }

  /* ---------- talking to a relay ---------- */
  function call(addr, method, path, o) {
    o = o || {};
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, o.wait || 20000);
    var init = { method: method, headers: {}, cache: "no-store", credentials: "omit", mode: "cors", referrerPolicy: "no-referrer" };
    if (ctl) init.signal = ctl.signal;
    if (o.auth) init.headers.Authorization = o.auth;
    if (o.raw != null) { init.body = o.raw; init.headers["Content-Type"] = "application/json"; }
    else if (o.body) { init.body = JSON.stringify(o.body); init.headers["Content-Type"] = "application/json"; }
    return fetch(addr + path, init).then(function (r) {
      return r.text().then(function (x) {
        clearTimeout(tm);
        var j = null; try { j = x ? JSON.parse(x) : null; } catch (e) { }
        if (!r.ok) { var e2 = new Error("relay"); e2.code = (j && j.error) || "http"; e2.status = r.status; throw e2; }
        return j;
      });
    }, function () { clearTimeout(tm); var e3 = new Error("unreachable"); e3.code = "unreachable"; throw e3; });
  }
  function bytesOf(b64u) { return U.b64d(b64u.replace(/-/g, "+").replace(/_/g, "/") + "="); }
  function hashOf(b64u) { return C.sha256hexOf(bytesOf(b64u)); }
  function deviceAuth() { return "Lakay device=" + B.device.id + ", key=" + rs.key; }

  /* ---------- this device's record of the relays (sealed, kept on this device alone) ---------- */
  function load() {
    return B.relayState().then(function (x) { rs = x || { v: 1, key: null, relays: {} }; rs.relays = rs.relays || {}; return rs; });
  }
  function save() { return rs && usable() ? B.saveRelayState(rs).catch(function () { }) : Promise.resolve(); }
  R.connected = function () { return !!(rs && rs.key && R.addresses().some(function (a) { return rs.relays[a] && rs.relays[a].on; })); };
  R.status = function () {
    return R.addresses().map(function (a) {
      var r = rs && rs.relays[a];
      return { a: a, on: !!(r && r.on), ok: r ? r.ok || null : null, err: r ? r.err || null : null, waiting: r && r.deferred ? r.deferred.length : 0 };
    });
  };
  R.last = function () { return last; };

  /* ---------- the owner: claiming a relay, connecting this device, closing a removed device's key ---------- */
  /* Asks each relay whether it is claimed, and by this store: for the connecting window. */
  R.check = function () {
    var sid = B.storeId();
    return Promise.all(R.addresses().map(function (a) {
      return call(a, "GET", "/v1/" + sid + "/hello", { wait: 8000 }).then(function (hi) {
        return { a: a, reach: true, claimed: !!hi.claimed, mine: !!hi.store };
      }, function () { return { a: a, reach: false }; });
    }));
  };
  R.connect = function (password, claims) {
    if (!usable()) return Promise.reject(Object.assign(new Error("locked"), { code: "locked" }));
    var sid = B.storeId(), ownerKey, hashes, out = {};
    return B.relayOwnerKey(password).then(function (k) { ownerKey = k; return load(); }).then(function () {
      if (!rs.key) rs.key = C.b64url(U.rnd(32));
      return Promise.all([hashOf(ownerKey), hashOf(rs.key)]);
    }).then(function (hs) {
      hashes = hs;
      return R.addresses().reduce(function (p, a) {
        return p.then(function () {
          return call(a, "GET", "/v1/" + sid + "/hello", { wait: 8000 }).then(function (hi) {
            if (!hi.claimed) {
              var code = claims && claims[a];
              if (!code) { out[a] = "needclaim"; return null; }
              return call(a, "PUT", "/v1/" + sid + "/owner", { body: { claim: code, owner: hashes[0] } });
            }
            if (!hi.store) { out[a] = "otherstore"; return null; }
            return null;
          }).then(function () {
            if (out[a]) return null;
            return call(a, "PUT", "/v1/" + sid + "/devices/" + B.device.id, { body: { key: hashes[1] }, auth: "Lakay owner=" + ownerKey }).then(function () {
              var r = rs.relays[a];
              if (!r || !r.on) r = rs.relays[a] = { cursor: 0, have: B.relayFloor(), deferred: [] };
              r.on = true; r.err = null; out[a] = "ok";
            });
          }).catch(function (e) { out[a] = (e && e.code) || "unreachable"; });
        });
      }, Promise.resolve());
    }).then(function () { return save(); }).then(function () {
      if (R.connected()) { R.start(); schedule(300); }
      paint();
      return out;
    });
  };
  /* A device removed from the store: its key is closed at every relay that can be reached. */
  R.closeDevice = function (devId, password) {
    var sid = B.storeId(), out = {};
    return B.relayOwnerKey(password).then(function (ownerKey) {
      return R.addresses().reduce(function (p, a) {
        return p.then(function () {
          return call(a, "DELETE", "/v1/" + sid + "/devices/" + devId, { auth: "Lakay owner=" + ownerKey }).then(function () { out[a] = "ok"; },
            function (e) { out[a] = (e && e.code) || "unreachable"; });
        });
      }, Promise.resolve());
    }).then(function () { return out; });
  };

  /* ---------- the exchange ---------- */
  function one(a, sum) {
    var r = rs.relays[a], sid = B.storeId(), me = B.device.id, auth = deviceAuth();
    function took(rep) {
      Object.keys(rep.upTo || {}).forEach(function (d) { r.have[d] = Math.max(r.have[d] || 0, rep.upTo[d]); });
      sum.took += rep.real || 0;
      (rep.clashes || []).forEach(function (c) { sum.clashes.push(c); });
      (rep.setAside || []).forEach(function (c) { if (sum.setAside.indexOf(c) < 0) sum.setAside.push(c); });
    }
    function problem(e, from) { sum.problems.push({ code: (e && e.code) || "error", c: (e && e.extra) || from || "?", a: a }); }
    /* 1. the bundles that waited for earlier changes */
    var waiting = r.deferred || [];
    r.deferred = [];
    return waiting.reduce(function (p, d) {
      return p.then(function () {
        return B.relayTake(d.text).then(took, function (e) {
          if (e && e.code === "gap" && Date.now() - Date.parse(d.since) < GAP_DAYS * 864e5) r.deferred.push(d);
          else if (e && e.code === "locked") throw e;
          else problem(e);
        });
      });
    }, Promise.resolve()).then(function () {
      /* 2. the new bundles, page after page, in the order they were left */
      function page() {
        return call(a, "GET", "/v1/" + sid + "/bundles?after=" + (r.cursor || 0), { auth: auth }).then(function (res) {
          if (r.cursor > 0 && res.first > r.cursor + 1) problem({ code: "lost" });
          return (res.bundles || []).reduce(function (p, b) {
            return p.then(function () {
              r.cursor = Math.max(r.cursor || 0, b.n);
              if (b.from === me) return null;
              return B.relayTake(b.text).then(took, function (e) {
                if (e && e.code === "gap") r.deferred.push({ n: b.n, from: b.from, text: b.text, since: new Date().toISOString() });
                else if (e && e.code === "locked") throw e;
                else problem(e);
              });
            });
          }, Promise.resolve()).then(save).then(function () { if (res.more) return page(); return null; });
        });
      }
      return page();
    }).then(function () {
      /* 3. what this relay lacks of this device's changes (and of those it holds of the others) */
      return B.relayBundle(r.have).then(function (bd) {
        if (!bd.lines) return null;
        return call(a, "POST", "/v1/" + sid + "/bundles", { auth: auth, raw: bd.text, wait: 60000 }).then(function () {
          Object.keys(bd.have).forEach(function (d) { r.have[d] = Math.max(r.have[d] || 0, bd.have[d]); });
        });
      });
    }).then(function () { r.ok = new Date().toISOString(); r.err = null; }, function (e) {
      r.err = { code: (e && e.code) || "error", at: new Date().toISOString() };
    });
  }
  R.run = function () {
    if (running) { again = true; return running; }
    if (!rs || !rs.key || !usable()) return Promise.resolve(null);
    var list = R.addresses().filter(function (a) { return rs.relays[a] && rs.relays[a].on; });
    if (!list.length) return Promise.resolve(null);
    var sum = { took: 0, clashes: [], problems: [], setAside: [] };
    running = list.reduce(function (p, a) { return p.then(function () { return usable() ? one(a, sum) : null; }); }, Promise.resolve())
      .then(save).then(function () {
        last.at = new Date().toISOString();
        if (sum.took || sum.clashes.length || sum.problems.length || sum.setAside.length) {
          last.took = sum.took; last.clashes = sum.clashes; last.problems = sum.problems; last.setAside = sum.setAside;
          last.seen = !(sum.clashes.length || sum.problems.length || sum.setAside.length);
        }
        paint();
        if (sum.took && E.ui && E.ui.afterRelay) E.ui.afterRelay(sum);
        return sum;
      }).catch(function (e) { console.error(e); return null; }).then(function (r) {
        running = null;
        if (again) { again = false; schedule(AFTER_CHANGE); }
        return r;
      });
    return running;
  };
  function schedule(ms) { clearTimeout(soon); soon = setTimeout(function () { soon = null; R.run(); }, ms); }
  R.start = function () {
    clearInterval(timer); timer = null;
    if (!R.addresses().length || !usable()) { paint(); return Promise.resolve(); }
    return load().then(function () {
      if (R.connected()) { timer = setInterval(function () { R.run(); }, EVERY); schedule(1200); }
      paint();
    });
  };
  R.stop = function () { clearInterval(timer); clearTimeout(soon); timer = soon = null; rs = null; last = { at: null, took: 0, clashes: [], problems: [], setAside: [], seen: true }; paint(); };
  B.on("open", function () { setTimeout(function () { R.start(); }, 0); });
  B.on("lock", function () { R.stop(); });
  B.on("drill", function (on) { if (!on && timer) schedule(AFTER_CHANGE); });
  B.on("change", function (line) { if (timer && line && line.type !== "sync.took") schedule(AFTER_CHANGE); });
  try { window.addEventListener("online", function () { if (timer) schedule(500); }); } catch (e) { }

  /* ---------- the sign in the top bar ---------- */
  function kind() {
    if (!rs || !R.connected() || B.mode === "practice") return null;
    var st = R.status().filter(function (s) { return s.on; });
    if (st.some(function (s) { return s.err && s.err.code === "key"; }) && !st.some(function (s) { return !s.err; })) return "closed";
    if (st.some(function (s) { return s.ok && !s.err && Date.now() - Date.parse(s.ok) < FRESH; })) return "ok";
    if (!last.at && st.every(function (s) { return !s.err; })) return "ok";
    return "wait";
  }
  function lastOk() { var best = null; R.status().forEach(function (s) { if (s.ok && (!best || s.ok > best)) best = s.ok; }); return best; }
  function when(iso) { if (!iso) return ""; var d = new Date(iso); return E.fmtTime(d); }
  function tip(k) {
    if (k === "ok") return lastOk() ? t("sign.tipOk", { d: when(lastOk()) }) : t("sign.tipStart");
    if (k === "closed") return t("sign.tipClosed");
    return t("sign.tipWait");
  }
  R.sign = function () {
    var k = kind();
    if (!k) return null;
    var note = !last.seen;
    return h("button.cl-key.relay-sign#relaySign." + k + (note ? ".note" : ""), { type: "button", title: tip(k), onclick: R.panel },
      [h("span.rdot", { "aria-hidden": "true" }), h("span.nm", null, t("sign." + k)), note ? h("span.cnt", { "aria-hidden": "true" }) : null]);
  };
  function paint() {
    var old = document.getElementById("relaySign"), cl = document.getElementById("topCluster"), el = R.sign();
    if (old && el) old.replaceWith(el);
    else if (old) old.remove();
    else if (el && cl) { var pill = document.getElementById("statusPill"); if (pill && pill.nextSibling) cl.insertBefore(el, pill.nextSibling); else cl.appendChild(el); }
    if (E.devices && E.devices.paintRelays) E.devices.paintRelays();
  }
  R.paint = paint;

  /* what the sign opens: each relay's state, the last exchange, and anything to see */
  R.panel = function () {
    var ui = E.ui, body = [];
    var rows = R.status().filter(function (s) { return s.on; }).map(function (s) {
      return h("li.rel-row", { "data-relay": s.a }, [h("span.rel-dot." + (s.err ? (s.err.code === "key" ? "closed" : "wait") : "ok"), { "aria-hidden": "true" }),
        h("div.rel-t", null, [h("b.mono", null, R.label(s.a)), h("small", null, R.stateText(s))])]);
    });
    body.push(h("p", null, t("rel.panelP")));
    body.push(h("ul.rel-list#relPanelList", null, rows));
    body.push(h("p#relLast", null, last.at ? (last.took ? t(last.took === 1 ? "rel.took1" : "rel.took", { n: last.took }) : t("rel.tookNone")) : t("rel.notYet")));
    body = body.concat(R.problemsList());
    last.seen = true; paint();
    ui.dialog({ title: t("set.devices"), emoji: "🛰️", wide: true, body: body, actions: [
      { label: t("close") },
      { label: t("rel.now"), kind: "primary", id: "relNow", onClick: function (close, btn) {
        btn.disabled = true; btn.textContent = t("rel.running");
        R.run().then(function () { close(); R.panel(); });
        return false;
      } }] });
  };
  R.stateText = function (s) {
    if (!s.on) return t("rel.st.off");
    if (s.err && s.err.code === "key") return t("rel.st.closed");
    if (s.err) return t("rel.st.wait", { d: when(s.err.at) });
    if (s.ok) return t("rel.st.ok", { d: when(s.ok) }) + (s.waiting ? " · " + t("rel.st.waiting", { n: s.waiting }) : "");
    return t("rel.st.never");
  };
  /* the changes made on two devices while they were apart, and anything set aside, from the last exchange */
  R.problemsList = function () {
    var out = [], what = E.devices && E.devices.what, field = E.devices && E.devices.field;
    if (last.clashes.length) {
      out.push(h("h3.status-h", null, t("dev.clashesH")));
      out.push(h("ul.dev-clash#relClashes", null, last.clashes.slice(0, 30).map(function (x) {
        return h("li", null, t("dev.clashLine", { what: (what ? what(x.k) : x.k) + " (" + (field ? field(x.f) : x.f) + ")", w: x.won }));
      })));
    }
    var P = { gap: "rel.pb.gap", lost: "rel.pb.lost", fork: "dev.err.fork", chain: "dev.err.fork", old: "dev.err.old", letter: "dev.err.letter", removed: "dev.err.removed", notbundle: "dev.err.notbundle", otherstore: "dev.err.otherstore" };
    if (last.problems.length) out.push(h("ul.rel-problems#relProblems", null, last.problems.slice(0, 12).map(function (x) {
      return h("li", null, t(P[x.code] || "rel.pb.other", { c: x.c, a: R.label(x.a) }));
    })));
    if (last.setAside.length) out.push(h("p.hint", null, t("dev.setAside", { c: last.setAside.join(", ") })));
    return out;
  };
})();
