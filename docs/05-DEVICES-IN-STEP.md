# Lakay: devices in step (a plan for the owner's approval)

Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.

Written 15 November 2026. The owner approved its recommendations the same day: the books join first (stage 1), then
pairing and carrying the changes by file (stage 2), then a relay on the Mac mini at the store (stage 3). Questions 1, 3
and 4 below are still open; they matter from stage 2 on.

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
