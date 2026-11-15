# Lakay: devices in step (a plan for the owner's approval)

Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.

Written 15 November 2026. The owner approved its recommendations the same day: the books join first (stage 1), then
pairing and carrying the changes by file (stage 2), then a relay on the Mac mini at the store (stage 3). Questions 1, 3
and 4 below are still open; they matter from stage 2 on.

**Stage 1 is built (Build 24, 15 November 2026), waiting for the owner's approval.** It has no screens yet: it is the
joining of the books, tested with two, three and five simulated devices (`tests/t_build24.js`). The appendix says how it
works.

## What the owner asked

To reach everything from anywhere with the internet, while every device still works fully with no connection, and the
books stay encrypted from one end to the other.

## How it would work, in short

- Every device keeps working with no connection, exactly as now.
- When a device is online, it leaves its new ledger lines, sealed, in a mailbox (the "relay"), and takes the lines the
  other devices left there. Each device then holds the same books.
- The relay holds only sealed lines and cannot read them. The Store Key never leaves the store's own devices. Someone
  who copied the relay's files would find only sealed data.
- A new device joins with a pairing code shown on a device already in the store, or with the Master Key. The code
  carries the Store Key to the new device, sealed; the relay never sees the code or the key.
- What the relay can see: which device left lines, when, and how large they were. Not what they say.

## Where the relay could live (the owner's choice)

1. **The Mac mini at the store.** It is already on and connected for the search app's server. Lakay would add a small
   relay program to it. Devices away from the store would reach it through a private network app installed on each
   device (Tailscale is one such app; I believe it is free for personal use, but its current terms should be checked),
   so the Mac mini is never open to the whole internet. Everything stays on hardware the owner owns. If the Mac mini is
   off, or the store's internet is down, devices away from the store wait; they keep working and catch up later.
2. **The owner's website host.** If the host can run a small program (many hosts run PHP), the relay could live beside
   the web app, reachable from anywhere with no extra app. It depends on what the host allows, and a third party would
   hold the sealed files (unreadable to them).
3. **No relay at first: carrying the changes.** A device saves its new lines in one sealed file, and another device
   takes them in (by USB stick, AirDrop or email). It needs no server at all, but it is done by hand.

My recommendation: begin with the third (it proves the joining of the books with no server), then the first (the Mac
mini), unless the website host allows a small program, in which case the second may be simpler to reach.

## What changes inside Lakay (honestly, the largest change since Build 1)

Today each device's books are its own. To join several devices' books, Lakay must:

- give each device its own chain of ledger lines, sealed and fingerprinted as now, and replay the other devices' lines
  in the order of their time;
- count each item's stock from every device's sales, deliveries and corrections, instead of keeping one stored figure;
- settle two changes to the same thing made while both devices were offline (two prices for one item): the later
  change wins, both stay in the history, and the owner is told;
- carry the people and their sealed envelopes, so that a person can sign in on any device.

Receipt and booking numbers already carry the device's letter (A-000123, A-T0001), so two devices never give the same
number. The practice store stays on each device alone.

## Stages, each tested and shown before release

1. **The books join.** Two devices' books are joined in tests, with no network: stock, sales, transfers, pay, bookings
   and the rest; Verify checks the joined books.
2. **Pairing, and carrying the changes.** A second device joins the store with a pairing code; changes move by a sealed
   file.
3. **The relay**, on the place the owner chooses, and the exchange done by itself whenever a device is online. A small
   sign in the top bar says when the device last caught up.
4. **From anywhere.** The owner's phone, at home, sees the store's books and, if the owner wishes, changes them.

## Safety

- A device lost or stolen holds its books sealed, as today; its password is still needed. Lakay would let the owner
  take that device's place in the store away, and later change the Store Key for every device.
- No program is proof against every attack. Before the books travel between devices for real, an independent security
  review of this part is recommended.

## Questions for the owner

1. Which devices should be in step: the counter's Windows computer, the Mac mini, the MacBook Pro, the iPhone or iPad,
   the Fire tablet?
2. Where should the relay live: the Mac mini at the store, or the website's host (which host, and can it run a small
   program such as PHP)? Or should Lakay begin with carrying the changes by file?
3. Away from the store, should the owner's phone only see the books, or also change them (sell, receive, change
   prices)?
4. Is the Mac mini on and connected day and night?

## Appendix: how stage 1 is built (for whoever continues the work)

All of it is in `src/js/04-books.js`, in the section "devices in step", with the stamps beside `commit`.

- **Lines.** From Build 24 every line carries `ts` (milliseconds; never behind the last line this device knows of, so
  a device's lines always go forward even if its clock is wrong), `w` (each record written: its key, its value whole,
  and the fields it changed, or null for a new record), `sd` (stock moved, by item) and `m` (the vault's changed parts:
  `owner`, `master`, `people:<id>`; and the Author Studio's choices). Counters, the head, the sync record and sticky notes
  are never in `w`.
- **Stamps.** A stamp is the line's time, its device's letter and its number (`ts36.LETTER.seq36`), compared as text.
  Each record is sealed as `{"~v": value, "~s": stamps}`, where `stamps[""]` is the stamp that wrote the record and
  `stamps[field]` the stamp that last changed that field. Records from before Build 24 have none, and count as oldest.
- **Letters.** Each device has a `device` record in the books (`device:<id>`: its letter, name, when it joined and from
  whom). The first device of a store is A; a joining device takes the next letter its copy does not know (never I or O).
- **Joining** (`B.joinFromBackup(body, secret, isMaster, name)`): only a device with no store of its own. It checks the
  copy's chains, keeps its records (not the sticky notes, not its head, not its sync record), keeps the source's lines
  as the source's chain (re-sealed under the peer's own associated data, `emporium|p|store|device|seq`), keeps any other
  chains the copy held, and starts its own chain with `device.joined` (the source's letter and the last line it took).
- **Bundles** (`B.makeBundle(have)`, `B.takeBundle(text)`): the lines the other device lacks, by chain, given what it
  holds (`B.syncInfo().have`), sealed with the Store Key under `emporium|b|store|device`. Taking a bundle: each chain must
  follow on from what is held (fingerprint by fingerprint; the line at the held point must match: else `fork`; a
  missing line: `gap`; a line without `ts`: `old`; a second device with a letter in use: `letter`). The new lines of
  every chain are taken in the order of their stamps. For each field the later stamp wins; stock is never taken but
  summed from `sd`; a booking's `pays` are joined by their id (a payment voided on either device stays voided); a
  person's training marks (`done`, `ex`, `tasks`) are joined by key. A field changed here while the other device could
  not know it (by what that device had taken, read from its `device.joined` and `sync.took` lines) is reported as a
  clash, except a record's "last changed" time. One line of this device's own, `sync.took`, says what was taken, from
  whom, and the clashes. The door's list of people and the vault are brought up to date.
- **Verify** reads this device's chain (numbered keys) and each other device's (`p:<device>:<seq>`), checks each against
  what the sync record holds, then replays all lines together in the order of their stamps (stock by the moves, without
  each device's own "stock before" check, which only holds on the device that wrote it).
- **Not carried**: each person's sticky notes (they stay on the device where they were written), the practice store, and
  each device's counters.
- **Honest limits.** "The later change wins" trusts the devices' clocks only as far as `ts` allows: a device whose clock
  runs ahead wins clashes it should not. Two devices that join from the same copy before either is heard of take the
  same letter; the second is refused and must join again (stage 2's pairing will reserve the letter on the inviting
  device). Two people added on two devices while apart may share a staff number; signing in still works (both envelopes
  are tried), but the screens would show the same number twice. Anyone holding the Store Key can write lines, as today:
  the limits on who may do what are kept by Lakay itself, not by the seal. Before the books travel between devices for
  real, an independent security review of this part is recommended.
