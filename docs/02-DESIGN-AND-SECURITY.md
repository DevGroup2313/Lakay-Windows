# Emporium: design and security

How Emporium keeps the store's books, who can open them, and what protects them. The first part is in plain words for
the owner. The appendix gives the exact methods and numbers, for an auditor.

Written 7 November 2026 for Build 1. Parts marked with a stage are planned, not yet built.

## 1. Principles

1. **Offline first.** Every device keeps its own complete, sealed copy of the books and works with no connection.
   The internet is used only to keep devices in step (Stage 5), never to run the store.
2. **One source of truth: the ledger.** Every event is written as one line: a sale, a delivery, a stock correction, a
   clock-in, a price change. Stock levels and reports are worked out from those lines.
3. **Nothing is deleted.** A mistake is corrected by a new line that names the line it corrects and gives a reason.
   The original stays visible.
4. **Every line has an author.** Who did it, when, and on which device.
5. **Money is counted in whole cents.** No figure is ever stored as a fraction of a cent, so totals add up exactly.
6. **Plain words.** Every screen, message and report says what it means in short sentences, in English, French or
   Kreyòl.

## 2. Where the data lives

On each device, inside the app's own private storage (the browser's database, IndexedDB, which the Windows, Mac,
iPhone, iPad and Fire tablet programs keep in the user's own profile). There is no Emporium server holding your data.

### What is sealed and what is not

- **Sealed** (encrypted): every item, price, cost, stock figure, sale, receipt, report figure, setting, note, name of an
  employee and line of the ledger.
- **Not sealed:** the store's name shown at the door (so the right store is opened), the number of the build, and the
  technical facts needed to open the seal (which method, the random "salt"). The number of records of each kind can be
  counted by someone holding the device, but not read.

## 3. Who can open the books

| Who | How they sign in | What it opens | Stage |
|---|---|---|---|
| The owner | Password (at least 10 characters) | Everything | Build 1 |
| The owner, recovering | The **Master Key** (a 52 character code on a printed card) | Everything, and sets a new password | Build 1 |
| Each person on the staff (cashier, stock keeper, manager) | Their name or user ID, and their own password (at least 10 characters) | What the owner allows | Build 6 |

### The Store Key and how it is protected

The books are sealed with one random **Store Key** (256 bits). The Store Key itself is never written down in the clear.
It is kept in two sealed envelopes (more at Stage 2):

1. one sealed with a key made from the **owner's password**;
2. one sealed with a key made from the **Master Key**.

Opening either envelope gives the Store Key, which stays in the computer's memory only while the store is open. When the
app locks (by hand, after the idle time you choose, or when it closes), the Store Key is forgotten.

### The Master Key

- It is created at setup from the device's secure random generator, shown once, and confirmed by typing two of its
  groups.
- It can be printed as a card. Keep it in a safe place away from the store's computers (a safe, a deposit box).
- It never leaves the device inside the app and is never stored by Emporium.
- With it you can always open the books and choose a new password. Without the password and without the Master Key,
  nobody can open the books, including the person who wrote Emporium. This is what end to end encryption means, and it
  is why the card matters.

### The people's own keys (Build 6)

The owner asked that signing out be clocking out, and that the next person sign in on their own. So when a person signs
out, the books lock, and the next person must open them. A short PIN cannot do that safely: a stolen copy of the books
could be tried against every PIN in minutes. So each person has a password of their own, held to the same rule as the
owner's (at least 10 characters), and their own envelope of the Store Key:

- The owner adds a person in the Team room. The owner's password opens the Store Key in a form that can be sealed again,
  and a new envelope is sealed with a key made from the person's first password (PBKDF2, the same settings as the
  owner's). The envelope's additional data names the store and the person, so it cannot be moved.
- At their first sign-in the person chooses their own password, and their envelope is sealed again under it.
- Each person has a user ID (the owner is 1001; the people are 1002, 1003 and on). It is kept on every ledger line, sale,
  stock move and shift they make. Their names and IDs are kept plain at the door, as the owner's name is, so the sign-in
  can find the right envelope; a wrong name takes as long to refuse as a wrong password.
- Taking a key back removes the person's envelope. Everything they did stays in the books, under their name and ID.
- What each person may do (sell, items and prices, deliveries, stock corrections, costs and profit, reports, the team's
  hours) is kept in their sealed record. Lakay keeps to it in two places: the screens (rooms, keys and figures are not
  shown) and the books (a change a person may not make is refused). Settings, backups, the Author Studio and the people
  are the owner's alone. (Build 19 lets the owner give some of this to leaders: see the next part.)

### Leaders and managers (Build 19)

The owner asked to give team leaders and managers some limited administrative access. Three kinds of access were added:
Training, The people and Backups. Only the owner gives them at first. The limits are kept by the books, in
`04-books.js`, and not only by the screens:

- **What a person may give** (`B.grantable`): the owner, everything; a person with The people, only the access they hold
  themselves, and never The people itself. So no one can make a person with more than they have, and no chain of
  managers can grow the access the owner gave.
- **Whom a person may change** (`B.canManage`): never the owner, never themselves, and no one who holds access they could
  not give. Adding, changing, giving a first password and taking a key back each check this inside the change itself.
- **A manager's own password.** To seal an envelope for a new person, Lakay needs the Store Key in a form it can seal
  again. The owner's password opens it from the owner's envelope. A manager's password opens it from the manager's own
  envelope, the same way their own sign-in does (and as changing their own password already did). No envelope is
  weakened, and nothing new is kept: the key is used in memory and let go.
- **Backups.** A sealed backup holds the same sealed records and envelopes as the device. Saving one gives a manager
  nothing they could not already open on that device. Restoring a backup, Settings and the Author Studio stay the
  owner's alone.

### Each person's notes (Build 8)

Schedae, the sticky notes, are each person's own. Each person's notes are one sealed record (`notes:<user id>`), sealed
with the Store Key like every other record, with additional data that names the store and the record, so it cannot be
moved. They are not ledger lines: a note changes with every keystroke, and it is a person's own scribble, not the
store's accounts.

- A note is written half a second after typing stops, and at once when the books lock, with the key that was in hand.
  The writes are made one at a time, in order, each into the books it was made in (the store's own or the practice
  store's), so an older copy never lands after a newer one. Erasing, resetting the practice store and restoring a backup
  wait for the last write, so no note sealed with an old key is left in new books.
- A sign-in opens only the signing-in person's notes. Other people's notes stay sealed and are not opened in that session.
  The practice store opens all of its sample people's notes, since it changes from one person to another.
- A note's words and marks are kept as a small model of allowed marks (bold, italic, underline, strikethrough, lists,
  line breaks, and pictures kept inside the note as data), never as markup. What is pasted or dropped arrives as plain
  words, or as a picture made small in the page. No address outside the page can enter a note.
- A backup carries the notes, sealed, as it carries every record.

## 3b. The Author Studio's choices

The owner can rename the app and the store, rewrite any phrase, choose the colours and word the receipt. These choices
are data, never code: the tested build stays exactly the same.

- They are kept beside the envelopes, not sealed, so that the door can wear them before the store is opened. They hold
  no figure of the business.
- Each change is also a ledger line ("The Author Studio was used", with the parts that changed), written in the same
  transaction, so the books show who changed what and when.
- A file brought in is checked field by field: only the fields the Studio knows, only text, within set lengths, and
  only phrases that exist. Everything is shown as text and never run.
- Whatever the app is called, receipts, reports and About keep the software's own name and build, which an auditor checks
  against the release.
- Only the owner, in the store's own books, opens the Studio (Build 24). The practice store opens with no sign-in, and
  the web app is open to anyone who visits it, so the practice store neither shows the Studio nor lets the books take its
  changes (`B.saveCustom` refuses them there). No one on the staff opens it.

## 4. The ledger and its seal

Each line of the ledger carries a fingerprint (SHA-256) of the line before it, so the lines form a chain. Changing,
removing or reordering any earlier line breaks the chain from that point on. "Verify the books" (Settings) checks the
whole chain and reports the first line that does not match.

At closing (Stage 2), the **day's seal** prints the fingerprint of the last line of the day on the closing report. A
paper copy of that fingerprint, kept outside the computer, proves later that the day's records were not rewritten.

## 5. Keeping devices in step (Stage 5)

Devices will exchange sealed ledger lines through a relay on the internet. The relay only ever stores sealed data and
cannot read it. A new device joins only when the owner approves it on a device that is already open (or with the Master
Key). Several services can serve as the relay; the choice and its cost are yours (question 10 in `04-QUESTIONS.md`).

**Stage 1, the books join (Build 24).** The plan the owner approved is `05-DEVICES-IN-STEP.md`; its appendix says how it
works. What matters for security:

- A device joins from a sealed backup, opened with the owner's password or the Master Key, and only if it holds no
  store of its own. Nothing new is ever sent in the clear.
- Each device writes its own chain of lines; another device's lines are kept as its chain, sealed again with the Store
  Key under associated data that names the store, the device and the line's number, so a line cannot be moved from one
  chain to another or taken for this device's own without Verify seeing it.
- A bundle of lines is sealed whole with the Store Key under associated data naming the store and the sending device.
  A bundle changed on its way, from another store, with a gap, from a device whose chain no longer matches (a fork),
  with lines written before Build 24, or from a second device with a letter already in use, is refused, and nothing is
  written.
- Taking a bundle writes everything (the other device's lines, the records, the vault, the door, its own `sync.took`
  line) in one transaction: all of it or none of it.
- Each person's sticky notes and each device's counters are never carried.
- Limits: the later change wins by the devices' stamps, so a device whose clock runs ahead wins clashes it should not
  (each is reported). Anyone who holds the Store Key can write lines, as before: the limits on who may do what are kept
  by Lakay itself. An independent review of this part is recommended before the books travel between devices for real.

**Stage 2, adding a device and carrying the changes by file (Build 25).** What matters for security:

- Only the owner adds a device, with the owner's password, in the store's own books (Settings is the owner's alone). The
  new device's letter and place are reserved by a ledger line before anything leaves the device.
- The joining file holds a sealed backup and one more envelope of the Store Key. That envelope is sealed with a key made
  (HKDF with SHA-256) from a pairing code of 96 random bits, shown once on the inviting device and kept nowhere. Its
  associated data names the store, the invitation, the new device's id and letter, the hour the invitation ends, and a
  fingerprint of the file's readable parts together with the backup's own checksum. A file whose hour, names or copy
  were changed no longer opens with its code. The file alone cannot open the books, and the code alone opens nothing.
- The file shows what a backup shows: the store's name, the people's names and staff numbers for the door, and the
  Author Studio's choices. Keep it as one keeps a backup, and delete it once the device has joined. The code is read
  from one screen and typed on the other; it should never be sent with the file.
- An invitation lasts a day, and the owner cancels it with one line. A device joins only into the place reserved for
  it, so a cancelled or used invitation is refused.
- Joining opens no books. Each person signs in on the new device with their own password, which opens their own
  envelope, carried in the backup.
- Changes travel by the sealed bundles of stage 1. The books let only someone with Backups save or take them in; the
  keys are in Settings, which only the owner opens.
- A removed device's changes are refused from then on, on every device that has taken in the line that removed it.
- Limits: removal does not change the Store Key, so a removed device still opens, with a person's password, on what it
  held. An invitation used on two devices lets the first one heard from keep the place, and refuses the other as a fork.

**Stage 3, the relays at home (Build 26).** The owner's choice (20 November 2026) is `06-THE-RELAY.md`: the owner's own
server and private network, on two Mac minis at home that also hold the books. What matters for security:

- Lakay Relay (`relay/lakay_relay.py`) keeps only sealed bundles, each sealed with the Store Key on the device that made
  it. It never holds the books, the Store Key or a password, and it cannot read what it keeps.
- It answers only to keys. The owner's key is made from the owner's password on a device (PBKDF2, salted with a label and
  the store's id); each device makes a random key of its own. The relay keeps only the SHA-256 of each and compares them in
  constant time. A new relay belongs to no store until the owner claims it with its claim code (16 characters; eight
  wrong codes, then a pause of ten minutes) and the owner's password.
- A removed device's key can be closed at the relays, so it can no longer fetch new changes from them.
- The page may reach only the relays named in `build.json`, through its security policy's `connect-src`; with none, it
  reaches nowhere. Relay state on a device (its key, its place in each relay's list) is sealed with the Store Key in that
  device's own database, and is never put in a backup.
- Limits: the relay is built on the web server of Python's standard library, which Python's documentation does not
  recommend for the open internet. It must answer only inside the store's private network (WireGuard on the home
  router, or Tailscale), with the owner's own certificate for https. Anyone on that network who learns a device's key
  could fetch sealed bundles, which they still cannot open without the Store Key. The relay limits sizes (16 MB a
  bundle, 2 GB in all) and keeps bundles 30 days.

## 6. Payments (Stage 7)

When cards are added, the card system (for example Square) handles the card. Emporium records only the amount, the
method and the card system's reference. Card numbers never enter Emporium. This keeps the card rules (PCI DSS) with the
card company, as far as possible.

Build 16 does exactly this, with any processor. The store's own card machine charges the card, Apple Pay or Google
Pay; Lakay records the way, the amount, the machine's approval code and, only if the owner asks, the card's last four
digits. A string that looks like a card's full number (13 to 19 digits whose Luhn check digit is right, with or
without spaces) is refused at the counter, in Settings and by the books themselves, so it cannot be stored by
mistake. Lakay's page still loads no processor's script and reaches no network: a direct link to one processor would
be a separate, reviewed change. Whether a store's own setup meets PCI DSS is the card company's and the store's
question; Lakay keeps card data out of its books.

## 6b. Learning (Build 17)

The guided tour acts only through Lakay's own page, as a person does: it presses the page's keys and types into its
fields. It has no road of its own into the books. In the store itself (not the practice store), a step whose key would
write in the books is shown but never pressed; the tour then closes the windows it opened and puts the sale at the
Register back as it was. The test `tests/t_build17.js` runs the sale, payment, transfer and delivery tours in a real
store and checks that the ledger did not move. A lesson's mark is the only thing Learning writes: one ledger line,
`training.completed`, with the person's user id, the lesson, and how many answers were right the first time, sealed
like every other record (record kind `train`, one per person) and replayed by Verify. Learning keeps nothing about
customers, and it reaches no network.

**Exercises (Build 19).** An exercise asks a person to do real work on Lakay's own screens. While it runs, the state
Lakay shows is a copy held in memory (`B.drillStart`). A change of the counter's kind (a sale, a delivery, a stock
correction, a transfer or top-up, clocking in and out, a break) is applied to that copy only: nothing is sealed,
nothing is written to the device, and no ledger line is made. Any other change is refused. When the exercise ends,
or Lakay locks, the copy is let go (`B.drillEnd`) and the books are exactly as they were. Only then is the mark that
the exercise was done written, as one ledger line, `training.exercise`. The person's own notes are not part of the
copy, so they stay theirs. The test `tests/t_build19.js` checks that a sale, a delivery, a transfer and a break done
in an exercise leave the ledger, the sales, the stock and the shifts unchanged.

**Plans, onboarding and sign-off (Build 19).** The store's course (its onboarding path, its own tasks and its
refreshers) is one sealed record, `course`; each person's plan (their onboarding and what was assigned to them) is
one sealed record, `plan`. Only those with Training may change them. Every change is a ledger line
(`course.updated`, `training.assigned`, `training.unassigned`, `onboarding.started`, `onboarding.signedoff`,
`training.task`). A task a leader signs cannot be signed by the person it is for, and no one signs off their own
onboarding (the owner aside). The course holds only what it may: a task's title is at most 80 characters and its
note at most 400, with control characters taken out; steps that do not exist are left out.

## 6c. The Schedule (Build 20)

A planned shift (`slot`), the usual week (`rota`) and each swap request (`swap`) are sealed records like every other,
and every change to them is a ledger line with the person who made it. Only those with the team's hours plan; the
books refuse the rest. The plan of a day gone by cannot be added to, changed or removed by anyone, so the schedule
cannot be rewritten after the fact to make a person look late or absent. A swap changes hands only when the colleague
has agreed and someone with the team's hours has approved, and it is checked again at that moment (the shifts are
still theirs, still to come, and no one would hold two at once). No one approves their own request, the owner aside.
The time clock is never changed by the schedule: "late" and "missed" are read from the clock's own records.

## 6d. Earnings, providers and pay (Build 21)

How each provider settles (`prov`), each settlement (`settle`), each statement checked (`stmt`), the pay settings
(`payset`), each person's rates (`rate`) and each period marked paid (`paid`) are sealed records like every other, and
every change is a ledger line with the person who made it. Nothing is erased: a settlement or a period marked paid is
voided with a reason and stays in the books. What is held for a provider is never typed in; it is worked out from the
log of transfers and top-ups and the settlements, so a statement can be checked against it, and the check is kept.
Only the owner says how a provider settles. "Pay" is a kind of access no level holds and only the owner gives. No one
sets their own rate, marks their own pay paid, or undoes it, the owner aside (the owner has no pay in Lakay). Verify
replays every settlement and every period marked paid against the ledger. During an exercise none of this is written.

## 6e. Travel bookings (Build 22)

Each booking (`booking`) is a sealed record, and every step is a ledger line carrying the booking as it then stood,
with one exception: the client's name and phone, which the ledger never holds. They are kept only if the owner turns
that on (it is off at first), only in the booking's own record, and they are erased from every booking when the owner
turns it off. Lakay refuses a card's number wherever a booking could hold one (the check digit is tested as card
machines do), and refuses what looks like a passport or identity number. That second check is a guess and is said to
be one. Money paid and given back is never erased: a payment is voided with a reason, a booking is cancelled with a
reason and the part of the fee kept. Verify replays each booking's status, prices, days and payments.

## 6f. Terms, privacy and the licence (Build 26)

The owner asked (21 November 2026) for Terms and Conditions and a clear copyright declaration, in exact parity with
Ingenium's system and prompting, made for Lakay. What there is, and what it is not:

- **The licence.** `LICENCE.txt` is the owner's licence, version 3, made for Lakay by `release/licence/make_licence.py`.
  The build stops if the file differs from what the script writes. Settings, Ownership, and About show it, with the
  copyright, this copy's build, the whole licence as a document, and Save the licence. `THIRD_PARTY_NOTICES.txt` lists
  what the programs for computers carry; the page carries no software made by others.
- **The terms and the notice.** `src/terms/terms.json` holds the Terms of use, the Privacy notice, In short and the
  licence's plain words, in English, French and Kreyòl. The English applies. Every statement in the Privacy notice was
  written from what the code does (what is sealed, what is left readable for the door, what is never kept, when the page
  goes online). When the code changes what the notice says, the notice changes with it, and its version moves on.
- **Agreeing.** After the welcome door, a device that has not agreed to this version shows the sheet over everything.
  The record (the version in English, the time, the build) is kept in this device's own storage (`emporium.terms`),
  never sent and never in the books. A new version (`version` in `terms.json`) asks every device again.
- **Not a lock.** The sheet records consent; it protects nothing. Someone who edits the device's storage can skip it.
  The books stay sealed whatever the sheet says, and the sheet never changes or sends anything.
- **Never locked out.** Declining leaves the welcome door within reach (Back to the welcome door), with Refresh and
  Reset, as Build 7 requires.
- **A draft.** The texts are not legal advice. A lawyer in the United States and in the United Kingdom should read them
  before they are final; the owner of the real store sees a Draft chip until then. The contact for questions is added by
  the owner (Settings, Ownership, Your contact, on that device) or in `build.json` (`contact`), for every device.

## 7. Protection against attacks and malware

- **No code from outside.** The app's page carries all its own code. A Content Security Policy forbids scripts and
  connections from anywhere else.
- **Text is never code.** Everything typed or imported (item names, notes, backup files) is shown as plain text and
  never interpreted as markup or script. This follows the Forge's security audit of pass 647.
- **Nothing hidden runs.** No `eval`, no remote fonts, no analytics, no trackers, no advertising.
- **Sealed at rest, locked when idle.** See sections 2 and 3.
- **Least privilege** (Stage 2). Each person can do only what the owner allows, and sensitive actions (refunds, price
  changes, deleting a person, exports) ask for the right person again.
- **Known builds.** Each release lists the SHA-256 fingerprint of every file, so a download can be checked. From Stage 9,
  builds will also be signed with your own key (PermitCore).
- **Tested builds.** Each build runs its tests before release (section 9).
- **Pinned build tools** (Build 12). The GitHub actions that build the apps are each named by the full commit of a
  release written for Node.js 24, not by a label that can be moved, so altered or hijacked action code cannot reach a
  build without a change to the repository. Each runtime was read from the action's own file at that commit
  (`release/ACTIONS.md`).
- **The logo inside the page** (Build 12). The tab and home screen icons are carried in the page as pictures, so the
  Content Security Policy needed no change: it still allows pictures only from inside the page. A first try pointed the
  iPhone's icon at a file beside the page, and the policy rightly refused it; the test of Build 12 checks that the
  policy refuses nothing the page needs.
- **Scanning and the camera** (Build 15). A scanner that types is heard only when no field has the focus, and only by
  its speed, so a person's typing is never taken for a code. The camera is opened only when someone presses its key;
  each picture is read in memory, on the device, and dropped at once; nothing is kept or sent, and the camera is let go
  as soon as a code is read or the window closes. Lakay's own reader accepts a code only with a right check digit,
  read twice.
- **Money transfers and top-ups** (Build 15). Each entry is a sealed record and a ledger line, like a sale, and Verify
  replays them. They hold the provider, the amount, the fee, the commission, the provider's reference and a short note,
  and never a customer's name, address or papers. A cashier may record; only someone who sees the reports may void,
  with a reason, and the books themselves refuse anyone else. The commission is shown only to those who see the reports.
- **The finder** (Build 15) is an index of the items kept in memory while the books are open, and dropped when they
  lock. It is never written anywhere.
- **The web app's policy** (Build 14). The web build (`web/index.html`) is the apps' page with three additions to its
  Content Security Policy, all limited to its own address: `img-src 'self'` (the iPhone's home screen tile beside the
  page), `manifest-src 'self'` (the manifest that names its icons) and `worker-src 'self'` (its service worker). Scripts
  are still only its own, named by SHA-256; `connect-src` is still `'none'`, so the page can send nothing anywhere. The
  service worker answers only for the site's own files, fetches the newest first, keeps the page, the manifest and the
  icons for use with no connection, and never sees the books, which stay sealed in the browser's own store on each
  device. It is registered only in the web build, and only over https or on this computer. Since Build 15 the web app
  is a zip for the owner's own website (`builds/Lakay-Web.zip`), and its manifest is `manifest.json`. A website must
  use https: browsers give Web Crypto, which seals the books, only to secure addresses, and on plain http Lakay says so
  and does not open. The test of Build 14 serves
  the site as GitHub Pages does and checks that the policy refuses nothing.

## 8. Honest limits

Encryption protects data at rest and in transit. It cannot protect against everything:

- While the store is **open** on a device, anyone at that device can see what the screen shows. Lock it when you step
  away, and let the idle lock work.
- **Malware on a computer** can watch the screen and the keyboard while the store is open. Keep Windows and macOS up to
  date, use their built in protection, and do not install unknown programs on the counter computer.
- A **weak password** can be guessed from a stolen copy. Choose a long password; Emporium refuses short ones.
- **People acting together** (two employees covering for each other) cannot be stopped by software, but the ledger makes
  their actions visible after the fact.
- **The Reset at the door needs no password** (Build 7). It can end the wait after wrong tries, start the practice store again, or take the store off this device after the store's name is typed. Nothing in the books can be read this way: they stay sealed, and a backup saved first opens only with the password or the Master Key. The risk is loss, not disclosure: anyone at an unattended counter could erase that device's books. Keep a sealed backup off the device, every day.
- **The wait after wrong tries is short** (at most a minute) and the Reset ends it, so the owner is never shut out. The real protection against guessing is the password's length and the slow key derivation (PBKDF2, 600,000 rounds), not the wait.
- **A person's key opens the same sealed books as the owner's.** The limits on what each person sees (costs, profit,
  reports) are kept by Lakay itself, not by a separate lock on that data. Someone who copied the books and also knew a
  staff password, and who wrote their own program, could read everything. Give keys only to people you trust with the
  store, and take a key back when someone leaves.
- **No program is proof against every attack.** Before Emporium is relied upon under audit, I recommend an independent
  security review by a professional, and that your accountant review the reports' arithmetic and tax rules.
- Emporium does not file taxes, move money or replace the provider systems of RIA, CAM, Unitransfer or Boss Revolution.
- **A leader's limits are kept by Lakay, like every person's.** The books refuse what a leader may not do, but anyone
  who holds a key holds the Store Key. Give The people and Backups only to someone you would trust with the store.
- **Pay in Lakay is an estimate**, from the time clock at the rates set, before taxes and deductions. Lakay does not
  do payroll taxes, withholding or filings, and it does not know the overtime rules where the store is. It starts with
  overtime after 40 hours in a week at one and a half times; the owner should confirm what applies with an accountant
  or the labour office. The rates are kept apart by Lakay like the costs: anyone who holds a key holds the Store Key.
- **A passport or identity number is refused only when it looks like one.** Lakay cannot know every country's
  pattern; a number written another way (with spaces, or in words) would not be caught. The room and the Guidebook
  say so, and ask that such numbers never be written.
- **The store's earnings from transfers count only the commissions written.** A cashier cannot write a commission;
  until someone with the reports writes it from the provider's statement, that entry counts as nothing, and the room
  says how many there are.
- **A joining file is a backup with an invitation inside** (Build 25). Its readable parts are those of any backup. A
  device removed from the store keeps what it held, sealed, and still opens with a person's password: removal stops
  its changes from being taken in, but does not take back what it holds, and does not change the Store Key.
- **Notes are kept apart by Lakay, not by a key of each person's own.** Every person who can open the books holds the
  Store Key, so someone who signs in and uses a browser's developer tools could, with effort, read another person's
  sealed notes on that device. Lakay never opens or shows them, but the seal itself is shared by everyone with a key.


## 9. Verification

Every build is checked in Chromium (the engine behind Edge and the Windows program) by automated tests: setup, the door,
the Master Key, sealing (the stored data is checked for any readable item name), sales arithmetic, stock, reports,
backups and restore, the ledger's chain, the three languages, and the layout at common screen sizes. The results are
published with the build.

## Appendix: methods and parameters (Build 1)

| Purpose | Method | Parameters |
|---|---|---|
| Random values | `crypto.getRandomValues` (Web Crypto) | |
| Store Key | AES-GCM | 256-bit key, generated by `crypto.subtle.generateKey` |
| Sealing each record | AES-GCM | 96-bit random IV per write; 128-bit tag; additional authenticated data = store id, record kind and record id |
| Password key | PBKDF2-HMAC-SHA-256 | 600,000 iterations (the OWASP Password Storage Cheat Sheet's recommendation for PBKDF2-HMAC-SHA-256); 128-bit random salt; password normalised to Unicode NFC |
| Master Key | 240 random bits + 16-bit checksum, written in Crockford Base32 (52 characters, 13 groups) | |
| Master wrapping key | HKDF-SHA-256 | salt = store id; info = "emporium master wrap v1" |
| Wrapping the Store Key | AES-GCM (`wrapKey` "raw") | 96-bit random IV; additional data names the store and the envelope |
| Ledger chain | SHA-256 over the line's canonical JSON, which includes the previous line's fingerprint | |
| Key in memory | The Store Key is unwrapped as non-extractable for daily use; it is unwrapped as extractable only during setup and password changes | |
| Idle lock | 15 minutes by default (5 to 60) | |
| Wrong password | A growing wait after 5 failures (the real protection is the cost of PBKDF2) | |

With a random 96-bit IV, NIST SP 800-38D advises at most 2^32 encryptions under one key. A store writing 100,000 records
a day would reach that limit after more than 100 years. Key rotation is still planned (Stage 9).
