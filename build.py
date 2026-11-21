#!/usr/bin/env python3
# LAKAY | Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.
"""Builds app/Lakay.html, the whole app in one file, from src/.

    python3 build.py            writes app/Lakay.html and app/Lakay.html.sha256

The page refuses every script but its own: its Content Security Policy names the SHA-256 of the one script it carries.
The build stops if the code reaches for anything that would weaken that (eval, new Function, innerHTML, document.write,
a script or a style from the network)."""
import base64, glob, hashlib, json, os, re, shutil, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")


def main():
    info = json.load(open(os.path.join(HERE, "build.json"), encoding="utf-8"))
    build, date = str(info["build"]), info["date"]
    parts = sorted(glob.glob(os.path.join(SRC, "js", "*.js")))
    js = "\n".join(open(p, encoding="utf-8").read() for p in parts)
    css = "\n".join(open(p, encoding="utf-8").read() for p in sorted(glob.glob(os.path.join(SRC, "css", "*.css"))))
    page = open(os.path.join(SRC, "lakay.html"), encoding="utf-8").read()

    # what the code must never do
    banned = [(r"\beval\s*\(", "eval"), (r"new\s+Function\s*\(", "new Function"), (r"\.innerHTML\b", "innerHTML"),
              (r"\.outerHTML\s*=", "outerHTML"), (r"insertAdjacentHTML", "insertAdjacentHTML"), (r"document\.write", "document.write"),
              (r"setTimeout\s*\(\s*['\"]", "setTimeout with a string"), (r"setInterval\s*\(\s*['\"]", "setInterval with a string")]
    for rx, what in banned:
        m = re.search(rx, js)
        if m:
            sys.exit("build stopped: the code uses %s near %r" % (what, js[max(0, m.start() - 60):m.end() + 20]))
    for u in re.findall(r"https?://[^\s\"')]+", js + css):
        if not u.startswith("http://www.w3.org/2000/svg"):
            sys.exit("build stopped: an address from outside: %s" % u)
    if "claude.ai" in js or "claudeusercontent" in js:
        sys.exit("build stopped: a script that does not belong")

    js = js.replace('"/*@@BUILD@@*/"', json.dumps(build)).replace('"/*@@DATE@@*/"', json.dumps(date))
    # the mark: the Spiral, its layers at depth (a coin with an edge, shadows on the plate, a shell with sides), by day and by night (drawn once, kept in src/brand/lakay-mark)
    MARK = os.path.join(SRC, "brand", "lakay-mark")
    def b64png(name):
        with open(os.path.join(MARK, name), "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
    ROLES = ["edge", "plate", "engr", "hshadow", "sshadow", "halo", "sside", "shell", "lattice", "pearl", "sparks"]
    mark = {th: {r: b64png("spiral-%s-%s.png" % (th, r)) for r in ROLES} for th in ("day", "night")}
    js = js.replace('"/*@@MARK@@*/"', json.dumps(mark))
    # Ownership, terms and privacy (Build 26, src/js/31-terms.js): the licence (LICENCE.txt, made by
    # release/licence/make_licence.py), the terms and the privacy notice (src/terms/terms.json, in English, French and Kreyòl)
    # and the notices of others' software (THIRD_PARTY_NOTICES.txt) go into the page as text. They go in after the checks
    # above, because the notices name the web pages of the licences they quote: the page shows those addresses and never
    # reaches them (its policy is unchanged). The same terms are written beside the licence as TERMS.txt and PRIVACY.txt.
    licence, notices, terms = terms_parts(info)
    for name, val in (("TERMS", terms), ("LICENCE", licence), ("NOTICES", notices)):
        ph = '"@@%s@@"' % name
        if js.count(ph) != 1:
            sys.exit("build stopped: the place for %s was not found in the code" % name)
        js = js.replace(ph, js_text(val))
    write_terms_texts(terms)
    if "@@" in js:
        sys.exit("build stopped: a placeholder was left in the code")
    # the logo alone for the tab, and its square tile for home screen shortcuts (both made by release/icons.py)
    favicon = b64png("web-coin-96.png")
    tile = b64png("web-tile-192.png")
    touch = b64png("web-tile-180.png")
    if "</script" in js.lower():
        sys.exit("build stopped: the code contains a closing script tag")
    digest = base64.b64encode(hashlib.sha256(js.encode("utf-8")).digest()).decode("ascii")
    out = (page.replace("@@CSS@@", css).replace("@@FAVICON@@", favicon).replace("@@ICON_TILE@@", tile).replace("@@TOUCH_ICON@@", touch).replace("@@BUILD@@", build).replace("@@DATE@@", date)
           .replace("@@SCRIPT_HASH@@", "sha256-" + digest).replace("@@JS@@", js))
    # The relays (Build 26): the addresses of Lakay Relay on the owner's own Mac minis, from build.json, are the only places
    # the page may reach (connect-src), in the apps and the web app alike. With none, nothing is reached, as before. Each
    # is https, or plain http on this very computer (for tests). The page reads them back from its own policy.
    relays = info.get("relays") or []
    if not isinstance(relays, list):
        sys.exit("build stopped: relays in build.json must be a list")
    for r in relays:
        if not re.match(r"^https://([A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?$|^http://(127\.0\.0\.1|localhost)(:[0-9]{1,5})?$", str(r)):
            sys.exit("build stopped: not a relay's address: %r" % (r,))
    if relays:
        if out.count("connect-src 'none'") != 1:
            sys.exit("build stopped: the policy's connect-src was not found")
        out = out.replace("connect-src 'none'", "connect-src " + " ".join(relays))
    os.makedirs(os.path.join(HERE, "app"), exist_ok=True)
    path = os.path.join(HERE, "app", "Lakay.html")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    sha = hashlib.sha256(out.encode("utf-8")).hexdigest()
    with open(path + ".sha256", "w", encoding="ascii", newline="\n") as f:
        f.write("%s  Lakay.html\n" % sha)
    print("Lakay build %s (%s): app/Lakay.html, %d bytes, SHA-256 %s" % (build, date, len(out.encode("utf-8")), sha))

    # The web app (Build 14): the same page, for a website. Its address bar and tabs show the logo, and "Add to Home
    # Screen" (iPhone, iPad, Android) or "Add to Dock" (a Mac) and a browser's "Install" make it an app with the logo.
    # The page and its code are the same; only its policy names three more things, each from its own site only: the
    # pictures beside it (img-src 'self'), its manifest (manifest-src 'self') and its service worker (worker-src 'self'),
    # which keeps the page, the manifest and the icons so that Lakay opens with no connection. Scripts stay limited to
    # the page's own, named by its hash; nothing reaches anywhere else (connect-src 'none').
    web = out
    for old_s, new_s in (("img-src data: blob:;", "img-src data: blob: 'self';"), ("manifest-src 'none';", "manifest-src 'self';"), ("worker-src 'none';", "worker-src 'self';"),
                         ('<link rel="apple-touch-icon" sizes="180x180" href="' + touch + '">', '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">'),
                         ('<meta name="apple-mobile-web-app-title" content="Lakay">',
                          '<meta name="apple-mobile-web-app-title" content="Lakay">\n<link rel="manifest" href="manifest.json">\n'
                          '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
                          '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<meta name="lakay-web" content="1">')):
        if web.count(old_s) != 1:
            sys.exit("build stopped: the web page could not be made (%s)" % old_s[:40])
        web = web.replace(old_s, new_s)
    WEB = os.path.join(HERE, "web")
    if os.path.isdir(WEB):
        shutil.rmtree(WEB)
    os.makedirs(WEB)
    with open(os.path.join(WEB, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(web)
    icons = {"apple-touch-icon.png": "web-tile-180.png", "icon-192.png": "web-coin-192.png", "icon-512.png": "web-coin-512.png",
             "icon-maskable-192.png": "web-maskable-192.png", "icon-maskable-512.png": "web-maskable-512.png", "favicon.ico": "web-favicon.ico"}
    for dst, src in icons.items():
        shutil.copyfile(os.path.join(MARK, src), os.path.join(WEB, dst))
    manifest = {
        "name": "Lakay", "short_name": "Lakay", "description": "The store's own books: the register, inventory, reports and the team, sealed on each device.",
        "id": "./", "start_url": "./", "scope": "./", "display": "standalone", "orientation": "any", "lang": "en",
        "background_color": "#f5f4f8", "theme_color": "#f5f4f8",
        "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                  {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                  {"src": "icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
                  {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    # manifest.json, not .webmanifest (Build 15): every web host serves .json with a type browsers accept
    with open(os.path.join(WEB, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False); f.write("\n")
    kept = ["./", "index.html", "manifest.json"] + sorted(icons)
    with open(os.path.join(SRC, "web", "sw.js"), encoding="utf-8") as f:
        sw = f.read().replace('"/*@@CACHE@@*/"', json.dumps("lakay-web-" + build)).replace('"/*@@FILES@@*/"', json.dumps(kept))
    if "@@" in sw:
        sys.exit("build stopped: a placeholder was left in the service worker")
    with open(os.path.join(WEB, "sw.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write(sw)
    wsha = hashlib.sha256(web.encode("utf-8")).hexdigest()
    with open(os.path.join(WEB, "index.html.sha256"), "w", encoding="ascii", newline="\n") as f:
        f.write("%s  index.html\n" % wsha)
    print("Lakay web app %s: web/ (index.html %d bytes, SHA-256 %s; manifest, service worker, %d icons)" % (build, len(web.encode("utf-8")), wsha, len(icons)))

    # The web app, ready to upload to the owner's own website (Build 15): builds/Lakay-Web.zip holds a "lakay" folder
    # and a note on putting it online. The same input always makes the same zip (fixed times), so a build that changes
    # nothing changes nothing here.
    with open(os.path.join(HERE, "release", "readme", "READ ME FIRST (web).txt"), encoding="utf-8") as f:
        note = f.read().replace("@@BUILD@@", build).replace("@@DATE@@", date).replace("@@SHA@@", wsha)
    if "@@" in note:
        sys.exit("build stopped: a placeholder was left in the web app's note")
    os.makedirs(os.path.join(HERE, "builds"), exist_ok=True)
    zpath = os.path.join(HERE, "builds", "Lakay-Web.zip")
    stamp = tuple(int(x) for x in date.split("-")) + (12, 0, 0)
    def put(z, name, data):
        zi = zipfile.ZipInfo(name, date_time=stamp)
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        z.writestr(zi, data, compresslevel=9)
    with zipfile.ZipFile(zpath, "w") as z:
        put(z, "READ ME FIRST (web).txt", note.replace("\n", "\r\n").encode("utf-8"))
        for name in ["index.html", "manifest.json", "sw.js"] + sorted(icons):
            with open(os.path.join(WEB, name), "rb") as f:
                put(z, "lakay/" + name, f.read())
    print("Lakay web app %s: builds/Lakay-Web.zip, %d bytes, ready to upload" % (build, os.path.getsize(zpath)))


def js_text(value):
    """A value as a JavaScript literal that is safe inside the page's one script: no "<" (so no closing tag and no comment can
    begin), and the two line separators that older engines refuse inside a string, escaped."""
    s = json.dumps(value, ensure_ascii=False)
    return s.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def terms_parts(info):
    """The licence, the notices and the terms, checked: the licence is what its script writes; the terms have every text in
    the three languages, with the same blanks ({contact}, {age}) in each; their plain words of the licence are the licence's own
    IN PLAIN WORDS, line for line; and nothing in them could become code or a remote script."""
    sys.dont_write_bytecode = True
    sys.path.insert(0, os.path.join(HERE, "release", "licence"))
    import make_licence
    with open(os.path.join(HERE, "LICENCE.txt"), encoding="utf-8") as f:
        licence = f.read()
    if licence != make_licence.render("lakay"):
        sys.exit("build stopped: LICENCE.txt is not what release/licence/make_licence.py writes (run it, then build again)")
    with open(os.path.join(HERE, "THIRD_PARTY_NOTICES.txt"), encoding="utf-8") as f:
        notices = f.read()
    with open(os.path.join(SRC, "terms", "terms.json"), encoding="utf-8") as f:
        terms = json.load(f)
    contact = str(info.get("contact") or "").strip()
    if len(contact) > 200 or re.search(r"[<>\"\\]", contact):
        sys.exit("build stopped: the contact in build.json is not plain words, an email address or a web page")
    terms["contact"] = contact

    def blanks(s):
        return sorted(re.findall(r"\{[a-z]+\}", s))
    def texts(o, where):
        if not (isinstance(o, dict) and all(isinstance(o.get(l), str) and o[l].strip() for l in ("en", "fr", "ht"))):
            sys.exit("build stopped: the terms miss a language at %s" % where)
        for l in ("fr", "ht"):
            if blanks(o[l]) != blanks(o["en"]):
                sys.exit("build stopped: the terms' blanks differ in %s at %s" % (l, where))
        if set(blanks(o["en"])) - {"{contact}", "{age}"}:
            sys.exit("build stopped: an unknown blank in the terms at %s" % where)
    texts(terms.get("version"), "version")
    for part, keys in (("short", ("t", "b")), ("terms", ("h", "b")), ("privacy", ("h", "b"))):
        if not terms.get(part):
            sys.exit("build stopped: the terms have no %s" % part)
        for i, x in enumerate(terms[part]):
            for k in keys:
                texts(x.get(k), "%s %d %s" % (part, i + 1, k))
    for i, x in enumerate(terms.get("licence") or []):
        texts(x, "licence %d" % (i + 1))
    plain, on = [], False
    for line in licence.split("\n"):
        if line.strip() == "IN PLAIN WORDS":
            on = True
        elif on and line.startswith("  \u2022 "):
            plain.append(line[4:].strip())
        elif on and line.startswith("    ") and plain:
            plain[-1] += " " + line.strip()
        elif on and plain and line.strip():
            break
    if plain != [x["en"] for x in terms.get("licence") or []]:
        sys.exit("build stopped: the terms' plain words of the licence are not the licence's own IN PLAIN WORDS")
    every = json.dumps(terms, ensure_ascii=False) + licence + notices
    if re.search(r"<\s*/?\s*script", every, re.I) or "claude.ai" in every or "claudeusercontent" in every or "@@" in every:
        sys.exit("build stopped: the terms, the licence or the notices hold something that does not belong")
    return licence, notices, terms


def write_terms_texts(terms):
    """TERMS.txt and PRIVACY.txt beside LICENCE.txt, laid out as Ingenium's: the name, the title, the version and the maker, a
    rule, then each section, its heading in capitals and its words wrapped at 76 characters. In English, which applies."""
    import textwrap
    contact = terms.get("contact") or "the contact shown in Lakay, in About, Terms and privacy"
    def fill(s):
        s = s.replace("{contact}", contact).replace("{age}", "the age the lawyer sets")
        return textwrap.fill(s, width=76, break_long_words=False, break_on_hyphens=False)
    for name, title, part in (("TERMS.txt", "TERMS OF USE", "terms"), ("PRIVACY.txt", "PRIVACY NOTICE", "privacy")):
        out = ["LAKAY", title, "%s. Made by Yannie D. Forest." % terms["version"]["en"], "", "=" * 76, ""]
        for x in terms[part]:
            out += [x["h"]["en"].upper(), "", fill(x["b"]["en"]), ""]
        out += ["=" * 76, fill("In Lakay, these texts are also given in French and Kreyòl. If a translation ever differs from this English text, the English applies. Copyright (c) 2026 Yannie D. Forest. All rights reserved. See LICENCE.txt.")]
        text = "\n".join(out).rstrip("\n") + "\n"
        if max(len(l) for l in text.split("\n")) > 76:
            sys.exit("build stopped: a line of %s is longer than 76 characters" % name)
        with open(os.path.join(HERE, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(text)


if __name__ == "__main__":
    main()
