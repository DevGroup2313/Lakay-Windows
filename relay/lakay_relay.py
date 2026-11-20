#!/usr/bin/env python3
# LAKAY RELAY  |  Copyright (c) 2026 Yannie D. Forest. All rights reserved.
# NO LICENCE IS GRANTED. See LICENCE.txt.
"""
Lakay Relay (Build 26): the store's own mailbox for sealed changes, run on the owner's own Mac minis.

Each device of the store leaves here the sealed bundles of its new changes (the "lakay-changes" files of Build 25) and
takes the bundles the other devices left. The relay never holds the books, the Store Key or a password, and it cannot
read what it keeps: every bundle is sealed with the Store Key on the device that made it.

It answers only to keys. The owner's key is made from the owner's password on a device; a device's key is made on that
device. The relay keeps only the SHA-256 of each and compares them in constant time. A new relay belongs to no store:
at its first start it makes a claim code (claim.txt, beside its data), which the owner types in Lakay, with the owner's
password, to make the relay the store's. Until then it takes no bundle.

It must answer only inside the owner's private network (WireGuard or Tailscale), never open to the whole internet: it is
built on the web server of Python's standard library, which Python's documentation does not recommend for that.

Run:  python3 lakay_relay.py [--data DIR] [--listen ADDRESS] [--port N] [--cert FILE --key FILE]
      python3 lakay_relay.py --data DIR --claim                    prints the claim code (making one if needed)
      python3 lakay_relay.py --data DIR --make-certificate ADDRESS [ADDRESS ...]
With --cert and --key it answers over https; without them, over plain http (for tests on this computer, or behind
Tailscale's own secure address). --make-certificate makes the owner's own certificate authority (once) and a
certificate for the relay's addresses, with the openssl program, in DIR/tls; the authority's certificate,
lakay-relay-authority.pem, is the one the owner installs on each device.
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

VERSION = "26"
MAX_BUNDLE = 16 * 1024 * 1024          # one sealed bundle
MAX_SMALL = 8 * 1024                    # the body of any other request
KEEP_DAYS = 30                          # how long a bundle is kept
MAX_TOTAL = 2 * 1024 * 1024 * 1024      # all bundles together; beyond this the oldest go first
PAGE_COUNT = 40                         # bundles given in one answer
PAGE_BYTES = 20 * 1024 * 1024
CLAIM_TRIES = 8                         # wrong claim codes allowed before a pause
CLAIM_PAUSE = 600                       # the pause, in seconds
SOCKET_TIMEOUT = 30                     # a connection that stays silent this long is closed
LOG_MAX = 1024 * 1024
ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"   # Crockford's Base32, as Lakay's own codes
RE_STORE = re.compile(r"[0-9a-f]{32}\Z")
RE_DEVICE = re.compile(r"[a-z0-9]{2,40}\Z")
RE_HASH = re.compile(r"[0-9a-f]{64}\Z")
RE_AUTH_OWNER = re.compile(r"Lakay owner=([A-Za-z0-9_-]{43})\Z")
RE_AUTH_DEVICE = re.compile(r"Lakay device=([a-z0-9]{2,40}), key=([A-Za-z0-9_-]{43})\Z")
RE_ADDRESS = re.compile(r"[A-Za-z0-9.:-]{1,253}\Z")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def age_days(iso):
    try:
        t = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return 0
    return (datetime.now(timezone.utc) - t).total_seconds() / 86400.0


def key_hash(b64):
    """The SHA-256 (hex) of a key sent as 43 characters of base64url (32 bytes), or None."""
    try:
        raw = base64.urlsafe_b64decode(b64 + "=")
    except (ValueError, TypeError):
        return None
    return hashlib.sha256(raw).hexdigest() if len(raw) == 32 else None


def clean_code(text):
    t = re.sub(r"[\s\-\u2013\u2014.\u00b7_]", "", str(text or "")).upper()
    return t.replace("O", "0").replace("I", "1").replace("L", "1")


def grouped(code):
    return "-".join(code[i:i + 4] for i in range(0, len(code), 4))


def default_data():
    home = os.path.expanduser("~")
    if sys.platform == "darwin":
        return os.path.join(home, "Library", "Application Support", "Lakay Relay")
    return os.path.join(home, ".lakay-relay")


class Fail(Exception):
    def __init__(self, status, code):
        Exception.__init__(self, code)
        self.status, self.code = status, code


class Relay:
    """The relay's own state, kept in its data folder: relay.json (the store it serves, the owner key's fingerprint, the
    claim code's fingerprint), devices.json (each device's key fingerprint), index.json and bundles/ (the bundles)."""

    def __init__(self, data):
        self.data = data
        self.lock = threading.Lock()
        os.makedirs(os.path.join(data, "bundles"), exist_ok=True)
        self.state = self.read("relay.json") or {"v": 1, "created": now_iso(), "store": None, "owner": None, "claim": None}
        self.devices = self.read("devices.json") or {}
        self.index = self.read("index.json") or {"next": 1, "items": []}
        self.claim_fails = []
        if not self.state.get("store") and not self.state.get("claim"):
            self.new_claim()
        self.write("relay.json", self.state)

    def path(self, *names):
        return os.path.join(self.data, *names)

    def read(self, name):
        try:
            with open(self.path(name), encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, ValueError):
            return None

    def write(self, name, obj):
        p = self.path(name)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f)
        os.replace(tmp, p)

    def new_claim(self):
        code = "".join(secrets.choice(ALPHA) for _ in range(16))
        self.state["claim"] = hashlib.sha256(code.encode("ascii")).hexdigest()
        p = self.path("claim.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write("Lakay Relay: the claim code is " + grouped(code) + "\n"
                    "Type it in Lakay (Settings, Devices in step, The relays) with the owner's password. It works once.\n")
        try:
            os.chmod(p, 0o600)
        except OSError:
            pass
        self.write("relay.json", self.state)
        return code

    def claim_code(self):
        try:
            with open(self.path("claim.txt"), encoding="utf-8") as f:
                m = re.search(r"is ([0-9A-Z-]{19})", f.read())
                return m.group(1) if m else None
        except FileNotFoundError:
            return None

    # ---------- the owner ----------
    def claim(self, store, body, auth):
        owner = body.get("owner")
        if not isinstance(owner, str) or not RE_HASH.match(owner):
            raise Fail(400, "owner")
        with self.lock:
            if self.state.get("store"):
                # claimed: only this store's owner may change the owner's key (a new password)
                if self.state["store"] != store:
                    raise Fail(409, "claimed")
                self.check_owner(auth)
                self.state["owner"] = owner
                self.write("relay.json", self.state)
                return {"ok": True}
            t = time.time()
            self.claim_fails = [x for x in self.claim_fails if t - x < CLAIM_PAUSE]
            if len(self.claim_fails) >= CLAIM_TRIES:
                raise Fail(429, "wait")
            given = hashlib.sha256(clean_code(body.get("claim")).encode("ascii", "replace")).hexdigest()
            if not self.state.get("claim") or not hmac.compare_digest(given, self.state["claim"]):
                self.claim_fails.append(t)
                raise Fail(403, "claim")
            self.state.update({"store": store, "owner": owner, "claim": None, "claimed": now_iso()})
            self.write("relay.json", self.state)
            try:
                os.remove(self.path("claim.txt"))
            except FileNotFoundError:
                pass
            return {"ok": True}

    def check_owner(self, auth):
        m = RE_AUTH_OWNER.match(auth or "")
        h = key_hash(m.group(1)) if m else None
        own = self.state.get("owner") or ""
        if not h or not own or not hmac.compare_digest(h, own):
            raise Fail(401, "key")

    def check_device(self, auth):
        m = RE_AUTH_DEVICE.match(auth or "")
        if not m:
            raise Fail(401, "key")
        dev, h = m.group(1), key_hash(m.group(2))
        rec = self.devices.get(dev) or {}
        ok = hmac.compare_digest(h or "0", rec.get("key") or "1")
        if not ok or rec.get("closed"):
            raise Fail(401, "key")
        return dev

    def put_device(self, dev, body):
        key = body.get("key")
        if not isinstance(key, str) or not RE_HASH.match(key):
            raise Fail(400, "key")
        with self.lock:
            rec = self.devices.get(dev) or {}
            rec.update({"key": key, "added": now_iso(), "closed": None})
            self.devices[dev] = rec
            self.write("devices.json", self.devices)
        return {"ok": True}

    def close_device(self, dev):
        with self.lock:
            rec = self.devices.get(dev)
            if rec and not rec.get("closed"):
                rec["closed"] = now_iso()
                self.write("devices.json", self.devices)
        return {"ok": True}

    def list_devices(self):
        with self.lock:
            return {"devices": [{"id": d, "added": r.get("added"), "closed": r.get("closed"), "seen": r.get("seen"),
                                 "took": r.get("took", 0)} for d, r in sorted(self.devices.items())]}

    # ---------- the bundles ----------
    def leave(self, store, dev, raw):
        try:
            b = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise Fail(400, "bundle")
        if (not isinstance(b, dict) or b.get("format") != "lakay-changes" or b.get("v") != 1 or b.get("store") != store
                or not isinstance(b.get("iv"), str) or not isinstance(b.get("ct"), str)):
            raise Fail(400, "bundle")
        if b.get("from") != dev:
            raise Fail(403, "from")          # a device leaves changes only in its own name
        with self.lock:
            n = self.index["next"]
            name = "%09d.lakay" % n
            tmp = self.path("bundles", name + ".tmp")
            with open(tmp, "wb") as f:
                f.write(raw)
            os.replace(tmp, self.path("bundles", name))
            self.index["items"].append({"n": n, "from": dev, "size": len(raw), "at": now_iso()})
            self.index["next"] = n + 1
            self.prune()
            self.write("index.json", self.index)
            rec = self.devices.get(dev)
            if rec is not None:
                rec["seen"] = now_iso()
                self.write("devices.json", self.devices)
        return {"n": n}

    def take(self, dev, after):
        out, size, more = [], 0, False
        with self.lock:
            items = [i for i in self.index["items"] if i["n"] > after]
            for i in items:
                if len(out) >= PAGE_COUNT or (out and size + i["size"] > PAGE_BYTES):
                    more = True
                    break
                try:
                    with open(self.path("bundles", "%09d.lakay" % i["n"]), encoding="utf-8") as f:
                        text = f.read()
                except FileNotFoundError:
                    continue
                out.append({"n": i["n"], "from": i["from"], "at": i["at"], "text": text})
                size += i["size"]
            last = out[-1]["n"] if out else max([after] + [i["n"] for i in self.index["items"] if i["n"] <= after][-1:])
            rec = self.devices.get(dev)
            if rec is not None:
                rec["seen"] = now_iso()
                rec["took"] = max(rec.get("took", 0), last)
                self.write("devices.json", self.devices)
        return {"bundles": out, "next": last, "more": more, "first": self.index["items"][0]["n"] if self.index["items"] else self.index["next"]}

    def prune(self):
        items, keep, total = self.index["items"], [], 0
        for i in reversed(items):
            if age_days(i["at"]) <= KEEP_DAYS and total + i["size"] <= MAX_TOTAL:
                keep.append(i)
                total += i["size"]
            else:
                try:
                    os.remove(self.path("bundles", "%09d.lakay" % i["n"]))
                except FileNotFoundError:
                    pass
        keep.reverse()
        self.index["items"] = keep


RELAY = None


class Server(ThreadingHTTPServer):
    daemon_threads = True
    ssl_ctx = None

    def finish_request(self, request, client_address):
        # the secure handshake happens here, in the connection's own thread, so a slow one never holds up the others
        request.settimeout(SOCKET_TIMEOUT)
        if self.ssl_ctx is not None:
            request = self.ssl_ctx.wrap_socket(request, server_side=True)
        self.RequestHandlerClass(request, client_address, self)

    def handle_error(self, request, client_address):
        log(client_address[0] if client_address else "?", "-", "-", "connection error: %s" % (sys.exc_info()[1],))


_log_lock = threading.Lock()


def log(addr, method, path, status, size=0):
    if RELAY is None:
        return
    p = RELAY.path("relay.log")
    line = "%s %s %s %s %s %s\n" % (now_iso(), addr, method, path, status, size)
    with _log_lock:
        try:
            if os.path.exists(p) and os.path.getsize(p) > LOG_MAX:
                os.replace(p, p + ".1")
            with open(p, "a", encoding="utf-8") as f:
                f.write(line)
        except OSError:
            pass


class Handler(BaseHTTPRequestHandler):
    server_version = "LakayRelay/" + VERSION
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass                                   # the relay's own log (log()) never holds a key or a bundle

    def send(self, status, obj=None):
        body = json.dumps(obj, separators=(",", ":")).encode("utf-8") if obj is not None else b""
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if body:
            self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)
        shown = re.sub(r"/v1/([0-9a-f]{6})[0-9a-f]+", r"/v1/\1…", urlsplit(self.path).path)
        log(self.client_address[0], self.command, shown, status, len(body))

    def body(self, limit):
        if self.headers.get("Transfer-Encoding"):
            raise Fail(411, "length")
        n = self.headers.get("Content-Length", "")
        if not n.isdigit():
            raise Fail(411, "length")
        n = int(n)
        if n > limit:
            self.close_connection = True       # the rest of the body is never read
            raise Fail(413, "large")
        data = b""
        while len(data) < n:
            chunk = self.rfile.read(n - len(data))
            if not chunk:
                raise Fail(400, "short")
            data += chunk
        return data

    def json_body(self):
        try:
            b = json.loads(self.body(MAX_SMALL).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise Fail(400, "json")
        if not isinstance(b, dict):
            raise Fail(400, "json")
        return b

    def route(self):
        R = RELAY
        url = urlsplit(self.path)
        parts = [p for p in url.path.split("/") if p]
        method = self.command
        if method == "OPTIONS":
            return self.send(204)
        if parts == ["v1", "hello"] and method == "GET":
            return self.send(200, {"relay": "lakay", "v": 1, "build": VERSION, "claimed": bool(R.state.get("store"))})
        if len(parts) < 3 or parts[0] != "v1" or not RE_STORE.match(parts[1]):
            raise Fail(404, "path")
        store, rest = parts[1], parts[2:]
        mine = R.state.get("store") == store
        if rest == ["hello"] and method == "GET":
            return self.send(200, {"relay": "lakay", "v": 1, "build": VERSION, "claimed": bool(R.state.get("store")), "store": mine})
        if rest == ["owner"] and method == "PUT":
            return self.send(200, R.claim(store, self.json_body(), self.headers.get("Authorization")))
        if not R.state.get("store"):
            raise Fail(403, "unclaimed")
        if not mine:
            raise Fail(404, "store")
        if rest == ["devices"] and method == "GET":
            R.check_owner(self.headers.get("Authorization"))
            return self.send(200, R.list_devices())
        if len(rest) == 2 and rest[0] == "devices" and RE_DEVICE.match(rest[1]) and method in ("PUT", "DELETE"):
            R.check_owner(self.headers.get("Authorization"))
            if method == "PUT":
                return self.send(200, R.put_device(rest[1], self.json_body()))
            return self.send(200, R.close_device(rest[1]))
        if rest == ["bundles"] and method == "POST":
            dev = R.check_device(self.headers.get("Authorization"))
            return self.send(200, R.leave(store, dev, self.body(MAX_BUNDLE)))
        if rest == ["bundles"] and method == "GET":
            dev = R.check_device(self.headers.get("Authorization"))
            q = parse_qs(url.query)
            a = (q.get("after") or ["0"])[0]
            if not a.isdigit():
                raise Fail(400, "after")
            return self.send(200, R.take(dev, int(a)))
        raise Fail(404, "path")

    def handle_any(self):
        try:
            self.route()
        except Fail as f:
            self.send(f.status, {"error": f.code})
        except (ConnectionError, TimeoutError, ssl.SSLError):
            self.close_connection = True
        except Exception as e:                  # never a page of Python's own: a short answer, and the log
            log(self.client_address[0], self.command, "-", "500 " + type(e).__name__)
            try:
                self.send(500, {"error": "relay"})
            except Exception:
                self.close_connection = True

    do_GET = do_POST = do_PUT = do_DELETE = do_OPTIONS = handle_any


def make_certificate(data, addresses):
    """The owner's own certificate authority (made once, kept in DIR/tls) and a certificate for the relay's addresses,
    made with the openssl program. Apple's devices accept a server certificate of at most 825 days; this one lasts 800."""
    for a in addresses:
        if not RE_ADDRESS.match(a):
            sys.exit("Not an address: %r" % a)
    exe = shutil.which("openssl")
    if not exe:
        sys.exit("The openssl program was not found.")
    tls = os.path.join(data, "tls")
    os.makedirs(tls, exist_ok=True)
    ca_key, ca_pem = os.path.join(tls, "authority.key"), os.path.join(tls, "lakay-relay-authority.pem")

    def run(*args):
        r = subprocess.run([exe] + list(args), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode != 0:
            sys.exit("openssl stopped: " + r.stderr.decode("utf-8", "replace")[-400:])

    with tempfile.TemporaryDirectory() as tmp:
        if not (os.path.exists(ca_key) and os.path.exists(ca_pem)):
            ca_cnf = os.path.join(tmp, "ca.cnf")
            with open(ca_cnf, "w") as f:
                f.write("[req]\ndistinguished_name=dn\nprompt=no\nx509_extensions=v3\n[dn]\nCN=Lakay Relay authority\n"
                        "[v3]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n")
            run("req", "-x509", "-newkey", "rsa:3072", "-nodes", "-sha256", "-days", "3650", "-config", ca_cnf,
                "-keyout", ca_key, "-out", ca_pem)
            os.chmod(ca_key, 0o600)
        alt = []
        for i, a in enumerate(addresses):
            ip = re.match(r"^[0-9.]+$", a) or ":" in a
            alt.append(("IP.%d" % (i + 1) if ip else "DNS.%d" % (i + 1)) + " = " + a)
        ext = os.path.join(tmp, "ext.cnf")
        with open(ext, "w") as f:
            f.write("[v3]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\n"
                    "extendedKeyUsage=serverAuth\nsubjectAltName=@alt\n[alt]\n" + "\n".join(alt) + "\n")
        key, csr, pem = os.path.join(tls, "relay.key"), os.path.join(tmp, "relay.csr"), os.path.join(tls, "relay.pem")
        run("req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256", "-subj", "/CN=" + addresses[0], "-keyout", key, "-out", csr)
        os.chmod(key, 0o600)
        run("x509", "-req", "-in", csr, "-CA", ca_pem, "-CAkey", ca_key, "-CAcreateserial", "-days", "800", "-sha256",
            "-extfile", ext, "-extensions", "v3", "-out", pem)
    print("The relay's certificate: %s (key %s)" % (pem, key))
    print("Install this on each device, once: %s" % ca_pem)
    return pem, key


def main(argv=None):
    global RELAY
    ap = argparse.ArgumentParser(prog="lakay_relay", description="Lakay Relay: the store's own mailbox for sealed changes.")
    ap.add_argument("--data", default=default_data(), help="the relay's folder")
    ap.add_argument("--listen", default="127.0.0.1", help="the address to answer on (the private network's)")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--cert", help="the relay's certificate (https)")
    ap.add_argument("--key", help="the certificate's private key")
    ap.add_argument("--claim", action="store_true", help="print the claim code and stop")
    ap.add_argument("--make-certificate", nargs="+", metavar="ADDRESS", help="make the relay's certificate and stop")
    a = ap.parse_args(argv)
    os.makedirs(a.data, exist_ok=True)
    RELAY = Relay(a.data)
    if a.make_certificate:
        make_certificate(a.data, a.make_certificate)
        return 0
    if a.claim:
        if RELAY.state.get("store"):
            print("This relay is claimed (since %s)." % RELAY.state.get("claimed"))
        else:
            print("The claim code: %s" % (RELAY.claim_code() or grouped(RELAY.new_claim())))
        return 0
    srv = Server((a.listen, a.port), Handler)
    scheme = "http"
    if a.cert or a.key:
        if not (a.cert and a.key):
            sys.exit("--cert and --key go together.")
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(a.cert, a.key)
        srv.ssl_ctx = ctx
        scheme = "https"
    print("Lakay Relay %s: answering at %s://%s:%d; its folder: %s" % (VERSION, scheme, a.listen, srv.server_address[1], a.data), flush=True)
    if not RELAY.state.get("store"):
        print("Not claimed yet. The claim code is in %s" % RELAY.path("claim.txt"), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
