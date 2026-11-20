# Lakay: the relay on the Mac mini (stage 3, a plan for the owner's approval)

Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.

Written 20 November 2026. Nothing in it is built yet. It follows the plan the owner approved on 15 November 2026
(`05-DEVICES-IN-STEP.md`) and the owner's answers of 20 November 2026: the Mac mini will be on and connected day and
night, and away from the store the phone may see the books and change them.

## What stage 3 adds, in short

- **A small program on the Mac mini, the relay.** It is a mailbox for sealed changes. It never holds the books, the
  Store Key or anyone's password, and it cannot read what it keeps.
- **The exchange, done by itself.** Whenever a device can reach the relay, it leaves its new changes there and takes the
  other devices' changes: when Lakay opens, every two minutes while it is open, and soon after each change. The sealed
  files of stage 2 still work, for a device with no connection.
- **A small sign in the top bar.** "In step a moment ago"; "Last in step at 14:05"; or "The relay cannot be reached:
  this device keeps working and will catch up."
- **Stage 4, the phone from anywhere,** is then the same exchange from the iPhone, wherever it is.

## How the devices would reach the Mac mini (the owner's choice)

1. **A private network app on each device (Tailscale is one).** Each device signs in to the owner's own private
   network, and only those devices can reach the relay. Nothing at the store is opened to the internet.
   - Facts checked on 20 November 2026; they may change. Tailscale's free plan is for non-commercial use only, so a
     store would need its Standard plan, listed at US$8 per user per month. Tailscale does not limit the number of
     devices. If every device of the store signs in with the owner's one account, that may count as one user. I am
     not certain how Tailscale counts a counter computer that the staff use, so this should be checked with Tailscale
     before choosing.
   - On the Fire tablet, Tailscale's current page says it is installed from Tailscale's own download page, not from the
     Amazon Appstore, and that most Fire tablets released after 2018 are supported.
   - On the Mac mini, plan on Tailscale running while a person is signed in. Tailscale's pages disagree on whether it
     can run on macOS with no one signed in: one says this is not yet supported, another says its App Store version
     can.
   - Tailscale can give the Mac mini a secure (https) address inside the private network. The Mac mini's name is then
     written in a public register of certificates, so it should have a plain name (for example "relay"), never the
     store's or a person's name.
2. **Cloudflare Tunnel.** Nothing is installed on the devices. The Mac mini opens a tunnel to Cloudflare, and the relay
   gets a secure address on the owner's own domain. The relay can then be reached from the whole internet, so it must
   turn away anyone without the store's keys (it would in any case). Cloudflare carries only sealed changes. Cloudflare's
   page says the tunnel can start with the Mac mini itself, before anyone signs in. As far as I know, the domain's
   addresses would need to be managed at Cloudflare. I could not confirm Cloudflare's terms for business use; they
   should be checked before choosing it.
3. **At the store only.** The relay is reached on the store's own network, with no third party at all. A device away
   from the store catches up when it comes back. This does not meet the owner's wish to change the books from anywhere.

**My recommendation: the first, with Tailscale's Standard plan.** Nothing at the store becomes reachable from the
internet, and only the owner's own devices can reach the relay at all. Its cost (about US$8 a month, to be confirmed)
is the price of that.

## What runs on the Mac mini

- **Lakay Relay**, a small program of its own, made with the Mac apps (the Lakay-Mac repository), and started by macOS
  when the owner signs in. It listens only on the Mac mini itself: the private network app (or the tunnel) is the only
  way in. It keeps the sealed changes in one folder, for 30 days or until every device has taken them, and nothing
  else.
- **Lakay itself need not run on the Mac mini.** As recommended, the Mac mini is the relay only, without the books.
- **What the owner does once:** install the private network app and sign in; install Lakay Relay; in System Settings,
  keep the Mac mini from sleeping; give the Mac mini a plain name. After a restart, someone signs in on the Mac mini.
  If FileVault is on, macOS asks for the password before anything starts, so the relay waits until then; the devices
  keep working and catch up later.

## How Lakay would talk to the relay (the one change to its security policy)

Today every build forbids the page to connect anywhere (`connect-src 'none'`). The relay needs one opening. There are
two ways to make it:

1. **Open the policy to the relay's one address, and to nothing else** (recommended). The address is written into the
   builds. It is public in any case once a certificate is issued, and through the private network only the store's
   devices can reach it. Every app, the web app included, then works the same way. If the address ever changes, a new
   build is made.
2. **Keep the page closed, and let each app's own shell carry the exchange.** The Windows and Mac program, the iPhone
   and iPad app and the Fire app each get a small bridge to the relay. It is more work, with three shells to change and
   test, and the web app would stay out of step.

## Who may reach the relay

- **Each device has its own key to the relay.** Only the owner, with the owner's password, connects a device to the
  relay (in Settings, Devices in step). The relay keeps only a fingerprint of each key, and checks that a device leaves
  changes only in its own name.
- **Removing a device also closes its key at the relay.** A lost or stolen device can then no longer fetch new changes,
  even if someone opens it with a password. Its own copy stays sealed, as before.
- **What the relay sees:** which device left changes, when, and how large they were. Never what they say.

## What the owner would see

- In Settings, Devices in step: "The relay", with its address, a key to connect this device, and each device's
  connection.
- The sign in the top bar.
- The sealed files of stage 2, still there for a device with no connection.

## Honest limits

- A device whose clock runs ahead wins clashes it should not, as before. Each clash is reported.
- The iPhone app installed with a free Apple ID must be installed again every 7 days (the books stay). The web app,
  added to the Home Screen from the owner's website, does not need this. I am not certain of Safari's present rules
  for keeping a website's data when it goes unused for weeks; a web app on the Home Screen that is used regularly
  should keep it, and a device in step can always join again.
- Changes kept for a device that stays away more than 30 days are let go; that device then joins again.
- Anyone who holds the Store Key can write lines, as in stages 1 and 2. The relay's keys stop a removed device from
  fetching new changes, but they do not change the Store Key.
- No program is proof against every attack. An independent security review of the relay and the exchange is
  recommended before the store relies on it.

## Questions for the owner

1. Which way should the devices reach the Mac mini: a private network app such as Tailscale (recommended; about US$8 a
   month for a business), Cloudflare Tunnel, or at the store only?
2. Should Lakay's security policy open to the relay's one address (recommended), or should each app's shell carry the
   exchange instead?
3. On your iPhone, do you use the installed app (from Sideloadly) or the web app from your website? If the web app, it
   must be in step too, which the first way of question 2 allows.
4. On the Mac mini, is FileVault on? Is the Mac mini also used by someone, or only as a server?
5. The devices: do you agree to begin with the counter's Windows computer and your iPhone, with the Mac mini as the relay
   only?

## After approval

- **Build 26:** the relay program and the exchange, tested here with simulated devices and a relay, and the relay
  tested on GitHub's Mac; the screens shown to the owner before release.
- **Then the owner sets it up on the Mac mini,** with the steps written out, and the first real exchange is checked
  together.

## Sources consulted (20 November 2026)

- Tailscale pricing: https://tailscale.com/pricing
- Tailscale, free plans and discounts: https://tailscale.com/docs/account/manage-plans/free-plans-discounts
- Tailscale, pricing update of 8 April 2026: https://tailscale.com/blog/pricing-v4
- Tailscale on Amazon Fire devices: https://tailscale.com/docs/install/amazon-fire
- Tailscale, running when no one is signed in: https://tailscale.com/docs/how-to/run-unattended
- Tailscale, HTTPS certificates: https://tailscale.com/docs/how-to/set-up-https-certificates
- Cloudflare Tunnel as a service on macOS: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/local-management/as-a-service/macos

## Appendix: notes for whoever builds it

- **The relay's requests** (sketch): leave a sealed bundle (`POST /v1/<store>/bundles`, the device's key in a header);
  take the bundles after a cursor (`GET /v1/<store>/bundles?after=<n>`); the owner connects or closes a device's key
  (`PUT` and `DELETE /v1/<store>/devices/<id>`, with the owner's relay key). Bundles are the sealed `lakay-changes` files
  of stage 2; the relay compares each bundle's clear `from` with the device whose key sent it.
- **Keys.** A device's relay key is random and kept only on that device; the relay holds its SHA-256. The owner's relay
  key is derived from the owner's password with its own salt (PBKDF2), so a device that holds only the Store Key cannot
  connect or close devices. A new owner's password means connecting again.
- **The apps' origins.** The iPhone and iPad app serves the page through its own scheme (`ShellSchemeHandler.swift`),
  the Fire app through its WebView, and the desktop program through the system's web view. The relay answers with CORS
  headers for any origin, which is safe here because it trusts keys, never cookies.
- **The policy.** With the first way of question 2, `build.py` writes `connect-src https://<the relay's address>` from
  `build.json`, in the apps and the web app alike; the tests build with a local relay's address instead.
- **When to exchange.** On opening, every two minutes while open and online, and two seconds after a change (one
  exchange at a time). On the phone, only while Lakay is on the screen: phones pause a page soon after it leaves it.
- **Tests.** The relay in Python's standard library, run here with two and three browsers standing for devices; a
  relay that is down, slow, or answering with a wrong bundle; a removed device's key refused; the practice store never
  in step.
