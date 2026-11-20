# Lakay: devices in step (a plan for the owner's approval)

Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.

Written 15 November 2026. The owner approved its recommendations the same day: the books join first (stage 1), then
pairing and carrying the changes by file (stage 2), then a relay on the Mac mini at the store (stage 3). The owner
answered questions 3 and 4 on 20 November 2026, and asked for a recommendation on question 1 (see the answers below the
questions).

**Stage 1 was released in Build 24 (15 November 2026).** It joined the books, with no screens, tested with two, three
and five simulated devices (`tests/t_build24.js`).

**Stage 2 is built (Build 25, 20 November 2026), waiting for the owner's approval.** The owner adds a device in Settings,
Devices in step: the device's letter is reserved in the books, and a joining file and a pairing code are made. The new
device joins at the door with the file and the code, and each person then signs in with their own password. The devices
carry their changes to one another by sealed files, with a plain report (`tests/t_build25.js`, through the screens, with
two browsers standing for two devices). The appendices say how each stage works.

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

**The owner's answers, 20 November 2026.**
- Question 3: away from the store, the owner's phone may see the books and change them (sell, receive, change prices,
  and the rest), as any device in step can.
- Question 4: the Mac mini will be on and connected day and night, for the relay.
- Question 1: the owner asked for a recommendation. Recommended: begin with the counter's Windows computer and the
  owner's iPhone. The Mac mini runs the relay only, without the books, since the relay never needs to read them. Add
  the iPad, the Fire tablet or the MacBook Pro when one is used for the store's work (Settings, Devices in step, Add a
  device). The owner's choice is still to confirm.

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
  same letter; the second is refused and must join again. (Since stage 2, an invitation reserves the letter on the
  inviting device, so this happens only when joining from a backup.) Two people added on two devices while apart may share a staff number; signing in still works (both envelopes
  are tried), but the screens would show the same number twice. Anyone holding the Store Key can write lines, as today:
  the limits on who may do what are kept by Lakay itself, not by the seal. Before the books travel between devices for
  real, an independent security review of this part is recommended.

## Appendix: how stage 2 is built (for whoever continues the work)

The books' side is in `src/js/04-books.js` (after the joining: "inviting a device" and "the store's devices"). The
pairing code is in `src/js/02-crypto.js`. The screens are `src/js/29-devices.js` (Settings, Devices in step, the owner's
alone, as all of Settings is) and `joinStore` in `src/js/11-door.js` (the door).

- **The pairing code** (`C.newPairing`, `C.readPairing`, `C.pairingKey`). Twelve random bytes (96 bits) and a checksum of
  three bytes (the first bytes of their SHA-256), written as the Master Key is, in Crockford's Base32: 24 characters in
  six groups of four. Reading it ignores case, spaces and hyphens (O is read as 0, I and L as 1), and refuses a code of
  the wrong length or with a wrong checksum (`badcode`) before any key is tried. The key that seals the Store Key comes
  from the code by HKDF with SHA-256, with the store's id as the salt and `lakay pairing wrap v1|` and the invitation's id
  as the info. Ninety-six random bits are far too many to guess, so no slow derivation is needed, unlike a password.
- **The invitation** (`B.prepareInvite(ownerPassword, name)`): the owner only, in the store's own books. The owner's
  password opens the Store Key in a form that can be sealed again. One line, `device.invited`, writes the new device's
  record (`device:<id>`: the next free letter, its name, status `invited`, when, by whom, until when, the invitation's
  id) and, if it is missing, this device's own record. Nothing secret is in the line. The sync record notes what the new
  device will hold (`sync.peers[<id>].have`: this device's lines up to and including this one, and what it holds of the
  others). Then a sealed backup is made, and the Store Key is sealed under the pairing key, with associated data naming
  the store, the invitation, the new device's id and letter, the hour it expires, and a fingerprint of the file's
  readable parts (`inviteSum`: the new device's name, the inviting device and its letter, the store's name, and the
  backup's own checksum, which covers the door's names and the Author Studio's choices). A file changed by hand, even
  with its backup's checksum made again, no longer opens with its code. The joining file is `{ format: "lakay-join",
  v: 1, store, id, device: { id, code, name }, from, fromCode, expires, storeName, env, backup }`. The code goes to the
  screen and is never stored.
- **Joining** (`B.readInvite(text)`, then `B.joinFromInvite(inv, code)`): reading checks the format, the hour (`expired`),
  the backup's checksum (`corrupt`) and that the backup is the named store's (`notinvite`). Joining needs a device with no
  store (`hasstore`), a code with a good checksum (`badcode`), and the right code for an unchanged file (`wrongcode`); the
  hour is checked again. `joinWith` then takes the place the copy holds for this device: the record must exist with the
  same letter and the same invitation, and still be `invited` (`notinvite`, `cancelled`, `samedevice`). The new device
  takes the invitation's device id as its own, writes `device.joined` (with the invitation's id and `holds`: what it holds
  of every chain), replaces its empty storage in one transaction, and opens no books.
- **What another device holds** (`peerHave(st, dev)`): its own lines as far as this device has them; what its lines say
  it took from the others (`knows`, read from its `device.joined` and `sync.took` lines, letters turned into device ids);
  and what it said it held in the last bundle it sent (`sync.peers[dev].have`, also set at its invitation).
  `B.makeBundleFor(dev)` makes the bundle from that. The receiver takes only what follows on from what it holds; lines it
  already has bring nothing new.
- **What is left to carry** (`B.devices()`): for each other device, this device's own lines it does not hold yet, and the
  other devices' lines this device holds that it does not. Lines that only say what was taken in (`sync.took`) are not
  counted (`real`, with the lists `sync.quiet` and `sync.chains[dev].quiet`, the last 300 of each kept), or two devices
  would never reach zero.
- **Naming and removing** (`B.renameDevice`, `B.removeDevice`): the owner's, one line each (`device.named`;
  `device.cancelled` for an invitation not yet used, `device.removed` otherwise; never this device). Taking in refuses a
  bundle from a removed or cancelled device (`removed`) and sets aside the lines of a removed device that another device
  relays (`setAside`, named in the report). The letter check also counts the letters in the device records, so a reserved
  letter is never taken by another device.
- **Knowledge before writes.** When a line is taken in, what it says it knew (`learn`) is counted before its writes are
  applied, so a device's own `device.joined` line never reports a clash with the record it writes.
- **Honest limits.** An invitation can be used by more than one device if each holds the file and the code: the first
  whose changes are taken in keeps the place, and the other is refused as a fork (`fork`) until it is invited again. The
  joining file shows what any backup shows (the store's name, the people's names and staff numbers, the Author Studio's
  choices); now that it is bound to the code, those parts cannot be changed unseen, but they can be read. Removing a
  device does not change the Store Key, so a removed device still opens, with a person's password, on what it held;
  changing the Store Key on every device (and with it each person's envelope) is still to come. As before, an independent
  security review of this part is recommended before the books travel between devices for real.
