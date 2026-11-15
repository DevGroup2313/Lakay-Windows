# Lakay: what changed in each build

Copyright (c) 2026 Yannie D. Forest. All rights reserved. NO LICENCE IS GRANTED. See LICENCE.txt.

The newest build is first. The build number also shows in Lakay's About.

## Build 23 (15 November 2026): who keeps the customer's fee on a transfer

The owner's answer of 15 November 2026: only the commission counts as the store's, "but I might want the option for both added".

- **For each provider, the owner chooses who keeps the fee a customer pays on top:** the provider (as since Build 15, and still the first choice) or the store. It is a third choice in How it settles, explained as it is chosen.
- **When the store keeps it**, the fee counts in Earnings with the commission ("in customers' fees the store keeps", with the provider's name), the table marks that provider's fees as the store's, and the fees are no longer part of what is held for the provider: what is owed to it goes down by as much. The provider's card says so, with the fees kept in all.
- The choice is the owner's alone and a ledger line (`provider.setup` carries it). Verify finds nothing wrong after it.
- Every word is in English, French and Kreyòl (11 new phrases; the Kreyòl is marked for review by a native speaker).
- tests/t_build23.js: 17 checks.
- Shown with this build, for the owner to decide: the green emoji beside periwinkle versions, side by side; and the keys at the right edge on a phone, as they stand now and laid down.

## Build 22 (15 November 2026): Travel, a short record of each flight booked for a client

The owner's answer of 15 November 2026: the owner books flights for clients on websites, and did not know what Lakay should keep. This build proposes a short record, kept to what the counter needs.

- **Travel, a new room in the menu**, after Inventory, for everyone who sells. Each booking keeps: where the trip leaves from and where it goes (an airport's letters or a city's name), the day it leaves and the day it comes back (or one way), how many travel (one to nine), where it was booked, the confirmation code from its email, the ticket's price as the website charged it, the store's fee, and a note.
- **The client's payments until it is paid in full.** A deposit can be taken as the booking is written, and the rest later with Take a payment, in cash, by card on the store's own machine (with the machine's approval code, never the card's number) or another way the store takes. Each booking shows its total, what was paid and what is left to pay.
- **To pay, Coming up, All, Cancelled.** The room opens on the bookings with money still owed, the soonest trip first. The figures at the top: what is still to pay, the bookings to pay, the bookings made this month and, for those who see the costs, the month's fees.
- **The store's fee is its own earning.** Earnings counts it with the commission on transfers and top-ups, apart from the sales.
- **Reports** show, for the period, the clients' payments for bookings (in cash, and by card or another way) and what went back to them, kept out of the sales, so the drawer can be counted.
- **Mistakes and cancellations.** Those who see the reports void a payment typed by mistake, with a reason, and cancel a booking: the part of its fee the store keeps, and what goes back to the client, in cash or another way. Nothing is erased; it stays in the books, struck through. A cancelled booking takes no more payments, and its kept fee still counts.
- **Who sees what.** Everyone who sells writes bookings and takes payments. The ticket's price and the fee, once written, are shown only to those who see the costs, and only they change them. The total never falls below what the client has paid.
- **Never a passport number or a card number.** Lakay refuses a card's number wherever it could be typed (it checks the number as card machines do), and refuses what looks like a passport or identity number (at most two letters, then seven to nine digits). That second check is a guess: it cannot catch every such number, and the room says so.
- **The client's name and phone: only if the owner turns it on**, in Settings, Travel bookings. It is off at first, and this build keeps none. When it is on, a booking holds a name and a phone, sealed with the books and never written in the ledger. Turning it off asks first, then erases them from every booking. The owner also sets the store's usual fee there, offered for each new booking.
- **The Home** reminds those who sell of a trip in the next seven days with a balance to pay.
- **Nothing of this is written during an exercise.** Verify replays every booking, its payments and its cancelling, and finds one changed outside the books.
- **The practice store** has four bookings: two travelling from Miami to Port-au-Prince in five days, paid in full (a deposit in cash, the rest by card, taken by Marie); one from Fort Lauderdale to Cap-Haïtien in twelve days with a balance to pay; one from New York that came back two days ago; and one to Santo Domingo cancelled, the store keeping its fee. The codes are made up. A practice store made by an earlier build is given these once, as it opens.
- **Every step is a ledger line:** `booking.made`, `booking.changed`, `booking.paid`, `booking.payVoided`, `booking.cancelled`, `settings.bookings`.
- A chapter in the Guidebook, Travel bookings; three tips. Every word is in English, French and Kreyòl (155 new phrases; the Kreyòl is marked for review by a native speaker).
- tests/t_build22.js: 73 checks. Every suite passes: 854 checks in all.

## Build 21 (15 November 2026): Earnings, settling with each provider, and each person's pay

The owner's answers of 15 November 2026: earnings means both the store's own earnings from transfers, top-ups and bookings (apart from its sales) and each employee's pay; for settling with the providers, "I want the option to do any of them".

- **Earnings, a new room in the menu**, after Schedule, with tabs: My pay, The store, Providers and Pay. Each person sees what their access opens. A cashier sees only their own pay.
- **The store: earned apart from sales.** For today, this week, last week, this month, last month or this year: the commission on transfers and top-ups, provider by provider, and the fees customers paid (counted as the providers' money, as the reports have done since Build 15). For those who see the costs, it is set beside the profit on sales: earned in all. For those who also see pay: what is left after pay, with the note that pay is an estimate and that rent, power and the goods bought are not counted. Bookings join this when travel bookings come (Build 22).
- **Commissions written afterwards.** A cashier records a transfer without its commission, which is the store's own figure. Those who see the reports now write it afterwards, from the provider's statement: Write the commissions lists the entries without one. One ledger line holds them all, and a commission already written is never changed this way.
- **Providers: each one's account, settled the owner's way.** For each provider the store works with: what was taken in and paid out, what was paid to it, and what is still its money in the store's hands (or, when the store paid out more than it took in, what the provider owes the store). The owner says, provider by provider, how it settles: the provider takes the money from the store's bank, the store deposits it, or the store keeps a prepaid balance with it; and whether the commission is taken off at once or paid to the store each month. The choice can change at any time, and the account is worked out again from the log.
- **Record a payment:** paid to the provider (taken from the bank, deposited, or added to the prepaid balance), returned to the store, or a commission received. The window starts at what Lakay works out is held or due. A payment cannot be dated in the future. A mistake is voided with a reason and stays in the log, struck through.
- **Check a statement:** type what the provider's statement says, with a minus sign if the provider owes the store. Lakay says at once whether it matches what it works out, or by how much it differs. The check is kept, and the provider's card shows the last one.
- **Pay, from the time clock.** Each person's hours, breaks left out, at the rate in force on the day of each shift, with overtime counted by the store's week. Those given "pay" choose how often pay is worked out (each week, every two weeks, twice a month or each month) and the overtime (at first after 40 hours in a week, at one and a half times; another limit, twice the rate, or none). A rate is set from a day on, and earlier shifts keep their rate. A period is marked paid once the pay is handed over, with the amount, how (cash, check, bank transfer or another way) and a reference. Undone with a reason, it stays in the books.
- **My pay:** each person's own hours, overtime, rate and estimate for the period, and the periods before with what was marked paid.
- **Pay is an estimate before taxes and deductions.** Lakay does not do payroll taxes, and says so wherever pay shows.
- **"Pay", a new kind of access**, held by no level: only the owner gives it, and a manager who looks after the people cannot give it. No one sets their own rate, marks their own pay paid, or undoes it. The books refuse it, not only the screens.
- **The Home** says when the last period's pay is not yet marked paid for someone, and when a prepaid balance is used up.
- **Nothing of this is written during an exercise.** Verify replays every settlement and every period marked paid, and finds one changed outside the books.
- **The practice store** settles each provider its own way: RIA by deposit, its commission paid monthly; CAM taken from the bank; Unitransfer by deposit; Boss Revolution a prepaid balance (given $300, then $150). A week ago Jean settled what was owed until then. Pay is weekly with overtime after 40 hours; Marie at $15.50 an hour, Jean at $19.00; last week's pay is marked paid. A practice store made by an earlier build is given these once, as it opens.
- **A fix in the practice store's sample transfers.** The dice that placed them lost their last digits, so every entry fell at ten in the morning, written by Marie, with no commission. They now fall through the day, and the owner's carry a commission.
- **Every step is a ledger line:** `provider.setup`, `provider.settled`, `provider.settleVoided`, `provider.checked`, `service.commission`, `pay.settings`, `pay.rate`, `pay.paid`, `pay.voided`.
- A chapter in the Guidebook, Earnings, providers and pay; three tips. Every word is in English, French and Kreyòl (222 new phrases; the Kreyòl is marked for review by a native speaker).
- tests/t_build21.js: 77 checks. Every suite passes: 781 checks in all.

## Build 20 (15 November 2026): the Schedule, with shift swaps approved by a leader

The owner's request: "generate schedules for my employees and be able to manage their shifts and be able to restructure their schedules and swap their shifts or reschedule them when needed".

- **Schedule, a new room in the menu**, after Team. The week's shifts: a line for each person, a column for each day, and the hours planned. The arrows move to the weeks before and after (eight each way). On a phone the week shows day by day.
- **Planning, for those given the team's hours.** The plus key in a day adds a shift: who, the day, from and to, and a note if it helps (Register, stock, closing). Press a shift to change it or remove it. No one is ever given two shifts at once.
- **The plan of a day gone by is kept as it was.** No shift can be added, changed or removed on a past day, by anyone, so the schedule cannot be rewritten after the fact to make someone look absent.
- **Generating the weeks:** Keep as the usual week keeps the week shown as the store's pattern; Fill from the usual week then fills a new week in one press; Copy the week before does the same from the week just past. Only today and the days to come are filled, and a shift that would overlap one already planned is left out.
- **Each person's own shifts** for the next two weeks, at the top, with Ask to swap.
- **Swaps.** A person asks a colleague to cover one of their shifts, or to trade it for one of the colleague's, with a word if they wish. The colleague answers first. Then someone with the team's hours approves, and only then do the shifts change hands, checked again as they are then. No one approves their own request, the owner aside. A request can be cancelled until it is decided; a request on a shift a leader then changes is closed. The window offers only what can work: it says when a colleague already works then, and lists for a trade only the shifts each of the two is free for.
- **Against the time clock.** Each shift that has begun shows how it went: on time (in within five minutes of the start), late by so many minutes, not in yet, or missed. Planned and worked, for leaders, sets the hours planned beside the hours the clock counted, with the late and missed shifts. The schedule never changes the time clock.
- **The Home** shows the person's next shift, a colleague's request, and for leaders the swaps waiting for them.
- **The practice store** has a schedule: the past days as its sample shifts were worked (one day Jean was planned from half past twelve, so he shows 17 minutes late), a usual week of five days each from today, a cover Jean agreed to (waiting for the owner) and a trade Jean asked of Marie. A practice store made by an earlier build is given these once as it opens.
- **Every step is a ledger line:** `slot.added`, `slot.changed`, `slot.removed`, `week.filled`, `rota.saved`, `swap.asked`, `swap.answered`, `swap.decided`, `swap.cancelled`.
- A chapter in the Guidebook, The schedule and shift swaps; three tips. The Guidebook's chapter on the clock now says the dot is periwinkle, as it is since Build 19. Every word is in English, French and Kreyòl (127 new phrases; the Kreyòl is marked for review by a native speaker).
- tests/t_build20.js: 58 checks. Every suite passes: 704 checks in all.

## Build 19 (15 November 2026): team leaders and managers, training assigned to each person, exercises, onboarding and refreshers

The owner's request of 15 November 2026: limited administrative access for team leaders and managers; training and exercises on the system and the app, assigned to employees and new hires; a full onboarding system, with refreshers, built into the app.

- **Access to lead, within limits.** Three new kinds of access: Training (assign lessons and exercises, start a new person's onboarding and sign it off), The people (add people, give a first password, take a key back) and Backups (save a sealed backup). A new level, Team leader: selling, the stock, the team's hours and Training. A Manager has all of them. Only the owner gives them at first.
- **The limits are kept by the books, not only by the screens.** A person who looks after the people gives only the access they hold themselves, and never The people itself. They change no one who holds more, never the owner, and never themselves. What they cannot give is shown in the window, but closed. Settings, restoring a backup and the Author Studio stay the owner's.
- **A manager adds a person with their own password.** Their password opens the store's key from their own envelope, and a new envelope is sealed for the new person, as the owner's does. A wrong password gives no key. The ledger says who added whom.
- **A manager's backup:** the Team room has the key to save a sealed backup, and the Home reminds them after a week.
- **Learning has tabs:** My training, Lessons, Exercises and, for those who train, The team and Plans. The room opens on the person's own training when they have some, and on the lessons when they have none.
- **Exercises on the real screens.** Six: a break, a sale in cash, a sale paid in two parts, a card payment, a delivery, a money transfer. Each says what to do, opens the right room and watches for the work. While it runs, the books Lakay shows are a copy in memory: the sale, the delivery, the transfer or the break change the copy, never the sealed books, and nothing is written to the device. A band across the top says so, with What to do and End the exercise. When the work is done, the copy is let go, and only the mark that it was done is written. Work other than the counter's is refused while an exercise runs; a lock ends it; a sale waiting at the Register is put aside and brought back. The card exercise follows the store's own payment settings.
- **Assigning:** who, what (lessons, exercises, the store's own tasks) and by when. Each person gets only what their access opens, and nothing is given twice. A lesson assigned counts once it is taken after it was assigned; an onboarding counts what was done before.
- **Onboarding, day by day.** Starting a person's onboarding gives them the store's path, each item due on its day. A new person's starts the day they are added (a box in the window, checked at first). The person sees it in My training, day by day: what is done, what is due today, what is overdue. When everything is done, a leader signs it off. No one signs off their own, and the books refuse an early sign-off.
- **The store's own tasks**, such as reading the cash rules, or a first shift beside a leader. The person marks one done, or a leader signs it.
- **Refreshers:** in Plans, how long after a lesson or exercise was last done it comes due again (3, 6 or 12 months). It shows a week before.
- **The Home** says what is waiting: the person's own training and how much of it is overdue; for leaders, the onboardings ready to sign off, or the people with overdue training.
- **The practice store** has a plan of its own: two tasks, a path of six days and three refreshers. Jean, the manager, started Marie's onboarding two days ago; the owner gave Jean the Reports lesson. A practice store made by an earlier build is given these samples once, as it opens, and Jean the manager's new access.
- **A manager added before Build 19 keeps the access they had.** Nothing is given without the owner: to give a manager the new access, press their name in Team and choose Manager again. A level's name is now kept only when the access is that level's own.
- **Every step is a ledger line** (`course.updated`, `training.assigned`, `training.unassigned`, `onboarding.started`, `onboarding.signedoff`, `training.exercise`, `training.task`), and Verify replays the marks of the exercises and the tasks with those of the lessons.
- **No green left:** the dot on the name key at the top (and beside each name in Team) was still green when a person was on the clock, since Build 6. It is now the logo's periwinkle; grey off the clock, amber on a break. The green circle beside "Your shift" on the Home, in the status window and over "On the clock now" in Team is now a blue one.
- A new chapter in the Guidebook: Training, onboarding and refreshers. Every word is in English, French and Kreyòl (171 new phrases; the Kreyòl is marked for review by a native speaker).
- tests/t_build19.js: 108 checks, among them a store of its own where a manager adds a person with her own password and that person signs in, and a practice store made by an earlier build. tests/t_build17.js now opens the Learning room's tabs and finds a cashier's training on the Home. Every suite passes: 646 checks in all.

## Build 18 (15 November 2026): the Author Studio made new

The fourth item on the owner's list: the Author Studio, which the owner found poor, redesigned from the ground up.

- **Tabs, as Inventory's:** At a glance, Names, Words, Look, Receipt and Safekeeping. The menu page that only repeated the menu is gone.
- **At a glance:** the app's calling card (the mark, the name, the line under it, the store) beside how each part stands now, each a key into its tab.
- **The desk:** on a wide screen the tools sit on white slabs at the left, and a live stage at the right stays in view. On a phone the stage follows the tools.
- **Names:** the app's name, the store's and the owner's, and the line under the name in each language, with a count of letters. The stage shows them at the door, in the menu, and on the window and its tab, as they are typed.
- **Words, now a phrase book:** every phrase as it reads on screen, by the place where it shows (Everywhere, Door, Menu, Home, Register, Inventory, Reports, Team, Learning, Settings, Guidebook, Tips, Studio), 25 to a page. Internal names are no longer shown. Edit opens a phrase with Lakay's words above the owner's; Keep sets it aside, marked "Not saved yet", until Save the phrases (or Undo them). Changed shows only the owner's phrases. The search finds every word typed, in the language chosen or in English.
- **The blanks Lakay fills in are kept:** a phrase such as "{n} of {m} done" cannot be saved without {n} and {m}; the Studio names the blank that is missing.
- **Look:** the six colour sets, each drawn as two small windows, by day and by night, named for their colours (Dawn, Amethyst, Indigo, Royal blue, Burgundy, Graphite) with no talk of brass or of old builds. The spacing, Compact or Comfortable, drawn too. The stage shows a piece of the counter in the colours worn.
- **A fault fixed:** Amethyst had no colours of its own, so choosing it changed nothing. It now has its own, by day and by night.
- **Receipt:** the lines under the store's name, the thank you in each language and the note at the foot, with the receipt drawn on its paper as it prints, and a test receipt to print.
- **Safekeeping:** save a copy of the choices, bring them back from a copy (checked first: unknown phrases, colours and fields are left out), put back every original, and **the history**: what was changed in the Studio, when, and by whom, read from the ledger.
- **Not saved yet:** the heading's chip says when a form holds changes, and leaving the tab then asks first.
- The Guidebook's chapter on the Author Studio is rewritten for it. Every word is in English, French and Kreyòl (65 new phrases, 28 rewritten; the Kreyòl is marked for review by a native speaker).
- tests/t_build18.js: 55 checks. Every suite passes: 538 checks in all.

## Build 17 (14 November 2026): Learning, with a lesson for each part of the work, a guided tour that does the work in front of the person, and a tip in every room

The third item on the owner's list: trainings for staff and new hires, a guided interactive tour with live demonstrations, and tips throughout.

- **Learning**, a new room in the menu under Learn. Eight short lessons: Welcome to Lakay, Your hours, Making a sale, Cards, phones and payments in parts, Money transfers and top-ups, Deliveries and finding stock, Reading the reports, and Keeping the books safe. Each person sees the lessons their access opens: a cashier five, a manager seven, the owner eight.
- **Show me: the guided tour.** Lakay lights one part of a room at a time and says what it is for, with Next, Back and Escape (the arrow keys too). Where a lesson shows the work, a pointer moves to each key and presses it, and types where a person would type, through Lakay's own keys: it finds an item, adds it to the sale, takes the cash, takes a card part and then the rest, records a transfer, receives a delivery. Some steps are the person's turn (add an item to the sale, open the payment window, choose last week); the tour says when it is done.
- **Safe in the store itself.** In the practice store a tour finishes the sale, the delivery and the transfer, so that all of it can be seen. In the store itself it stops before anything would be written in the books, says so, closes what it opened, and puts the sale at the Register back as it was. The tests check that no line is written.
- **Two questions end each lesson.** A wrong answer says "Not quite. Try again."; the right one says why. When both are answered, the lesson is marked done in the books (a `training.completed` line), with how many were right the first time. Taking a lesson again keeps the newest mark. Verify replays the marks with the rest of the books.
- **The team's lessons.** The owner, and those with the team access, see each person's lessons in Learning: how many are done, the last one finished, and a mark for each lesson. In the practice store, Marie and Jean have taken some already.
- **Show me in the rooms.** The headings of the Register, Inventory, Reports, Team and Settings have a Show me key that starts that room's tour.
- **A tip at the foot of every room**, a different one at each visit, with Another tip. The cross hides the tips; Display turns them on again. Learning also lists every tip, room by room.
- **The Home** has a drawer for Learning, and reminds a staff member of the lessons still to take.
- **A new chapter in the Guidebook:** Learning: lessons and the guided tour.
- Calm and "reduce motion" keep the tour still: the pointer appears at each key instead of travelling to it. On a phone, the tour's bubble sits at the top or the foot of the screen, away from what it lights.
- Every word is in English, French and Kreyòl (258 new phrases; the Kreyòl is marked for review by a native speaker).
- tests/t_build17.js: 88 checks. tests/t_build10.js now counts eight drawers on the Home. Every suite passes: 483 checks in all.

## Build 16 (14 November 2026): taking payment by cash, card, Apple Pay, Google Pay and other ways, in one part or several

The second item on the owner's list: card, Apple Pay and Google Pay through any processor, and split payments.

- **Take payment** replaces Take cash, on the same key and F9. Cash is chosen first, so a cash sale is as quick as ever: the amount received, the change, done.
- **A card, Apple Pay or Google Pay** is charged on the store's own card machine, whatever its processor (Square, Clover, SumUp, a bank's terminal). Lakay shows the exact amount to charge ("Charge $53.21 on Square") and records what was taken: the way, the amount, the machine's approval code and, if the owner asks for them, the card's last four digits.
- **Other ways the owner accepts**, by name (for example Zelle or Cash App), with their reference.
- **Split payments.** Take part of the total one way ("Take this part, then the rest") and the rest another: cash then a card, a card then Apple Pay, two cards. Each part is listed with what is left to pay, and a part can be taken back before the sale is done. No part may be more than what is left. Cash given for the last part gets its change.
- **A card's number never enters Lakay.** Lakay never touches the card. A full card number (13 to 19 digits whose check digit is right) is refused wherever it could be typed: at the counter, in Settings, and by the books themselves.
- **Settings, Payments** (the owner): the ways the store takes (cash always; card, Apple Pay and Google Pay each on or off), the card machine's name, the other ways by name, and whether to ask for the approval code (ask, require, or not) and the card's last four digits.
- **Receipts** list each payment, the card or phone with its approval code under it, then the cash received and the change.
- **Reports: How it was paid.** Each way, how many payments and how much, with the sales paid in parts counted; the cash is what stayed in the drawer after the change. The receipts export (CSV) lists every way a sale was paid, the cash received, the change and the approval codes.
- **The practice store** now has sales by card, by phone and in two parts, and takes Zelle and Cash App, so every part can be tried.
- **A fix:** a key or field Lakay hides stays hidden whatever its own style. Build 15's camera key had stayed visible on devices without a camera (pressing it only said that no camera could be used); it is now hidden there.
- **A new chapter in the Guidebook:** Taking payment: cash, cards and phones.
- tests/t_build16.js: 51 checks. Every suite passes: 395 checks in all.

## Build 15 (14 November 2026): Inventory's departments, scanning everywhere, large inventories, and the transfers and top-ups

The first item on the owner's list: Inventory, with the store's departments as real sections, barcode scanning everywhere, and room for an inventory of any size.

- **The departments, each with its own tab and page:** Music, Films, Perfume and beauty, Caribbean groceries, Drinks, Haitian patties and food, Money transfers and top-ups, and Other goods (and any department the owner adds). All departments shows them side by side, with what runs low and what is out. Each department's page has its own sign, its own figures (items, units on the shelf, value at cost, running low), and its own search and filters. An item added from a department starts in it. The arrow keys move between the tabs, and the tabs fade at an edge where more of them wait.
- **New signs for the departments.** Each is a line drawing of what it holds, set in the logo's periwinkle jewel: a disc, a film, a bottle, a basket, a cup, a covered dish, two arrows, a tag. The coconut and dumpling emoji are gone, in keeping with the owner's rule against fruit and food as decoration.
- **Nothing green.** The stock figures that were green, and every other "all is well" mark (the people who are active in Team, the success messages), are now the logo's periwinkle, by day and by night.
- **Barcode scanning everywhere.**
  - A scanner that types, plugged in or paired, is heard in every room, even with no field in focus. At the Register the item goes onto the ticket. In Inventory its card opens, or its delivery while receiving. Anywhere else Price check shows it. With a window open, a scan fills its barcode field.
  - A code no item has says so and offers to add one with that barcode; at the Register the new item then goes straight onto the ticket.
  - The same product is found whether its code comes as EAN-13, UPC-A, EAN-8 or GTIN-14.
  - Ordinary typing is never mistaken for a scan: Lakay tells a scanner by its speed.
  - **The camera, where the device allows.** A camera key stands beside the searches and the barcode field on devices with a camera. It uses the device's own barcode reader where there is one, and otherwise Lakay's own reader for the codes on store goods (EAN-13, UPC-A and EAN-8), which accepts a code only when its check digit is right and it reads the same code twice. The picture never leaves the device and is never kept.
- **Large inventories.** Every list is drawn a page of fifty at a time, with Previous and Next, from one index kept in memory. With twenty thousand items in the test: a search took about 5 ms, a scanned code about 0.1 ms, and Inventory drew in under 20 ms.
- **Money transfers and top-ups, a service with its own log.** Each transfer sent, transfer paid out and phone top-up is recorded with its provider (RIA, CAM, Unitransfer, Boss Revolution or another), the amount, the fee, the provider's reference and, for those who see the reports, the store's commission. The page shows today's figures, the log by period and provider, and what came into and went out of the drawer. The money is held for the provider, so it is never counted in the store's sales or profit; the Reports show it in a section of its own. A mistake is voided with a reason by someone who sees the reports, and stays in the log. No customer's name or papers are kept. Verify replays every entry from the ledger. At the Register, the department records one at the counter.
- **The web app as a zip for the owner's own website.** At the owner's request, `builds/Lakay-Web.zip` replaces the GitHub Pages plan: a `lakay` folder to upload, and a READ ME FIRST. Its manifest is now `manifest.json`, which every host serves correctly. The address must begin with https, because browsers allow Lakay's sealing only on secure addresses; on plain http Lakay now says so.
- **Two new chapters in the Guidebook:** Departments and scanning, and Money transfers and top-ups.
- tests/t_build15.js: 60 checks, including Chromium's fake camera showing a printed barcode, and twenty thousand items. The Build 14 test now serves the web app from the zip and checks the https message (49 checks). Every suite passes: 344 checks in all.

## Build 14 (14 November 2026): the logo left alone, the colour woven in, a quieter rail, and Lakay on the web

The owner approved the arrangement of Build 13 and asked for five corrections. Everything else stays as approved.

- **The logo, left alone.** The thick ring drawn around the logo in Builds 12 and 13 is gone. The logo keeps the living, popped-out 3D mark and the movement it had before the redesign.
- **The colour woven in, not poured on.** The day's figures sit in a pearl card with a periwinkle rim and a slim periwinkle band along its top, in place of the solid purple card. New sale is a pearl key with a periwinkle edge and a periwinkle jewel, in place of the solid purple key. By night both are darker slabs with the same periwinkle touches.
- **No gold band.** The proverb's champagne plaque at the foot of the Home is removed. The Home now ends with the rooms.
- **A quieter side rail.** It carried seven keys. It now carries the three the counter reaches for all day: the sticky notes, a new sale and Price check. The others moved to the top bar:
  - **Alerts** now holds what needs seeing to (each low item with its Receive and Open keys, and a backup to make) and the reminders (their list and the form to add one). Its dot shows while anything waits, and it rings while a reminder is due.
  - **The calculator** has its own small key beside Alerts. It still floats and can be carried anywhere.
  - **Day or night** stays in Display.
- **Lakay on the web.** `build.py` now also makes `web/`: the same page as the apps, a manifest, the logo's icons and a service worker. It is made for the owner's GitHub Pages site, at **https://devgroup2313.github.io/lakay/**. The site's repository (`DevGroup2313.github.io`) is still to be created by the owner: GitHub did not allow this session to create it. There it shows Lakay's logo in the address bar and the tab in any browser. Added to a home screen or the Dock, or installed from Chrome or Edge, it shows the logo with no white square: the coin alone where a system allows a round picture, the logo's own periwinkle tile where a system draws a square. Once opened, it works with no connection. The books stay on each device, sealed in the browser that opens the page.
  - The web build's security policy allows one thing more than the apps': its own manifest, icons and service worker, from its own address only. It still runs no script but its own and reaches no other site. The service worker keeps only the site's own files, never the books.
- tests/t_build14.js: 46 checks, including the web app served as GitHub Pages serves it, checked by Chromium for installing, and opened again with the server gone. The tests of Builds 10 and 12 follow the changes. Every suite passes: 281 checks in all.

## Build 13 (14 November 2026): the Home's colours turned around

At the owner's request, the Home now wears the logo's colours the way Ingenium and Carpe Diem wear theirs. The large surfaces are white slabs. The cards set inside them and the keys that act are the periwinkle enamel, or a gentle lavender beside it. It reads softer and calmer, and keeps its depth.

- **The welcome** is a white slab with the shell's spiral engraved faintly across it. The day's figures roll on pearl drums inside an enamel card.
- **The keys:** New sale is the enamel key; Receive a delivery and Price check are gentle lavender keys. In what needs seeing to, Receive is enamel; Set up the real store is enamel; the quieter keys (See all, Read the guidebook) are lavender.
- **The rooms** are white drawers with enamel jewels and champagne label plates, in a lavender tray on a white slab.
- By night the slabs are Lakay's night slabs and the enamel deepens to the shell's indigo.
- **The builds' Node.js 24 actions, proven.** Build 12 was the first build made with them: all five apps were built and published, and the Fire tablet's build log shows no Node.js 20 warning. At the owner's request, the same change was made in the owner's other apps' repositories (Carpe Diem, The Forge, Ingenium and Inkwell), marked so that no build started. See `release/ACTIONS.md`.
- tests/t_build12.js checks the new arrangement (31 checks). A check in tests/t_build8.js that wanted a note back at exactly the same point now allows a hundred-thousandth of a point: a drag can leave a position that far off a whole number. Every suite passes: 235 checks in all.

## Build 12 (14 November 2026): the Home in the seashell's colours, Lakay's logo on home screens, and the builds off Node.js 20

The owner found Build 10's Home too close to what came before. A green design was tried after it and rejected outright; it was never released. The owner then asked for the colours of Lakay's seashell logo and something far better to look at.

- **Every colour on the Home comes from the logo:** its periwinkle enamel, the indigo of the shell's sides, the pearl of the shell, the blush of the pearl at its heart, and the fine champagne gold of its rim. Nothing on the Home is green. The other rooms keep Lakay's Dawn, which comes from the same logo.
- **The hero is an enamel plate** with the shell's own spiral engraved across it, turning slowly around the logo, with a soft play of colour like the inside of a shell. The logo sits in a pearl ring.
- **The day's figures roll into place on pearl drums** behind a champagne rim, as a mechanical counter's do. A screen reader hears each figure whole. A profit, a loss and low stock each light a small lamp beside the figure: periwinkle, red and amber.
- **The counter's three keys** are enamel (New sale), pearl (Receive a delivery) and blush pearl (Price check), each in a champagne rim, on a pearl tray below the plate. A key travels down when pressed. On a narrow screen the keys wrap rather than cut their words.
- **The day's ledger** on ruled paper with a champagne margin, the takings of each hour as columns in the logo's periwinkle, and the day in brief with dotted leaders. **What needs seeing to** as ledger entries. **The latest sales** on a receipt roll with a torn foot. **The rooms** as pearl drawers with champagne label plates in an enamel cabinet. **The day's proverb** on a champagne plaque.
- By night the enamel deepens to the shell's indigo and the drums turn dark with pearl figures. Calm and the system's "reduce motion" hold the drums and the engraving still.
- **Lakay's logo in the tab and on home screens.** The page now carries the logo for the tab (the round coin alone, with nothing around it), for a home screen shortcut, and for the iPhone and iPad home screen. A home screen icon is a tile filled edge to edge with the logo's own periwinkle, never a white square. For a website, the same pictures stand beside the page in `app/` (see the README). The page's security policy is unchanged.
- **The app icons, without the white square.** The iPhone and iPad app's icons are the logo's periwinkle tile. The Fire tablet's icon is the round coin alone. The Mac and Windows icons were already the coin alone. `release/icons.py` makes every icon from the one approved drawing.
- **GitHub's builds moved off Node.js 20.** GitHub warned that Lakay's actions ran on Node.js 20, which it no longer supports. Every action now names a release written for Node.js 24 by its full commit, so a moved or altered release can never reach Lakay's builds: checkout 7.0.1 and setup-python 7.1.0. Each runtime was read from the action's own file at that commit. See `release/ACTIONS.md`.
- tests/t_build12.js: 28 checks. The Build 10 test reads each drum's figure as a screen reader hears it. Every suite passes: 232 checks in all.

## Build 11 (13 November 2026): the sticky notes' papers renamed

- The six papers had been given fruit and other stereotyped names. The owner found them offensive and unfitting for the app, and they were a poor choice. The papers are now named for gems, each with a plain colour word: Citrine (pale yellow), Aquamarine (sea glass), Rose Quartz (soft pink), Jade (pale green), Moonstone (soft lilac blue) and Pearl (ivory). The colours are unchanged.
- Notes made in Builds 8, 9 and 10 keep their colour under the new name.
- The tests of Builds 8 and 9 check the new names; every suite passes.

## Build 10 (13 November 2026): the Home page, redesigned

The Home page was Ingenium's layout, with seven large room cards that repeated the menu and pushed the day's work to the bottom. It now puts the counter's work first, and reads from action to calm.

- **The hero:** the living mark, the date, the greeting, and a few live facts (the day's sales, the last sale's time, the people on the clock). Beside them are the counter's three keys: New sale, Receive a delivery, and Price check.
- **One slim strip for what comes next:** the first steps of a new store, with the next one marked and its key; a person's shift, with the break and clock keys; or the practice store's note.
- **Today at the counter:** the four figures, and the takings of each hour as columns. Each column answers the pointer, a press or the keyboard with its takings and sales. The busiest hour is named above. A table carries the same figures for screen readers. The column colours were checked with the chart checker, by day and by night.
- **Needs you:** what runs low, each with its Receive key; the reminders due today; and, for the owner, a backup that is missing or more than a week old. When nothing needs you, it says so calmly.
- **Latest sales:** the last five, each with its time and who served it. A press opens the receipt.
- **The rooms** as small tiles, and **the day's Haitian proverb** on parchment, in Kreyòl with its meaning.
- The page fits the iPad and the phone without sideways scrolling, and keeps still in Calm.
- tests/t_build10.js: 33 checks, all passing, with every earlier suite.

## Build 9 (13 November 2026): the edit menu everywhere, and Schedae's own papers

- **The right press's edit menu, inside the sticky notes and every field.** Three faults were found and fixed:
  - A right press on bold or listed words inside a note took only those words as the field, so Select all, Copy the whole field and Clear the field acted on part of the note. The menu now always takes the whole note (the whole editable area).
  - On the Fire tablet, Paste put the tablet program's whole answer into the field, braces and all, instead of the words. The page now takes the words from it.
  - In a browser and the standalone page, Copy borrowed the focus for a moment, so Cut inside a note copied the words but did not remove them. The focus and the selection now go straight back, and Cut removes what it copied.
- **Checked on every road the words travel:** the browser's own clipboard, the Fire tablet's program, the iPhone and iPad program, and the Mac and Windows program, in a sticky note, a search field, a text area in a dialog, and words chosen on the page.
- **Schedae's own papers.** The notes no longer use Carpe Diem's colours. Lakay has six papers of its own, light pastels by day, each with its own night paper. The inks are Lakay's too. A note made in Build 8 takes the Lakay paper nearest to its old one. (Build 11 renamed the papers.)
- tests/t_build9.js: 21 checks, served from this computer so the test reaches a real clipboard. All the earlier suites pass.

## Build 8 (13 November 2026): Schedae, and the Dawn dress refined

- **Schedae, Carpe Diem's sticky notes, in parity,** behind the 🗒️ key at the foot of the side keys. The list makes a new note, finds notes by their words, pins and unpins them, copies their words, and deletes them. A note floats over every room until its ✕ unpins it. It moves by its top and grows from any edge or its corner. Its ⋯ menu changes its paper (Carpe Diem's six: Foolscap, Primrose, Inkwell, Claret, Laurel, Vespers), folds it, opens the list, copies it, or deletes it. Its keys make words bold, italic, underlined or struck through, start a list, add a picture, and save. Undo and redo are on its top. The paper, edges, night papers, ink, head, tools and corner carry the values measured from Carpe Diem by day and by night.
- **Two departures from Carpe Diem, on purpose.** "Send to Tabula" is "Copy the note", since Lakay has no Tabula. New note in the list puts the list away and leaves the caret in the new note, so it can be written in at once.
- **Each person's own, and sealed.** Notes are sealed in the books with the Store Key, one record per person, and a backup carries them. A sign-in opens only that person's notes; the practice store opens all of its sample people's. A note saves itself half a second after typing stops, and again when the books lock. Notes are not ledger lines: they are a person's own scribbles, not the store's accounts.
- **No foreign markup.** A note keeps its words and marks as a small model (bold, italic, underline, strikethrough, lists, line breaks, and pictures held inside the note), never as markup. A paste arrives as plain words, or as a picture. Nothing from outside the page can enter a note.
- **The right press** inside a note opens the Offline Project's edit menu, as in every field.
- **The Dawn dress, refined, by the owner's request.** Lakay keeps its design and its periwinkle; the surfaces are a step more refined. By day: white and ivory faces with crisp hairline rims and a firm stepped edge, a deeper and matte periwinkle on the main keys and the room jewels, and a quieter sunrise behind the page. By night: Lakay's periwinkle ink, calmer and deeper, in place of the saturated indigo. Dialogs, the edit menu, the side keys' panels and the calculator are flat slabs with a hairline rim, without the purple glow and the pillowed walls. The other colour sets follow.
- **The Reset's erase choice** is a quiet card in the same ink as the others, marked by a small brick-red badge and dot, not painted red.
- A new Guidebook chapter: Sticky notes (Schedae).
- tests/t_build8.js: 36 checks, all passing, with the 48 of t_build3.js, the 42 of t_build6.js and the 24 of t_build7.js.

## Build 7 (12 November 2026): never locked out

The owner reported being shut out of Lakay: refused at the door, asked again and again for a key, and unable to reach the practice store. Build 6 had prefilled the sign-in's name with the owner's record name while the door still compared the typed name with the name given at the first sign-in; when the two differed, every try was refused even with the right password, and five refusals started a wait that grew to fifteen minutes. This build removes every such lock.

- **The password is the key, never the name.** The owner's envelope is tried with the owner's password whatever name is typed, or none. A staff name still finds that person's own envelope first.
- **The practice store is always on the door.** Its own key sits beside Enter when a store exists. If its sample books will not open, the door offers to start the practice store again.
- **Refresh and Reset,** on the door's bar and in Display. Refresh starts the app again, as a browser's refresh does. Reset needs no password and offers three things: clear the wait and the remembered name; start the practice store again; or take the store off this device after a sealed backup (the store's name must be typed; a backup can be saved first and restored later with the password or the Master Key). "Can't sign in?" offers Reset as a third way.
- **The wait after wrong tries** is now at most a minute, and the Reset ends it.
- Dialogs and messages now sit above the sign-in card, so nothing on the door is ever out of reach.
- tests/t_build7.js: 24 checks, all passing, with the 48 of t_build3.js and the 42 of t_build6.js.

## Build 6 (7 November 2026): the owner as administrator, the staff, and the time clock

- **The owner is the administrator,** with every room and key, and the user ID 1001. Settings, backups, the Author Studio and the people with their keys are the owner's alone.
- **The Team room.** The owner adds each person with a name, a user ID (1002, 1003 and on) and a level of access: Cashier, Stock keeper, Manager, or chosen one by one (sell; items and prices; deliveries; stock corrections; costs and profit; reports; the team's hours). The owner gives a first password; the person chooses their own at their first sign-in. A key can be given again, or taken back; what the person did stays in the books.
- **Who did what.** Every ledger line, sale, receipt, stock move and shift carries the person's user ID. The receipt says who served; the history of an item says who did each thing; the reports have a Person chooser and a table of each person's sales, with the time they worked and their sales per hour.
- **Signing in and out is the time clock.** A person signs in with their name or ID and their own password, and is clocked in as they arrive. The status key at the top shows who is in, green on the clock and amber on a break; it starts and ends breaks, clocks out, and signs out. "Clock out and sign out" brings the door back for the next person. My hours shows each week's shifts; the owner and managers see everyone's hours and who is on the clock now, and can clock out a person who forgot.
- **What each person sees.** A person without costs and profit sees no cost, profit or value of the stock anywhere: not in Inventory, the item cards, Home, the reports or the CSV files. The rooms, keys and side-rail keys follow each person's access, and the books themselves refuse a change a person may not make.
- **The practice store** has two sample people, Marie (a cashier) and Jean (a manager), with two weeks of shifts and sales. The status key there shows the store as each of them sees it.
- Two new Guidebook chapters: Your team, and Signing in, the clock and breaks.
- tests/t_build6.js: 42 checks, all passing, with the 48 of tests/t_build3.js.

## Build 5 (7 November 2026): the mark in true depth, and the downloads set up as the other apps'

- **The mark in true depth.** The Spiral now stands in sixteen planes at real depth, with its drawing unchanged: the coin's gold edge (four planes behind the face, so its thickness shows as it turns), the shadows the halo and the shell cast on the plate, the shell's own sides under its faceted top, then the lattice, the pearl and the sparkles. It sways further, leans toward the pointer, and its rings, shell and pearl breathe in and out of depth out of step. A press still winds it up like a flywheel. Calm keeps it still.
- **Downloads, as the other apps have them.** Each repository is set up for its device, as Inkwell's and Ingenium's are: the ready-made app in `builds/` on the front page, a READ ME FIRST for the device, and a short README. Each Releases page is "Lakay for <device> (latest build)" and lists only that device's files. Lakay-Mac holds both Mac apps; Lakay-Apps holds the iPhone and iPad app and the Fire tablet's; Lakay-Windows holds the Windows installer and Lakay's source.
- The standalone page is no longer offered as a download: every device has a ready-made app. The iPhone and iPad file is now `Lakay-iPhone-iPad.ipa`.

## Build 4 (7 November 2026): the door, the side rail, the sounds

- **The door.** Ingenium's introduction door, always first: the mark, the name, Enter. The little lock in the card's top-left corner (as in Ingenium) opens the sign-in in the card's place; on a new device it sets up the real store. Carpe Diem's top bar on the door: Display, About and one language key.
- **The side rail, for the store.** 🔔 Reminders (orders, deliveries, bills; they ring when due, sealed in the books), 🔎 Price check (any item by name, code or barcode, with its price and stock; sell it or open it from there), 📦 Low stock (what runs low or out; receive a delivery in one press), 🧮 the calculator (it floats and can be carried anywhere; keyboard, a tape of results, copy), 🌙 day or night, 🛒 a new sale. The › key lays them down.
- **The sounds.** Made live, as Ingenium's are: the door's welcome, felt key taps, a page set down, the mark's flywheel, a book shut, the lamp, a sale sealed. Never in Calm; on or off and three volumes in Display.
- **The edit menu.** The Offline Project's own right-press menu, only where there is something to edit or copy.
- **The mark** in Lakay's own deep periwinkle enamel, with a pearl-light shell and champagne gold; every icon redrawn.
- **Show the password** on every password field.

## Build 3 (7 November 2026): Lakay

- **The name and the mark.** Emporium is now Lakay. Its mark is the Spiral: a nautilus cut in facets like a jewel, on an enamel plate with a fine champagne rim, a pearl at its heart. It lives in seven layers, as Ingenium's seal does: it sways, leans toward the pointer, breathes in depth, turns in counter motion, and winds up like a flywheel when pressed. Every device icon is drawn from it. Le Comptoir and its compass rose are kept in `docs/brand/backup/`.
- **Colours.** Dawn: a warm periwinkle between Carpe Diem's blue and Ingenium's purple, with a sunrise glow and champagne gold.
- **The top bar.** Carpe Diem's capsule: the fold key, the status key, Alerts, Display, Guide, About, and one language key with a small flag.
- **Everywhere.** Hidden scrollbars; the right press panel (Undo, Redo, Cut, Copy, Paste, Paste as plain text, Select all) that works with the device's own clipboard; a show-password key on every password field; Ingenium's footer, with the build number in About and the Guidebook.
- **The door.** Ingenium's door: Enter opens the practice store at once; the real store is set up with a sign-in and the Master Key.
- **Reports.** This hour, the morning, the afternoon, the evening, a day, another day, the week, the month, 2, 3, 6 and 12 months, the year, or between two dates, with every sale listed.
- **Downloads by device.** Lakay-Windows (Windows and the standalone page), Lakay-Mac (both Macs) and Lakay-Apps (iPhone, iPad and Fire). The data folders keep the name Emporium, so nothing is lost.

## Build 2 (7 November 2026): the foundation, redesigned, with the Author Studio

- One family of colours: lavender mist, white and indigo by day; a midnight library (ink, parchment, brass) by night.
  Compact raised keys at the Forge's scale, figures set like a ledger, the ticket as a slip of receipt paper, and the
  side menu after the Forge's own.
- The store's name at the top of every page, so the screen always says whose system it is.
- The Author Studio (after Carpe Diem's): rename the app and the store, rewrite any phrase in English, French or Kreyòl,
  choose a matched set of colours, word the receipt, and export, import or reset those choices. Every change is written
  in the ledger, and the software's own name and build stay on receipts and reports for audits.
- 65 checks in Chromium, served and opened from a file.

## Build 1 (7 November 2026): the foundation

- The door: setting up the store in five steps, the owner's password, the Master Key (shown once, confirmed, printable),
  recovery with the Master Key, restoring a backup.
- The books sealed on the device (AES-GCM, with the Store Key in two envelopes), a ledger whose lines are chained by
  SHA-256 fingerprints, locking by hand and when idle, and "Verify the books".
- Inventory: items, categories, prices, costs, barcodes, reorder levels; receiving stock at an average cost; correcting
  stock with a reason; archiving; each item's history.
- The register: search or scan, the ticket, sales tax, cash with the change to give, the receipt.
- Reports for any period: sales, tax, cost of goods, gross profit, best sellers, items not selling, sales by hour and by
  category, losses, stock value; CSV files for the accountant.
- Sealed backups and restore; English, French and Kreyòl; Day, Night and Auto; larger text; Calm mode; tips beside the
  controls; the Guidebook.
