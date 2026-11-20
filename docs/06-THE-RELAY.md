# Lakay: the relay on the owner's own Mac minis (stage 3)

Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.

Written 20 November 2026, and changed the same day after the owner's answers. It follows the plan the owner approved
on 15 November 2026 (`05-DEVICES-IN-STEP.md`).

## The owner's choices (20 November 2026)

- **The owner's own server and the owner's own private network, with no company in the path.** Two Mac minis at home
  serve as the relays. Tailscale is kept as an option.
- **The Mac minis hold the books as well** (the owner, 20 November 2026, changing the answer to question 5): each runs
  Lakay as a device in step, with its own letter, and Lakay Relay beside it.
- **Lakay's security policy** opens to the relays' own addresses, and to nothing else (question 2, as recommended).
- **On the iPhone, the installed app** (from Sideloadly), not the website version (question 3, as recommended).
- **FileVault on the Mac minis** stays as it is (question 4).
- **The devices:** the counter's Windows computer, the owner's iPhone, and the two Mac minis at home.
- Earlier answers: away from the store, the phone may see the books and change them; the Mac minis are on day and
  night.

Confirmed by the owner: both Mac minis are at home, and the counter computer is at the store. The owner has not bought
the home router yet (see "Choosing the home router" below).

## What stage 3 adds, in short

- **Lakay Relay, a small program on each Mac mini.** It is a mailbox for sealed changes. The relay itself never holds the
  books, the Store Key or anyone's password, and it cannot read what it keeps. (Lakay, beside it on the same Mac mini,
  holds the books, sealed, as on every device.)
- **The exchange, done by itself.** Whenever a device can reach a relay, it takes the other devices' new changes from it
  and leaves its own: when Lakay opens, every two minutes while it is open, soon after each change, and when the
  connection comes back. Every device uses both Mac minis, so either one can be off. A change taken twice brings
  nothing new, so the two relays need not keep each other in step. The sealed files of stage 2 still work, for a device
  with no connection.
- **A small sign in the top bar.** "In step a moment ago"; "Last in step at 14:05"; or "The relays cannot be reached:
  this device keeps working and will catch up."

## The way into the owner's home

1. **The owner's own private network, with WireGuard** (the owner's choice). WireGuard is free and open source, and needs
   no account with any company. Its apps are made for Windows, the Mac, the iPhone and iPad, and Android; the Fire tablet
   takes the Android app from WireGuard's own download page. The private network runs on the home router, so that both
   Mac minis are reached through it (if one Mac mini ran it instead, the other could not be reached from outside when
   that one is off). Each device gets the
   WireGuard app once, with its own settings (a code to scan). The relays answer only inside this private network: they
   are never open to the whole internet.
   - **The home connection must accept a connection from outside.** Some internet providers share one address among
     many homes (called CGNAT), which blocks this. The usual fix is to ask the provider for a public address of one's
     own. If that is not possible, Tailscale (below) still works.
   - **The home router** must send WireGuard's one port to the device that runs it. The router's brand and model will
     say how (a question for the owner).
2. **Tailscale** (the option kept). Tailscale links the devices privately with no change to the home router, and works
   even behind CGNAT. Facts checked on 20 November 2026; they may change. Its free plan is for non-commercial use only,
   so a store would need its Standard plan, listed at US$8 per user per month. Tailscale's own servers help the devices
   find each other; the sealed changes still travel between the owner's devices. With Tailscale, the relays work the
   same way.

## Choosing the home router (the owner has not bought it yet)

- **A WireGuard server built in.** ASUS publishes official steps for the WireGuard server of its routers, and GL.iNet
  does for its own; other makers may too. Confirm it in the exact model's specifications before buying.
- **Fixed addresses on the home network** for the two Mac minis (an "address reservation"), and sending one port from
  outside to the router's own WireGuard server. Nearly every router does both.
- **Security updates** from its maker, for years.
- **Before buying anything, ask the home internet provider** whether the home connection has a public address of its
  own, not shared with other homes (CGNAT). Without one, no router at home can be reached from outside; the provider
  may give one, sometimes for a fee. If it cannot, Tailscale remains the way.

## Secure addresses without a company

Lakay's pages may only talk over secure (https) addresses on Apple devices, so each relay needs a certificate. Lakay
Relay makes its own: a small certificate authority of the owner's own, made on the Mac mini, and a certificate for each
relay's address. The owner installs the authority's certificate once on each device (a profile on the iPhone; the
Keychain on a Mac; the certificate store on Windows; the Fire app is told to accept it). With Tailscale, Tailscale's own
certificate can be used instead.

## What runs on each Mac mini

- **Lakay**, the Mac app, as a device in step, with the books sealed as on every device. It exchanges only while
  someone is signed in to it; when it opens again, it catches up from the relays.
- **Lakay Relay**, made with the Mac apps (the Lakay-Mac repository), started by macOS when the owner signs in. It keeps
  the sealed changes in one folder, for 30 days, and nothing else.
- **At its first start, it shows a claim code.** The owner types that code in Lakay, with the owner's password, to make
  the relay the store's. Until then it accepts nothing, and no one else can claim it.
- **Because they hold the books and are always on,** the Mac minis should have FileVault on, a strong password for
  each person who signs in to macOS, and no one else using them.
- **What the owner does once:** install Lakay and Lakay Relay on both Mac minis; join each Mac mini to the store
  (Settings, Devices in step, Add a device); give each a fixed address on the home network
  (the router keeps it for the Mac mini); keep the Mac minis from sleeping; set up WireGuard (or Tailscale); install the
  certificate on each device; connect each device in Lakay. After a restart, someone signs in on the Mac mini; with
  FileVault on, macOS asks for the password first. The devices keep working meanwhile and catch up later.

## Who may reach the relays

- **Only the owner, with the owner's password, claims a relay and connects a device to it** (Settings, Devices in step).
  The owner's relay key is made from the owner's password, so a device that holds only the Store Key cannot connect or
  close devices.
- **Each device has its own key to the relays.** It is made on the device, kept sealed on that device alone (never in a
  backup or a joining file), and the relays keep only its fingerprint. A device can leave changes only in its own name.
- **Removing a device also closes its key at the relays** (the owner's password is asked). A lost or stolen device can
  then no longer fetch new changes, even if someone opens it with a password. Its own copy stays sealed, as before.
- **What the relays see:** which device left changes, when, and how large they were. Never what they say.

## How Lakay talks to the relays

Today every build forbids the page to connect anywhere (`connect-src 'none'`). The owner approved opening it to the
relays' own addresses, and to nothing else. The addresses are written in `build.json` once the Mac minis are set up;
until then the policy stays closed and the relay settings say so. The web app gets the same policy.

## Honest limits

- A device whose clock runs ahead wins clashes it should not, as before. Each clash is reported.
- The iPhone app installed with a free Apple ID must be installed again every 7 days (the books stay).
- Changes kept for a device that stays away more than 30 days are let go; that device then joins again.
- Anyone who holds the Store Key can write lines, as in stages 1 and 2. The relays' keys stop a removed device from
  fetching new changes, but they do not change the Store Key.
- Lakay Relay uses the web server in Python's standard library, which Python's own documentation does not recommend for
  use open to the internet. This is acceptable only because the relays answer inside the owner's private network. They
  must never be opened to the whole internet.
- No program is proof against every attack. An independent security review of the relay and the exchange is
  recommended before the store relies on it.

## Questions for the owner (for the setup, not for the building)

1. The home internet provider's answer: does the home connection have a public address of its own (not CGNAT)?
2. The home router, once chosen: its brand and model, so that the setup steps can be written for it.

## After approval

- **Build 26:** Lakay Relay and the exchange, tested here with simulated devices and relays, and Lakay Relay built and
  started on GitHub's Mac; the screens shown to the owner before release.
- **Then the setup at home,** with the steps written out for the owner's router, and the first real exchange checked
  together. The relays' addresses go into `build.json`, and that build is released once the owner approves it.

## Sources consulted (20 November 2026)

- Tailscale pricing: https://tailscale.com/pricing
- Tailscale, free plans and discounts: https://tailscale.com/docs/account/manage-plans/free-plans-discounts
- Tailscale, pricing update of 8 April 2026: https://tailscale.com/blog/pricing-v4
- Tailscale on Amazon Fire devices: https://tailscale.com/docs/install/amazon-fire
- Tailscale, running when no one is signed in: https://tailscale.com/docs/how-to/run-unattended
- Tailscale, HTTPS certificates: https://tailscale.com/docs/how-to/set-up-https-certificates
- WireGuard, installation: https://www.wireguard.com/install/
- WireGuard for Android, downloads: https://download.wireguard.com/android-client/
- CGNAT and WireGuard (OpenWrt forum): https://forum.openwrt.org/t/possible-to-connect-via-wiregaurd-to-router-behind-a-cgnat/211445
- ASUS, the WireGuard VPN server of its routers: https://www.asus.com/ch-en/support/FAQ/1048280
- GL.iNet, VPN on its routers: https://www.gl-inet.com/solutions/vpn/

## Appendix: how it is built (for whoever continues the work)

- **Lakay Relay** (`relay/lakay_relay.py`, Python standard library only). One store per relay, claimed with the claim
  code. Requests: `GET /v1/hello`; `PUT /v1/<store>/owner` (claim, or change the owner's key); `PUT` and `DELETE
  /v1/<store>/devices/<id>` (the owner's key); `GET /v1/<store>/devices` (the owner's key); `POST /v1/<store>/bundles`
  (a device's key; the body is a sealed `lakay-changes` bundle of stage 2 whose clear `from` must be that device);
  `GET /v1/<store>/bundles?after=<n>` (a device's key). Keys travel in the `Authorization` header and are compared by
  their SHA-256 in constant time. Every answer carries CORS headers for any origin (the relay trusts keys, never
  cookies). Bodies are limited in size, requests in time; ids are checked before any file is touched; the log never
  holds a key or a bundle.
- **Keys in Lakay.** The owner's relay key: PBKDF2 of the owner's password with its own salt (the store's id and
  "lakay relay owner"). A device's key: 32 random bytes, sealed with the Store Key in this device's own `meta`
  (`relay`), with each relay's cursor and what it holds.
- **The exchange** (`src/js/30-relay.js`): for each relay, take the bundles after the cursor (`B.takeBundle`; a bundle
  of this device's own is passed over; a gap waits for the next round), then leave a bundle of what that relay lacks
  (`B.makeBundle(have)`). One exchange at a time.
- **The policy:** `build.py` writes the relays' origins from `build.json` (`relays`) into `connect-src`; the page reads
  its relays back from its own policy, so a test can point a copy of the page at a test relay.
