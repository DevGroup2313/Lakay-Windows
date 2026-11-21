# Lakay for the Mac

**Build @@BUILD@@, @@DATE@@.** Lakay is the store's own app: inventory, the register and reports. It works with no connection, and it keeps the store's books sealed on each device.

## Download

| The ready-made app | For | |
| --- | --- | --- |
| [**Lakay-Mac-Apple-Silicon.zip**](builds/Lakay-Mac-Apple-Silicon.zip) | Macs with Apple silicon (M1 and later), such as the Mac mini | [Download now](https://github.com/DevGroup2313/Lakay-Mac/releases/latest/download/Lakay-Mac-Apple-Silicon.zip) |
| [**Lakay-Mac-Intel.zip**](builds/Lakay-Mac-Intel.zip) | Macs with an Intel processor, such as a 2019 MacBook Pro | [Download now](https://github.com/DevGroup2313/Lakay-Mac/releases/latest/download/Lakay-Mac-Intel.zip) |

Unzip it, drag Lakay to Applications, and follow [READ ME FIRST (Mac).txt](READ%20ME%20FIRST%20%28Mac%29.txt) for the first open. The same files are on the Releases page, "Lakay for Mac (latest build)".

## What is here

- `builds/`: the ready-made Mac apps. Each new build replaces them.
- `READ ME FIRST (Mac).txt`: installing, the first open, updating, and where the books are kept.
- The build kit, the files GitHub builds from: `app/Lakay.html` (Lakay itself), `desktop/` (the window program and its Mac recipe), `release/publish.py`, and `.github/workflows/mac.yml`. A push builds both apps again on GitHub's Macs, opens each once, and puts them here and on the Releases page.
- `LICENCE.txt`: the owner's licence (Copyright (c) 2026 Yannie D. Forest; all rights reserved). `TERMS.txt` and `PRIVACY.txt`: Lakay's Terms of use and Privacy notice, which each device agrees to once, in Lakay itself. `THIRD_PARTY_NOTICES.txt`: the software made by others that the programs carry. `BUILD_INFO.txt`: the build, and the SHA-256 fingerprints of the app and of the web app's page.

Lakay's source and its notes are in Lakay-Windows. Lakay for iPhone, iPad and the Fire tablet is in Lakay-Apps.

Copyright (c) 2026 Yannie D. Forest. All rights reserved.
