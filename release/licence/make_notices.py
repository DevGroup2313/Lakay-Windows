#!/usr/bin/env python3
# LAKAY  |  Copyright (c) 2026 Yannie D. Forest. All rights reserved.
# NO LICENCE IS GRANTED. See LICENCE.txt.
"""THIRD_PARTY_NOTICES.txt: what Lakay's programs carry that others made, and the texts of their licences.

    python3 -I release/licence/make_notices.py          writes THIRD_PARTY_NOTICES.txt at the top of the repository
    python3 -I release/licence/make_notices.py check    fails if THIRD_PARTY_NOTICES.txt differs from what this script writes

The licences' texts in third_party/ were taken on 21 November 2026 from the packages themselves: each wheel's own
licence file on PyPI (pywebview 6.2.1, pythonnet 3.2.0, clr_loader 0.3.1, cffi 2.1.1, pycparser 3.12, bottle 0.13.4,
typing_extensions 4.16.0, pyobjc 13.0, PyInstaller 6.22.3's COPYING.txt), Microsoft's WebView2 SDK package on NuGet
(Microsoft.Web.WebView2 1.0.4314.35, LICENSE.txt), Inno Setup's licence (jrsoftware.org/files/is/license.txt) and
Python 3.12's LICENSE.txt (the same text as typing_extensions'). proxy_tools 0.1.0 declares the MIT License and carries
no licence file, so its entry gives the MIT License's own words with no copyright line.

What the programs carry comes from their recipes: desktop/windows/emporium.spec and desktop/mac/emporium-mac.spec
(pywebview, clr_loader and pythonnet collected whole), the workflows' pip lines (PyInstaller 6.22.3, pywebview 6.2.1,
pythonnet 3.2.0 on Windows), and their dependencies. When a recipe changes what a program carries, change COMPONENTS
and the texts with it. The page itself carries nothing made by others, and build.py puts this file in it, so the
notices travel inside every program, and stop the build if this file is not what this script writes.
"""
import os
import sys
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TEXTS = os.path.join(HERE, "third_party")
OUT = os.path.join(ROOT, "THIRD_PARTY_NOTICES.txt")

# (name, what it is, its licence, where: W for the Windows program, M for the Mac programs, R for Lakay Relay once packaged, its text)
COMPONENTS = [
    ("Python 3.12", "the language the programs run on, from python.org", "Python Software Foundation License", "WMR", "python.txt"),
    ("PyInstaller 6.22.3", "packs each program; its bootloader starts it", "GNU GPL 2.0 or later with the Bootloader Exception; its run-time hooks and modules, Apache License 2.0", "WMR", "pyinstaller.txt"),
    ("pywebview 6.2.1", "the program's window, showing Lakay's page", "BSD 3-Clause License", "WM", "pywebview.txt"),
    ("Microsoft WebView2 SDK files", "carried by pywebview on Windows: Microsoft.Web.WebView2.Core.dll, Microsoft.Web.WebView2.WinForms.dll and WebView2Loader.dll", "Microsoft's licence for them (BSD-style)", "W", "webview2.txt"),
    ("pythonnet 3.2.0", "lets the Windows window reach .NET", "MIT License", "W", "pythonnet.txt"),
    ("clr_loader", "loads .NET for pythonnet", "MIT License", "W", "clr_loader.txt"),
    ("cffi", "used by clr_loader", "MIT No Attribution License", "W", "cffi.txt"),
    ("pycparser", "used by cffi", "BSD 3-Clause License", "W", "pycparser.txt"),
    ("bottle", "used by pywebview", "MIT License", "WM", "bottle.txt"),
    ("proxy_tools", "used by pywebview", "MIT License", "WM", "proxy_tools.txt"),
    ("typing_extensions", "used by pywebview", "Python Software Foundation License (the same text as Python's, below)", "WM", None),
    ("PyObjC", "pyobjc-core and its Cocoa, Quartz, WebKit, Security and UniformTypeIdentifiers frameworks, the Mac window's way to macOS", "MIT License", "M", "pyobjc.txt"),
    ("Inno Setup", "makes the Windows installer; its setup program is Inno Setup's", "Inno Setup License", "W", "innosetup.txt"),
]


def wrap(s):
    return "\n".join(textwrap.fill(p, width=76, break_long_words=False, break_on_hyphens=False) for p in s.split("\n"))


def render():
    out = ["LAKAY: THIRD-PARTY NOTICES", "==========================", ""]
    out.append(wrap("Lakay itself is the work of Yannie D. Forest; see LICENCE.txt. Lakay's page (the app, and the web app) carries no software, fonts or pictures made by others. Lakay's programs for Windows and the Mac carry the open-source software listed here, each under its own licence, whose texts follow. Lakay Relay, once packaged as a program, carries Python and PyInstaller too. The apps for the iPhone, the iPad and the Fire tablet carry nothing made by others: they use only the devices' own parts."))
    out += ["", "1. WHAT EACH PROGRAM CARRIES", ""]
    for where, title in (("W", "The Windows program and its installer:"), ("M", "The Mac programs (Apple silicon and Intel):"), ("R", "Lakay Relay, once packaged as a program:")):
        out.append(title)
        for name, what, lic, places, _ in COMPONENTS:
            if where in places:
                out.append(textwrap.fill("- %s, %s. %s." % (name, what, lic), width=76, subsequent_indent="  ", break_long_words=False, break_on_hyphens=False))
        out.append("")
    out.append(wrap("Python's own builds for Windows and the Mac also carry libraries made by others, such as OpenSSL, libffi, zlib and expat, each under its own licence. Python's documentation lists them with their licences, under Licenses and Acknowledgements for Incorporated Software: https://docs.python.org/3.12/license.html"))
    out += ["", "2. WHAT THE DEVICES PROVIDE", ""]
    out.append(wrap("The programs show Lakay's page in the device's own web view: the Microsoft Edge WebView2 Runtime on Windows, WebKit on the Mac, the iPhone and the iPad, and the Android web view on the Fire tablet. These are parts of the devices' own systems, under their makers' terms, and are not carried by Lakay (on Windows, Lakay carries only the WebView2 SDK files named above, which reach the Runtime). The emoji are the device's own."))
    out += ["", "3. THE LICENCES' TEXTS", ""]
    out.append(wrap("Each text is given as its package gives it. Nothing here gives any right in Lakay itself. Everything in Lakay that is not listed here is the work of Yannie D. Forest (LICENCE.txt, section 13)."))
    seen = set()
    for name, what, lic, places, fn in COMPONENTS:
        if not fn or fn in seen:
            continue
        seen.add(fn)
        with open(os.path.join(TEXTS, fn), encoding="utf-8") as f:
            text = f.read().rstrip("\n")
        also = " (also typing_extensions)" if fn == "python.txt" else ""
        out += ["", "-" * 76, name + also, "-" * 76, "", text]
    return "\n".join(out).rstrip("\n") + "\n"


if __name__ == "__main__":
    text = render()
    if sys.argv[1:] == ["check"]:
        try:
            with open(OUT, encoding="utf-8") as f:
                same = f.read() == text
        except FileNotFoundError:
            same = False
        if not same:
            print("differs: " + OUT)
        sys.exit(0 if same else 1)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("wrote %s (%d lines, %d bytes)" % (OUT, text.count("\n"), len(text.encode("utf-8"))))
