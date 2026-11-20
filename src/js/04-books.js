/* EMPORIUM | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
   The books: setting up a store, opening and locking it, the ledger, stock, sales, reports, backups, and verification.
   Every change is one ledger line, written in the same transaction as the records it changes. */
"use strict";
(function () {
  var U = E.util, C = E.crypto, D = E.db;
  var B = E.books = { isOpen: false };
  var KEY = null, ID = null, state = null, listeners = {}, doorMeta = null;
  var ZERO = "0000000000000000000000000000000000000000000000000000000000000000";

  B.on = function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); };
  B.off = function (name, fn) { var l = listeners[name], i = l ? l.indexOf(fn) : -1; if (i >= 0) l.splice(i, 1); };
  function emit(name, data) { (listeners[name] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }

  function aadEnv(id, which) { return "emporium|v1|" + id + "|" + which; }
  function aadRec(id, k) { return "emporium|r|" + id + "|" + k; }
  function aadLine(id, seq) { return "emporium|j|" + id + "|" + seq; }
  /* Build 24: another device's ledger lines, kept beside this device's own, and the sealed bundle that carries them */
  function aadPeer(id, dev, seq) { return "emporium|p|" + id + "|" + dev + "|" + seq; }
  function aadBundle(id, dev) { return "emporium|b|" + id + "|" + dev; }
  function peerKey(dev, seq) { return "p:" + dev + ":" + String(seq).padStart(9, "0"); }
  function idBytes(id) { var u = new Uint8Array(id.length / 2); for (var i = 0; i < u.length; i++) u[i] = parseInt(id.substr(i * 2, 2), 16); return u; }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function err(code, extra) { var e = new Error(code); e.code = code; if (extra) e.extra = extra; return e; }

  /* ---------- the device and the door ---------- */
  B.device = null;
  B.boot = function () {
    return D.get("meta", "device").then(function (dev) {
      if (dev) return dev;
      dev = { id: U.uid("d"), code: "A", created: new Date().toISOString() };
      return D.write([{ store: "meta", key: "device", value: dev }]).then(function () { return dev; });
    }).then(function (dev) {
      B.device = dev;
      return Promise.all([D.get("meta", "vault"), D.get("meta", "door"), D.get("meta", "custom")]);
    }).then(function (r) {
      E.custom = E.cleanCustom ? E.cleanCustom(r[2]) : (r[2] || null);
      doorMeta = r[1] || null;
      return { hasStore: !!r[0], door: r[1] || null, vault: r[0] || null, practice: !!(r[0] && r[0].practice) };
    });
  };

  /* ---------- one clock for the books ----------
     Every time the books write comes from here. Only the practice store may set it back (B._at), to lay down its
     sample weeks of sales; the store's own books always write the time it is. */
  function clock() { return (B.mode === "practice" && B._at) ? new Date(B._at) : new Date(); }
  B.mode = "real";

  /* ---------- the owner's user name at the door (as Ingenium keeps its own: plain, so the sign-in can greet) ---------- */
  B.setDoorUser = function (name) {
    var n = String(name || "").normalize("NFC").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!n) return Promise.resolve(false);
    return D.get("meta", "door").then(function (d) {
      d = d || {}; if (d.user === n) return false;
      d.user = n; doorMeta = d; return D.write([{ store: "meta", key: "door", value: d }]).then(function () { return true; });
    });
  };
  B.sameName = function (a, b) { function n(x) { return String(x || "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase(); } return n(a) === n(b); };

  /* ---------- the default shelves of the store ---------- */
  var DEFAULT_CATS = ["music", "movies", "perfume", "grocery", "drinks", "food", "services", "other"];

  /* ---------- setting up a store: prepared in memory, written only once the Master Key is confirmed ---------- */
  B.prepareSetup = function (o) {
    var pending = { o: o };
    return C.newStoreKey().then(function (k) {
      pending.key = k;
      return C.newMaster();
    }).then(function (m) {
      pending.master = m;
      pending.id = U.hex(U.rnd(16));
      pending.salt = U.rnd(16);
      return C.passwordKey(o.password, pending.salt);
    }).then(function (kek) {
      pending.kek = kek;
      return C.wrap(pending.key, kek, aadEnv(pending.id, "owner"));
    }).then(function (envOwner) {
      pending.envOwner = envOwner;
      return C.masterKey(pending.master.secret, idBytes(pending.id));
    }).then(function (kekM) {
      return C.wrap(pending.key, kekM, aadEnv(pending.id, "master"));
    }).then(function (envMaster) {
      pending.envMaster = envMaster;
      delete pending.o.password;
      return { code: pending.master.code, finish: function () { return finishSetup(pending); } };
    });
  };
  function finishSetup(p) {
    var o = p.o, now = new Date(), id = p.id;
    var vault = { v: 1, app: "emporium", storeId: id, created: now.toISOString(),
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: C.ITERATIONS },
      owner: { salt: U.b64e(p.salt), iv: p.envOwner.iv, ct: p.envOwner.ct }, master: p.envMaster };
    var settings = { storeName: o.storeName, ownerName: o.ownerName, currency: o.currency || "USD", taxes: [],
      weekStart: 1, lockMinutes: 15, receiptNote: "", created: now.toISOString() };
    var recs = [{ kind: "settings", id: "main", value: settings },
      { kind: "user", id: "owner", value: { id: "owner", name: o.ownerName, role: "owner", created: now.toISOString() } },
      { kind: "counter", id: "receipt", value: { next: 1 } }];
    DEFAULT_CATS.forEach(function (c, i) { recs.push({ kind: "cat", id: c, value: { id: c, key: "cat." + c, order: i } }); });
    var line = { seq: 1, at: now.toISOString(), day: U.dayKey(now), by: "owner", dev: B.device.id, type: "store.created",
      data: { storeName: o.storeName, ownerName: o.ownerName, currency: settings.currency }, prev: ZERO, build: E.BUILD.number };
    return U.sha256hex(U.canon(line)).then(function (hash) {
      var head = { seq: 1, hash: hash, at: line.at };
      return Promise.all([C.seal(p.key, line, aadLine(id, 1)), C.seal(p.key, head, aadRec(id, "head:main"))]
        .concat(recs.map(function (r) { return C.seal(p.key, r.value, aadRec(id, r.kind + ":" + r.id)); })));
    }).then(function (sealed) {
      var ops = [{ store: "meta", key: "vault", value: vault }, { store: "meta", key: "door", value: { storeName: o.storeName, user: o.ownerName, created: now.toISOString() } },
        { store: "journal", key: 1, value: sealed[0], add: true }, { store: "rec", key: "head:main", value: sealed[1] }];
      recs.forEach(function (r, i) { ops.push({ store: "rec", key: r.kind + ":" + r.id, value: sealed[i + 2] }); });
      return D.write(ops);
    }).then(function () {
      D.persist();
      /* the new store is opened with a key that cannot be copied out of memory: the owner's envelope, opened again */
      return C.unwrap(p.envOwner, p.kek, aadEnv(id, "owner"), false);
    }).then(function (key) { p.key = null; p.kek = null; return load(vault, key); });
  }

  /* ---------- opening ---------- */
  B.openWithPassword = function (password) {
    return D.get("meta", "vault").then(function (v) {
      if (!v) throw err("nostore");
      return C.passwordKey(password, U.b64d(v.owner.salt), v.kdf.iterations).then(function (kek) {
        return C.unwrap(v.owner, kek, aadEnv(v.storeId, "owner"), false);
      }).then(function (key) { return load(v, key); }, function (e) { if (e && e.code) throw e; throw err("wrong"); });
    });
  };
  /* The Master Key opens the store and leaves a key in hand with which a new password is set. */
  B.checkMaster = function (text) {
    return C.readMaster(text).then(function (secret) {
      if (!secret) throw err("badcode");
      return D.get("meta", "vault").then(function (v) {
        return C.masterKey(secret, idBytes(v.storeId)).then(function (kek) {
          return C.unwrap(v.master, kek, aadEnv(v.storeId, "master"), true);
        }).then(function (key) { return { vault: v, key: key }; }, function () { throw err("wrongmaster"); });
      });
    });
  };
  B.resetPasswordWithMaster = function (handle, newPassword) {
    var v = clone(handle.vault), salt = U.rnd(16);
    var kek;
    return C.passwordKey(newPassword, salt).then(function (k) { kek = k; return C.wrap(handle.key, kek, aadEnv(v.storeId, "owner")); }).then(function (env) {
      v.owner = { salt: U.b64e(salt), iv: env.iv, ct: env.ct };
      return D.write([{ store: "meta", key: "vault", value: v }]).then(function () { return C.unwrap(v.owner, kek, aadEnv(v.storeId, "owner"), false); });
    }).then(function (key) { handle.key = null; return load(v, key); }).then(function () {
      return B.change(function () { return { type: "owner.password.reset", data: { with: "master" } }; });
    });
  };

  function load(vault, key, userId) {
    ID = vault.storeId;
    return D.entries("rec").then(function (entries) {
      var st = { settings: null, users: {}, cats: {}, items: {}, sales: [], moves: [], shifts: [], services: [], train: {}, plans: {}, course: null, slots: [], rota: null, swaps: [], provs: {}, settles: [], stmts: [], payset: null, rates: {}, paids: [], counters: {}, pad: {}, notes: {}, devices: {}, sync: null, stamps: {}, head: null, unreadable: [] };
      /* each person's notes are their own: a sign-in opens only the notes of the one signing in (the practice store opens
         all of its sample people's, since it changes from one to another) */
      var mine = "notes:" + (userId || "owner"), practice = B.mode === "practice";
      return Promise.all(entries.map(function (e) {
        if (!practice && /^notes:/.test(e[0]) && e[0] !== mine) return null;
        return C.open(key, e[1], aadRec(ID, e[0])).then(function (val) { return [e[0], val]; }, function () { st.unreadable.push(e[0]); return null; });
      })).then(function (rows) {
        rows.forEach(function (r) {
          if (!r) return;
          /* from Build 24 a record is sealed with the stamps of the lines that last wrote each of its fields */
          var v = r[1];
          if (v && typeof v === "object" && v["~s"] && Object.prototype.hasOwnProperty.call(v, "~v")) { st.stamps[r[0]] = v["~s"]; v = v["~v"]; }
          put(st, r[0], v);
        });
        st.sales.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
        st.moves.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
        st.shifts.sort(function (a, b) { return a.in < b.in ? -1 : a.in > b.in ? 1 : 0; });
        st.services.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
        st.slots.sort(slotOrder);
        st.swaps.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
        [st.settles, st.stmts, st.paids].forEach(function (list) { list.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; }); });
        if (!st.head || !st.settings) throw err("damaged");
        return D.get("journal", st.head.seq).then(function (env) {
          if (!env) { st.headProblem = true; return; }
          return C.open(key, env, aadLine(ID, st.head.seq)).then(function (line) {
            return U.sha256hex(U.canon(line)).then(function (h) { if (h !== st.head.hash) st.headProblem = true; });
          }, function () { st.headProblem = true; });
        }).then(function () { return st; });
      });
    }).then(function (st) {
      var u = st.users[userId || "owner"];
      if (!u && (userId || "owner") === "owner") throw err("damaged");
      if (!u || (u.role !== "owner" && u.active === false)) throw err("wrong");
      KEY = key; state = st; B.isOpen = true;
      B.user = u;
      E.settings = st.settings;
      emit("open", st);
      return st;
    });
  }
  function put(st, k, v) {
    var i = k.indexOf(":"), kind = k.slice(0, i), id = k.slice(i + 1);
    if (kind === "settings") st.settings = v;
    else if (kind === "head") st.head = v;
    else if (kind === "user") st.users[id] = v;
    else if (kind === "cat") st.cats[id] = v;
    else if (kind === "item") st.items[id] = v;
    else if (kind === "sale") { var j = st.sales.findIndex(function (s) { return s.id === v.id; }); if (j >= 0) st.sales[j] = v; else st.sales.push(v); }
    else if (kind === "move") st.moves.push(v);
    else if (kind === "shift") { var q = st.shifts.findIndex(function (x) { return x.id === v.id; }); if (q >= 0) st.shifts[q] = v; else st.shifts.push(v); }
    else if (kind === "svc") { st.services = st.services || []; var z = st.services.findIndex(function (x) { return x.id === v.id; }); if (z >= 0) st.services[z] = v; else st.services.push(v); }
    else if (kind === "train") { st.train = st.train || {}; st.train[id] = v; }
    else if (kind === "plan") { st.plans = st.plans || {}; st.plans[id] = v; }
    else if (kind === "course") st.course = v;
    else if (kind === "slot") { st.slots = st.slots || []; var si = st.slots.findIndex(function (x) { return x.id === v.id; }); if (si >= 0) st.slots[si] = v; else { st.slots.push(v); st.slots.sort(slotOrder); } }
    else if (kind === "rota") st.rota = v;
    else if (kind === "swap") { st.swaps = st.swaps || []; var wi = st.swaps.findIndex(function (x) { return x.id === v.id; }); if (wi >= 0) st.swaps[wi] = v; else st.swaps.push(v); }
    else if (kind === "prov") { st.provs = st.provs || {}; st.provs[id] = v; }
    else if (kind === "rate") { st.rates = st.rates || {}; st.rates[id] = v; }
    else if (kind === "payset") st.payset = v;
    else if (kind === "booking") { st.bookings = st.bookings || []; var zb = st.bookings.findIndex(function (x) { return x.id === v.id; }); if (zb >= 0) st.bookings[zb] = v; else st.bookings.push(v); }
    else if (kind === "settle" || kind === "stmt" || kind === "paid") {
      var key = kind === "settle" ? "settles" : kind === "stmt" ? "stmts" : "paids"; st[key] = st[key] || [];
      var pi = st[key].findIndex(function (x) { return x.id === v.id; }); if (pi >= 0) st[key][pi] = v; else st[key].push(v);
    }
    else if (kind === "counter") st.counters[id] = v;
    else if (kind === "device") { st.devices = st.devices || {}; st.devices[id] = v; }
    else if (kind === "sync") st.sync = v;
    else if (kind === "pad") st.pad[id] = v;
    else if (kind === "notes") st.notes[id] = (v && Array.isArray(v.notes)) ? v.notes : [];
  }

  /* the record kept under a key ("item:7xk2..."), as the books hold it now (the inverse of put) */
  var LISTS = { sale: "sales", move: "moves", shift: "shifts", svc: "services", slot: "slots", swap: "swaps", booking: "bookings", settle: "settles", stmt: "stmts", paid: "paids" };
  var MAPS = { user: "users", cat: "cats", item: "items", train: "train", plan: "plans", prov: "provs", rate: "rates", counter: "counters", device: "devices", pad: "pad" };
  var ONES = { settings: "settings", course: "course", rota: "rota", payset: "payset", sync: "sync", head: "head" };
  function getRec(st, k) {
    var i = k.indexOf(":"), kind = k.slice(0, i), id = k.slice(i + 1);
    if (ONES[kind]) return st[ONES[kind]] || null;
    if (MAPS[kind]) return (st[MAPS[kind]] && st[MAPS[kind]][id]) || null;
    if (LISTS[kind]) { var l = st[LISTS[kind]] || []; for (var j = l.length - 1; j >= 0; j--) if (l[j].id === id) return l[j]; return null; }
    if (kind === "notes") return st.notes && st.notes[id] ? { notes: st.notes[id] } : null;
    return null;
  }

  B.lock = function (why) {
    if (drill) { state = drill.state; drill = null; }
    var flushed = writeNotes();
    KEY = null; state = null; B.isOpen = false; B.user = null; E.settings = null; ID = null;
    emit("lock", why || "hand");
    return flushed;
  };
  B.state = function () { return state; };

  /* ---------- the practice store ----------
     A store of its own, in its own database, with sample goods and two weeks of sample sales, that opens with no
     sign-in: to see every page, and to train. Its Store Key is sealed by a key kept on this device only, made so that
     it cannot be copied out of the browser; nothing in the practice store is real, and it never touches the store's
     own books, which stay sealed with the owner's password and the Master Key. */
  B.PRACTICE_DB = "emporium-practice";
  function quietLock() { if (drill) { state = drill.state; drill = null; } writeNotes(); KEY = null; state = null; B.isOpen = false; B.user = null; E.settings = null; ID = null; }
  B.useBooks = function (practice) {
    quietLock();
    D.use(practice ? B.PRACTICE_DB : "emporium");
    B.mode = practice ? "practice" : "real";
  };
  B.openPractice = function (progress) {
    B.useBooks(true);
    return B.boot().then(function (r) {
      if (r.vault && r.vault.device) {
        return D.get("meta", "devkey").then(function (kek) {
          if (!kek) throw err("damaged");
          return C.unwrap(r.vault.device, kek, aadEnv(r.vault.storeId, "device"), false).then(function (key) { return load(r.vault, key); }).then(upgradePractice);
        });
      }
      if (r.vault) throw err("damaged");
      return createPractice(progress);
    });
  };
  B.resetPractice = function (progress) {
    B.useBooks(true);
    return notesSettled().then(function () { return D.wipe(); }).then(function () { return createPractice(progress); });
  };
  function createPractice(progress) {
    var id = U.hex(U.rnd(16)), now = new Date(), storeKey, kek, env;
    return C.newStoreKey().then(function (k) {
      storeKey = k;
      return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["wrapKey", "unwrapKey"]);
    }).then(function (k2) { kek = k2; return C.wrap(storeKey, kek, aadEnv(id, "device")); }).then(function (e) {
      env = e;
      var start = new Date(now.getTime() - 16 * 86400000);
      var settings = { storeName: E.t("practice.store"), ownerName: E.t("practice.owner"), currency: "USD",
        taxes: [{ id: "tx1", name: E.t("practice.tax"), rate: 7000 }], weekStart: 1, lockMinutes: 15, receiptNote: "", created: start.toISOString(), practice: true,
        payments: { methods: ["cash", "card", "applepay", "googlepay"], machine: "", others: ["Zelle", "Cash App"], askCode: "optional", askLast4: "yes" } };
      var recs = [{ kind: "settings", id: "main", value: settings },
        { kind: "user", id: "owner", value: { id: "owner", no: 1001, name: settings.ownerName, role: "owner", created: start.toISOString() } },
        { kind: "counter", id: "receipt", value: { next: 1 } }];
      /* two sample people, to see the store as they see it: a cashier and a manager */
      SAMPLE_PEOPLE.forEach(function (x) {
        recs.push({ kind: "user", id: x[0], value: { id: x[0], no: x[1], name: x[2], role: "staff", preset: x[3], access: B.PRESETS[x[3]].slice(), active: true,
          mustChange: false, created: start.toISOString(), updated: start.toISOString() } });
      });
      DEFAULT_CATS.forEach(function (c, i) { recs.push({ kind: "cat", id: c, value: { id: c, key: "cat." + c, order: i } }); });
      var line = { seq: 1, at: start.toISOString(), day: U.dayKey(start), by: "owner", dev: B.device.id, type: "store.created",
        data: { storeName: settings.storeName, ownerName: settings.ownerName, currency: "USD", practice: true }, prev: ZERO, build: E.BUILD.number };
      var vault = { v: 1, app: "emporium", storeId: id, created: now.toISOString(), practice: true, device: env };
      return U.sha256hex(U.canon(line)).then(function (hash) {
        var head = { seq: 1, hash: hash, at: line.at };
        return Promise.all([C.seal(storeKey, line, aadLine(id, 1)), C.seal(storeKey, head, aadRec(id, "head:main"))]
          .concat(recs.map(function (r) { return C.seal(storeKey, r.value, aadRec(id, r.kind + ":" + r.id)); })));
      }).then(function (sealed) {
        var ops = [{ store: "meta", key: "vault", value: vault }, { store: "meta", key: "devkey", value: kek },
          { store: "meta", key: "door", value: { storeName: settings.storeName, practice: true, created: now.toISOString() } },
          { store: "journal", key: 1, value: sealed[0], add: true }, { store: "rec", key: "head:main", value: sealed[1] }];
        recs.forEach(function (r, i) { ops.push({ store: "rec", key: r.kind + ":" + r.id, value: sealed[i + 2] }); });
        return D.write(ops);
      }).then(function () { return C.unwrap(env, kek, aadEnv(id, "device"), false); })
        .then(function (key) { storeKey = null; return load(vault, key); })
        .then(function () { return seedPractice(start, progress); });
    });
  }
  /* A practice store made before Build 19 is given Build 19's samples once, as it opens: Jean, the sample manager, the
     manager's new access, and the store its plan of training (sampleCourse). Nothing here touches a real store, and a
     sample that cannot be made is let go: the practice store still opens. */
  function upgradePractice(st) {
    if (B.mode !== "practice" || !state) return st;
    var c = Promise.resolve();
    if (!state.course) {
      /* Jean as the practice store made him (the manager's access of Build 6 to Build 18); if the owner changed him, he is left as he is */
      var jean = state.users[SAMPLE_PEOPLE[1][0]], was = ["sell", "items", "receive", "adjust", "costs", "reports", "team"];
      if (jean && jean.active !== false && JSON.stringify(jean.access || []) === JSON.stringify(was))
        c = c.then(function () { return B.editPerson(jean.id, { access: B.PRESETS.manager.slice(), preset: "manager" }); });
      c = c.then(sampleCourse);
    }
    /* and a practice store made before Build 20, its schedule */
    if (!state.rota && !(state.slots || []).length) c = c.then(sampleSchedule);
    /* and before Build 21, its providers and its pay */
    if (!Object.keys(state.provs || {}).length && !state.payset) c = c.then(sampleMoney);
    /* and before Build 22, its travel bookings */
    if (!(state.bookings || []).length && !(state.counters && state.counters.booking)) c = c.then(sampleTravel);
    return c.then(function () { B._at = null; B.user = state.users.owner; return state; },
      function (e) { console.warn(e); B._at = null; if (state) B.user = state.users.owner; return state; });
  }
  /* the practice store's schedule (Build 20). Until yesterday, the shifts as the time clock's samples were worked, both
     every day (one day Jean was planned from half past twelve, so his quarter to one shows fifteen minutes late). From
     today, the usual week: Marie Monday to Friday, mornings; Jean Wednesday to Sunday, afternoons. Marie asked Jean to
     cover her Monday next week and he agreed, so it waits for a leader; Jean asked Marie to trade his Saturday next week
     for her Tuesday, and it waits for her answer. */
  function sampleSchedule() {
    var marie = SAMPLE_PEOPLE[0][0], jean = SAMPLE_PEOPLE[1][0];
    if (!state.users[marie] || !state.users[jean] || state.users[marie].active === false || state.users[jean].active === false) return Promise.resolve();
    var today = new Date(), todayKey = U.dayKey(today), wk = U.fromDayKey(B.weekStartKey(today)), last = U.addDays(wk, -7), at = today.toISOString();
    var MARIE = [1, 2, 3, 4, 5], JEAN = [3, 4, 5, 6, 0], slots = [], rows = [];
    function slot(user, d, from, to) { var s = { id: U.uid("s"), user: user, day: U.dayKey(d), from: from, to: to, note: "", by: "owner", at: at, status: "on" }; slots.push(s); return s; }
    for (var d = new Date(last), n = 0; U.dayKey(d) < todayKey; d = U.addDays(d, 1), n++) {
      slot(marie, d, "08:45", "15:15"); slot(jean, d, n === 9 ? "12:30" : "12:45", "20:15");
    }
    for (var e = new Date(today.getFullYear(), today.getMonth(), today.getDate()); e < U.addDays(wk, 14); e = U.addDays(e, 1)) {
      if (MARIE.indexOf(e.getDay()) >= 0) slot(marie, e, "08:45", "15:15");
      if (JEAN.indexOf(e.getDay()) >= 0) slot(jean, e, "12:45", "20:15");
    }
    for (var i = 0; i < 7; i++) {
      var g = U.addDays(wk, i);
      if (MARIE.indexOf(g.getDay()) >= 0) rows.push({ dow: i, user: marie, from: "08:45", to: "15:15", note: "" });
      if (JEAN.indexOf(g.getDay()) >= 0) rows.push({ dow: i, user: jean, from: "12:45", to: "20:15", note: "" });
    }
    function on(user, d) { var k = U.dayKey(d); return slots.filter(function (s) { return s.user === user && s.day === k; })[0]; }
    var next = U.addDays(wk, 7), mon = on(marie, next), tue = on(marie, U.addDays(next, 1)), sat = on(jean, U.addDays(next, 5));
    function as(id, when, fn) { return function () { B._at = when.toISOString(); B.user = state.users[id]; return fn().then(function () { B.user = state.users.owner; }); }; }
    var yesterday = U.addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -1);
    function hour(d, hh) { var x = new Date(d); x.setHours(hh, 0, 0, 0); return x; }
    return Promise.resolve()
      .then(as("owner", hour(U.addDays(last, -1), 18), function () {
        return B.change(function () { var v = { v: 1, rows: rows, from: U.dayKey(wk), at: at, by: "owner" }; return { type: "rota.saved", data: { from: v.from, rows: rows.length }, recs: [{ kind: "rota", id: "main", value: v }] }; });
      }))
      .then(as("owner", hour(U.addDays(last, -1), 18), function () {
        return B.change(function () { return { type: "week.filled", data: { week: U.dayKey(last), source: "sample", added: slots.length }, recs: slots.map(function (s) { return { kind: "slot", id: s.id, value: s }; }) }; });
      }))
      .then(as(marie, hour(yesterday, 10), function () { return mon && sat ? B.askSwap({ slot: mon.id, to: jean, kind: "cover", note: "" }) : Promise.resolve(); }))
      .then(as(jean, hour(yesterday, 14), function () { var w = B.swaps(function (x) { return x.from === marie && x.status === "asked"; })[0]; return w ? B.answerSwap(w.id, true) : Promise.resolve(); }))
      .then(as(jean, hour(yesterday, 16), function () { return sat && tue ? B.askSwap({ slot: sat.id, to: marie, kind: "trade", theirSlot: tue.id, note: "" }) : Promise.resolve(); }));
  }
  /* the practice store's providers and pay (Build 21). RIA: the store deposits, and RIA pays the commission each month;
     CAM takes it from the bank, commission taken off at once; Unitransfer: deposits, commission at once; Boss
     Revolution: a prepaid balance. A week ago everything collected until the day before was settled, so what is held
     now is the last week's; Boss Revolution was given $300, then $150. Pay is weekly, overtime after 40 hours at one
     and a half times; Marie at $15.50 an hour, Jean at $19.00; last week's pay is marked paid. */
  function sampleMoney() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    function at(back, hh) { var d = U.addDays(today, -back); d.setHours(hh, 0, 0, 0); return d; }
    function as(id, when, fn) { return function () { B._at = when.toISOString(); B.user = state.users[id] || state.users.owner; return fn().then(function () { B.user = state.users.owner; }); }; }
    var setups = [["ria", "deposit", "monthly"], ["cam", "sweep", "deducted"], ["unitransfer", "deposit", "deducted"], ["boss", "prepaid", "deducted"]];
    var cut = U.dayKey(U.addDays(today, -8)), c = Promise.resolve();
    setups.forEach(function (x) { c = c.then(as("owner", at(15, 9), function () { return B.setProvSetup(x[0], { how: x[1], com: x[2], note: "" }); })); });
    setups.forEach(function (x) {
      if (x[1] === "prepaid") return;
      c = c.then(function () {
        var owed = 0;
        (state.services || []).forEach(function (v) {
          if (v.provider !== x[0] || v.status === "void" || v.day > cut) return;
          var m = B.svcCash(v); owed += m.cashIn - m.cashOut - (x[2] === "deducted" ? (v.commission || 0) : 0);
        });
        if (!owed) return null;
        var kind = owed > 0 ? "paid" : "returned", amount = Math.abs(owed);
        if (x[1] === "deposit" && kind === "paid") amount = Math.floor(amount / 100) * 100;
        return amount ? as(SAMPLE_PEOPLE[1][0], at(7, 11), function () { return B.settle({ provider: x[0], kind: kind, amount: amount, ref: (x[0] === "cam" ? "SWP-" : "DEP-") + U.dayKey(at(7, 11)).slice(5).replace("-", ""), note: "", day: U.dayKey(at(7, 11)) }); })() : null;
      });
    });
    c = c.then(as("owner", at(15, 10), function () { return B.settle({ provider: "boss", kind: "paid", amount: 30000, ref: "BR-PRE-1", note: "", day: U.dayKey(at(15, 10)) }); }));
    c = c.then(as("owner", at(6, 10), function () { return B.settle({ provider: "boss", kind: "paid", amount: 15000, ref: "BR-PRE-2", note: "", day: U.dayKey(at(6, 10)) }); }));
    /* RIA paid the commission of the month before, on the third of this month (or an hour ago, early in the month) */
    c = c.then(function () {
      var m0 = new Date(today.getFullYear(), today.getMonth(), 1), k0 = U.dayKey(m0), due = 0, when = new Date(today.getFullYear(), today.getMonth(), 3, 15, 0, 0);
      if (when.getTime() > Date.now() - 3600000) when = new Date(Date.now() - 3600000);
      (state.services || []).forEach(function (v) { if (v.provider === "ria" && v.status !== "void" && v.day < k0 && v.commission) due += v.commission; });
      return due ? as("owner", when, function () { return B.settle({ provider: "ria", kind: "commission", amount: due, ref: "RIA-COM-" + k0.slice(0, 7), note: "", day: U.dayKey(when) }); })() : null;
    });
    c = c.then(as("owner", at(15, 9), function () { return B.setPaySettings({ period: "weekly", anchor: B.weekStartKey(today), otAfter: 40, otTimes: 150 }); }));
    c = c.then(as("owner", at(15, 9), function () { return B.setRate(SAMPLE_PEOPLE[0][0], 1550, U.dayKey(at(15, 9))); }));
    c = c.then(as("owner", at(15, 9), function () { return B.setRate(SAMPLE_PEOPLE[1][0], 1900, U.dayKey(at(15, 9))); }));
    /* last week's pay, handed over on the first day of this week at five, or an hour ago if that is still to come */
    c = c.then(function () {
      var wk = U.fromDayKey(B.weekStartKey(today)), last = { from: U.dayKey(U.addDays(wk, -7)), to: U.dayKey(U.addDays(wk, -1)) }, d = new Date(wk); d.setHours(17, 0, 0, 0);
      if (d.getTime() > Date.now() - 3600000) d = new Date(Date.now() - 3600000);
      return [[SAMPLE_PEOPLE[0][0], "cash", ""], [SAMPLE_PEOPLE[1][0], "check", "1042"]].reduce(function (p, x) {
        return p.then(as("owner", d, function () { var e = B.payFor(x[0], last.from, last.to); return B.markPaid({ user: x[0], from: last.from, to: last.to, amount: e.gross, method: x[1], ref: x[2], note: "" }); }));
      }, Promise.resolve());
    });
    return c;
  }
  /* the practice store's travel bookings (Build 22): two travel from Miami to Port-au-Prince in five days, paid in full
     (a deposit in cash, the rest by card at the counter, taken by Marie); one goes from Fort Lauderdale to Cap-Haitien
     in twelve days, with a deposit and the balance still to pay; one went from New York and came back two days ago;
     and one to Santo Domingo was cancelled, the store keeping its fee and giving the rest of the deposit back. No
     client's name or phone: the owner has not turned that on. The codes are made up. */
  function sampleTravel() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    function at(back, hh, mm) { var d = U.addDays(today, -back); d.setHours(hh, mm || 0, 0, 0); if (d.getTime() > Date.now() - 600000) d = new Date(Date.now() - 600000); return d; }
    function day(n) { return U.dayKey(U.addDays(today, n)); }
    function as(id, when, fn) { return function () { B._at = when.toISOString(); B.user = state.users[id] || state.users.owner; return fn().then(function (x) { B.user = state.users.owner; return x; }); }; }
    var card = B.payPrefs().methods.indexOf("card") >= 0 ? "card" : "cash", air = E.t("practice.siteAir"), web = E.t("practice.siteWeb"), made = {}, c = Promise.resolve();
    c = c.then(as("owner", at(6, 11), function () { return B.addBooking({ from: "MIA", to: "PAP", depart: day(5), ret: day(19), pax: 2, site: air, code: "QX7P2M", ticket: 61240, fee: 3500, note: "" }, { amount: 30000, method: "cash" }).then(function (b) { made.a = b; }); }));
    c = c.then(function () { return as(SAMPLE_PEOPLE[0][0], at(2, 10, 20), function () { return B.payBooking(made.a.id, { amount: 34740, method: card, ref: card === "card" ? "314159" : "" }); })(); });
    c = c.then(as("owner", at(3, 15), function () { return B.addBooking({ from: "FLL", to: "CAP", depart: day(12), ret: null, pax: 1, site: web, code: "H4K9TL", ticket: 28900, fee: 2500, note: "" }, { amount: 10000, method: "cash" }); }));
    c = c.then(as("owner", at(13, 12), function () { return B.addBooking({ from: "JFK", to: "PAP", depart: day(-9), ret: day(-2), pax: 1, site: air, code: "ZT5RW8", ticket: 45500, fee: 3000, note: "" }, { amount: 48500, method: "cash" }); }));
    c = c.then(as("owner", at(8, 16), function () { return B.addBooking({ from: "MIA", to: "SDQ", depart: day(20), ret: day(27), pax: 1, site: web, code: "M2VN6C", ticket: 39800, fee: 3000, note: "" }, { amount: 10000, method: "cash" }).then(function (b) { made.d = b; }); }));
    c = c.then(function () { return as("owner", at(4, 14), function () { return B.cancelBooking(made.d.id, { feeKept: 3000, refund: 7000, method: "cash", reason: E.t("practice.cancelWhy") }); })(); });
    return c;
  }
  /* The practice store's sample people: [user id, staff number, name, level of access]. */
  var SAMPLE_PEOPLE = [["u_practice_marie", 1002, "Marie", "cashier"], ["u_practice_jean", 1003, "Jean", "manager"]];
  /* The sample goods of a Caribbean store: [shelf, name, price, cost (cents), stock, reorder at, taxed, barcode]. */
  var SAMPLE = [
    ["music", "Kompa classics, volume 1 (CD)", 1299, 650, 18, 5, 1, "0850001000017"], ["music", "Konpa love songs (CD)", 1299, 650, 14, 5, 1, "0850001000024"],
    ["music", "Rara and carnival hits (CD)", 1499, 760, 9, 4, 1, "0850001000031"], ["music", "Zouk evenings (CD)", 1299, 640, 4, 5, 1, "0850001000048"],
    ["music", "Haitian gospel favourites (CD)", 1199, 600, 12, 4, 1, ""], ["movies", "Haitian comedy night (DVD)", 999, 480, 15, 5, 1, "0850002000016"],
    ["movies", "Carnival in Jacmel (DVD)", 1499, 720, 7, 3, 1, ""], ["movies", "Family drama, season 1 (DVD set)", 1999, 1050, 5, 2, 1, ""],
    ["perfume", "Florida water, 7.5 oz", 699, 310, 24, 8, 1, "0850003000015"], ["perfume", "Kananga water, 7.5 oz", 599, 270, 16, 6, 1, ""],
    ["perfume", "Bay rum aftershave", 799, 380, 10, 4, 1, ""], ["perfume", "Eau de parfum, vanilla musk", 3499, 1600, 6, 2, 1, "0850003000039"],
    ["grocery", "Djon djon mushrooms, 1 oz", 999, 520, 22, 8, 0, "0850004000014"], ["grocery", "Pikliz, 16 oz jar", 649, 300, 20, 6, 0, ""],
    ["grocery", "Haitian coffee, 1 lb", 1199, 640, 13, 5, 0, "0850004000038"], ["grocery", "Akasan mix, 1 lb", 499, 230, 17, 6, 0, ""],
    ["grocery", "Peanut butter (manba), 16 oz", 799, 380, 11, 4, 0, ""], ["grocery", "Coconut candy (tablèt)", 249, 100, 30, 10, 0, ""],
    ["grocery", "Plantain chips", 199, 80, 40, 12, 0, "0850004000076"], ["grocery", "Rice, 5 lb", 849, 520, 19, 6, 0, ""],
    ["drinks", "Cola champagne, 12 oz", 175, 70, 60, 24, 1, "0850005000013"], ["drinks", "Malta, 12 oz", 199, 85, 48, 24, 1, "0850005000020"],
    ["drinks", "Ginger beer, 12 oz", 199, 90, 36, 12, 1, ""], ["drinks", "Coconut water, 16 oz", 249, 120, 30, 12, 1, ""],
    ["drinks", "Spring water, 16 oz", 125, 40, 72, 24, 1, ""], ["food", "Patty, beef", 275, 110, 40, 12, 1, ""],
    ["food", "Patty, chicken", 275, 110, 40, 12, 1, ""], ["food", "Patty, herring", 300, 125, 24, 8, 1, ""],
    ["food", "Patty, codfish", 300, 125, 6, 8, 1, ""], ["other", "Phone charger, USB-C", 999, 400, 8, 3, 1, ""]
  ];
  function seedPractice(start, progress) {
    var seed = 20261107;
    function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
    var made = [], left = {}, chain = Promise.resolve(), steps = SAMPLE.length + 3, done = 0;
    function tick() { done++; if (progress) try { progress(Math.min(1, done / steps)); } catch (e) { } }
    B._at = start.toISOString();
    SAMPLE.forEach(function (s) {
      chain = chain.then(function () {
        return B.addItem({ name: s[1], cat: s[0], price: s[2], cost: s[3], openingStock: s[4] <= s[5] ? s[4] : s[4] + 30, reorderAt: s[5], taxId: s[6] ? "tx1" : null, barcode: s[7] }).then(function (it) {
          made.push(it); left[it.id] = it.stock; tick();
        });
      });
    });
    /* fourteen days of sales, from two weeks ago to an hour ago, in the order they happened */
    chain = chain.then(function () {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var plan = [];
      for (var d = 14; d >= 0; d--) {
        var day = new Date(today.getTime() - d * 86400000), n = 4 + rnd(6);
        for (var k = 0; k < n; k++) {
          var at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9 + rnd(11), rnd(60), rnd(60));
          if (at.getTime() < Date.now() - 3600000) plan.push(at);
        }
      }
      plan.sort(function (a, b) { return a - b; });
      steps = SAMPLE.length + plan.length + 3;
      var c2 = Promise.resolve();
      plan.forEach(function (at, j) {
        c2 = c2.then(function () {
          var lines = [], n = 1 + rnd(3);
          for (var x = 0; x < n; x++) {
            var it = made[rnd(made.length)], q = 1 + rnd(it.cat === "drinks" || it.cat === "food" ? 3 : 1);
            if (left[it.id] - q < 2 || lines.some(function (l) { return l.itemId === it.id; })) continue;
            left[it.id] -= q; lines.push({ itemId: it.id, qty: q });
          }
          if (!lines.length) { tick(); return null; }
          B._at = at.toISOString();
          /* the morning's sales are Marie's, the afternoon's Jean's, and one in four the owner's own */
          var seller = j % 4 === 3 ? "owner" : at.getHours() < 13 ? SAMPLE_PEOPLE[0][0] : SAMPLE_PEOPLE[1][0];
          B.user = state.users[seller] || state.users.owner;
          var total = B.priceTicket(lines).total, paid = total <= 2000 ? Math.ceil(total / 500) * 500 : Math.ceil(total / 1000) * 1000;
          /* about a third by card, some by phone, a few in two parts (cash, then the card); the rest in cash. The ways
             follow the sale's place in the fortnight, not the dice, so the sales themselves stay the same */
          var code = String(100000 + (j * 7919) % 900000), pays = paid;
          if (j % 3 === 1) pays = [{ method: "card", amount: total, ref: code, last4: String(1000 + (j * 37) % 9000) }];
          else if (j % 7 === 3) pays = [{ method: "applepay", amount: total, ref: code }];
          else if (j % 11 === 5) pays = [{ method: "googlepay", amount: total, ref: code }];
          else if (j % 13 === 6 && total > 500) pays = [{ method: "card", amount: total - 500, ref: code, last4: String(1000 + (j * 53) % 9000) }, { method: "cash", tendered: 500 }];
          return B.completeSale(lines, pays).then(function () { B.user = state.users.owner; tick(); });
        });
        if (j === plan.length - 1) c2 = c2.then(function () { return sampleShifts(today); });
        if (j === Math.floor(plan.length / 2)) {
          c2 = c2.then(function () {
            var patty = made.filter(function (m) { return m.cat === "food"; })[0];
            B._at = new Date(at.getTime() + 60000).toISOString();
            return B.adjust(patty.id, -3, "expired", "").then(function () { left[patty.id] -= 3; tick(); });
          });
        }
      });
      return c2;
    });
    chain = chain.then(function () { return sampleServices(); });
    chain = chain.then(function () { return sampleTraining(); });
    chain = chain.then(function () { return sampleCourse(); });
    chain = chain.then(function () { return sampleSchedule(); });
    chain = chain.then(function () { return sampleMoney(); });
    chain = chain.then(function () { return sampleTravel(); });
    return chain.then(function () { B._at = null; B.user = state.users.owner; return state; }, function (e) { B._at = null; B.user = state && state.users.owner; throw e; });
  }
  /* The practice store's money transfers and top-ups: a few a day for two weeks, with made-up fees and references.
     [provider, kind, amount, fee, commission] in cents; nothing here is a real provider's price. */
  var SAMPLE_SVC = [["ria", "send", 15000, 1000, 300], ["cam", "send", 20000, 1200, 350], ["boss", "topup", 2000, 0, 150],
    ["unitransfer", "payout", 10000, 0, 200], ["ria", "send", 5000, 600, 150], ["boss", "topup", 1000, 0, 80], ["cam", "payout", 25000, 0, 300]];
  function sampleServices() {
    var seed = 20261115, c = Promise.resolve(), today = new Date(); today.setHours(0, 0, 0, 0);
    /* Build 21: whole 32-bit arithmetic, so the low bits are kept (before, every entry fell at ten o'clock, Marie's) */
    function rnd(n) { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return (seed >>> 8) % n; }
    for (var d = 14; d >= 0; d--) {
      var day = new Date(today.getTime() - d * 86400000), n = 1 + rnd(3);
      for (var k = 0; k < n; k++) (function (at, s, j) {
        if (at.getTime() >= Date.now() - 3600000) return;
        c = c.then(function () {
          B._at = at.toISOString();
          B.user = state.users[at.getHours() < 13 ? SAMPLE_PEOPLE[0][0] : "owner"] || state.users.owner;
          return B.recordService({ provider: s[0], kind: s[1], amount: s[2], fee: s[3], commission: s[4], ref: (s[0] === "boss" ? "BR" : s[0].slice(0, 2).toUpperCase()) + String(483920 + j * 37) })
            .then(function () { B.user = state.users.owner; });
        });
      })(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10 + rnd(8), rnd(60), 0), SAMPLE_SVC[rnd(SAMPLE_SVC.length)], d * 10 + k);
    }
    return c;
  }
  /* the sample people's lessons (Build 17): Marie, a cashier, has taken the first two of her five; Jean, a manager,
     six of his seven, with a question missed here and there */
  function sampleTraining() {
    var c = Promise.resolve(), base = new Date(); base.setHours(10, 30, 0, 0);
    [[SAMPLE_PEOPLE[0][0], [["welcome", 2], ["clock", 2]], 9], [SAMPLE_PEOPLE[1][0], [["welcome", 2], ["clock", 1], ["sale", 2], ["pay", 2], ["svc", 2], ["stock", 1]], 12]].forEach(function (p) {
      p[1].forEach(function (x, k) {
        c = c.then(function () {
          B._at = new Date(base.getTime() - (p[2] - k) * 86400000).toISOString();
          B.user = state.users[p[0]] || state.users.owner;
          return B.trainDone(x[0], x[1], 2).then(function () { B.user = state.users.owner; });
        });
      });
    });
    return c;
  }
  /* the store's own training (Build 19): two tasks of the store's own, a path of six days, and three refreshers; Jean,
     the manager, started Marie's onboarding two days ago, and Marie has done the first day of it; the owner gave Jean
     the Reports lesson, due in three days */
  function sampleCourse() {
    var base = new Date(); base.setHours(9, 0, 0, 0);
    function day(n, hh, mm) { var d = U.addDays(base, n); d.setHours(hh, mm, 0, 0); return d; }
    function as(id, at, fn) { return function () { B._at = at.toISOString(); B.user = state.users[id] || state.users.owner; return fn().then(function () { B.user = state.users.owner; }); }; }
    var course = B.defaultCourse(), marie = SAMPLE_PEOPLE[0][0], jean = SAMPLE_PEOPLE[1][0];
    /* Jean starts Marie's onboarding if he may train; if not (an older practice store the owner changed), the owner does */
    var lead = state.users[jean] && state.users[jean].active !== false && (state.users[jean].access || []).indexOf("train") >= 0 ? jean : "owner";
    course.tasks = [{ id: "krulesone", title: E.t("practice.task1.t"), body: E.t("practice.task1.b"), sign: "self", need: null },
      { id: "kshadowing", title: E.t("practice.task2.t"), body: E.t("practice.task2.b"), sign: "lead", need: "sell" }];
    course.path.splice(2, 0, ["task", "krulesone", 1]);
    course.path.splice(5, 0, ["task", "kshadowing", 2]);
    course.refresh = { "lesson:sale": 365, "lesson:pay": 180, "exercise:split": 90 };
    return Promise.resolve()
      .then(as("owner", day(-3, 17, 0), function () { return B.saveCourse(course); }))
      .then(as(lead, day(-2, 9, 0), function () { return B.startOnboarding(marie, U.dayKey(day(-2, 9, 0))); }))
      .then(as(marie, day(-2, 11, 0), function () { return B.exerciseDone("break"); }))
      .then(as(marie, day(-2, 11, 30), function () { return B.taskDone(marie, "krulesone"); }))
      .then(as("owner", day(-1, 17, 0), function () { return B.assign([jean], [{ kind: "lesson", ref: "reports" }], U.dayKey(day(3, 9, 0))); }));
  }
  /* the sample people's shifts for the days before today: Marie from a quarter to nine, Jean from a quarter to one,
     each with a half-hour break */
  function sampleShifts(today) {
    var c = Promise.resolve();
    for (var d = 14; d >= 1; d--) {
      [[SAMPLE_PEOPLE[0], 8, 45, 15, 15, 12, 0], [SAMPLE_PEOPLE[1], 12, 45, 20, 15, 16, 30]].forEach(function (x) {
        var base = new Date(today.getTime() - d * 86400000);
        function at(hh, mm) { return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm + (d % 3) * 2, 0); }
        var sh = { id: "t_practice_" + x[0][0] + "_" + d, user: x[0][0], no: x[0][1], in: at(x[1], x[2]).toISOString(), out: at(x[3], x[4]).toISOString(),
          breaks: [{ from: at(x[5], x[6]).toISOString(), to: at(x[5], x[6] + 30).toISOString() }], day: U.dayKey(base), dev: B.device.id };
        c = c.then(function () { B._at = sh.out; return recordShift(sh); });
      });
    }
    return c;
  }

  /* ---------- the side rail's own notes: each person's reminders and caught thoughts, sealed like the rest ---------- */
  B.pad = function () {
    var u = (B.user && B.user.id) || "owner", p = state && state.pad && state.pad[u];
    p = clone(p) || {}; p.thoughts = p.thoughts || []; p.reminders = p.reminders || []; return p;
  };
  B.savePad = function (pad, what) {
    var u = (B.user && B.user.id) || "owner";
    return B.change(function () { return { type: "pad.updated", data: { what: what || "pad", thoughts: pad.thoughts.length, reminders: pad.reminders.length }, recs: [{ kind: "pad", id: u, value: pad }] }; });
  };

  /* ---------- the people of the store: the owner, who is the administrator, and the staff ----------
     Every person has a user id (kept on every ledger line, sale, stock move and shift they make) and a staff number
     the screens show: 1001 is the owner. Each person signs in with a password of their own, which opens their own
     envelope of the Store Key (vault.people). What each person may do is kept in their sealed record; the books keep
     to it as well as the screens. Only the owner adds people, sets what they may do, gives them a first password, and
     takes a key back. The names are kept plain at the door, as the owner's own name is, so the sign-in can find the
     right envelope. A person's key opens the same sealed books as the owner's: the limits are kept by Lakay itself. */
  /* Build 19: three kinds of access to lead, which only the owner gives at first: "train" (training and onboarding),
     "people" (adding the staff, their first passwords, taking a key back) and "backup" (saving a sealed backup). A
     team leader trains and leads; a manager may also look after the people, within limits the books keep: a person with
     "people" gives only what they have themselves, never "people", and manages no one who holds more, nor the owner. */
  B.ACCESS = ["sell", "items", "receive", "adjust", "costs", "reports", "team", "train", "people", "backup", "pay"];
  /* Build 21: "pay" (everyone's pay rates and pay, and marking it paid) is given one by one: no level holds it */
  B.PRESETS = { cashier: ["sell"], stock: ["sell", "items", "receive", "adjust"], lead: ["sell", "items", "receive", "adjust", "team", "train"],
    manager: ["sell", "items", "receive", "adjust", "costs", "reports", "team", "train", "people", "backup"] };
  B.isOwner = function () { return !!(B.user && B.user.role === "owner"); };
  B.can = function (what) {
    var u = B.user; if (!u) return false;
    if (u.role === "owner") return true;
    return what !== "owner" && (u.access || []).indexOf(what) >= 0;
  };
  function need(what) { if (!B.can(what)) throw err("denied"); }
  /* what the person signed in may give others */
  B.grantable = function () {
    if (!B.user) return [];
    if (B.isOwner()) return B.ACCESS.slice();
    if (!B.can("people")) return [];
    /* "people" and "pay" (Build 21) are the owner's to give */
    return B.ACCESS.filter(function (a) { return a !== "people" && a !== "pay" && (B.user.access || []).indexOf(a) >= 0; });
  };
  /* whether the person signed in may change this person, give them a first password or take their key back */
  B.canManage = function (u) {
    if (!u || u.role === "owner" || !B.user) return false;
    if (B.isOwner()) return true;
    if (!B.can("people") || u.id === B.user.id) return false;
    var g = B.grantable();
    return (u.access || []).every(function (a) { return g.indexOf(a) >= 0; });
  };
  function needManage(st, id) { var u = st.users[id]; if (!u || u.role === "owner") throw err("noperson"); if (!B.canManage(u)) throw err("denied"); return u; }
  function needGrant(list) { var g = B.grantable(); if (!(list || []).every(function (a) { return g.indexOf(a) >= 0; })) throw err("denied"); }
  B.numberOf = function (u) { return u ? (u.no || (u.role === "owner" ? 1001 : 0)) : 0; };
  B.people = function (all) {
    var st = state; if (!st) return [];
    return Object.keys(st.users).map(function (k) { return st.users[k]; })
      .filter(function (u) { return all || u.role === "owner" || u.active !== false; })
      .sort(function (a, b) { return B.numberOf(a) - B.numberOf(b); });
  };
  function cleanName(n) { return String(n || "").normalize("NFC").trim().replace(/\s+/g, " ").slice(0, 60); }
  function nameTaken(st, name, selfId) {
    if (/^\d+$/.test(cleanName(name))) return true;
    return Object.keys(st.users).some(function (k) { return k !== selfId && B.sameName(st.users[k].name, name); });
  }
  function doorWith(ch) {
    var d = clone(doorMeta) || {};
    Object.keys(ch).forEach(function (k) { if (ch[k] === undefined) delete d[k]; else d[k] = clone(ch[k]); });
    return d;
  }
  function peopleOf(users) {
    return Object.keys(users).map(function (k) { return users[k]; }).filter(function (u) { return u.role !== "owner" && u.active !== false; })
      .map(function (u) { return { id: u.id, no: u.no, name: u.name }; }).sort(function (a, b) { return a.no - b.no; });
  }
  function nextNo(st) { return Object.keys(st.users).reduce(function (m, k) { return Math.max(m, B.numberOf(st.users[k])); }, 1001) + 1; }
  function cleanAccess(list) { return B.ACCESS.filter(function (a) { return (list || []).indexOf(a) >= 0; }); }
  /* a level's name is kept only when the access is that level's own (Build 19): no label says more than is given */
  function presetFor(name, access) { var p = B.PRESETS[name]; return p && p.length === access.length && p.every(function (a) { return access.indexOf(a) >= 0; }) ? name : "custom"; }
  function iterations(v) { return (v && v.kdf && v.kdf.iterations) || C.ITERATIONS; }
  /* The Store Key, in a form that can be sealed into a new envelope: the owner's password opens it, or, for a manager
     who looks after the people, their own password and envelope (in the practice store, the key this device keeps). */
  function keyToShare(password) {
    if (B.mode === "practice") {
      return Promise.all([D.get("meta", "vault"), D.get("meta", "devkey")]).then(function (r) {
        return C.unwrap(r[0].device, r[1], aadEnv(r[0].storeId, "device"), true).then(function (k) { return { vault: r[0], key: k }; });
      });
    }
    if (B.isOwner()) return ownerKeyExtractable(password);
    return personKeyExtractable(B.user.id, password);
  }
  function personKeyExtractable(id, password) {
    return D.get("meta", "vault").then(function (v) {
      var e = v.people && v.people[id]; if (!e) throw err("wrong");
      return C.passwordKey(password || "", U.b64d(e.salt), iterations(v)).then(function (kek) { return C.unwrap(e, kek, aadEnv(v.storeId, "person:" + id), true); })
        .then(function (k) { return { vault: v, key: k }; }, function () { throw err("wrong"); });
    });
  }
  function personEnvelope(hk, id, password) {
    var salt = U.rnd(16);
    return C.passwordKey(password, salt).then(function (kek) { return C.wrap(hk.key, kek, aadEnv(hk.vault.storeId, "person:" + id)); })
      .then(function (env) { return { salt: U.b64e(salt), iv: env.iv, ct: env.ct }; });
  }
  function checkPw(pw) { var a = C.passwordAdvice(pw || ""); if (!a.ok) throw err("password", a.key); }

  B.addPerson = function (f, ownerPassword) {
    var name = cleanName(f.name), id = U.uid("u"), access = cleanAccess(f.access);
    try {
      need("people"); needGrant(access);
      if (!name) throw err("name");
      if (nameTaken(state, name)) throw err("nameTaken");
      checkPw(f.password);
    } catch (e) { return Promise.reject(e); }
    return keyToShare(ownerPassword).then(function (hk) {
      return personEnvelope(hk, id, f.password).then(function (env) {
        return B.change(function (st) {
          need("people"); needGrant(access);
          if (nameTaken(st, name)) throw err("nameTaken");
          var now = clock().toISOString(), no = nextNo(st);
          var u = { id: id, no: no, name: name, role: "staff", preset: presetFor(f.preset, access), access: access, active: true,
            mustChange: true, created: now, updated: now };
          var v = clone(hk.vault); v.people = v.people || {}; v.people[id] = env;
          var users = clone(st.users); users[id] = u;
          return { type: "person.added", data: { id: id, no: no, name: name, preset: u.preset, access: access },
            recs: [{ kind: "user", id: id, value: u }], meta: [{ key: "vault", value: v }, { key: "door", value: doorWith({ people: peopleOf(users) }) }], result: u };
        });
      });
    });
  };
  B.editPerson = function (id, f) {
    return B.change(function (st) {
      need("people");
      var u = clone(needManage(st, id));
      var diff = {};
      if (f.name !== undefined) {
        var n = cleanName(f.name); if (!n) throw err("name");
        if (!B.sameName(n, u.name) && nameTaken(st, n, id)) throw err("nameTaken");
        if (n !== u.name) { diff.name = [u.name, n]; u.name = n; }
      }
      if (f.access !== undefined) {
        var a = cleanAccess(f.access), p = presetFor(f.preset, a);
        if (JSON.stringify(a) !== JSON.stringify(u.access)) { needGrant(a); diff.access = [u.access, a]; u.access = a; }
        if (p !== u.preset) { diff.preset = [u.preset, p]; u.preset = p; }
      }
      if (!Object.keys(diff).length) return null;
      u.updated = clock().toISOString();
      var users = clone(st.users); users[id] = u;
      return { type: "person.updated", data: { id: id, no: u.no, changes: diff }, recs: [{ kind: "user", id: id, value: u }],
        meta: diff.name ? [{ key: "door", value: doorWith({ people: peopleOf(users) }) }] : [], result: u };
    });
  };
  /* A new first password for a person (they forgot theirs, or they come back): they choose their own at their next sign-in. */
  B.setPersonPassword = function (id, password, ownerPassword) {
    try { need("people"); checkPw(password); needManage(state, id); } catch (e) { return Promise.reject(e); }
    return keyToShare(ownerPassword).then(function (hk) {
      return personEnvelope(hk, id, password).then(function (env) {
        return B.change(function (st) {
          need("people");
          var u = clone(needManage(st, id));
          var back = u.active === false;
          u.active = true; u.mustChange = true; u.updated = clock().toISOString();
          var v = clone(hk.vault); v.people = v.people || {}; v.people[id] = env;
          var users = clone(st.users); users[id] = u;
          return { type: back ? "person.restored" : "person.password.set", data: { id: id, no: u.no }, recs: [{ kind: "user", id: id, value: u }],
            meta: [{ key: "vault", value: v }, { key: "door", value: doorWith({ people: peopleOf(users) }) }], result: u };
        });
      });
    });
  };
  /* Taking a key back: the person can no longer sign in; everything they did stays in the books, under their name. */
  B.retirePerson = function (id) {
    return D.get("meta", "vault").then(function (vault) {
      return B.change(function (st) {
        need("people");
        var u = clone(needManage(st, id));
        if (u.active === false) return null;
        var now = clock().toISOString(), recs = [];
        var open = B.openShift(id);
        if (open) { var sh = clone(open); (sh.breaks || []).forEach(function (b) { if (!b.to) b.to = now; }); sh.out = now; sh.outBy = B.user.id; recs.push({ kind: "shift", id: sh.id, value: sh }); }
        u.active = false; u.mustChange = false; u.updated = now; recs.unshift({ kind: "user", id: id, value: u });
        var v = clone(vault); if (v.people) delete v.people[id];
        var users = clone(st.users); users[id] = u;
        return { type: "person.retired", data: { id: id, no: u.no, clockedOut: !!open }, recs: recs,
          meta: [{ key: "vault", value: v }, { key: "door", value: doorWith({ people: peopleOf(users) }) }], result: u };
      });
    });
  };
  /* A person's own password, changed by them (and chosen by them the first time they sign in). */
  B.changeMyPassword = function (current, next) {
    if (B.isOwner()) return B.changePassword(current, next);
    var id = B.user && B.user.id;
    try { checkPw(next); } catch (e) { return Promise.reject(e); }
    return personKeyExtractable(id, current).then(function (hk) {
      return personEnvelope(hk, id, next).then(function (env) {
        return B.change(function (st) {
          var u = clone(st.users[id]); u.mustChange = false; u.updated = clock().toISOString();
          var v = clone(hk.vault); v.people[id] = env;
          return { type: "person.password.changed", data: { id: id, no: u.no }, recs: [{ kind: "user", id: id, value: u }], meta: [{ key: "vault", value: v }], result: u };
        });
      }).then(function (u) { B.user = state.users[id]; return u; });
    });
  };

  /* ---------- signing in: the owner, or one of the people, each with their own password ---------- */
  /* Whose envelopes a typed name may open, in order: the person it names (by name or staff number), then the owner.
     The owner's envelope is always tried, whatever name was typed or none: the password is the key, never the name,
     so the owner is never shut out by a name remembered differently. */
  function whoIs(d, typed) {
    var n = cleanName(typed), num = /^\d{3,6}$/.test(n) ? parseInt(n, 10) : null, people = (d && d.people) || [], out = [];
    for (var i = 0; i < people.length; i++) { var x = people[i]; if (num ? x.no === num : B.sameName(x.name, n)) out.push(x.id); }
    out.push("owner");
    return out;
  }
  B.signIn = function (name, password) {
    return Promise.all([D.get("meta", "vault"), D.get("meta", "door")]).then(function (r) {
      var v = r[0], d = r[1] || {}, who = whoIs(d, name), id = null;
      if (!v) throw err("nostore");
      function attempt(i) {
        if (i >= who.length) throw err("wrong");
        var cand = who[i], env = cand === "owner" ? v.owner : v.people ? v.people[cand] : null;
        if (!env) return attempt(i + 1);
        return C.passwordKey(String(password), U.b64d(env.salt), iterations(v)).then(function (kek) {
          return C.unwrap(env, kek, aadEnv(v.storeId, cand === "owner" ? "owner" : "person:" + cand), false);
        }).then(function (key) { id = cand; return key; }, function () { return attempt(i + 1); });
      }
      return attempt(0).then(function (key) { return load(v, key, id); }).then(function (st) {
        var nd = clone(d); nd.last = B.user.name;
        if (id === "owner" && !nd.user) nd.user = cleanName(name) || B.user.name;
        doorMeta = nd;
        return D.write([{ store: "meta", key: "door", value: nd }]).catch(function () { }).then(function () { return st; });
      });
    });
  };
  /* The practice store opens with no sign-in; there the owner can see Lakay as any of the people sees it. */
  B.practiceAs = function (id) {
    if (B.mode !== "practice" || !state || !state.users[id] || state.users[id].active === false) return Promise.reject(err("denied"));
    B.user = state.users[id]; emit("user", B.user);
    return Promise.resolve(B.user);
  };

  /* ---------- the time clock: each person's shifts, with their breaks ---------- */
  B.openShift = function (userId) {
    var st = state; if (!st) return null;
    for (var i = st.shifts.length - 1; i >= 0; i--) { var x = st.shifts[i]; if (x.user === userId && !x.out) return x; }
    return null;
  };
  B.onClock = function () { return state ? state.shifts.filter(function (x) { return !x.out; }) : []; };
  B.onBreak = function (sh) { var b = sh && sh.breaks && sh.breaks[sh.breaks.length - 1]; return !!(b && !b.to); };
  B.breakMs = function (sh, now) {
    var end = sh.out ? Date.parse(sh.out) : (now || Date.now());
    return (sh.breaks || []).reduce(function (m, b) { return m + Math.max(0, (b.to ? Date.parse(b.to) : end) - Date.parse(b.from)); }, 0);
  };
  B.shiftMs = function (sh, now) {
    var end = sh.out ? Date.parse(sh.out) : (now || Date.now());
    return Math.max(0, end - Date.parse(sh.in) - B.breakMs(sh, now));
  };
  B.shifts = function (filter) { return state ? state.shifts.filter(function (x) { return !filter || filter(x); }) : []; };
  function shiftChange(userId, type, fn) {
    return B.change(function (st) {
      if (userId !== B.user.id) need("team");
      var sh = B.openShift(userId); if (!sh) return null;
      sh = clone(sh);
      var now = clock().toISOString(), data = fn(sh, now); if (!data) return null;
      data.shift = sh.id; data.user = userId; data.at = now;
      return { type: type, data: data, recs: [{ kind: "shift", id: sh.id, value: sh }], result: sh };
    });
  }
  B.clockIn = function () {
    return B.change(function () {
      if (B.openShift(B.user.id)) return null;
      var now = clock(), sh = { id: U.uid("t"), user: B.user.id, no: B.numberOf(B.user), in: now.toISOString(), out: null, breaks: [], day: U.dayKey(now), dev: B.device.id };
      return { type: "clock.in", data: { shift: sh.id, user: sh.user, at: sh.in }, recs: [{ kind: "shift", id: sh.id, value: sh }], result: sh };
    });
  };
  B.clockOut = function (userId) {
    userId = userId || (B.user && B.user.id);
    return shiftChange(userId, "clock.out", function (sh, now) {
      (sh.breaks || []).forEach(function (b) { if (!b.to) b.to = now; });
      sh.out = now; if (userId !== B.user.id) sh.outBy = B.user.id;
      return { worked: B.shiftMs(sh), breaks: B.breakMs(sh) };
    });
  };
  B.breakStart = function () {
    return shiftChange(B.user.id, "break.started", function (sh, now) { if (B.onBreak(sh)) return null; sh.breaks = (sh.breaks || []).concat([{ from: now, to: null }]); return {}; });
  };
  B.breakEnd = function () {
    return shiftChange(B.user.id, "break.ended", function (sh, now) { if (!B.onBreak(sh)) return null; sh.breaks[sh.breaks.length - 1].to = now; return {}; });
  };
  /* the practice store's sample shifts, each written whole in one line */
  function recordShift(sh) {
    return B.change(function () { return { type: "shift.recorded", data: { shift: sh.id, user: sh.user, in: sh.in, out: sh.out, practice: true }, recs: [{ kind: "shift", id: sh.id, value: sh }] }; });
  }

  /* ---------- Schedae: each person's sticky notes (Carpe Diem's, in exact parity) ----------
     Sealed with the Store Key like everything in the books, kept per person, and carried in backups. They are a
     person's own scribbles, not the store's books, so a keystroke is not a ledger line: the notes are written quietly
     half a second after typing stops, and at once when the books lock (with the key that was in hand). */
  var notesWait = null, notesDue = null, notesWriting = Promise.resolve(true);
  function noteOwner() { return (B.user && B.user.id) || "owner"; }
  /* the live list of the signed-in person's notes: the screen changes these objects, then calls B.saveNotes() */
  B.notes = function () {
    if (!state) return [];
    var u = noteOwner();
    if (!state.notes) state.notes = {};
    if (!Array.isArray(state.notes[u])) state.notes[u] = [];
    return state.notes[u];
  };
  B.saveNotes = function (now) {
    if (!state || !KEY) return Promise.resolve(false);
    var u = noteOwner();
    notesDue = { key: KEY, id: ID, db: D.NAME, u: u, list: B.notes() };
    clearTimeout(notesWait); notesWait = null;
    if (now) return writeNotes();
    notesWait = setTimeout(writeNotes, 500);
    return Promise.resolve(true);
  };
  /* One write at a time, in order, each into the books it was made in (the practice store's or the store's own),
     so an older copy never lands after a newer one, and a switch of books never loses the last words typed. */
  function writeNotes() {
    var p = notesDue; notesDue = null; clearTimeout(notesWait); notesWait = null;
    if (!p) return notesWriting;
    var value = { v: 1, notes: clone(p.list) };
    notesWriting = notesWriting.then(function () {
      return C.seal(p.key, value, aadRec(p.id, "notes:" + p.u));
    }).then(function (sealed) {
      return D.writeTo(p.db, [{ store: "rec", key: "notes:" + p.u, value: sealed }]);
    }).then(function () { return true; }, function (e) { console.error(e); return false; });
    return notesWriting;
  }
  B.flushNotes = writeNotes;
  /* Wiping or replacing the books waits for this, so no note sealed with the old key lands in the new books. */
  function notesSettled() { return notesWriting.then(function () { return true; }, function () { return true; }); }
  B.notesSettled = notesSettled;

  /* ---------- writing: one change at a time, each worked out from the books as they stand at that moment ---------- */
  var queue = Promise.resolve();
  B.change = function (fn) {
    var p = queue.then(function () {
      if (!KEY || !state) throw err("locked");
      var c = fn(state);
      if (!c) return null;
      if (drill) return drilled(c);
      return commit(c.type, c.data, c.recs || [], c.meta || []).then(function (line) { return c.result !== undefined ? c.result : line; });
    });
    queue = p.catch(function () { });
    return p;
  };
  /* the same one-at-a-time order, for work that writes in its own way (taking another device's lines, Build 24) */
  function enqueue(fn) { var p = queue.then(fn); queue = p.catch(function () { }); return p; }
  /* ---------- exercises (Build 19): Lakay's real screens, with the sealed books set aside ----------
     While an exercise runs, the books that Lakay shows are a copy in memory. A sale, a delivery, a transfer or a break
     made then changes the copy, never the sealed books, and nothing is written to the device. When the exercise ends
     (or Lakay locks), the copy is let go and the books are exactly as they were. Only the counter's work can be done in
     an exercise: anything else is refused. A person's own notes are not part of it, so they stay their own. */
  var drill = null, DRILL_OK = ["sale.completed", "stock.received", "stock.adjusted", "service.recorded", "clock.in", "clock.out", "break.started", "break.ended"];
  B.drilling = function () { return !!drill; };
  B.drillStart = function (onLine) {
    if (drill || !state || !KEY) return false;
    var copy = clone(state);
    copy.notes = state.notes; copy.pad = state.pad;
    drill = { state: state, onLine: onLine || null };
    state = copy; E.settings = state.settings;
    emit("drill", true);
    return true;
  };
  B.drillEnd = function () {
    if (!drill) return false;
    state = drill.state; drill = null; E.settings = state ? state.settings : null;
    emit("drill", false);
    return true;
  };
  function drilled(c) {
    if (DRILL_OK.indexOf(c.type) < 0) throw err("drill");
    var line = { seq: 0, at: clock().toISOString(), day: U.dayKey(clock()), by: B.user.id, type: c.type, data: clone(c.data), drill: true };
    (c.recs || []).forEach(function (r) { put(state, r.kind + ":" + r.id, clone(r.value)); });
    var d = drill;
    emit("change", line);
    if (d && d.onLine) setTimeout(function () { try { d.onLine(line); } catch (e) { console.error(e); } }, 0);
    return c.result !== undefined ? c.result : line;
  }
  /* ---------- stamps (Build 24) ----------
     Every line from Build 24 carries a time that only goes forward on this device (ts: the clock, or one millisecond after
     the last line this device knows of, whichever is later), the records it wrote (w: each record whole, with the
     fields it changed), the stock it moved (sd: item by item) and the door's or the vault's new parts (m). Each record
     is sealed with the stamp of the line that last wrote each of its fields: the line's time, its device's letter and
     its number. Two devices that hold the same lines then work out the same books, whatever order the lines reached
     them in: for each field the later stamp wins; stock is the sum of every device's moves; counters stay each
     device's own. */
  function pad36(n, w) { return Math.max(0, Math.floor(n)).toString(36).padStart(w, "0"); }
  function stampOf(ts, code, seq) { return pad36(ts, 9) + "." + code + "." + pad36(seq, 6); }
  function stampCode(s) { var a = String(s || "").split("."); return a.length === 3 ? a[1] : ""; }
  function stampSeq(s) { var a = String(s || "").split("."); return a.length === 3 ? parseInt(a[2], 36) : 0; }
  function lineTs(line) { return line.ts || Date.parse(line.at) || 0; }
  function lineStamp(line, code) { return stampOf(lineTs(line), code, line.seq); }
  function stampF(s, f) { return (s && (s[f] !== undefined ? s[f] : s[""])) || ""; }
  function same(a, b) { return U.canon(a === undefined ? null : a) === U.canon(b === undefined ? null : b); }
  function changedFields(a, b) {
    var keys = {}, out = [];
    Object.keys(a || {}).forEach(function (k) { keys[k] = 1; }); Object.keys(b || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { if (!same(a[k], b[k])) out.push(k); });
    return out;
  }
  /* what travels to the other devices: everything but each device's own counters, its head, its sync record, and each
     person's sticky notes (they stay on the device where they were written) */
  var LOCAL = { counter: 1, head: 1, sync: 1, notes: 1 };
  function kindOf(k) { return k.slice(0, k.indexOf(":")); }
  var VAULT_PARTS = function (v) {
    var out = { owner: (v && v.owner) || null, master: (v && v.master) || null };
    Object.keys((v && v.people) || {}).forEach(function (id) { out["people:" + id] = v.people[id]; });
    return out;
  };
  function vaultDiff(a, b) {
    var pa = VAULT_PARTS(a), pb = VAULT_PARTS(b), keys = {}, out = [];
    Object.keys(pa).forEach(function (k) { keys[k] = 1; }); Object.keys(pb).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).sort().forEach(function (k) { if (!same(pa[k], pb[k])) out.push([k, pb[k] === undefined ? null : clone(pb[k])]); });
    return out;
  }
  function wrapRec(v, s) { return { "~v": v, "~s": s }; }

  /* opts (Build 24, taking another device's lines): raw, records already worked out with their own stamps; ops,
     further writes for the same transaction; minTs, a time this line must come after */
  function commit(type, data, recs, metaOps, opts) {
    opts = opts || {};
    var now = clock(), seq = state.head.seq + 1, ts = Math.max(now.getTime(), (state.head.ts || 0) + 1, (opts.minTs || 0) + 1);
    var code = (B.device && B.device.code) || "A", stamp = stampOf(ts, code, seq);
    var line = { seq: seq, at: now.toISOString(), day: U.dayKey(now), by: B.user.id, dev: B.device.id, type: type, data: data,
      prev: state.head.hash, build: E.BUILD.number, ts: ts };
    var key = KEY, id = ID, w = [], sd = {}, stamps = {};
    recs.forEach(function (r) {
      var k = r.kind + ":" + r.id, old = getRec(state, k), s;
      if (old) {
        var f = changedFields(old, r.value);
        s = clone(state.stamps[k]) || {};
        f.forEach(function (x) { s[x] = stamp; });
        if (f.length && !LOCAL[r.kind]) w.push([k, clone(r.value), f]);
      } else {
        s = { "": stamp };
        if (!LOCAL[r.kind]) w.push([k, clone(r.value), null]);
      }
      if (r.kind === "item") { var dl = ((r.value && r.value.stock) || 0) - ((old && old.stock) || 0); if (dl) sd[r.id] = dl; }
      stamps[k] = s;
    });
    if (w.length) line.w = w;
    if (Object.keys(sd).length) line.sd = sd;
    var vaultOp = metaOps.filter(function (m) { return m.key === "vault"; })[0], customOp = metaOps.filter(function (m) { return m.key === "custom"; })[0];
    var syncRec = null;
    return (vaultOp ? D.get("meta", "vault") : Promise.resolve(null)).then(function (oldVault) {
      var m = {};
      if (vaultOp && B.mode !== "practice") { var vd = vaultDiff(oldVault, vaultOp.value); if (vd.length) m.v = vd; }
      if (customOp && B.mode !== "practice") m.c = clone(customOp.value);
      if (m.v || m.c) {
        line.m = m;
        syncRec = clone(state.sync) || { v: 1, chains: {}, vs: {}, cs: "" };
        syncRec.vs = syncRec.vs || {};
        (m.v || []).forEach(function (x) { syncRec.vs[x[0]] = stamp; });
        if (m.c) syncRec.cs = stamp;
      }
      return U.sha256hex(U.canon(line));
    }).then(function (hash) {
      var head = { seq: seq, hash: hash, at: line.at, ts: ts };
      var raw = opts.raw || [];
      var seals = [C.seal(key, line, aadLine(id, seq)), C.seal(key, head, aadRec(id, "head:main"))]
        .concat(recs.map(function (r) { var k = r.kind + ":" + r.id; return C.seal(key, wrapRec(r.value, stamps[k]), aadRec(id, k)); }))
        .concat(raw.map(function (r) { return C.seal(key, r.s ? wrapRec(r.v, r.s) : r.v, aadRec(id, r.k)); }));
      if (syncRec) seals.push(C.seal(key, syncRec, aadRec(id, "sync:main")));
      return Promise.all(seals).then(function (sealed) {
        var ops = [{ store: "journal", key: seq, value: sealed[0], add: true }, { store: "rec", key: "head:main", value: sealed[1] }];
        recs.forEach(function (r, i) { ops.push({ store: "rec", key: r.kind + ":" + r.id, value: sealed[i + 2] }); });
        raw.forEach(function (r, i) { ops.push({ store: "rec", key: r.k, value: sealed[i + 2 + recs.length] }); });
        if (syncRec) ops.push({ store: "rec", key: "sync:main", value: sealed[sealed.length - 1] });
        metaOps.forEach(function (mo) { ops.push({ store: "meta", key: mo.key, value: mo.value }); });
        (opts.ops || []).forEach(function (o) { ops.push(o); });
        return D.write(ops).then(function () {
          metaOps.forEach(function (mo) { if (mo.key === "door") doorMeta = clone(mo.value); });
          if (state) {
            state.head = head;
            recs.forEach(function (r) { var k = r.kind + ":" + r.id; put(state, k, clone(r.value)); state.stamps[k] = stamps[k]; });
            raw.forEach(function (r) { put(state, r.k, clone(r.v)); if (r.s) state.stamps[r.k] = r.s; });
            if (syncRec) state.sync = syncRec;
          }
          emit("change", line);
          return line;
        });
      });
    });
  }

  /* ---------- settings, people, shelves ---------- */
  B.updateSettings = function (changes) {
    return B.change(function (st) {
      need("owner");
      var s = clone(st.settings), diff = {};
      Object.keys(changes).forEach(function (k) {
        if (JSON.stringify(s[k]) !== JSON.stringify(changes[k])) { diff[k] = [s[k] === undefined ? null : s[k], changes[k]]; s[k] = clone(changes[k]); }
      });
      if (!Object.keys(diff).length) return null;
      var meta = [];
      if (diff.ownerName && nameTaken(st, s.ownerName, "owner")) throw err("nameTaken");
      if (diff.storeName || diff.ownerName) meta.push({ key: "door", value: doorWith(diff.ownerName ? { storeName: s.storeName, user: cleanName(s.ownerName) } : { storeName: s.storeName }) });
      if (diff.ownerName) {
        var u = clone(st.users.owner); u.name = s.ownerName;
        return { type: "settings.updated", data: { changes: diff }, recs: [{ kind: "settings", id: "main", value: s }, { kind: "user", id: "owner", value: u }], meta: meta };
      }
      return { type: "settings.updated", data: { changes: diff }, recs: [{ kind: "settings", id: "main", value: s }], meta: meta };
    }).then(function (r) { if (state) E.settings = state.settings; return r; });
  };
  B.addCategory = function (name) {
    name = String(name || "").trim();
    if (!name) return Promise.reject(err("name"));
    return B.change(function (st) {
      need("items");
      var id = U.uid("c"), order = Object.keys(st.cats).length;
      var c = { id: id, name: name, order: order };
      return { type: "category.created", data: { cat: c }, recs: [{ kind: "cat", id: id, value: c }], result: c };
    });
  };

  /* The Author Studio's choices (names, words, look, receipt) are kept beside the envelopes, so the door can wear them
     before the store is opened; each change is also a ledger line, written in the same transaction. */
  B.saveCustom = function (custom, changed) {
    /* the Author Studio's choices: the owner's alone, and never from the practice store (Build 24) */
    if (B.mode === "practice") return Promise.reject(err("denied"));
    return B.change(function () { need("owner"); return { type: "author.changed", data: { changed: changed }, meta: [{ key: "custom", value: custom }] }; })
      .then(function (r) { E.custom = custom; return r; });
  };

  /* ---------- items ---------- */
  var ITEM_FIELDS = ["name", "cat", "price", "cost", "barcode", "sku", "taxId", "reorderAt", "notes"];
  function checkItem(it, st, selfId) {
    if (!it.name || !String(it.name).trim()) return "name";
    if (!Number.isSafeInteger(it.price) || it.price < 0) return "price";
    if (it.cost !== null && (!Number.isSafeInteger(it.cost) || it.cost < 0)) return "cost";
    if (it.reorderAt !== null && (!Number.isSafeInteger(it.reorderAt) || it.reorderAt < 0)) return "reorder";
    if (!st.cats[it.cat]) return "cat";
    if (it.taxId && !(st.settings.taxes || []).some(function (t) { return t.id === it.taxId; })) return "tax";
    if (it.barcode) {
      var dup = Object.keys(st.items).some(function (k) { var o = st.items[k]; return k !== selfId && !o.archived && o.barcode && o.barcode === it.barcode; });
      if (dup) return "barcodeTaken";
    }
    return null;
  }
  B.addItem = function (f) {
    return B.change(function (st) {
      need("items");
      var now = clock().toISOString();
      var it = { id: U.uid("i"), name: String(f.name || "").trim(), cat: f.cat, price: f.price, cost: f.cost === undefined ? null : f.cost,
        barcode: String(f.barcode || "").trim() || null, sku: String(f.sku || "").trim() || null, taxId: f.taxId || null,
        reorderAt: f.reorderAt === undefined ? null : f.reorderAt, notes: String(f.notes || "").trim(), stock: 0, archived: false, created: now, updated: now };
      var opening = f.openingStock || 0;
      if (!Number.isSafeInteger(opening) || opening < 0) throw err("qty");
      var bad = checkItem(it, st, it.id); if (bad) throw err(bad);
      it.stock = opening;
      return { type: "item.created", data: { item: clone(it) }, recs: [{ kind: "item", id: it.id, value: it }], result: it };
    });
  };
  B.editItem = function (id, f) {
    return B.change(function (st) {
      need("items");
      var old = st.items[id]; if (!old) throw err("noitem");
      var it = clone(old), diff = {};
      ITEM_FIELDS.forEach(function (k) {
        if (!(k in f)) return;
        var v = f[k];
        if (typeof v === "string") v = v.trim();
        if ((k === "barcode" || k === "sku" || k === "taxId") && !v) v = null;
        if (JSON.stringify(it[k]) !== JSON.stringify(v)) { diff[k] = [it[k] === undefined ? null : it[k], v]; it[k] = v; }
      });
      if (!Object.keys(diff).length) return null;
      var bad = checkItem(it, st, id); if (bad) throw err(bad);
      it.updated = clock().toISOString();
      return { type: "item.updated", data: { id: id, changes: diff }, recs: [{ kind: "item", id: id, value: it }], result: it };
    });
  };
  B.setArchived = function (id, flag) {
    return B.change(function (st) {
      need("items");
      var it = clone(st.items[id]); if (!it) throw err("noitem");
      if (!!it.archived === !!flag) return null;
      it.archived = !!flag; it.updated = clock().toISOString();
      return { type: "item.archived", data: { id: id, archived: !!flag }, recs: [{ kind: "item", id: id, value: it }], result: it };
    });
  };
  /* Weighted average cost: what is on the shelf is valued at the average of what it cost. */
  function averageCost(stockBefore, costBefore, qty, unitCost) {
    if (unitCost === null || unitCost === undefined) return costBefore;
    var have = Math.max(0, stockBefore);
    if (have === 0 || costBefore === null) return unitCost;
    return U.divRound(have * costBefore + qty * unitCost, have + qty);
  }
  B.averageCost = averageCost;
  B.receive = function (id, qty, unitCost, supplier, note) {
    return B.change(function (st) {
      need("receive");
      var it = clone(st.items[id]); if (!it) throw err("noitem");
      if (!Number.isSafeInteger(qty) || qty <= 0) throw err("qty");
      if (unitCost !== null && (!Number.isSafeInteger(unitCost) || unitCost < 0)) throw err("cost");
      var before = it.stock, costBefore = it.cost, costAfter = averageCost(before, costBefore, qty, unitCost);
      it.stock = before + qty; it.cost = costAfter; it.updated = clock().toISOString();
      var mv = { id: U.uid("m"), kind: "receive", itemId: id, qty: qty, unitCost: unitCost, costBefore: costBefore, costAfter: costAfter,
        stockBefore: before, stockAfter: it.stock, supplier: String(supplier || "").trim(), note: String(note || "").trim(),
        at: clock().toISOString(), day: U.dayKey(clock()), by: B.user.id };
      return { type: "stock.received", data: clone(mv), recs: [{ kind: "item", id: id, value: it }, { kind: "move", id: mv.id, value: mv }], result: it };
    });
  };
  B.REASONS = ["count", "damaged", "expired", "lost", "stolen", "personal", "returned", "other"];
  B.adjust = function (id, delta, reason, note) {
    return B.change(function (st) {
      need("adjust");
      var it = clone(st.items[id]); if (!it) throw err("noitem");
      if (!Number.isSafeInteger(delta) || delta === 0) throw err("qty");
      if (B.REASONS.indexOf(reason) < 0) throw err("reason");
      if (reason === "other" && !String(note || "").trim()) throw err("note");
      var before = it.stock; it.stock = before + delta; it.updated = clock().toISOString();
      var mv = { id: U.uid("m"), kind: "adjust", itemId: id, qty: delta, reason: reason, unitCost: it.cost, stockBefore: before, stockAfter: it.stock,
        note: String(note || "").trim(), at: clock().toISOString(), day: U.dayKey(clock()), by: B.user.id };
      return { type: "stock.adjusted", data: clone(mv), recs: [{ kind: "item", id: id, value: it }, { kind: "move", id: mv.id, value: mv }], result: it };
    });
  };

  /* ---------- learning (Build 17): each person's lessons done, kept in the books so that the owner can see them ---------- */
  B.trainingOf = function (userId) {
    var r = state && state.train && state.train[userId || (B.user && B.user.id)];
    return r ? clone(r) : { user: userId || (B.user && B.user.id), done: {} };
  };
  B.trainDone = function (lesson, score, of) {
    return B.change(function (st) {
      if (!B.user) throw err("locked");
      lesson = String(lesson || "").slice(0, 30);
      if (!/^[a-z]+$/.test(lesson) || !Number.isSafeInteger(score) || !Number.isSafeInteger(of) || score < 0 || of < 1 || score > of) throw err("lesson");
      var me = B.user.id, rec = clone((st.train && st.train[me]) || { user: me, done: {} });
      rec.done[lesson] = { at: clock().toISOString(), score: score, of: of };
      return { type: "training.completed", data: { user: me, lesson: lesson, score: score, of: of }, recs: [{ kind: "train", id: me, value: rec }], result: rec };
    });
  };

  /* ---------- the store's own training (Build 19): the onboarding path, the store's tasks, refreshers, assignments ----------
     The course (one record) is the store's: the path a new person follows, day by day; the store's own tasks (read the
     cash rules, work a first shift beside a leader...), each done by the person or signed off by a leader; and which
     lessons and exercises come due again, some months after they were last done. Each person's plan (one record each)
     holds their onboarding and what was assigned to them. The marks (lessons, exercises, tasks) are in their train
     record. Those with the "train" access write the course and the plans; every change is a ledger line. */
  B.LESSON_IDS = ["welcome", "clock", "sale", "pay", "svc", "stock", "reports", "safe"];
  B.EX_IDS = ["break", "sale", "split", "card", "receive", "transfer"];
  /* the access each lesson and exercise asks for (null: everyone; "owner": the owner only) */
  B.TRAIN_NEED = { "lesson:welcome": null, "lesson:clock": null, "lesson:sale": "sell", "lesson:pay": "sell", "lesson:svc": "sell", "lesson:stock": "receive",
    "lesson:reports": "reports", "lesson:safe": "owner", "exercise:break": null, "exercise:sale": "sell", "exercise:split": "sell", "exercise:card": "sell",
    "exercise:receive": "receive", "exercise:transfer": "sell" };
  var DEFAULT_PATH = [["lesson", "welcome", 1], ["lesson", "clock", 1], ["exercise", "break", 1], ["lesson", "sale", 2], ["exercise", "sale", 2], ["lesson", "pay", 3],
    ["exercise", "split", 3], ["exercise", "card", 3], ["lesson", "stock", 4], ["exercise", "receive", 4], ["lesson", "svc", 5], ["exercise", "transfer", 5], ["lesson", "reports", 6]];
  B.defaultCourse = function () { return { v: 1, tasks: [], path: clone(DEFAULT_PATH), refresh: {} }; };
  B.course = function () { return clone((state && state.course) || B.defaultCourse()); };
  function needOf(kind, ref, course) {
    if (kind === "task") { var tk = ((course && course.tasks) || []).filter(function (x) { return x.id === ref; })[0]; return tk ? (tk.need || null) : undefined; }
    var k = kind + ":" + ref; return Object.prototype.hasOwnProperty.call(B.TRAIN_NEED, k) ? B.TRAIN_NEED[k] : undefined;
  }
  /* whether this person can be given this lesson, exercise or task */
  B.canTrain = function (u, kind, ref, course) {
    course = course || (state && state.course) || B.defaultCourse();
    var n = needOf(kind, ref, course);
    if (n === undefined || !u) return false;
    if (u.role === "owner") return true;
    if (n === null) return true;
    return n !== "owner" && (u.access || []).indexOf(n) >= 0;
  };
  function plain(x, n) { return String(x || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
  /* only what a course can hold, within limits: anything else is left out */
  B.cleanCourse = function (c) {
    c = c || {};
    var o = { v: 1, tasks: [], path: [], refresh: {} };
    (Array.isArray(c.tasks) ? c.tasks : []).slice(0, 40).forEach(function (x) {
      if (!x || typeof x !== "object") return;
      var title = plain(x.title, 80); if (!title) return;
      var id = /^k[a-z0-9]{6,12}$/.test(x.id) && !o.tasks.some(function (y) { return y.id === x.id; }) ? x.id : U.uid("k");
      o.tasks.push({ id: id, title: title, body: plain(x.body, 400), sign: x.sign === "lead" ? "lead" : "self", need: B.ACCESS.indexOf(x.need) >= 0 ? x.need : null });
    });
    (Array.isArray(c.path) ? c.path : []).slice(0, 60).forEach(function (x) {
      if (!Array.isArray(x)) return;
      var kind = x[0], ref = x[1], day = Math.round(Number(x[2]));
      if (["lesson", "exercise", "task"].indexOf(kind) < 0 || needOf(kind, ref, o) === undefined) return;
      if (o.path.some(function (y) { return y[0] === kind && y[1] === ref; })) return;
      o.path.push([kind, ref, day >= 1 && day <= 60 ? day : 1]);
    });
    Object.keys(c.refresh && typeof c.refresh === "object" ? c.refresh : {}).forEach(function (k) {
      var i = k.indexOf(":"), kind = k.slice(0, i), ref = k.slice(i + 1), d = Math.round(Number(c.refresh[k]));
      if ((kind === "lesson" || kind === "exercise") && needOf(kind, ref, o) !== undefined && d >= 30 && d <= 730) o.refresh[k] = d;
    });
    return o;
  };
  B.saveCourse = function (c) {
    return B.change(function (st) {
      need("train");
      var next = B.cleanCourse(c), before = st.course || B.defaultCourse(), changed = [];
      ["tasks", "path", "refresh"].forEach(function (k) { if (JSON.stringify(before[k]) !== JSON.stringify(next[k])) changed.push(k); });
      if (!changed.length) return null;
      return { type: "course.updated", data: { changed: changed, tasks: next.tasks.length, path: next.path.length, refresh: Object.keys(next.refresh).length },
        recs: [{ kind: "course", id: "main", value: next }], result: next };
    });
  };
  B.planOf = function (userId) { var p = state && state.plans && state.plans[userId]; return p ? clone(p) : { user: userId, onboarding: null, items: [] }; };
  function planRec(st, userId) { return clone((st.plans && st.plans[userId]) || { user: userId, onboarding: null, items: [] }); }
  function trainRec(st, userId) { return clone((st.train && st.train[userId]) || { user: userId, done: {} }); }
  function markOf(st, userId, kind, ref) {
    var r = st.train && st.train[userId]; if (!r) return null;
    return (kind === "lesson" ? (r.done || {})[ref] : kind === "exercise" ? (r.ex || {})[ref] : kind === "task" ? (r.tasks || {})[ref] : null) || null;
  }
  /* an onboarding item counts what was done at any time; an item assigned (or a refresher) asks for it done again, from then on */
  function itemDone(st, userId, it) { var m = markOf(st, userId, it.kind, it.ref); return !!m && (it.why === "onboarding" || m.at >= (it.at || "")); }
  B.markOf = function (userId, kind, ref) { return state ? clone(markOf(state, userId, kind, ref)) : null; };
  B.itemDone = function (userId, it) { return !!state && itemDone(state, userId, it); };
  function dueDay(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : null; }
  /* lessons, exercises and the store's tasks given to people, each with the day it is due */
  B.assign = function (userIds, items, due) {
    return B.change(function (st) {
      need("train");
      var course = st.course || B.defaultCourse(), now = clock().toISOString(), recs = [], given = [];
      userIds = (userIds || []).filter(function (id, i, a) { return a.indexOf(id) === i; });
      items = (items || []).filter(function (x) { return x && needOf(x.kind, x.ref, course) !== undefined; });
      if (!userIds.length || !items.length) throw err("assign");
      userIds.forEach(function (id) {
        var u = st.users[id]; if (!u || u.active === false) throw err("noperson");
        var plan = planRec(st, id), added = 0;
        items.forEach(function (x) {
          if (!B.canTrain(u, x.kind, x.ref, course)) return;
          if (plan.items.some(function (y) { return y.kind === x.kind && y.ref === x.ref && !itemDone(st, id, y); })) return;
          plan.items.push({ id: U.uid("a"), kind: x.kind, ref: x.ref, due: dueDay(due), by: B.user.id, at: now, why: "assigned" }); added++;
        });
        if (added) { recs.push({ kind: "plan", id: id, value: plan }); given.push({ user: id, n: added }); }
      });
      if (!recs.length) return null;
      return { type: "training.assigned", data: { given: given, items: items.map(function (x) { return x.kind + ":" + x.ref; }), due: dueDay(due) }, recs: recs, result: given };
    });
  };
  B.unassign = function (userId, itemId) {
    return B.change(function (st) {
      need("train");
      var plan = planRec(st, userId), it = plan.items.filter(function (x) { return x.id === itemId; })[0];
      if (!it) return null;
      plan.items = plan.items.filter(function (x) { return x.id !== itemId; });
      return { type: "training.unassigned", data: { user: userId, item: it.kind + ":" + it.ref }, recs: [{ kind: "plan", id: userId, value: plan }], result: plan };
    });
  };
  /* a new person's first days: the course's path, kept to what their access opens, each item due on its day */
  B.startOnboarding = function (userId, startDay) {
    return B.change(function (st) {
      need("train");
      var u = st.users[userId]; if (!u || u.active === false || u.role === "owner") throw err("noperson");
      var plan = planRec(st, userId);
      if (plan.onboarding && !plan.onboarding.done) throw err("already");
      var course = st.course || B.defaultCourse(), now = clock(), start = dueDay(startDay) || U.dayKey(now), n = 0;
      plan.items = plan.items.filter(function (x) { return x.why !== "onboarding"; });
      course.path.forEach(function (x) {
        if (!B.canTrain(u, x[0], x[1], course)) return;
        plan.items.push({ id: U.uid("a"), kind: x[0], ref: x[1], due: U.dayKey(U.addDays(U.fromDayKey(start), x[2] - 1)), day: x[2], by: B.user.id, at: now.toISOString(), why: "onboarding" }); n++;
      });
      plan.onboarding = { start: start, started: now.toISOString(), by: B.user.id, done: null };
      return { type: "onboarding.started", data: { user: userId, start: start, items: n }, recs: [{ kind: "plan", id: userId, value: plan }], result: plan };
    });
  };
  /* a leader signs the onboarding off once every item of it is done (never their own, unless they are the owner) */
  B.signOff = function (userId) {
    return B.change(function (st) {
      need("train");
      if (userId === B.user.id && !B.isOwner()) throw err("denied");
      var plan = planRec(st, userId);
      if (!plan.onboarding || plan.onboarding.done) throw err("noonboarding");
      if (plan.items.some(function (x) { return x.why === "onboarding" && !itemDone(st, userId, x); })) throw err("notDone");
      plan.onboarding.done = { at: clock().toISOString(), by: B.user.id };
      return { type: "onboarding.signedoff", data: { user: userId }, recs: [{ kind: "plan", id: userId, value: plan }], result: plan };
    });
  };
  /* refreshers: what the course asks to be taken again, some days after it was last done (shown a week before) */
  B.refreshersOf = function (userId) {
    var st = state; if (!st) return [];
    var u = st.users[userId], course = st.course || B.defaultCourse(), out = [], now = clock().getTime();
    Object.keys(course.refresh || {}).forEach(function (k) {
      var i = k.indexOf(":"), kind = k.slice(0, i), ref = k.slice(i + 1), days = course.refresh[k];
      if (!B.canTrain(u, kind, ref, course)) return;
      var m = markOf(st, userId, kind, ref); if (!m) return;
      var due = Date.parse(m.at) + days * 86400000;
      if (due <= now + 7 * 86400000) out.push({ kind: kind, ref: ref, last: m.at, due: U.dayKey(new Date(due)), every: days, overdue: due <= now, why: "refresh" });
    });
    return out;
  };
  B.exerciseDone = function (exId) {
    return B.change(function (st) {
      if (!B.user) throw err("locked");
      if (B.EX_IDS.indexOf(exId) < 0) throw err("exercise");
      var me = B.user.id, rec = trainRec(st, me); rec.ex = rec.ex || {};
      rec.ex[exId] = { at: clock().toISOString() };
      return { type: "training.exercise", data: { user: me, exercise: exId }, recs: [{ kind: "train", id: me, value: rec }], result: rec };
    });
  };
  /* one of the store's tasks, done: by the person (a task they mark themselves) or signed off by a leader */
  B.taskDone = function (userId, taskId) {
    return B.change(function (st) {
      if (!B.user) throw err("locked");
      var course = st.course || B.defaultCourse(), tk = (course.tasks || []).filter(function (x) { return x.id === taskId; })[0];
      if (!tk) throw err("task");
      if (!st.users[userId]) throw err("noperson");
      if (tk.sign === "lead") { need("train"); if (userId === B.user.id && !B.isOwner()) throw err("denied"); }
      else if (userId !== B.user.id) need("train");
      var rec = trainRec(st, userId); rec.tasks = rec.tasks || {};
      rec.tasks[taskId] = { at: clock().toISOString(), by: B.user.id };
      return { type: "training.task", data: { user: userId, task: taskId, by: B.user.id }, recs: [{ kind: "train", id: userId, value: rec }], result: rec };
    });
  };

  /* ---------- schedules and shift swaps (Build 20) ----------
     A shift planned is a "slot": who, which day, from and to (the store's own clock, hh:mm) and a short note. Those with
     the team access plan the week, fill it from the usual week or from the week before, and change or remove a shift;
     every change is a ledger line. A person may ask a colleague to cover one of their shifts, or to trade one for one
     of the colleague's. The colleague answers; then someone with the team access approves, and only then do the shifts
     change hands (no one approves their own request, the owner aside). The time clock is never touched: the hours worked
     stay what the clock says, and the schedule is compared with them. */
  function slotOrder(a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.from < b.from ? -1 : a.from > b.from ? 1 : 0; }
  function hhmm(x) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(x || ""); }
  function mins(x) { return +x.slice(0, 2) * 60 + +x.slice(3, 5); }
  B.slotMins = function (sl) { return Math.max(0, mins(sl.to) - mins(sl.from)); };
  B.slots = function (filter) { return state ? (state.slots || []).filter(function (x) { return x.status !== "off" && (!filter || filter(x)); }).map(clone) : []; };
  function slotOn(st, id) { return (st.slots || []).filter(function (x) { return x.id === id && x.status !== "off"; })[0] || null; }
  B.slotOf = function (id) { var x = state && slotOn(state, id); return x ? clone(x) : null; };
  /* two shifts of one person on one day may not overlap */
  function overlaps(st, sl, skip) {
    return (st.slots || []).some(function (x) {
      return x.status !== "off" && x.user === sl.user && x.day === sl.day && skip.indexOf(x.id) < 0 && mins(x.from) < mins(sl.to) && mins(sl.from) < mins(x.to);
    });
  }
  function cleanSlot(st, f, base) {
    var sl = clone(base);
    if (f.user !== undefined) sl.user = String(f.user || "");
    if (f.day !== undefined) sl.day = String(f.day || "");
    if (f.from !== undefined) sl.from = String(f.from || "");
    if (f.to !== undefined) sl.to = String(f.to || "");
    if (f.note !== undefined) sl.note = plain(f.note, 60);
    var u = st.users[sl.user];
    if (!u || u.active === false) throw err("noperson");
    if (!dueDay(sl.day)) throw err("day");
    /* the plan of a day gone by is kept as it was: no one rewrites it after the fact */
    if (sl.day < U.dayKey(clock())) throw err("pastday");
    if (!hhmm(sl.from) || !hhmm(sl.to) || mins(sl.to) <= mins(sl.from)) throw err("hours");
    sl.note = sl.note || "";
    return sl;
  }
  /* a request still open on a shift that changed is closed, so no one approves a swap of a shift that is no longer there */
  function dropSwaps(st, ids, now) {
    return (st.swaps || []).filter(function (w) { return B.SWAP_OPEN.indexOf(w.status) >= 0 && (ids.indexOf(w.slot) >= 0 || ids.indexOf(w.theirSlot) >= 0); })
      .map(function (w) { var v = clone(w); v.status = "void"; v.closed = now; return { kind: "swap", id: v.id, value: v }; });
  }
  B.addSlot = function (f) {
    return B.change(function (st) {
      need("team");
      var sl = cleanSlot(st, f, { id: U.uid("s"), note: "" });
      if (overlaps(st, sl, [])) throw err("overlap");
      sl.by = B.user.id; sl.at = clock().toISOString(); sl.status = "on";
      return { type: "slot.added", data: { slot: clone(sl) }, recs: [{ kind: "slot", id: sl.id, value: sl }], result: sl };
    });
  };
  B.changeSlot = function (id, f) {
    return B.change(function (st) {
      need("team");
      var cur = slotOn(st, id); if (!cur) throw err("noslot");
      if (cur.day < U.dayKey(clock())) throw err("pastday");
      var sl = cleanSlot(st, f, cur), diff = {};
      ["user", "day", "from", "to", "note"].forEach(function (k) { if (sl[k] !== cur[k]) diff[k] = [cur[k], sl[k]]; });
      if (!Object.keys(diff).length) return null;
      if (overlaps(st, sl, [id])) throw err("overlap");
      var now = clock().toISOString(); sl.updated = now; sl.updatedBy = B.user.id;
      return { type: "slot.changed", data: { id: id, diff: diff }, recs: [{ kind: "slot", id: id, value: sl }].concat(dropSwaps(st, [id], now)), result: sl };
    });
  };
  B.removeSlot = function (id) {
    return B.change(function (st) {
      need("team");
      var cur = slotOn(st, id); if (!cur) throw err("noslot");
      if (cur.day < U.dayKey(clock())) throw err("pastday");
      var now = clock().toISOString(), sl = clone(cur); sl.status = "off"; sl.updated = now; sl.updatedBy = B.user.id;
      return { type: "slot.removed", data: { id: id, user: cur.user, day: cur.day, from: cur.from, to: cur.to }, recs: [{ kind: "slot", id: id, value: sl }].concat(dropSwaps(st, [id], now)), result: sl };
    });
  };
  /* the first day of the week that holds a day, by the store's own first day of the week */
  B.weekStartKey = function (d) {
    d = d || clock();
    var first = state && state.settings && state.settings.weekStart === 0 ? 0 : 1, x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return U.dayKey(U.addDays(x, -((x.getDay() - first + 7) % 7)));
  };
  function dayIndex(fromKey, dayKey) { return Math.round((U.fromDayKey(dayKey).getTime() - U.fromDayKey(fromKey).getTime()) / 86400000); }
  function weekRows(st, weekKey) {
    var end = U.dayKey(U.addDays(U.fromDayKey(weekKey), 6));
    return (st.slots || []).filter(function (x) { return x.status !== "off" && x.day >= weekKey && x.day <= end; })
      .map(function (x) { return { dow: dayIndex(weekKey, x.day), user: x.user, from: x.from, to: x.to, note: x.note || "" }; });
  }
  /* the usual week: one week of shifts kept as the pattern the next weeks are filled from */
  B.usualWeek = function () { return clone((state && state.rota) || { v: 1, rows: [] }); };
  B.saveUsualWeek = function (weekKey) {
    return B.change(function (st) {
      need("team");
      if (!dueDay(weekKey)) throw err("day");
      var rows = weekRows(st, weekKey);
      if (!rows.length) throw err("empty");
      var v = { v: 1, rows: rows, from: weekKey, at: clock().toISOString(), by: B.user.id };
      return { type: "rota.saved", data: { from: weekKey, rows: rows.length }, recs: [{ kind: "rota", id: "main", value: v }], result: v };
    });
  };
  /* a week filled from the usual week or from the week before it: only today and the days to come, and never a shift that
     would overlap one already there */
  B.fillWeek = function (weekKey, source) {
    return B.change(function (st) {
      need("team");
      if (!dueDay(weekKey)) throw err("day");
      source = source === "last" ? "last" : "usual";
      var rows = source === "last" ? weekRows(st, U.dayKey(U.addDays(U.fromDayKey(weekKey), -7))) : ((st.rota && st.rota.rows) || []);
      var now = clock(), todayKey = U.dayKey(now), at = now.toISOString(), tmp = { slots: (st.slots || []).slice() }, recs = [];
      rows.forEach(function (r) {
        var u = st.users[r.user]; if (!u || u.active === false || !hhmm(r.from) || !hhmm(r.to) || r.dow < 0 || r.dow > 6) return;
        var sl = { id: U.uid("s"), user: r.user, day: U.dayKey(U.addDays(U.fromDayKey(weekKey), r.dow)), from: r.from, to: r.to, note: plain(r.note, 60), by: B.user.id, at: at, status: "on" };
        if (sl.day < todayKey || overlaps(tmp, sl, [])) return;
        tmp.slots.push(sl); recs.push({ kind: "slot", id: sl.id, value: sl });
      });
      if (!recs.length) return null;
      return { type: "week.filled", data: { week: weekKey, source: source, added: recs.length }, recs: recs, result: recs.map(function (r) { return r.value; }) };
    });
  };
  /* ---- swaps: a colleague covers a shift, or two people trade one shift each ---- */
  B.SWAP_OPEN = ["asked", "agreed"];
  B.swaps = function (filter) { return state ? (state.swaps || []).filter(function (x) { return !filter || filter(x); }).map(clone) : []; };
  function swapOn(st, id) { return clone((st.swaps || []).filter(function (x) { return x.id === id; })[0] || null); }
  function startsLater(sl) { var now = clock(), k = U.dayKey(now); return sl.day > k || (sl.day === k && mins(sl.from) > now.getHours() * 60 + now.getMinutes()); }
  B.askSwap = function (f) {
    return B.change(function (st) {
      if (!B.user) throw err("locked");
      var sl = slotOn(st, f.slot); if (!sl) throw err("noslot");
      if (sl.user !== B.user.id) throw err("denied");
      if (!startsLater(sl)) throw err("past");
      var to = st.users[f.to]; if (!to || to.active === false || to.id === B.user.id) throw err("noperson");
      var kind = f.kind === "trade" ? "trade" : "cover", theirs = null;
      if (kind === "trade") { theirs = slotOn(st, f.theirSlot); if (!theirs || theirs.user !== to.id) throw err("noslot"); if (!startsLater(theirs)) throw err("past"); }
      var ids = [sl.id].concat(theirs ? [theirs.id] : []);
      if ((st.swaps || []).some(function (w) { return B.SWAP_OPEN.indexOf(w.status) >= 0 && (ids.indexOf(w.slot) >= 0 || ids.indexOf(w.theirSlot) >= 0); })) throw err("already");
      /* whoever takes a shift must be free then */
      if (overlaps(st, { user: to.id, day: sl.day, from: sl.from, to: sl.to }, ids)) throw err("overlap");
      if (theirs && overlaps(st, { user: B.user.id, day: theirs.day, from: theirs.from, to: theirs.to }, ids)) throw err("overlap");
      var w = { id: U.uid("w"), kind: kind, from: B.user.id, to: to.id, slot: sl.id, theirSlot: theirs ? theirs.id : null, note: plain(f.note, 120), at: clock().toISOString(), status: "asked" };
      return { type: "swap.asked", data: { id: w.id, kind: kind, to: to.id, slot: sl.id, theirSlot: w.theirSlot }, recs: [{ kind: "swap", id: w.id, value: w }], result: w };
    });
  };
  B.answerSwap = function (id, yes) {
    return B.change(function (st) {
      var w = swapOn(st, id); if (!w) throw err("noswap");
      if (!B.user || w.to !== B.user.id) throw err("denied");
      if (w.status !== "asked") throw err("closed");
      w.status = yes ? "agreed" : "declined"; w.answered = clock().toISOString();
      return { type: "swap.answered", data: { id: id, yes: !!yes }, recs: [{ kind: "swap", id: id, value: w }], result: w };
    });
  };
  B.cancelSwap = function (id) {
    return B.change(function (st) {
      var w = swapOn(st, id); if (!w) throw err("noswap");
      if (!B.user || w.from !== B.user.id) throw err("denied");
      if (B.SWAP_OPEN.indexOf(w.status) < 0) throw err("closed");
      w.status = "cancelled"; w.closed = clock().toISOString();
      return { type: "swap.cancelled", data: { id: id }, recs: [{ kind: "swap", id: id, value: w }], result: w };
    });
  };
  /* a leader decides; approved, the shifts change hands, checked again as they are now */
  B.decideSwap = function (id, yes, why) {
    return B.change(function (st) {
      need("team");
      var w = swapOn(st, id); if (!w) throw err("noswap");
      if (w.status !== "agreed") throw err("closed");
      if (!B.isOwner() && (w.from === B.user.id || w.to === B.user.id)) throw err("denied");
      var now = clock().toISOString();
      w.decidedBy = B.user.id; w.decided = now;
      if (!yes) { w.status = "refused"; w.why = plain(why, 120); return { type: "swap.decided", data: { id: id, yes: false }, recs: [{ kind: "swap", id: id, value: w }], result: w }; }
      var a = slotOn(st, w.slot), b = w.theirSlot ? slotOn(st, w.theirSlot) : null, ids = [w.slot].concat(w.theirSlot ? [w.theirSlot] : []);
      if (!a || a.user !== w.from || (w.theirSlot && (!b || b.user !== w.to))) throw err("changed");
      if (!startsLater(a) || (b && !startsLater(b))) throw err("past");
      var na = clone(a); na.user = w.to; na.updated = now; na.updatedBy = B.user.id; na.swap = id;
      if (overlaps(st, na, ids)) throw err("overlap");
      var recs = [{ kind: "slot", id: na.id, value: na }];
      if (b) { var nb = clone(b); nb.user = w.from; nb.updated = now; nb.updatedBy = B.user.id; nb.swap = id; if (overlaps(st, nb, ids)) throw err("overlap"); recs.push({ kind: "slot", id: nb.id, value: nb }); }
      w.status = "approved"; recs.push({ kind: "swap", id: id, value: w });
      return { type: "swap.decided", data: { id: id, yes: true, from: w.from, to: w.to, slot: w.slot, theirSlot: w.theirSlot }, recs: recs, result: w };
    });
  };
  /* a shift planned against the time clock: not begun yet, on time (in within five minutes of the start), late, not in
     yet (the shift has begun and no one clocked in), or absent (the shift is over and no one did) */
  B.attendance = function (sl, now) {
    now = now || clock();
    var start = U.fromDayKey(sl.day); start.setHours(+sl.from.slice(0, 2), +sl.from.slice(3, 5), 0, 0);
    var end = U.fromDayKey(sl.day); end.setHours(+sl.to.slice(0, 2), +sl.to.slice(3, 5), 0, 0);
    var first = (state ? state.shifts : []).reduce(function (m, x) {
      if (x.user !== sl.user || x.day !== sl.day) return m; var t = Date.parse(x.in); return m === null || t < m ? t : m;
    }, null);
    if (first === null) return { state: now.getTime() < start.getTime() + 5 * 60000 ? "later" : now < end ? "notin" : "absent" };
    var late = Math.round((first - start.getTime()) / 60000);
    return late > 5 ? { state: "late", minutes: late } : { state: "ontime" };
  };

  /* ---------- money transfers and top-ups (Build 15) ----------
     The money a customer sends, receives or puts on a phone is held for the provider (RIA, CAM, Unitransfer, Boss
     Revolution): it is not the store's sale. Each one is written as it happens: the provider, what kind it was, the
     amount, the fee, the store's commission when it is known, and the provider's reference. No customer's name or
     papers are kept: the provider's own system keeps those. A mistake is voided with a reason, never erased. */
  B.PROVIDERS = ["ria", "cam", "unitransfer", "boss", "other"];
  B.SVC_KINDS = ["send", "payout", "topup"];
  B.recordService = function (f) {
    return B.change(function () {
      need("sell");
      var provider = String(f.provider || ""), kind = String(f.kind || "");
      if (B.PROVIDERS.indexOf(provider) < 0) throw err("provider");
      if (B.SVC_KINDS.indexOf(kind) < 0) throw err("kind");
      if (!Number.isSafeInteger(f.amount) || f.amount <= 0) throw err("amount");
      var fee = f.fee === null || f.fee === undefined ? 0 : f.fee;
      if (!Number.isSafeInteger(fee) || fee < 0) throw err("fee");
      var com = f.commission === null || f.commission === undefined ? null : f.commission;
      if (com !== null && (!Number.isSafeInteger(com) || com < 0)) throw err("commission");
      if (!B.can("reports")) com = null;
      var now = clock();
      var v = { id: U.uid("v"), provider: provider, kind: kind, amount: f.amount, fee: fee, commission: com,
        ref: String(f.ref || "").trim().slice(0, 40), note: String(f.note || "").trim().slice(0, 200),
        at: now.toISOString(), day: U.dayKey(now), hour: now.getHours(), by: B.user.id, byNo: B.numberOf(B.user), dev: B.device.id, status: "done" };
      return { type: "service.recorded", data: { svc: clone(v) }, recs: [{ kind: "svc", id: v.id, value: v }], result: v };
    });
  };
  B.voidService = function (id, reason) {
    return B.change(function (st) {
      need("reports");
      var cur = (st.services || []).find(function (x) { return x.id === id; }); if (!cur) throw err("nosvc");
      if (cur.status === "void") return null;
      reason = String(reason || "").trim(); if (!reason) throw err("note");
      var v = clone(cur); v.status = "void"; v.voidedBy = B.user.id; v.voidedAt = clock().toISOString(); v.voidReason = reason.slice(0, 200);
      return { type: "service.voided", data: { id: id, reason: v.voidReason }, recs: [{ kind: "svc", id: id, value: v }], result: v };
    });
  };
  /* the commission of entries written without one (a cashier records a transfer, the commission is the store's own
     figure): those who see the reports write it afterwards, from the provider's statement (Build 21). One ledger line
     holds them all; an entry voided, or one that already has its commission, is left as it is. */
  B.setSvcCommissions = function (list) {
    return B.change(function (st) {
      need("reports");
      var recs = [], done = [];
      (list || []).forEach(function (x) {
        var cur = (st.services || []).find(function (v) { return v.id === x.id; }); if (!cur) throw err("nosvc");
        if (!Number.isSafeInteger(x.commission) || x.commission < 0) throw err("commission");
        if (cur.status === "void" || (cur.commission !== null && cur.commission !== undefined)) return;
        var v = clone(cur); v.commission = x.commission; v.comBy = B.user.id; v.comAt = clock().toISOString();
        recs.push({ kind: "svc", id: v.id, value: v }); done.push({ id: v.id, commission: v.commission });
      });
      if (!recs.length) return null;
      return { type: "service.commission", data: { list: done }, recs: recs, result: done.length };
    });
  };
  B.services = function (filter) { return state ? (state.services || []).filter(function (x) { return !filter || filter(x); }) : []; };
  /* what one entry did to the drawer: money in (the amount sent or put on a phone, and the fee) or out (a payout) */
  B.svcCash = function (v) { return { cashIn: (v.kind === "payout" ? 0 : v.amount) + (v.fee || 0), cashOut: v.kind === "payout" ? v.amount : 0 }; };

  /* ---------- settling with the providers, and the store's own earnings from them (Build 21) ----------
     How each provider settles is the owner's to say, one provider at a time: it takes the money from the store's bank
     ("sweep"), the store deposits it ("deposit"), or the store keeps a prepaid balance with it ("prepaid"); and the
     store's commission is taken off at once ("deducted") or paid to the store each month ("monthly"). A settlement is
     written as it happens: money paid to the provider, money the provider returned, or a commission it paid. What is
     still the provider's in the store's hands is worked out from the log of transfers and top-ups and the settlements;
     a provider's statement can be checked against it, and the check is kept. A mistake is voided with a reason. */
  B.PROV_HOW = ["sweep", "deposit", "prepaid"];
  B.PROV_COM = ["deducted", "monthly"];
  /* Build 23: who keeps the fee a customer pays on top: the provider (as since Build 15) or the store, whose own
     earning it then is, with the commission */
  B.PROV_FEE = ["provider", "store"];
  B.SETTLE_KINDS = ["paid", "returned", "commission"];
  B.provSetup = function (id) { var x = state && state.provs && state.provs[id]; return x ? clone(x) : null; };
  B.setProvSetup = function (id, f) {
    return B.change(function (st) {
      need("owner");
      if (B.PROVIDERS.indexOf(id) < 0) throw err("provider");
      if (B.PROV_HOW.indexOf(f.how) < 0 || B.PROV_COM.indexOf(f.com) < 0) throw err("how");
      var cur = (st.provs || {})[id] || null, fee = f.fee === undefined ? (cur && cur.fee) || "provider" : f.fee;
      if (B.PROV_FEE.indexOf(fee) < 0) throw err("how");
      var v = { id: id, how: f.how, com: f.com, fee: fee, note: plain(f.note, 120), at: clock().toISOString(), by: B.user.id };
      if (cur && cur.how === v.how && cur.com === v.com && (cur.fee || "provider") === v.fee && (cur.note || "") === v.note) return null;
      return { type: "provider.setup", data: { provider: id, how: v.how, com: v.com, fee: v.fee, was: cur ? [cur.how, cur.com, cur.fee || "provider"] : null }, recs: [{ kind: "prov", id: id, value: v }], result: v };
    });
  };
  B.settle = function (f) {
    return B.change(function (st) {
      need("reports");
      if (B.PROVIDERS.indexOf(f.provider) < 0) throw err("provider");
      if (B.SETTLE_KINDS.indexOf(f.kind) < 0) throw err("kind");
      if (!Number.isSafeInteger(f.amount) || f.amount <= 0) throw err("amount");
      var now = clock(), day = dueDay(f.day) || U.dayKey(now);
      if (day > U.dayKey(now)) throw err("future");
      var x = { id: U.uid("p"), provider: f.provider, kind: f.kind, amount: f.amount, ref: plain(f.ref, 40), note: plain(f.note, 200), day: day, at: now.toISOString(), by: B.user.id, status: "done" };
      return { type: "provider.settled", data: { settle: clone(x) }, recs: [{ kind: "settle", id: x.id, value: x }], result: x };
    });
  };
  B.voidSettle = function (id, reason) {
    return B.change(function (st) {
      need("reports");
      var cur = (st.settles || []).filter(function (x) { return x.id === id; })[0]; if (!cur) throw err("nosettle");
      if (cur.status === "void") return null;
      reason = plain(reason, 200); if (!reason) throw err("note");
      var x = clone(cur); x.status = "void"; x.voidedBy = B.user.id; x.voidedAt = clock().toISOString(); x.voidReason = reason;
      return { type: "provider.settleVoided", data: { id: id, reason: reason }, recs: [{ kind: "settle", id: id, value: x }], result: x };
    });
  };
  B.settlements = function (filter) { return state ? (state.settles || []).filter(function (x) { return !filter || filter(x); }).map(clone) : []; };
  /* a provider's account, from the store's first day: what was collected for it (money in less payouts), the commission,
     what was paid to it and returned by it, and what is still its money in the store's hands ("held"; with a prepaid
     balance, a negative "held" is the balance left) */
  B.providerAccount = function (id) {
    var st = state, setup = (st && st.provs && st.provs[id]) || null, com = setup ? setup.com : "deducted";
    var a = { id: id, setup: setup ? clone(setup) : null, count: 0, cashIn: 0, cashOut: 0, collected: 0, fees: 0, commission: 0, unknown: 0, paid: 0, returned: 0, comReceived: 0,
      lastPaid: null, lastReturned: null, lastEntry: null };
    if (!st) return a;
    (st.services || []).forEach(function (v) {
      if (v.provider !== id || v.status === "void") return;
      var c = B.svcCash(v); a.count++; a.cashIn += c.cashIn; a.cashOut += c.cashOut; a.collected += c.cashIn - c.cashOut; a.fees += v.fee || 0;
      if (v.commission === null || v.commission === undefined) a.unknown++; else a.commission += v.commission;
      if (!a.lastEntry || v.at > a.lastEntry) a.lastEntry = v.at;
    });
    (st.settles || []).forEach(function (x) {
      if (x.provider !== id || x.status === "void") return;
      if (x.kind === "paid") { a.paid += x.amount; if (!a.lastPaid || x.day > a.lastPaid) a.lastPaid = x.day; }
      else if (x.kind === "returned") { a.returned += x.amount; if (!a.lastReturned || x.day > a.lastReturned) a.lastReturned = x.day; }
      else if (x.kind === "commission") a.comReceived += x.amount;
    });
    a.kept = com === "deducted" ? a.commission : 0;
    /* the customer's fees, when the store keeps them, are the store's from the start (Build 23) */
    a.feeStore = !!(setup && setup.fee === "store");
    a.feeKept = a.feeStore ? a.fees : 0;
    a.held = a.collected - a.kept - a.feeKept - a.paid + a.returned;
    a.comDue = com === "monthly" ? a.commission - a.comReceived : 0;
    a.lastCheck = (st.stmts || []).filter(function (x) { return x.provider === id; }).map(clone).pop() || null;
    return a;
  };
  /* a provider's statement, checked: what it says against what Lakay works out, kept with who checked it */
  B.checkStatement = function (id, says, note) {
    return B.change(function (st) {
      need("reports");
      if (B.PROVIDERS.indexOf(id) < 0) throw err("provider");
      if (!Number.isSafeInteger(says)) throw err("amount");
      var a = B.providerAccount(id), prepaid = a.setup && a.setup.how === "prepaid", lakay = prepaid ? -a.held : a.held, now = clock();
      var x = { id: U.uid("c"), provider: id, says: says, lakay: lakay, diff: says - lakay, prepaid: !!prepaid, note: plain(note, 200), day: U.dayKey(now), at: now.toISOString(), by: B.user.id };
      return { type: "provider.checked", data: { check: clone(x) }, recs: [{ kind: "stmt", id: x.id, value: x }], result: x };
    });
  };

  /* ---------- each person's pay (Build 21) ----------
     Pay is worked out from the time clock: the hours each person worked (breaks left out), at the rate in force on the
     day of each shift, with the overtime the owner sets (after so many hours in a week, at so many times the rate).
     It is an estimate before taxes and deductions: Lakay does not do payroll taxes. Those given "pay" set the rates and
     the period and mark a period paid; each person sees their own. Every change is a ledger line. */
  B.PAY_PERIODS = ["weekly", "biweekly", "semimonthly", "monthly"];
  /* how a person's pay was handed over (not B.PAY_METHODS, the ways a customer pays, Build 16) */
  B.WAGE_METHODS = ["cash", "check", "transfer", "other"];
  B.paySettings = function () {
    var p = (state && state.payset) || {};
    return { period: B.PAY_PERIODS.indexOf(p.period) >= 0 ? p.period : "weekly", anchor: dueDay(p.anchor) ? p.anchor : B.weekStartKey(),
      otAfter: p.otAfter === null ? null : Number.isSafeInteger(p.otAfter) ? p.otAfter : 40, otTimes: Number.isSafeInteger(p.otTimes) ? p.otTimes : 150 };
  };
  B.setPaySettings = function (f) {
    return B.change(function (st) {
      need("pay");
      if (B.PAY_PERIODS.indexOf(f.period) < 0) throw err("period");
      var after = f.otAfter === null || f.otAfter === "" ? null : Math.round(Number(f.otAfter)), times = Math.round(Number(f.otTimes || 150));
      if (after !== null && !(after >= 1 && after <= 80)) throw err("overtime");
      if (!(times >= 100 && times <= 300)) throw err("overtime");
      var v = { period: f.period, anchor: dueDay(f.anchor) ? B.weekStartKey(U.fromDayKey(f.anchor)) : B.weekStartKey(clock()), otAfter: after, otTimes: times, at: clock().toISOString(), by: B.user.id };
      return { type: "pay.settings", data: { period: v.period, otAfter: after, otTimes: times }, recs: [{ kind: "payset", id: "main", value: v }], result: v };
    });
  };
  /* the pay period that holds a day */
  B.payPeriodOf = function (dayKey) {
    var s = B.paySettings(), d = U.fromDayKey(dayKey);
    if (s.period === "monthly") return { from: U.dayKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: U.dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
    if (s.period === "semimonthly") return d.getDate() <= 15 ? { from: U.dayKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: U.dayKey(new Date(d.getFullYear(), d.getMonth(), 15)) }
      : { from: U.dayKey(new Date(d.getFullYear(), d.getMonth(), 16)), to: U.dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
    var wk = U.fromDayKey(B.weekStartKey(d));
    if (s.period === "biweekly") { var n = Math.round((wk.getTime() - U.fromDayKey(s.anchor).getTime()) / 86400000 / 7); if (((n % 2) + 2) % 2 === 1) wk = U.addDays(wk, -7);
      return { from: U.dayKey(wk), to: U.dayKey(U.addDays(wk, 13)) }; }
    return { from: U.dayKey(wk), to: U.dayKey(U.addDays(wk, 6)) };
  };
  /* this period and the ones before it, newest first */
  B.payPeriods = function (n) {
    var out = [], p = B.payPeriodOf(U.dayKey(clock()));
    for (var i = 0; i < (n || 6); i++) { out.push(p); p = B.payPeriodOf(U.dayKey(U.addDays(U.fromDayKey(p.from), -1))); }
    return out;
  };
  B.rateOf = function (userId, dayKey) {
    var r = state && state.rates && state.rates[userId], list = (r && r.list) || [], best = null;
    list.forEach(function (x) { if (x.from <= dayKey && (!best || x.from >= best.from)) best = x; });
    return best ? best.rate : null;
  };
  B.rates = function (userId) { var r = state && state.rates && state.rates[userId]; return r ? clone(r.list) : []; };
  B.setRate = function (userId, rate, from) {
    return B.change(function (st) {
      need("pay");
      var u = st.users[userId]; if (!u || u.role === "owner") throw err("noperson");
      /* no one sets their own pay */
      if (u.id === B.user.id) throw err("self");
      if (!Number.isSafeInteger(rate) || rate < 0 || rate > 100000) throw err("rate");
      from = dueDay(from) || U.dayKey(clock());
      var rec = clone((st.rates && st.rates[userId]) || { user: userId, list: [] });
      rec.list = rec.list.filter(function (x) { return x.from !== from; });
      rec.list.push({ from: from, rate: rate, by: B.user.id, at: clock().toISOString() });
      rec.list.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
      return { type: "pay.rate", data: { user: userId, from: from, rate: rate }, recs: [{ kind: "rate", id: userId, value: rec }], result: rec };
    });
  };
  /* a person's pay for a period: hours from the clock's closed shifts, overtime by the store's week (the week's earlier
     shifts count toward the limit even when they fall before the period), each shift at the rate of its day */
  B.payFor = function (userId, fromKey, toKey) {
    var s = B.paySettings(), out = { user: userId, from: fromKey, to: toKey, regMin: 0, otMin: 0, gross: 0, shifts: 0, open: 0, noRate: 0, paid: null };
    if (!state) return out;
    var lim = s.otAfter === null ? Infinity : s.otAfter * 60, byWeek = {}, sum = 0;
    state.shifts.filter(function (x) { return x.user === userId; }).sort(function (a, b) { return a.in < b.in ? -1 : 1; }).forEach(function (x) {
      if (!x.out) { if (x.day >= fromKey && x.day <= toKey) out.open++; return; }
      var wk = B.weekStartKey(U.fromDayKey(x.day)); (byWeek[wk] = byWeek[wk] || []).push(x);
    });
    Object.keys(byWeek).forEach(function (wk) {
      var acc = 0;
      byWeek[wk].forEach(function (x) {
        var m = Math.round(B.shiftMs(x) / 60000), reg = Math.max(0, Math.min(m, lim - acc)), ot = m - reg; acc += m;
        if (x.day < fromKey || x.day > toKey) return;
        out.shifts++; out.regMin += reg; out.otMin += ot;
        var r = B.rateOf(userId, x.day);
        if (r === null) { out.noRate++; return; }
        sum += reg * r * 100 + ot * r * s.otTimes;
      });
    });
    out.gross = Math.round(sum / 6000);
    out.paid = (state.paids || []).filter(function (x) { return x.user === userId && x.from === fromKey && x.to === toKey && x.status !== "void"; }).map(clone)[0] || null;
    return out;
  };
  B.markPaid = function (f) {
    return B.change(function (st) {
      need("pay");
      var u = st.users[f.user]; if (!u || u.role === "owner") throw err("noperson");
      if (u.id === B.user.id) throw err("self");
      if (!dueDay(f.from) || !dueDay(f.to) || f.to < f.from) throw err("period");
      if (!Number.isSafeInteger(f.amount) || f.amount < 0) throw err("amount");
      if (B.WAGE_METHODS.indexOf(f.method) < 0) throw err("method");
      if ((st.paids || []).some(function (x) { return x.user === f.user && x.from === f.from && x.to === f.to && x.status !== "void"; })) throw err("already");
      var est = B.payFor(f.user, f.from, f.to), now = clock();
      var x = { id: U.uid("y"), user: f.user, from: f.from, to: f.to, amount: f.amount, method: f.method, ref: plain(f.ref, 40), note: plain(f.note, 200),
        minutes: est.regMin + est.otMin, otMinutes: est.otMin, estimate: est.gross, day: U.dayKey(now), at: now.toISOString(), by: B.user.id, status: "done" };
      return { type: "pay.paid", data: { paid: clone(x) }, recs: [{ kind: "paid", id: x.id, value: x }], result: x };
    });
  };
  B.voidPaid = function (id, reason) {
    return B.change(function (st) {
      need("pay");
      var cur = (st.paids || []).filter(function (x) { return x.id === id; })[0]; if (!cur) throw err("nopaid");
      if (cur.user === B.user.id) throw err("self");
      if (cur.status === "void") return null;
      reason = plain(reason, 200); if (!reason) throw err("note");
      var x = clone(cur); x.status = "void"; x.voidedBy = B.user.id; x.voidedAt = clock().toISOString(); x.voidReason = reason;
      return { type: "pay.voided", data: { id: id, reason: reason }, recs: [{ kind: "paid", id: id, value: x }], result: x };
    });
  };
  B.paids = function (filter) { return state ? (state.paids || []).filter(function (x) { return !filter || filter(x); }).map(clone) : []; };

  /* ---------- travel bookings (Build 22) ----------
     The owner books flights on websites for the store's clients. A booking keeps the trip (from, to, the days, how
     many travel), where it was booked and its confirmation code, the ticket's price and the store's fee, and the
     client's payments until it is paid in full. The fee is the store's own earning. Never a passport number or a card
     number: both are refused wherever they could be typed. The client's name and phone are kept only if the owner
     turns that on; they live in the booking's sealed record and never in the ledger, so they can be erased, and they
     are erased from every booking when the owner turns it off. Cancelling keeps the part of the fee the store kept, and
     writes what went back to the client. */
  /* what may be a passport or identity number: at most two letters, then digits, eight or nine signs in all, at least
     seven of them digits. A guess: it cannot catch every such number, and says so where it is used. */
  function idNumberIn(text) {
    return (String(text || "").match(/[A-Za-z0-9]+/g) || []).some(function (w) { return w.length >= 8 && w.length <= 9 && /^[A-Za-z]{0,2}\d{7,9}$/.test(w); });
  }
  B.idNumberIn = idNumberIn;
  B.bookingPrefs = function () {
    var p = (state && state.settings && state.settings.bookings) || {};
    return { keepClient: p.keepClient === true, fee: Number.isSafeInteger(p.fee) ? p.fee : 0 };
  };
  B.setBookingPrefs = function (f) {
    return B.change(function (st) {
      need("owner");
      var cur = B.bookingPrefs(), keep = f.keepClient === true, fee = f.fee === undefined || f.fee === null ? cur.fee : f.fee;
      if (!Number.isSafeInteger(fee) || fee < 0 || fee > 1000000) throw err("amount");
      if (keep === cur.keepClient && fee === cur.fee) return null;
      var set = clone(st.settings); set.bookings = { keepClient: keep, fee: fee };
      var recs = [{ kind: "settings", id: "main", value: set }], erased = 0;
      if (!keep) (st.bookings || []).forEach(function (b) { if (b.client) { var x = clone(b); x.client = null; recs.push({ kind: "booking", id: x.id, value: x }); erased++; } });
      return { type: "settings.bookings", data: { keepClient: keep, fee: fee, erased: erased }, recs: recs, result: erased };
    });
  };
  /* a booking as the ledger keeps it: everything but the client */
  function bookingLine(b) { var x = clone(b); delete x.client; return x; }
  function cleanBooking(f, cur, keepClient) {
    var b = cur ? clone(cur) : {};
    var from = plain(f.from, 40), to = plain(f.to, 40); if (!from || !to) throw err("place");
    var depart = dueDay(f.depart); if (!depart) throw err("days");
    var ret = f.ret ? dueDay(f.ret) : null; if ((f.ret && !ret) || (ret && ret < depart)) throw err("days");
    if (!Number.isSafeInteger(f.pax) || f.pax < 1 || f.pax > 9) throw err("pax");
    var site = plain(f.site, 40), code = plain(f.code, 12).toUpperCase(), note = plain(f.note, 200);
    [["code", code], ["site", site], ["note", note], ["place", from + " " + to]].forEach(function (x) { if (cardNumberIn(x[1])) throw err("card", x[0]); if (idNumberIn(x[1])) throw err("idnum", x[0]); });
    b.from = from; b.to = to; b.depart = depart; b.ret = ret; b.pax = f.pax; b.site = site; b.code = code; b.note = note;
    if (f.ticket !== undefined) { if (!Number.isSafeInteger(f.ticket) || f.ticket <= 0 || f.ticket > 10000000) throw err("amount"); b.ticket = f.ticket; }
    if (f.fee !== undefined) { if (!Number.isSafeInteger(f.fee) || f.fee < 0 || f.fee > 1000000) throw err("amount"); b.fee = f.fee; }
    if (!Number.isSafeInteger(b.ticket)) throw err("amount");
    if (!Number.isSafeInteger(b.fee)) b.fee = 0;
    if (keepClient && f.client) {
      var nm = plain(f.client.name, 60), ph = String(f.client.phone || "").replace(/[^\d+()\- .]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
      if (cardNumberIn(nm) || idNumberIn(nm)) throw err("idnum", "client");
      if (cardNumberIn(ph)) throw err("card", "phone");
      b.client = nm || ph ? { name: nm, phone: ph } : null;
    } else if (!keepClient) b.client = null;
    return b;
  }
  /* the ways the store takes money for a booking, as for a sale: cash, a card on its own machine, or another way */
  function cleanBookingPay(f, kind) {
    var prefs = B.payPrefs(), m = String(f.method || "");
    if (!(m === "cash" || (m === "card" && prefs.methods.indexOf("card") >= 0) || (m === "other" && (prefs.others || []).length))) throw err("method");
    if (!Number.isSafeInteger(f.amount) || f.amount <= 0) throw err("amount");
    var ref = plain(f.ref, 20); if (cardNumberIn(ref)) throw err("card");
    return { id: U.uid("q"), kind: kind || "pay", amount: f.amount, method: m, ref: ref, at: clock().toISOString(), by: B.user.id, status: "done" };
  }
  B.bookingMoney = function (b) {
    var paid = 0, refunded = 0;
    (b.pays || []).forEach(function (p) { if (p.status === "void") return; if (p.kind === "refund") refunded += p.amount; else paid += p.amount; });
    var total = (b.ticket || 0) + (b.fee || 0);
    return { total: total, paid: paid, refunded: refunded, balance: b.status === "cancelled" ? 0 : Math.max(0, total - paid) };
  };
  function bookingOf(st, id) { var b = (st.bookings || []).find(function (x) { return x.id === id; }); if (!b) throw err("nobooking"); return b; }
  B.addBooking = function (f, first) {
    return B.change(function (st) {
      need("sell");
      var b = cleanBooking(f, null, B.bookingPrefs().keepClient), now = clock(), counter = clone((st.counters && st.counters.booking) || { next: 1 });
      b.id = U.uid("b"); b.no = B.device.code + "-T" + String(counter.next).padStart(4, "0"); counter.next += 1;
      b.at = now.toISOString(); b.day = U.dayKey(now); b.by = B.user.id; b.dev = B.device.id; b.status = "on"; b.feeKept = null; b.pays = [];
      if (first) { var p = cleanBookingPay(first, "pay"); if (p.amount > b.ticket + b.fee) throw err("over"); b.pays.push(p); }
      return { type: "booking.made", data: { booking: bookingLine(b) }, recs: [{ kind: "booking", id: b.id, value: b }, { kind: "counter", id: "booking", value: counter }], result: b };
    });
  };
  B.changeBooking = function (id, f) {
    return B.change(function (st) {
      need("sell");
      var cur = bookingOf(st, id); if (cur.status === "cancelled") throw err("closed");
      var g = Object.assign({}, f); if (!B.can("costs")) { delete g.ticket; delete g.fee; }
      var b = cleanBooking(g, cur, B.bookingPrefs().keepClient);
      if (B.bookingMoney(b).total < B.bookingMoney(cur).paid) throw err("below");
      if (JSON.stringify(b) === JSON.stringify(cur)) return null;
      b.changedAt = clock().toISOString(); b.changedBy = B.user.id;
      return { type: "booking.changed", data: { id: id, booking: bookingLine(b) }, recs: [{ kind: "booking", id: id, value: b }], result: b };
    });
  };
  B.payBooking = function (id, f) {
    return B.change(function (st) {
      need("sell");
      var cur = bookingOf(st, id); if (cur.status === "cancelled") throw err("closed");
      var p = cleanBookingPay(f, "pay"); if (p.amount > B.bookingMoney(cur).balance) throw err("over");
      var b = clone(cur); b.pays.push(p);
      return { type: "booking.paid", data: { id: id, pay: clone(p), booking: bookingLine(b) }, recs: [{ kind: "booking", id: id, value: b }], result: b };
    });
  };
  B.voidBookingPay = function (id, payId, reason) {
    return B.change(function (st) {
      need("reports");
      var cur = bookingOf(st, id); if (cur.status === "cancelled") throw err("closed");
      var p = (cur.pays || []).filter(function (x) { return x.id === payId; })[0]; if (!p) throw err("nopay");
      if (p.status === "void") return null;
      reason = plain(reason, 200); if (!reason) throw err("note");
      var b = clone(cur), now = clock().toISOString();
      b.pays = b.pays.map(function (x) { if (x.id !== payId) return x; var y = clone(x); y.status = "void"; y.voidReason = reason; y.voidedBy = B.user.id; y.voidedAt = now; return y; });
      return { type: "booking.payVoided", data: { id: id, pay: payId, reason: reason, booking: bookingLine(b) }, recs: [{ kind: "booking", id: id, value: b }], result: b };
    });
  };
  B.cancelBooking = function (id, f) {
    return B.change(function (st) {
      need("reports");
      var cur = bookingOf(st, id); if (cur.status === "cancelled") return null;
      var m = B.bookingMoney(cur);
      if (!Number.isSafeInteger(f.feeKept) || f.feeKept < 0 || f.feeKept > cur.fee) throw err("kept");
      if (!Number.isSafeInteger(f.refund) || f.refund < 0 || f.refund > m.paid) throw err("refund");
      var reason = plain(f.reason, 200); if (!reason) throw err("note");
      var b = clone(cur); b.status = "cancelled"; b.feeKept = f.feeKept; b.cancelReason = reason; b.cancelledBy = B.user.id; b.cancelledAt = clock().toISOString();
      if (f.refund) b.pays.push(cleanBookingPay({ amount: f.refund, method: f.method || "cash", ref: "" }, "refund"));
      return { type: "booking.cancelled", data: { id: id, feeKept: f.feeKept, refund: f.refund, reason: reason, booking: bookingLine(b) }, recs: [{ kind: "booking", id: id, value: b }], result: b };
    });
  };
  B.bookings = function (filter) { return state ? (state.bookings || []).filter(function (x) { return !filter || filter(x); }).map(clone) : []; };
  B.booking = function (id) { var b = state && (state.bookings || []).find(function (x) { return x.id === id; }); return b ? clone(b) : null; };
  /* the store's fees from the bookings made in a period: the whole fee, or the part kept when one was cancelled */
  B.bookingEarned = function (fromKey, toKey) {
    var out = { count: 0, fees: 0, cancelled: 0 };
    (state ? state.bookings || [] : []).forEach(function (b) {
      if (b.day < fromKey || b.day > toKey) return;
      if (b.status === "cancelled") { out.cancelled++; out.fees += b.feeKept || 0; } else { out.count++; out.fees += b.fee || 0; }
    });
    return out;
  };

  /* ---------- payments (Build 16) ----------
     Lakay never touches a card. The store's own card machine (Square, Clover, SumUp, a bank's terminal: any of them)
     charges the card, Apple Pay or Google Pay; Lakay records what was taken: the way, the amount, the machine's approval
     code and, if the owner asks for them, the card's last four digits. A full card number is refused wherever it could
     be typed. A sale may be paid in parts: cash and a card, two cards, a card and another way the owner accepts. */
  B.PAY_METHODS = ["cash", "card", "applepay", "googlepay", "other"];
  B.payPrefs = function (st) {
    st = st || state;
    var p = clone((st && st.settings && st.settings.payments) || {}), d = { methods: ["cash", "card", "applepay", "googlepay"], machine: "", others: [], askCode: "optional", askLast4: "no" };
    Object.keys(d).forEach(function (k) { if (p[k] === undefined || p[k] === null) p[k] = d[k]; });
    if (p.methods.indexOf("cash") < 0) p.methods.unshift("cash");
    return p;
  };
  /* a card's number: 13 to 19 digits (spaces and dashes allowed) whose check digit is right */
  function cardNumberIn(text) {
    var runs = String(text || "").match(/\d[\d -]{11,24}\d/g) || [];
    return runs.some(function (r) {
      var d = r.replace(/[ -]/g, ""); if (!/^\d{13,19}$/.test(d)) return false;
      var sum = 0, alt = false;
      for (var i = d.length - 1; i >= 0; i--) { var n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
      return sum % 10 === 0;
    });
  }
  B.cardNumberIn = cardNumberIn;
  /* The payments of one sale, checked and put in order: the other ways first, then the cash, in one part, with its
     change. pays: [{ method, amount, tendered (cash), ref, last4, name (another way) }], or a number (cash received,
     as Builds 1 to 15 had it). */
  function cleanPayments(total, pays, prefs) {
    if (typeof pays === "number") pays = [{ method: "cash", tendered: pays }];
    if (!Array.isArray(pays) || !pays.length) throw err("short");
    var other = [], tendered = 0, anyCash = false;
    pays.forEach(function (p) {
      var m = String(p.method || "");
      if (B.PAY_METHODS.indexOf(m) < 0) throw err("method");
      if (m === "cash") {
        if (!Number.isSafeInteger(p.tendered) || p.tendered <= 0) throw err("short");
        tendered += p.tendered; anyCash = true; return;
      }
      if (m === "other" ? !(prefs.others || []).length : prefs.methods.indexOf(m) < 0) throw err("method");
      if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw err("amount");
      var ref = String(p.ref || "").trim().slice(0, 40), last4 = String(p.last4 || "").trim(), name = String(p.name || "").trim().slice(0, 30);
      if (cardNumberIn(ref) || cardNumberIn(name) || cardNumberIn(p.note)) throw err("cardNumber");
      if (last4 && !/^\d{4}$/.test(last4)) throw err("last4");
      if (m !== "other" && m !== "card" && last4) last4 = "";
      if (m !== "other" && prefs.askCode === "required" && !ref) throw err("code");
      if (m === "other" && !name) throw err("name");
      var x = { method: m, amount: p.amount };
      if (ref) x.ref = ref;
      if (last4) x.last4 = last4;
      if (m === "other") x.name = name;
      if (m !== "other" && prefs.machine) x.machine = String(prefs.machine).slice(0, 40);
      other.push(x);
    });
    var otherSum = other.reduce(function (a, x) { return a + x.amount; }, 0);
    if (otherSum > total) throw err("over");
    var cashDue = total - otherSum;
    if (!anyCash) { if (cashDue !== 0) throw err("short"); return other; }
    if (cashDue === 0) throw err("over");
    if (tendered < cashDue) throw err("short");
    return other.concat([{ method: "cash", amount: cashDue, tendered: tendered, change: tendered - cashDue }]);
  }
  B.cleanPayments = function (total, pays) { return cleanPayments(total, pays, B.payPrefs()); };

  /* ---------- the ticket and the sale ---------- */
  /* Prices a ticket from the books as they stand: lines [{itemId, qty}] give lines with prices, the tax of each rate
     (worked out on the total taxed at that rate, rounded half up to the cent) and the totals. */
  B.priceTicket = function (lines, st) {
    st = st || state;
    var out = { lines: [], subtotal: 0, taxes: [], tax: 0, total: 0, items: 0 }, byRate = {};
    lines.forEach(function (l) {
      var it = st.items[l.itemId]; if (!it || !(l.qty > 0)) return;
      var rate = null, tx = it.taxId ? (st.settings.taxes || []).find(function (t) { return t.id === it.taxId; }) : null;
      if (tx) rate = tx.rate;
      var amount = it.price * l.qty;
      out.lines.push({ itemId: it.id, name: it.name, cat: it.cat, qty: l.qty, price: it.price, cost: it.cost, taxId: tx ? tx.id : null, rate: rate, amount: amount });
      out.subtotal += amount; out.items += l.qty;
      if (tx) { byRate[tx.id] = byRate[tx.id] || { id: tx.id, name: tx.name, rate: tx.rate, base: 0, tax: 0 }; byRate[tx.id].base += amount; }
    });
    Object.keys(byRate).forEach(function (k) { var r = byRate[k]; r.tax = U.taxOn(r.base, r.rate); out.taxes.push(r); out.tax += r.tax; });
    out.total = out.subtotal + out.tax;
    return out;
  };
  /* pays: the payments (Build 16), or, as before, the cash received */
  B.completeSale = function (lines, pays) {
    return B.change(function (st) {
      need("sell");
      var t = B.priceTicket(lines, st);
      if (!t.lines.length) throw err("empty");
      var paid = cleanPayments(t.total, pays, B.payPrefs(st));
      var counter = clone(st.counters.receipt || { next: 1 }), no = B.device.code + "-" + String(counter.next).padStart(6, "0");
      counter.next += 1;
      var now = clock();
      var sale = { id: U.uid("s"), no: no, at: now.toISOString(), day: U.dayKey(now), hour: now.getHours(), by: B.user.id, byNo: B.numberOf(B.user), dev: B.device.id,
        lines: t.lines, subtotal: t.subtotal, taxes: t.taxes, tax: t.tax, total: t.total, items: t.items,
        pay: paid, status: "completed" };
      var recs = [{ kind: "sale", id: sale.id, value: sale }, { kind: "counter", id: "receipt", value: counter }];
      var touched = {};
      t.lines.forEach(function (l) { touched[l.itemId] = (touched[l.itemId] || 0) + l.qty; });
      Object.keys(touched).forEach(function (iid) {
        var it = clone(st.items[iid]); it.stock -= touched[iid]; it.updated = sale.at;
        recs.push({ kind: "item", id: iid, value: it });
      });
      return { type: "sale.completed", data: { sale: clone(sale) }, recs: recs, result: sale };
    });
  };

  /* ---------- reports ---------- */
  /* A report for whole days (fromKey to toKey, by the store's calendar), or for part of a day: win = { from, to } in
     milliseconds narrows it to the sales and moves made in that window (this hour, this morning, this afternoon). */
  B.report = function (fromKey, toKey, win, who) {
    function inWin(x) { if (!win) return true; var at = Date.parse(x.at); return at >= win.from && at < win.to; }
    function mine(x) { return !who || x.by === who; }
    var st = state, r = { from: fromKey, to: toKey, win: win || null, who: who || null, count: 0, items: 0, net: 0, tax: 0, gross: 0, cogs: 0, noCost: 0, profit: 0,
      byCat: {}, byItem: {}, byHour: [], byDay: {}, byMethod: {}, byMethodN: {}, split: 0, byPerson: {}, losses: { value: 0, qty: 0, byReason: {} }, received: { qty: 0, value: 0 } };
    for (var h = 0; h < 24; h++) r.byHour.push({ count: 0, gross: 0 });
    st.sales.forEach(function (s) {
      if (s.status !== "completed" || s.day < fromKey || s.day > toKey || !inWin(s) || !mine(s)) return;
      r.count++; r.items += s.items; r.net += s.subtotal; r.tax += s.tax; r.gross += s.total;
      var pp = r.byPerson[s.by] = r.byPerson[s.by] || { count: 0, items: 0, gross: 0 };
      pp.count++; pp.items += s.items; pp.gross += s.total;
      r.byHour[s.hour].count++; r.byHour[s.hour].gross += s.total;
      var d = r.byDay[s.day] = r.byDay[s.day] || { count: 0, gross: 0, net: 0, profit: 0 };
      d.count++; d.gross += s.total; d.net += s.subtotal;
      s.pay.forEach(function (p) {
        var k = p.method === "other" ? "other:" + (p.name || "") : p.method;
        r.byMethod[k] = (r.byMethod[k] || 0) + p.amount; r.byMethodN[k] = (r.byMethodN[k] || 0) + 1;
      });
      if (s.pay.length > 1) r.split++;
      s.lines.forEach(function (l) {
        var cost = l.cost === null ? null : l.cost * l.qty;
        if (cost === null) r.noCost += l.amount; else r.cogs += cost;
        var prof = cost === null ? 0 : l.amount - cost;
        d.profit += prof;
        var c = r.byCat[l.cat] = r.byCat[l.cat] || { qty: 0, net: 0, cogs: 0, profit: 0 };
        c.qty += l.qty; c.net += l.amount; c.cogs += cost || 0; c.profit += prof;
        var it = r.byItem[l.itemId] = r.byItem[l.itemId] || { itemId: l.itemId, name: l.name, cat: l.cat, qty: 0, net: 0, cogs: 0, profit: 0 };
        it.qty += l.qty; it.net += l.amount; it.cogs += cost || 0; it.profit += prof;
      });
    });
    /* profit counts only lines whose cost is known; sales of items with no cost are shown apart */
    r.profit = r.net - r.noCost - r.cogs;
    /* money transfers and top-ups: held for the providers, so never part of the sales above (Build 15) */
    var sv = r.services = { count: 0, voided: 0, fees: 0, commission: 0, cashIn: 0, cashOut: 0, byProvider: {}, byKind: {} };
    (st.services || []).forEach(function (v) {
      if (v.day < fromKey || v.day > toKey || !inWin(v) || !mine(v)) return;
      if (v.status === "void") { sv.voided++; return; }
      var c = B.svcCash(v);
      sv.count++; sv.fees += v.fee || 0; sv.commission += v.commission || 0; sv.cashIn += c.cashIn; sv.cashOut += c.cashOut;
      var p = sv.byProvider[v.provider] = sv.byProvider[v.provider] || { count: 0, send: 0, payout: 0, topup: 0, fees: 0, commission: 0, cashIn: 0, cashOut: 0 };
      p.count++; p[v.kind] += v.amount; p.fees += v.fee || 0; p.commission += v.commission || 0; p.cashIn += c.cashIn; p.cashOut += c.cashOut;
      var k = sv.byKind[v.kind] = sv.byKind[v.kind] || { count: 0, amount: 0 }; k.count++; k.amount += v.amount;
    });
    st.moves.forEach(function (m) {
      if (m.day < fromKey || m.day > toKey || !inWin(m) || !mine(m)) return;
      if (m.kind === "receive") { r.received.qty += m.qty; r.received.value += (m.unitCost || 0) * m.qty; }
      if (m.kind === "adjust" && m.qty < 0) {
        var v = (m.unitCost || 0) * -m.qty;
        r.losses.qty += -m.qty; r.losses.value += v;
        var b = r.losses.byReason[m.reason] = r.losses.byReason[m.reason] || { qty: 0, value: 0 };
        b.qty += -m.qty; b.value += v;
      }
    });
    return r;
  };
  B.stockSummary = function () {
    var s = { items: 0, units: 0, atCost: 0, atPrice: 0, noCost: 0, low: [], negative: [] };
    Object.keys(state.items).forEach(function (k) {
      var it = state.items[k]; if (it.archived) return;
      s.items++;
      var q = Math.max(0, it.stock); s.units += q; s.atPrice += q * it.price;
      if (it.cost === null) { if (q > 0) s.noCost++; } else s.atCost += q * it.cost;
      if (it.stock < 0) s.negative.push(it);
      if (it.reorderAt !== null && it.stock <= it.reorderAt) s.low.push(it);
    });
    s.low.sort(function (a, b) { return a.stock - b.stock; });
    return s;
  };

  /* ---------- verifying the books: every line read, every fingerprint recomputed, every stock figure replayed ---------- */
  B.verify = function (progress) {
    var key = KEY, id = ID, st = state;
    if (!key) return Promise.reject(err("locked"));
    return D.entries("journal").then(function (all) {
      /* Build 24: this device's own lines (numbered), and the lines of the other devices of the store ("p:...") */
      var entries = all.filter(function (e) { return typeof e[0] === "number"; }), peers = all.filter(function (e) { return typeof e[0] === "string"; });
      var merged = peers.length > 0, kept = [], myCode = (B.device && B.device.code) || "A";
      var res = { ok: true, lines: all.length, devices: 1, problems: [] }, prev = ZERO, expect = 1, items = {}, svcs = {}, train = {}, money = { settle: {}, paid: {}, booking: {}, bk: {} }, i = 0;
      function next() {
        if (i >= entries.length) return Promise.resolve();
        var e = entries[i++];
        return C.open(key, e[1], aadLine(id, e[0])).then(function (line) {
          if (line.seq !== e[0] || e[0] !== expect) res.problems.push({ seq: e[0], what: "order" });
          if (line.prev !== prev) res.problems.push({ seq: e[0], what: "chain" });
          if (merged) kept.push([lineStamp(line, myCode), line, myCode]); else replay(items, line, res, svcs, train, money);
          expect = e[0] + 1;
          return U.sha256hex(U.canon(line)).then(function (hsh) { prev = hsh; });
        }, function () { res.problems.push({ seq: e[0], what: "unreadable" }); prev = null; expect = e[0] + 1; }).then(function () {
          if (progress && i % 200 === 0) progress(i, all.length);
          return next();
        });
      }
      /* each other device's chain, read the same way: numbered from 1, each line holding the fingerprint of the one before */
      var chains = {}, j = 0;
      function nextPeer() {
        if (j >= peers.length) return Promise.resolve();
        var e = peers[j++], m = /^p:(.+):(\d+)$/.exec(e[0]);
        if (!m) { res.problems.push({ rec: e[0], what: "unreadable" }); return nextPeer(); }
        var dev = m[1], seq = parseInt(m[2], 10), ch = chains[dev] || (chains[dev] = { seq: 0, hash: ZERO, code: codeOfDev(st, dev) });
        return C.open(key, e[1], aadPeer(id, dev, seq)).then(function (line) {
          if (line.seq !== seq || seq !== ch.seq + 1) res.problems.push({ dev: ch.code, seq: seq, what: "order" });
          if (line.prev !== ch.hash) res.problems.push({ dev: ch.code, seq: seq, what: "chain" });
          kept.push([lineStamp(line, ch.code), line, ch.code]);
          ch.seq = seq;
          return U.sha256hex(U.canon(line)).then(function (hsh) { ch.hash = hsh; });
        }, function () { res.problems.push({ dev: ch.code, seq: seq, what: "unreadable" }); ch.seq = seq; ch.hash = null; }).then(function () {
          if (progress && (i + j) % 200 === 0) progress(i + j, all.length);
          return nextPeer();
        });
      }
      return next().then(nextPeer).then(function () {
        if (merged) {
          var held = (st.sync && st.sync.chains) || {}, codes = {};
          codes[myCode] = 1;
          Object.keys(chains).forEach(function (dev) {
            var c = chains[dev], h = held[dev];
            res.devices += 1;
            if (!h || h.seq !== c.seq || h.hash !== c.hash) res.problems.push({ dev: c.code, what: "head" });
            if (codes[c.code]) res.problems.push({ dev: c.code, what: "letter" }); codes[c.code] = 1;
          });
          Object.keys(held).forEach(function (dev) { if (!chains[dev] && held[dev].seq > 0) res.problems.push({ dev: held[dev].code, what: "missing" }); });
          /* every device's lines together, in the order of their stamps */
          kept.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
          kept.forEach(function (x) { replay(items, x[1], res, svcs, train, money, x[0]); });
          Object.keys(money.bk).forEach(function (k) { money.booking[k] = money.bk[k].v; });
        }
        if (!st.head || st.head.seq !== entries.length || st.head.hash !== prev) res.problems.push({ seq: st.head ? st.head.seq : 0, what: "head" });
        Object.keys(st.items).forEach(function (k) {
          var a = st.items[k], b = items[k];
          if (!b) { res.problems.push({ item: k, what: "missing" }); return; }
          ["stock", "price", "cost", "archived", "name"].forEach(function (f) {
            if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) res.problems.push({ item: k, what: "differs", field: f, books: a[f], ledger: b[f] });
          });
        });
        Object.keys(items).forEach(function (k) { if (!st.items[k]) res.problems.push({ item: k, what: "extra" }); });
        (st.services || []).forEach(function (v) {
          var b = svcs[v.id];
          if (!b) { res.problems.push({ svc: v.id, what: "missing" }); return; }
          ["provider", "kind", "amount", "fee", "commission", "status"].forEach(function (f) {
            if (JSON.stringify(v[f]) !== JSON.stringify(b[f])) res.problems.push({ svc: v.id, what: "differs", field: f });
          });
          delete svcs[v.id];
        });
        Object.keys(svcs).forEach(function (k) { res.problems.push({ svc: k, what: "extra" }); });
        /* the settlements with the providers and the pay marked paid (Build 21), each as the ledger wrote it last */
        [["settle", st.settles, ["provider", "kind", "amount", "day", "status"]], ["paid", st.paids, ["user", "from", "to", "amount", "method", "status"]]].forEach(function (g) {
          var want = money[g[0]];
          (g[1] || []).forEach(function (v) {
            var b = want[v.id];
            if (!b) { res.problems.push({ money: g[0], id: v.id, what: "missing" }); return; }
            g[2].forEach(function (f) { if (JSON.stringify(v[f]) !== JSON.stringify(b[f])) res.problems.push({ money: g[0], id: v.id, what: "differs", field: f }); });
            delete want[v.id];
          });
          Object.keys(want).forEach(function (k) { res.problems.push({ money: g[0], id: k, what: "extra" }); });
        });
        /* the travel bookings (Build 22): each as its last ledger line left it, with the money paid and given back */
        (st.bookings || []).forEach(function (b) {
          var w = money.booking[b.id];
          if (!w) { res.problems.push({ booking: b.id, what: "missing" }); return; }
          var mb = B.bookingMoney(b), mw = B.bookingMoney(w);
          ["status", "ticket", "fee", "feeKept", "depart", "ret", "pax"].forEach(function (f) { if (JSON.stringify(b[f]) !== JSON.stringify(w[f])) res.problems.push({ booking: b.id, what: "differs", field: f }); });
          if (mb.paid !== mw.paid || mb.refunded !== mw.refunded) res.problems.push({ booking: b.id, what: "differs", field: "pays" });
          delete money.booking[b.id];
        });
        Object.keys(money.booking).forEach(function (k) { res.problems.push({ booking: k, what: "extra" }); });
        /* each person's marks (Build 17 lessons; Build 19 exercises and the store's tasks): the ones the ledger wrote last */
        Object.keys(st.train || {}).forEach(function (u) {
          var r = st.train[u] || {}, have = {}, want = train[u] || {};
          Object.keys(r.done || {}).forEach(function (l) { have["l:" + l] = { score: r.done[l].score, of: r.done[l].of }; });
          Object.keys(r.ex || {}).forEach(function (x) { have["x:" + x] = {}; });
          Object.keys(r.tasks || {}).forEach(function (x) { have["t:" + x] = { by: r.tasks[x].by }; });
          Object.keys(have).forEach(function (k) {
            var w = want[k];
            if (!w) res.problems.push({ train: u, lesson: k, what: "missing" });
            else if (JSON.stringify(w) !== JSON.stringify(have[k])) res.problems.push({ train: u, lesson: k, what: "differs" });
            delete want[k];
          });
          Object.keys(want).forEach(function (k) { res.problems.push({ train: u, lesson: k, what: "extra" }); });
          delete train[u];
        });
        Object.keys(train).forEach(function (u) { res.problems.push({ train: u, what: "extra" }); });
        (st.unreadable || []).forEach(function (k) { res.problems.push({ rec: k, what: "unreadable" }); });
        res.ok = res.problems.length === 0;
        return res;
      });
    });
  };
  /* stamp: given when the books of several devices are replayed together (Build 24): stock is then counted by each
     device's moves (each device checked its own figures as it wrote them), and a booking takes in what each line wrote */
  function replay(items, line, res, svcs, train, money, stamp) {
    var d = line.data || {};
    if (stamp && money && line.w && /^booking\./.test(line.type)) {
      line.w.forEach(function (e) {
        if (kindOf(e[0]) !== "booking") return;
        var bid = e[0].slice(8), r = takeWrite(money.bk[bid] || null, "booking", e[1], e[2], stamp, function () { return false; });
        money.bk[bid] = r.cur;
      });
      return;
    }
    if (stamp && money && /^booking\./.test(line.type) && d.booking) {
      var prior = money.bk[d.booking.id] || null;
      money.bk[d.booking.id] = takeWrite(prior, "booking", d.booking, null, stamp, function () { return false; }).cur;
      return;
    }
    if (stamp) {
      switch (line.type) {
        case "stock.received": if (items[d.itemId]) { items[d.itemId].stock += d.qty; items[d.itemId].cost = d.costAfter; } return;
        case "stock.adjusted": if (items[d.itemId]) items[d.itemId].stock += d.qty; return;
      }
    }
    switch (line.type) {
      case "provider.settled": if (money && d.settle) money.settle[d.settle.id] = clone(d.settle); break;
      case "provider.settleVoided": if (money) { if (money.settle[d.id]) money.settle[d.id].status = "void"; else res.problems.push({ seq: line.seq, what: "void" }); } break;
      case "pay.paid": if (money && d.paid) money.paid[d.paid.id] = clone(d.paid); break;
      case "pay.voided": if (money) { if (money.paid[d.id]) money.paid[d.id].status = "void"; else res.problems.push({ seq: line.seq, what: "void" }); } break;
      case "booking.made": case "booking.changed": case "booking.paid": case "booking.payVoided": case "booking.cancelled": if (money && d.booking) money.booking[d.booking.id] = clone(d.booking); break;
      case "training.completed": if (train && d.user && d.lesson) { train[d.user] = train[d.user] || {}; train[d.user]["l:" + d.lesson] = { score: d.score, of: d.of }; } break;
      case "training.exercise": if (train && d.user && d.exercise) { train[d.user] = train[d.user] || {}; train[d.user]["x:" + d.exercise] = {}; } break;
      case "training.task": if (train && d.user && d.task) { train[d.user] = train[d.user] || {}; train[d.user]["t:" + d.task] = { by: d.by }; } break;
      case "service.recorded": if (d.svc) svcs[d.svc.id] = clone(d.svc); break;
      case "service.voided": if (svcs[d.id]) svcs[d.id].status = "void"; else res.problems.push({ seq: line.seq, what: "void" }); break;
      case "service.commission": (d.list || []).forEach(function (x) { if (svcs[x.id]) svcs[x.id].commission = x.commission; else res.problems.push({ seq: line.seq, what: "commission" }); }); break;
      case "item.created": items[d.item.id] = clone(d.item); break;
      case "item.updated": if (items[d.id]) Object.keys(d.changes).forEach(function (k) { items[d.id][k] = clone(d.changes[k][1]); }); break;
      case "item.archived": if (items[d.id]) items[d.id].archived = d.archived; break;
      case "stock.received":
        if (items[d.itemId]) {
          var it = items[d.itemId], want = averageCost(it.stock, it.cost, d.qty, d.unitCost);
          if (it.stock !== d.stockBefore || want !== d.costAfter) res.problems.push({ seq: line.seq, what: "receive" });
          it.stock += d.qty; it.cost = want;
        }
        break;
      case "stock.adjusted": if (items[d.itemId]) { if (items[d.itemId].stock !== d.stockBefore) res.problems.push({ seq: line.seq, what: "adjust" }); items[d.itemId].stock += d.qty; } break;
      case "sale.completed": (d.sale.lines || []).forEach(function (l) { if (items[l.itemId]) items[l.itemId].stock -= l.qty; }); break;
    }
  }

  /* The ledger, read back for people (newest first), for the History of an item and the ledger viewer. */
  B.lines = function (filter) {
    var key = KEY, id = ID, st = state, peers = false, myCode = (B.device && B.device.code) || "A";
    return D.entries("journal").then(function (entries) {
      return Promise.all(entries.map(function (e) {
        if (typeof e[0] === "number") return C.open(key, e[1], aadLine(id, e[0])).then(function (l) { l.code = myCode; return l; }).catch(function () { return null; });
        /* Build 24: another device's lines, each marked with that device's letter */
        var m = /^p:(.+):(\d+)$/.exec(e[0]); if (!m) return null;
        peers = true;
        return C.open(key, e[1], aadPeer(id, m[1], parseInt(m[2], 10))).then(function (l) { l.code = st ? codeOfDev(st, m[1]) : "?"; return l; }).catch(function () { return null; });
      }));
    }).then(function (lines) {
      lines = lines.filter(function (l) { return l && (!filter || filter(l)); });
      if (!peers) return lines.reverse();
      return lines.sort(function (a, b) { var x = lineStamp(a, a.code), y = lineStamp(b, b.code); return x < y ? 1 : x > y ? -1 : 0; });
    });
  };

  /* ---------- passwords and the Master Key ---------- */
  function ownerKeyExtractable(password) {
    return D.get("meta", "vault").then(function (v) {
      return C.passwordKey(password, U.b64d(v.owner.salt), v.kdf.iterations).then(function (kek) {
        return C.unwrap(v.owner, kek, aadEnv(v.storeId, "owner"), true);
      }).then(function (k) { return { vault: v, key: k }; }, function () { throw err("wrong"); });
    });
  }
  B.checkPassword = function (password) { return ownerKeyExtractable(password).then(function () { return true; }); };
  B.changePassword = function (current, next) {
    return ownerKeyExtractable(current).then(function (h) {
      var v = clone(h.vault), salt = U.rnd(16);
      return C.passwordKey(next, salt).then(function (kek) { return C.wrap(h.key, kek, aadEnv(v.storeId, "owner")); }).then(function (env) {
        v.owner = { salt: U.b64e(salt), iv: env.iv, ct: env.ct };
        return B.change(function () { return { type: "owner.password.changed", data: {}, meta: [{ key: "vault", value: v }] }; });
      });
    });
  };
  /* A new Master Key replaces the old one; the old card stops working once the new one is confirmed. */
  B.prepareNewMaster = function (password) {
    return ownerKeyExtractable(password).then(function (h) {
      return C.newMaster().then(function (m) {
        return C.masterKey(m.secret, idBytes(h.vault.storeId)).then(function (kek) { return C.wrap(h.key, kek, aadEnv(h.vault.storeId, "master")); }).then(function (env) {
          return { code: m.code, finish: function () {
            var v = clone(h.vault); v.master = env;
            return B.change(function () { return { type: "master.replaced", data: {}, meta: [{ key: "vault", value: v }] }; });
          } };
        });
      });
    });
  };

  /* ---------- backups: the sealed books as they are, in one file ---------- */
  B.makeBackup = function () {
    if (B.user && !B.can("backup")) return Promise.reject(err("denied"));
    return Promise.all([D.get("meta", "vault"), D.get("meta", "door"), D.entries("rec"), D.entries("journal"), D.get("meta", "custom")]).then(function (r) {
      var body = { format: "emporium-backup", v: 1, build: E.BUILD.number, at: new Date().toISOString(), door: r[1], vault: r[0], custom: r[4] || null, device: B.device,
        rec: r[2].map(function (e) { return [e[0], U.b64e(e[1].iv), U.b64e(e[1].ct)]; }),
        journal: r[3].map(function (e) { return [e[0], U.b64e(e[1].iv), U.b64e(e[1].ct)]; }) };
      return U.sha256hex(U.canon(body)).then(function (sum) { body.sum = sum; return JSON.stringify(body); });
    });
  };
  B.readBackup = function (text) {
    var body;
    try { body = JSON.parse(text); } catch (e) { return Promise.reject(err("notbackup")); }
    if (!body || body.format !== "emporium-backup" || body.v !== 1 || !body.vault || !Array.isArray(body.rec) || !Array.isArray(body.journal)) return Promise.reject(err("notbackup"));
    var sum = body.sum; delete body.sum;
    return U.sha256hex(U.canon(body)).then(function (s) {
      if (s !== sum) throw err("corrupt");
      return body;
    });
  };
  /* Opens a backup's own envelope with the password (or the Master Key) that was valid when it was made, reads every
     line of its ledger, and only then replaces the books on this device, in one transaction. */
  function backupKey(body, secret, isMaster) {
    var v = body.vault, keyP;
    if (isMaster) keyP = C.readMaster(secret).then(function (s) { if (!s) throw err("badcode"); return C.masterKey(s, idBytes(v.storeId)); })
      .then(function (kek) { return C.unwrap(v.master, kek, aadEnv(v.storeId, "master"), false); });
    else keyP = C.passwordKey(secret, U.b64d(v.owner.salt), v.kdf.iterations).then(function (kek) { return C.unwrap(v.owner, kek, aadEnv(v.storeId, "owner"), false); });
    return keyP.catch(function (e) { if (e && e.code) throw e; throw err(isMaster ? "wrongmaster" : "wrong"); });
  }
  /* A backup's ledger, read through: the device's own chain (numbered from 1), and from Build 24 the chain of each other
     device of the store ("p:..."), each line holding the fingerprint of the one before. Gives back the own chain's
     lines when asked (a device joining keeps them as the other device's), and where each chain ends. */
  function readChains(key, storeId, journal, keepOwn) {
    var own = journal.filter(function (e) { return typeof e[0] === "number"; }), peers = journal.filter(function (e) { return typeof e[0] !== "number"; });
    var out = { lines: [], seq: 0, hash: ZERO, maxTs: 0, peers: {} }, i = 0, j = 0;
    function next() {
      if (i >= own.length) return Promise.resolve();
      var e = own[i++];
      return C.open(key, e[1], aadLine(storeId, e[0])).then(function (line) {
        if (line.prev !== out.hash || line.seq !== i || e[0] !== i) throw err("chain");
        if (keepOwn) out.lines.push(line);
        out.maxTs = Math.max(out.maxTs, lineTs(line));
        return U.sha256hex(U.canon(line)).then(function (h) { out.hash = h; out.seq = line.seq; return next(); });
      });
    }
    function nextPeer() {
      if (j >= peers.length) return Promise.resolve();
      var e = peers[j++], m = /^p:(.+):(\d+)$/.exec(String(e[0]));
      if (!m) throw err("chain");
      var dev = m[1], seq = parseInt(m[2], 10), ch = out.peers[dev] || (out.peers[dev] = { seq: 0, hash: ZERO });
      return C.open(key, e[1], aadPeer(storeId, dev, seq)).then(function (line) {
        if (line.prev !== ch.hash || line.seq !== seq || seq !== ch.seq + 1) throw err("chain");
        out.maxTs = Math.max(out.maxTs, lineTs(line));
        return U.sha256hex(U.canon(line)).then(function (h) { ch.hash = h; ch.seq = seq; return nextPeer(); });
      });
    }
    return next().then(nextPeer).then(function () { return out; });
  }
  B.restoreBackup = function (body, secret, isMaster) {
    var v = body.vault, restoredAs = null;
    return backupKey(body, secret, isMaster).then(function (key) {
      var journal = body.journal.map(function (e) { return [e[0], { iv: U.b64d(e[1]), ct: U.b64d(e[2]) }]; });
      var rec = body.rec.map(function (e) { return [e[0], { iv: U.b64d(e[1]), ct: U.b64d(e[2]) }]; });
      return readChains(key, v.storeId, journal, false).then(function () { return B.lock("restore"); }).then(function () {
        /* a restore puts this device in the place of the one that made the backup (Build 24: its letter, and its chain) */
        if (body.device && body.device.id && body.device.code) restoredAs = { id: body.device.id, code: body.device.code, created: body.device.created || B.device.created };
        var meta = [["vault", v], ["door", body.door], ["device", restoredAs || B.device]];
        if (body.custom) meta.push(["custom", E.cleanCustom ? E.cleanCustom(body.custom) : body.custom]);
        return D.replaceAll(meta, rec, journal);
      }).then(function () { if (restoredAs) B.device = restoredAs; doorMeta = body.door || null; E.custom = body.custom && E.cleanCustom ? E.cleanCustom(body.custom) : null; if (E.ui && E.ui.applyLook) E.ui.applyLook(); return load(v, key); });
    });
  };

  /* ---------- devices in step (Build 24, stage 1): the books of several devices joined ----------
     Each device of a store writes its own chain of ledger lines and keeps the other devices' chains beside it, sealed
     with the same Store Key. A device joins from a copy (a sealed backup) of a device already in the store: it keeps
     the copy's records, keeps that device's lines as that device's chain, takes a letter of its own, and starts a
     chain of its own. Changes travel as a sealed bundle of lines. Taking a bundle in checks that each chain follows on
     from what was last taken from it, fingerprint by fingerprint, then takes each line's writes field by field (the
     later stamp wins), adds up the stock moves, never takes another device's counters, and writes one line of its own
     saying what it took. Two changes to the same field made while the devices were apart: the later one stays, both
     stay in the ledger, and the report says so. */
  var LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  function nextCode(used) {
    for (var i = 0; i < LETTERS.length; i++) if (!used[LETTERS[i]]) return LETTERS[i];
    for (var a = 0; a < LETTERS.length; a++) for (var b = 0; b < LETTERS.length; b++) if (!used[LETTERS[a] + LETTERS[b]]) return LETTERS[a] + LETTERS[b];
    throw err("letters");
  }
  function codeOfDev(st, dev) {
    if (B.device && dev === B.device.id) return B.device.code;
    var c = st && st.sync && st.sync.chains && st.sync.chains[dev]; if (c && c.code) return c.code;
    var d = st && st.devices && st.devices[dev]; return d ? d.code : "?";
  }
  /* what a device knew of the others when it wrote a line: the lines it had taken from each (by letter) */
  function learn(knows, line, code) {
    var d = line.data || {};
    if (line.type === "device.joined" && d.fromCode) knows[d.fromCode] = Math.max(knows[d.fromCode] || 0, d.at || 0);
    if (line.type === "device.joined" && d.holds) Object.keys(d.holds).forEach(function (c) { knows[c] = Math.max(knows[c] || 0, d.holds[c] || 0); });
    if (line.type === "sync.took" && d.chains) Object.keys(d.chains).forEach(function (c) { knows[c] = Math.max(knows[c] || 0, (d.chains[c] || [])[1] || 0); });
    knows[code] = Math.max(knows[code] || 0, line.seq);
  }
  /* fields two devices may both add to while apart, joined rather than one taking the other's place: a booking's
     payments (by their own id; a payment voided on either device stays voided), and each person's training marks */
  var MERGE = { booking: { pays: "byId" }, train: { done: "keys", ex: "keys", tasks: "keys" } };
  /* when a record was last changed is kept like any field, but two devices both changing it is nothing to report */
  var QUIET = { updated: 1, updatedAt: 1, updatedBy: 1 };
  function mergeField(rule, loc, inc, incWins) {
    if (rule === "keys") {
      var o = clone(loc) || {};
      Object.keys(inc || {}).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(o, k) || (incWins && !same(o[k], inc[k]))) o[k] = clone(inc[k]); });
      return o;
    }
    var by = {}, out = [];
    (loc || []).forEach(function (x) { by[x.id] = clone(x); });
    (inc || []).forEach(function (x) {
      var a = by[x.id];
      if (!a) { by[x.id] = clone(x); return; }
      if (same(a, x)) return;
      var av = a.status === "void", xv = x.status === "void";
      if (av !== xv) { if (xv) by[x.id] = clone(x); } else if (incWins) by[x.id] = clone(x);
    });
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    out.sort(function (a, b) { var p = (a.at || "") + "|" + a.id, q = (b.at || "") + "|" + b.id; return p < q ? -1 : p > q ? 1 : 0; });
    return out;
  }
  /* One record written by another device's line, taken in. cur: { v, s } as held (or null); fields: what the line
     changed (null: the record was new there). Stock is never taken: it is the sum of every device's moves. apart(stamp)
     says whether the field was changed here while the other device could not know it. */
  function takeWrite(cur, kind, val, fields, stamp, apart) {
    if (!cur) { var v = clone(val); if (kind === "item") v.stock = 0; return { cur: { v: v, s: { "": stamp } }, clash: [] }; }
    var c = { v: clone(cur.v), s: clone(cur.s) || {} }, clash = [], fs = fields;
    if (!fs) { var ks = {}; Object.keys(val || {}).forEach(function (k) { ks[k] = 1; }); Object.keys(c.v || {}).forEach(function (k) { ks[k] = 1; }); fs = Object.keys(ks); }
    fs.forEach(function (f) {
      if (kind === "item" && f === "stock") return;
      var ls = stampF(c.s, f), later = stamp > ls, rule = MERGE[kind] && MERGE[kind][f];
      if (same(c.v[f], val[f])) { if (later) c.s[f] = stamp; return; }
      if (!rule && !QUIET[f] && apart(ls)) clash.push({ f: f, won: later ? stampCode(stamp) : stampCode(ls) });
      if (rule) { c.v[f] = mergeField(rule, c.v[f], val[f], later); if (later) c.s[f] = stamp; }
      else if (later) { if (val[f] === undefined) delete c.v[f]; else c.v[f] = clone(val[f]); c.s[f] = stamp; }
    });
    return { cur: c, clash: clash };
  }
  function myHave(st) {
    var h = {}; h[B.device.id] = st.head.seq;
    var ch = (st.sync && st.sync.chains) || {}; Object.keys(ch).forEach(function (d) { h[d] = ch[d].seq; });
    return h;
  }
  /* What this device holds: its letter, each device's chain as far as it has it, and the devices of the store. */
  B.syncInfo = function () {
    var st = state; if (!st) return null;
    var ch = (st.sync && st.sync.chains) || {}, list = [{ id: B.device.id, code: B.device.code, me: true, seq: st.head.seq, at: st.head.at }];
    Object.keys(ch).forEach(function (d) { list.push({ id: d, code: ch[d].code, me: false, seq: ch[d].seq, at: ch[d].at || null }); });
    list.forEach(function (x) { var r = st.devices && st.devices[x.id]; x.name = (r && r.name) || ""; x.joined = (r && r.joined) || null; });
    list.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
    return { device: { id: B.device.id, code: B.device.code }, have: myHave(st), devices: list };
  };

  /* ---------- a bundle: this device's lines (and those it holds of the others) that the other device lacks ---------- */
  B.makeBundle = function (have) {
    if (!KEY || !state) return Promise.reject(err("locked"));
    if (B.mode === "practice") return Promise.reject(err("practice"));
    if (B.user && !B.can("backup")) return Promise.reject(err("denied"));
    have = have || {};
    var key = KEY, id = ID, st = state, me = B.device.id;
    return D.entries("journal").then(function (entries) {
      var chains = {};
      function into(dev, code, line) { var c = chains[dev] || (chains[dev] = { dev: dev, code: code, lines: [] }); c.lines.push(line); }
      return Promise.all(entries.map(function (e) {
        if (typeof e[0] === "number") {
          if (e[0] <= (have[me] || 0)) return null;
          return C.open(key, e[1], aadLine(id, e[0])).then(function (l) { into(me, B.device.code, l); });
        }
        var m = /^p:(.+):(\d+)$/.exec(e[0]); if (!m) return null;
        var dev = m[1], seq = parseInt(m[2], 10);
        if (seq <= (have[dev] || 0)) return null;
        return C.open(key, e[1], aadPeer(id, dev, seq)).then(function (l) { into(dev, codeOfDev(st, dev), l); });
      })).then(function () {
        var list = Object.keys(chains).map(function (d) { var c = chains[d]; c.lines.sort(function (a, b) { return a.seq - b.seq; }); return c; });
        /* lines written before Build 24 travel as they are: the device taking them in already holds them (it joined from a
           copy made after them), or it refuses them */
        var payload = { v: 1, from: me, code: B.device.code, at: new Date().toISOString(), have: myHave(st), chains: list };
        return C.seal(key, payload, aadBundle(id, me)).then(function (sealed) {
          return JSON.stringify({ format: "lakay-changes", v: 1, store: id, from: me, iv: U.b64e(sealed.iv), ct: U.b64e(sealed.ct) });
        });
      });
    });
  };

  /* ---------- taking a bundle in ---------- */
  B.takeBundle = function (text) {
    var bundle;
    try { bundle = JSON.parse(text); } catch (e) { return Promise.reject(err("notbundle")); }
    if (!bundle || bundle.format !== "lakay-changes" || bundle.v !== 1 || !bundle.iv || !bundle.ct || !bundle.from) return Promise.reject(err("notbundle"));
    if (!KEY || !state) return Promise.reject(err("locked"));
    if (B.mode === "practice") return Promise.reject(err("practice"));
    if (B.user && !B.can("backup")) return Promise.reject(err("denied"));
    if (bundle.store !== ID) return Promise.reject(err("otherstore"));
    if (bundle.from === B.device.id) return Promise.reject(err("mine"));
    var key = KEY, id = ID;
    return C.open(key, { iv: U.b64d(bundle.iv), ct: U.b64d(bundle.ct) }, aadBundle(id, bundle.from)).then(null, function () { throw err("notbundle"); }).then(function (pl) {
      if (!pl || pl.from !== bundle.from || !Array.isArray(pl.chains)) throw err("notbundle");
      return enqueue(function () { return takeIn(pl, key, id); });
    });
  };
  function takeIn(pl, key, id) {
    if (!KEY || !state || KEY !== key) throw err("locked");
    var st = state, sync = clone(st.sync) || { v: 1, chains: {}, vs: {}, cs: "" };
    sync.chains = sync.chains || {}; sync.vs = sync.vs || {}; sync.cs = sync.cs || "";
    var rep = { from: pl.code, lines: 0, chains: {}, clashes: [], problems: [] }, fresh = [];
    /* 1. each chain must follow on from what this device holds of it */
    return pl.chains.reduce(function (p, ch) {
      return p.then(function () {
        if (!ch || !ch.dev || ch.dev === B.device.id || !Array.isArray(ch.lines)) return;
        /* a device removed from the store (or an invitation cancelled): its changes are refused (Build 25) */
        var dr = st.devices && st.devices[ch.dev];
        if (dr && (dr.status === "removed" || dr.status === "cancelled")) {
          if (ch.dev === pl.from) throw err("removed", dr.code);
          rep.setAside = (rep.setAside || []).concat([dr.code]); return;
        }
        var held = sync.chains[ch.dev] || { code: ch.code, seq: 0, hash: ZERO, knows: {} };
        var code = held.code || ch.code, at = ch.lines.filter(function (l) { return l.seq === held.seq; })[0];
        var lines = ch.lines.filter(function (l) { return l.seq > held.seq; }).sort(function (a, b) { return a.seq - b.seq; });
        return (at ? U.sha256hex(U.canon(at)).then(function (h) { if (h !== held.hash) throw err("fork", code); }) : Promise.resolve()).then(function () {
          if (!lines.length) return;
          if (lines[0].seq !== held.seq + 1) throw err("gap", code);
          var prev = held.hash, hashes = [], i = 0;
          function next() {
            if (i >= lines.length) return Promise.resolve();
            var l = lines[i];
            if (l.prev !== prev || l.seq !== held.seq + 1 + i) throw err("chain", code);
            if (!l.ts) throw err("old", code);
            i++;
            return U.sha256hex(U.canon(l)).then(function (h) { prev = h; hashes.push(h); return next(); });
          }
          return next().then(function () { fresh.push({ dev: ch.dev, code: code, held: held, lines: lines, hashes: hashes }); });
        });
      });
    }, Promise.resolve()).then(function () {
      if (!fresh.length) return rep;
      /* two devices may never share a letter (two joined from the same copy before either was heard of): the second is
         refused, and joins again from a newer copy */
      var codes = {}; codes[B.device.code] = B.device.id;
      Object.keys(sync.chains).forEach(function (d) { var c = sync.chains[d].code; if (!codes[c]) codes[c] = d; });
      /* and the letters this store's books have given out, invitations included (Build 25) */
      Object.keys(st.devices || {}).forEach(function (d) { var c = st.devices[d].code; if (c && !codes[c]) codes[c] = d; });
      fresh.forEach(function (c) { var o = codes[c.code]; if (o && o !== c.dev) throw err("letter", c.code); codes[c.code] = c.dev; });
      /* 2. every new line, from every chain, in the order of the stamps */
      var queue2 = [], work = {}, knows = {}, maxTs = 0, vaultTaken = {}, custom, customTaken = false;
      fresh.forEach(function (c) {
        knows[c.dev] = clone(c.held.knows) || {};
        c.lines.forEach(function (l) { queue2.push([lineStamp(l, c.code), l, c]); maxTs = Math.max(maxTs, l.ts || 0); });
        rep.chains[c.code] = c.lines.length; rep.lines += c.lines.length;
      });
      queue2.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
      function workGet(k) { if (Object.prototype.hasOwnProperty.call(work, k)) return work[k]; var v = getRec(st, k); return v ? { v: v, s: st.stamps[k] || {} } : null; }
      queue2.forEach(function (q) {
        var stamp = q[0], line = q[1], c = q[2], kn = knows[c.dev];
        /* what the device knew as it wrote this line (a joining line says what it came with) counts for the line itself */
        learn(kn, line, c.code);
        var apart = function (ls) { if (!ls) return false; var lc = stampCode(ls); if (!lc || lc === c.code) return false; return (kn[lc] || 0) < stampSeq(ls); };
        (line.w || []).forEach(function (e) {
          var k = e[0], kind = kindOf(k); if (LOCAL[kind]) return;
          var r = takeWrite(workGet(k), kind, e[1], e[2], stamp, apart);
          work[k] = r.cur;
          r.clash.forEach(function (x) { rep.clashes.push({ k: k, f: x.f, from: c.code, seq: line.seq, won: x.won }); });
        });
        Object.keys(line.sd || {}).forEach(function (iid) {
          var k = "item:" + iid, cur = workGet(k);
          if (!cur) { rep.problems.push({ seq: line.seq, from: c.code, what: "item", id: iid }); return; }
          var v = clone(cur.v); v.stock = (v.stock || 0) + line.sd[iid]; work[k] = { v: v, s: cur.s };
        });
        if (line.m) {
          (line.m.v || []).forEach(function (pt) { if (stamp > (sync.vs[pt[0]] || "")) { vaultTaken[pt[0]] = pt[1]; sync.vs[pt[0]] = stamp; } });
          if (line.m.c !== undefined && stamp > sync.cs) { custom = line.m.c; customTaken = true; sync.cs = stamp; }
        }
      });
      /* 3. the books as they now stand: the records changed, the vault, the door, and what this device holds */
      var raw = [], ops = [], took = {};
      Object.keys(work).forEach(function (k) { raw.push({ k: k, v: work[k].v, s: work[k].s }); });
      fresh.forEach(function (c) {
        var last = c.lines[c.lines.length - 1], before = sync.chains[c.dev];
        /* the lines that only say what a device took in: they change nothing in the books, so they are not counted as
           changes still to carry (Build 25) */
        var quiet = ((before && before.quiet) || []).concat(c.lines.filter(function (l) { return l.type === "sync.took"; }).map(function (l) { return l.seq; })).slice(-300);
        sync.chains[c.dev] = { code: c.code, seq: last.seq, hash: c.hashes[c.hashes.length - 1], at: last.at, knows: knows[c.dev], quiet: quiet };
        took[c.code] = [c.lines[0].seq, last.seq];
      });
      sync.quiet = (sync.quiet || []).concat([st.head.seq + 1]).slice(-300);
      sync.peers = sync.peers || {}; sync.peers[pl.from] = { have: pl.have || {}, at: new Date().toISOString() };
      raw.push({ k: "sync:main", v: sync });
      var users = clone(st.users), settings = st.settings;
      Object.keys(work).forEach(function (k) { if (kindOf(k) === "user") users[k.slice(5)] = work[k].v; });
      if (work["settings:main"]) settings = work["settings:main"].v;
      var door = doorWith({ storeName: settings.storeName, people: peopleOf(users) });
      if (work["settings:main"] && !same(settings.ownerName, st.settings.ownerName)) door.user = cleanName(settings.ownerName);
      var meta = [{ key: "door", value: door }];
      return Promise.all(fresh.map(function (c) {
        return Promise.all(c.lines.map(function (l) { return C.seal(key, l, aadPeer(id, c.dev, l.seq)).then(function (env) { ops.push({ store: "journal", key: peerKey(c.dev, l.seq), value: env, add: true }); }); }));
      })).then(function () {
        if (!Object.keys(vaultTaken).length) return;
        return D.get("meta", "vault").then(function (v) {
          v = clone(v);
          Object.keys(vaultTaken).forEach(function (pt) {
            var env = vaultTaken[pt];
            if (pt === "owner" || pt === "master") { if (env) v[pt] = env; }
            else if (pt.indexOf("people:") === 0) { v.people = v.people || {}; if (env) v.people[pt.slice(7)] = env; else delete v.people[pt.slice(7)]; }
          });
          ops.push({ store: "meta", key: "vault", value: v });
        });
      }).then(function () {
        if (customTaken) ops.push({ store: "meta", key: "custom", value: custom });
        var data = { from: pl.from, code: pl.code, chains: took, lines: rep.lines, clashes: rep.clashes.length, list: rep.clashes.slice(0, 40) };
        if (rep.problems.length) data.problems = rep.problems.slice(0, 20);
        return commit("sync.took", data, [], meta, { raw: raw, ops: ops, minTs: maxTs });
      }).then(function () {
        if (state) E.settings = state.settings;
        if (customTaken) { E.custom = E.cleanCustom ? E.cleanCustom(custom) : custom; if (E.ui && E.ui.applyLook) E.ui.applyLook(); }
        return rep;
      });
    });
  }

  /* ---------- a device joins the store from a copy (a sealed backup) made by a device already in it ----------
     Stage 1 (Build 24): with the owner's password or the Master Key; the device takes the next free letter.
     Stage 2 (Build 25): with a joining file and its pairing code; the device takes the letter and the place that the
     inviting device reserved for it in its books, so two devices never share a letter. */
  function joinStart() {
    if (B.mode === "practice") B.useBooks(false);
    /* only a device with no store of its own joins: the books of a store already here are never replaced this way */
    return D.get("meta", "vault").then(function (here) { if (here) throw err("hasstore"); });
  }
  function joinWith(body, key, opts) {
    opts = opts || {};
    var v = body.vault;
    var journal = body.journal.map(function (e) { return [e[0], { iv: U.b64d(e[1]), ct: U.b64d(e[2]) }]; });
    var rec = body.rec.map(function (e) { return [e[0], { iv: U.b64d(e[1]), ct: U.b64d(e[2]) }]; });
    var src, devRecs = {}, copySync = null;
    return readChains(key, v.storeId, journal, true).then(function (r) {
      src = r;
      return Promise.all(rec.filter(function (e) { return /^device:/.test(e[0]) || e[0] === "sync:main"; }).map(function (e) {
        return C.open(key, e[1], aadRec(v.storeId, e[0])).then(function (val) {
          if (val && val["~s"] && Object.prototype.hasOwnProperty.call(val, "~v")) val = val["~v"];
          if (e[0] === "sync:main") copySync = val; else devRecs[e[0].slice(7)] = val;
        });
      }));
    }).then(function () {
      var last = src.lines[src.lines.length - 1];
      var srcDev = (body.device && body.device.id) || (last && last.dev);
      if (!last || !srcDev) throw err("notbackup");
      var me = opts.device ? opts.device.id : B.device.id, myCode, mine, now = new Date();
      if (srcDev === me || src.peers[me]) throw err("samedevice");
      var srcCode = (devRecs[srcDev] && devRecs[srcDev].code) || (body.device && body.device.code) || "A";
      if (opts.device) {
        /* the place the inviting device reserved: this device's letter, its name, the invitation it came with */
        var held = devRecs[me];
        if (!held || held.code !== opts.device.code || held.invite !== opts.invite) throw err("notinvite");
        if (held.status === "cancelled" || held.status === "removed") throw err("cancelled");
        if (held.status !== "invited") throw err("samedevice");
        myCode = held.code;
        mine = clone(held); mine.status = "joined"; mine.joined = now.toISOString(); mine.from = srcDev;
        if (opts.name) mine.name = cleanName(opts.name);
      } else {
        if (devRecs[me]) throw err("samedevice");
        var used = {};
        Object.keys(devRecs).forEach(function (d) { used[devRecs[d].code] = 1; });
        Object.keys((copySync && copySync.chains) || {}).forEach(function (d) { used[copySync.chains[d].code] = 1; });
        used[srcCode] = 1;
        myCode = nextCode(used);
        mine = { id: me, code: myCode, name: cleanName(opts.name), joined: now.toISOString(), from: srcDev, status: "joined" };
      }
      var ts = Math.max(now.getTime(), src.maxTs + 1), knowsSrc = {};
      src.lines.forEach(function (l) { learn(knowsSrc, l, srcCode); });
      /* what this device holds of every chain, so that the others send it only what it lacks (Build 25) */
      var holds = {}; holds[srcCode] = last.seq;
      Object.keys(src.peers).forEach(function (d) { var c = copySync && copySync.chains && copySync.chains[d]; if (c && c.code) holds[c.code] = src.peers[d].seq; });
      var w = [["device:" + me, mine, null]], newRecs = [["device:" + me, mine]];
      if (!devRecs[srcDev]) {
        var theirs = { id: srcDev, code: srcCode, name: "", joined: src.lines[0].at, from: null, status: "joined" };
        w.push(["device:" + srcDev, theirs, null]); newRecs.push(["device:" + srcDev, theirs]);
      }
      var data = { code: myCode, from: srcDev, fromCode: srcCode, at: last.seq, hash: src.hash, name: mine.name, holds: holds };
      if (opts.invite) data.invite = opts.invite;
      var line = { seq: 1, at: now.toISOString(), day: U.dayKey(now), by: "owner", dev: me, type: "device.joined",
        data: data, prev: ZERO, build: E.BUILD.number, ts: ts, w: w };
      var stamp = stampOf(ts, myCode, 1), sync = { v: 1, chains: {}, vs: (copySync && copySync.vs) || {}, cs: (copySync && copySync.cs) || "" };
      Object.keys((copySync && copySync.chains) || {}).forEach(function (d) { if (d !== me) sync.chains[d] = copySync.chains[d]; });
      sync.chains[srcDev] = { code: srcCode, seq: last.seq, hash: src.hash, at: last.at, knows: knowsSrc };
      var device = { id: me, code: myCode, created: opts.device ? now.toISOString() : B.device.created };
      return U.sha256hex(U.canon(line)).then(function (hash) {
        var head = { seq: 1, hash: hash, at: line.at, ts: ts };
        return Promise.all([C.seal(key, line, aadLine(v.storeId, 1)), C.seal(key, head, aadRec(v.storeId, "head:main")), C.seal(key, sync, aadRec(v.storeId, "sync:main"))]
          .concat(newRecs.map(function (r) { return C.seal(key, wrapRec(r[1], { "": stamp }), aadRec(v.storeId, r[0])); }))
          .concat(src.lines.map(function (l) { return C.seal(key, l, aadPeer(v.storeId, srcDev, l.seq)); })));
      }).then(function (sealed) {
        var outRec = rec.filter(function (e) { return e[0] !== "head:main" && e[0] !== "sync:main" && !/^notes:/.test(e[0]); });
        outRec.push(["head:main", sealed[1]], ["sync:main", sealed[2]]);
        newRecs.forEach(function (r, i) { outRec = outRec.filter(function (e) { return e[0] !== r[0]; }); outRec.push([r[0], sealed[3 + i]]); });
        var outJournal = [[1, sealed[0]]];
        src.lines.forEach(function (l, i) { outJournal.push([peerKey(srcDev, l.seq), sealed[3 + newRecs.length + i]]); });
        journal.forEach(function (e) { if (typeof e[0] !== "number") outJournal.push(e); });
        return B.lock("join").then(function () {
          var meta = [["vault", v], ["door", body.door], ["device", device]];
          if (body.custom) meta.push(["custom", E.cleanCustom ? E.cleanCustom(body.custom) : body.custom]);
          return D.replaceAll(meta, outRec, outJournal);
        });
      }).then(function () {
        B.device = device;
        doorMeta = body.door || null; E.custom = body.custom && E.cleanCustom ? E.cleanCustom(body.custom) : null;
        if (E.ui && E.ui.applyLook) E.ui.applyLook();
        return { v: v, key: key, code: myCode };
      });
    });
  }
  B.joinFromBackup = function (body, secret, isMaster, name) {
    return joinStart().then(function () { return backupKey(body, secret, isMaster); })
      .then(function (key) { return joinWith(body, key, { name: name }); })
      .then(function (r) { return load(r.v, r.key); });
  };

  /* ---------- inviting a device (Build 25, stage 2) ----------
     The owner names the new device and gives the owner's password. This device reserves the next letter in the books
     (a line, device.invited), makes a sealed copy of the books, and seals the Store Key under a key made from a fresh
     pairing code, bound to the store, to the invitation, to the reserved place and to the hour it expires. The joining
     file carries the copy and that envelope; the code is shown once, on this screen, and kept nowhere. Each part is
     useless without the other. The invitation can be used once, until it expires (a day), or cancelled. */
  var INVITE_HOURS = 24;
  function usedLetters(st) {
    var used = {}; used[B.device.code] = 1;
    Object.keys(st.devices || {}).forEach(function (d) { used[st.devices[d].code] = 1; });
    Object.keys((st.sync && st.sync.chains) || {}).forEach(function (d) { used[st.sync.chains[d].code] = 1; });
    return used;
  }
  function inviteAad(storeId, inv) { return aadEnv(storeId, "invite:" + inv.id + "|" + inv.device.id + "|" + inv.device.code + "|" + inv.expires); }
  function selfRecord() { return { id: B.device.id, code: B.device.code, name: "", joined: B.device.created || null, from: null, status: "joined" }; }
  B.prepareInvite = function (ownerPassword, name) {
    if (!state || !KEY) return Promise.reject(err("locked"));
    if (B.mode === "practice") return Promise.reject(err("practice"));
    if (!B.isOwner()) return Promise.reject(err("denied"));
    var hk, pc, inv = { id: U.uid("v"), device: { id: U.uid("d"), code: "", name: cleanName(name) }, expires: new Date(Date.now() + INVITE_HOURS * 3600000).toISOString() };
    return ownerKeyExtractable(ownerPassword).then(function (x) { hk = x; return C.newPairing(); }).then(function (p) {
      pc = p;
      return enqueue(function () {
        if (!KEY || !state) throw err("locked");
        var st = state, me = B.device.id;
        inv.device.code = nextCode(usedLetters(st));
        var recs = [];
        if (!(st.devices && st.devices[me])) recs.push({ kind: "device", id: me, value: selfRecord() });
        recs.push({ kind: "device", id: inv.device.id, value: { id: inv.device.id, code: inv.device.code, name: inv.device.name, status: "invited",
          invited: clock().toISOString(), by: B.user.id, expires: inv.expires, invite: inv.id } });
        /* what the new device will hold: this device's lines up to this one, and what it holds of the others */
        var sync = clone(st.sync) || { v: 1, chains: {}, vs: {}, cs: "" };
        sync.peers = sync.peers || {};
        var have = myHave(st); have[me] = st.head.seq + 1;
        sync.peers[inv.device.id] = { have: have, at: new Date().toISOString() };
        return commit("device.invited", { id: inv.device.id, code: inv.device.code, name: inv.device.name, expires: inv.expires, invite: inv.id }, recs, [], { raw: [{ k: "sync:main", v: sync }] });
      });
    }).then(function () { return B.makeBackup(); }).then(function (text) {
      var body = JSON.parse(text);
      return C.pairingKey(pc.secret, idBytes(ID), inv.id).then(function (kek) { return C.wrap(hk.key, kek, inviteAad(ID, inv)); }).then(function (env) {
        hk.key = null;
        var file = JSON.stringify({ format: "lakay-join", v: 1, store: ID, id: inv.id, device: inv.device, from: B.device.id, fromCode: B.device.code,
          expires: inv.expires, storeName: state ? state.settings.storeName : "", env: env, backup: body });
        return { code: pc.code, file: file, device: clone(inv.device), expires: inv.expires };
      });
    });
  };
  /* A joining file, read and checked (its copy's checksum too) before anything is asked. */
  B.readInvite = function (text) {
    var inv;
    try { inv = JSON.parse(text); } catch (e) { return Promise.reject(err("notinvite")); }
    if (!inv || inv.format !== "lakay-join" || inv.v !== 1 || !inv.id || !inv.device || !inv.device.id || !inv.device.code || !inv.env || !inv.backup || !inv.expires) return Promise.reject(err("notinvite"));
    if (!(Date.now() <= Date.parse(inv.expires))) return Promise.reject(err("expired"));
    return B.readBackup(JSON.stringify(inv.backup)).then(function (body) {
      if (!body.vault || body.vault.storeId !== inv.store) throw err("notinvite");
      inv.backup = body; return inv;
    }, function (e) { throw e && e.code === "corrupt" ? e : err("notinvite"); });
  };
  /* The new device joins with the joining file and the code. It does not open the books: the door then asks each
     person for their own password, as on every device. */
  B.joinFromInvite = function (inv, codeText) {
    var v = inv.backup.vault;
    return joinStart().then(function () { return C.readPairing(codeText); }).then(function (secret) {
      if (!secret) throw err("badcode");
      return C.pairingKey(secret, idBytes(v.storeId), inv.id);
    }).then(function (kek) {
      return C.unwrap(inv.env, kek, inviteAad(v.storeId, inv), false).then(null, function () { throw err("wrongcode"); });
    }).then(function (key) {
      if (!(Date.now() <= Date.parse(inv.expires))) throw err("expired");
      return joinWith(inv.backup, key, { device: inv.device, invite: inv.id, name: inv.device.name });
    }).then(function (r) { return { code: r.code, storeName: (inv.backup.door && inv.backup.door.storeName) || inv.storeName || "" }; });
  };

  /* ---------- the store's devices (Build 25): naming one, cancelling an invitation, removing a device ---------- */
  B.renameDevice = function (id, name) {
    var nm = cleanName(name);
    return B.change(function (st) {
      need("owner");
      if (B.mode === "practice") throw err("practice");
      var d = st.devices && st.devices[id];
      if (!d && id !== B.device.id) throw err("nodevice");
      var r = d ? clone(d) : selfRecord();
      if (r.name === nm) return null;
      r.name = nm;
      return { type: "device.named", data: { id: id, code: r.code, name: nm }, recs: [{ kind: "device", id: id, value: r }], result: r };
    });
  };
  /* A device removed (lost, stolen, or given up) is refused from then on: its changes are no longer taken in, here or
     on any device that takes this line. An invitation not yet used is cancelled the same way. The removed device keeps
     what it held; its password is still needed to open it. */
  B.removeDevice = function (id) {
    return B.change(function (st) {
      need("owner");
      if (B.mode === "practice") throw err("practice");
      if (id === B.device.id) throw err("self");
      var d = st.devices && st.devices[id]; if (!d) throw err("nodevice");
      if (d.status === "removed" || d.status === "cancelled") return null;
      var r = clone(d), invited = d.status === "invited";
      r.status = invited ? "cancelled" : "removed"; r.removed = clock().toISOString(); r.removedBy = B.user.id;
      return { type: invited ? "device.cancelled" : "device.removed", data: { id: id, code: d.code }, recs: [{ kind: "device", id: id, value: r }], result: r };
    });
  };
  function devOfCode(st, code) {
    if (B.device && B.device.code === code) return B.device.id;
    var ch = (st.sync && st.sync.chains) || {}, d;
    for (d in ch) if (ch[d].code === code) return d;
    var ds = st.devices || {};
    for (d in ds) if (ds[d].code === code) return d;
    return null;
  }
  /* What another device surely holds: its own lines as far as this device has them, what its lines say it took from
     the others, and what it said it held in the last bundle it sent here (or at its invitation). */
  function peerHave(st, dev) {
    var h = {}, sync = st.sync || {}, ch = (sync.chains || {})[dev];
    if (ch) {
      h[dev] = ch.seq;
      Object.keys(ch.knows || {}).forEach(function (code) { var d = devOfCode(st, code); if (d && d !== dev) h[d] = Math.max(h[d] || 0, ch.knows[code] || 0); });
    }
    var p = (sync.peers || {})[dev];
    if (p && p.have) Object.keys(p.have).forEach(function (d) { h[d] = Math.max(h[d] || 0, p.have[d] || 0); });
    return h;
  }
  /* the lines after "from" up to "to" that change the books (not those that only say what was taken in) */
  function real(from, to, quiet) {
    if (to <= from) return 0;
    return (to - from) - (quiet || []).filter(function (q) { return q > from && q <= to; }).length;
  }
  B.makeBundleFor = function (dev) { return state ? B.makeBundle(peerHave(state, dev)) : Promise.reject(err("locked")); };
  /* every device of the store, for the Devices section: its letter, name and state, when it was last heard from, and
     how many of this device's changes (and of the others' it holds) it has yet to take */
  B.devices = function () {
    var st = state; if (!st) return [];
    var me = B.device.id, out = {}, chains = (st.sync && st.sync.chains) || {};
    function row(id) { return out[id] || (out[id] = { id: id, code: "?", name: "", me: id === me, status: "joined" }); }
    var self = row(me); self.code = B.device.code; self.seq = st.head.seq; self.at = st.head.at;
    Object.keys(st.devices || {}).forEach(function (id) {
      var d = st.devices[id], r = row(id);
      if (!r.me) r.code = d.code;
      r.name = d.name || ""; r.status = d.status || "joined"; r.invited = d.invited || null; r.expires = d.expires || null; r.joined = d.joined || null; r.removed = d.removed || null;
    });
    Object.keys(chains).forEach(function (id) { var c = chains[id], r = row(id); if (r.code === "?") r.code = c.code; r.seq = c.seq; r.at = c.at || null; });
    Object.keys(out).forEach(function (id) {
      var r = out[id]; if (r.me) return;
      var hv = peerHave(st, id), more = 0;
      r.behind = real(hv[me] || 0, st.head.seq, st.sync && st.sync.quiet);
      Object.keys(chains).forEach(function (d) { if (d !== id) more += real(hv[d] || 0, chains[d].seq, chains[d].quiet); });
      r.behindOthers = more;
    });
    return Object.keys(out).map(function (k) { return out[k]; }).sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
  };

  /* ---------- erasing the store from this device (the owner only, with the password) ---------- */
  B.erase = function (password) {
    return B.checkPassword(password).then(function () { return B.lock("erase"); }).then(function () { return D.wipe(); }).then(function () {
      return D.write([{ store: "meta", key: "device", value: B.device }]);
    });
  };
  /* The Reset key at the door: the store leaves this device with no password asked. The books are sealed, so nothing
     in them can be read this way; they are only gone from this device. The door offers a sealed backup first. */
  B.eraseAtDoor = function () {
    if (B.isOpen) return Promise.reject(err("denied"));
    B.useBooks(false);
    return notesSettled().then(function () { return D.wipe(); }).then(function () { doorMeta = null; return D.write([{ store: "meta", key: "device", value: B.device }]); });
  };
  /* The sign-in's memory on this device: the waits after wrong tries, and the last name typed. */
  B.forgetSignIn = function () {
    U.prefSet("fails", "0"); U.prefSet("waitUntil", "0");
    return D.get("meta", "door").then(function (d) {
      if (!d || !d.last) return false;
      delete d.last; doorMeta = d;
      return D.write([{ store: "meta", key: "door", value: d }]).then(function () { return true; });
    }).catch(function () { return false; });
  };
})();
