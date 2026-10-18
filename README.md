# Moss & Moon ☾ — an aesthetic café website

**Live site:** https://moss-and-moon.up.railway.app (every push to `main` deploys automatically)

A full-stack café site built with **Next.js 16 + React 19 + TypeScript**, with a real backend
(Next.js API routes + **SQLite**, built into Node — nothing extra to install).

## Run it

```bash
npm install        # first time only
npm run dev        # → http://localhost:3000
```

For the faster production version: `npm run build && npm run start`.

Staff dashboard: http://localhost:3000/admin — passcode **`moonlight`**
(change it by creating `.env.local` with `ADMIN_PASSCODE=yourcode`, see `.env.example`).

**Going online, real payments and real emails:** see [DEPLOY.md](DEPLOY.md).

## Features

**Ordering**
- ☕ **92 items** in sections (Specials, Coffee, Tea & matcha, Cold drinks, Food, Bakes, Kids, **Shop**), with Goan favourites like Bebinca, Kokum Soda, Sol Kadhi and Chorizo Pão, with search and vegan / gluten-free / nut-free / egg-free filters, edited live from the admin page
- 🥤 Cold drinks (cold brew, frappés, smoothies, mocktails, juices) and savoury food (toasties, sandwiches, toast, pancakes, pasta, bowls) with add-ons like an egg, extra cheese, gluten-free bread or a coffee combo
- 🍱 **Combo deals** (e.g. any coffee + a bake for ₹299), applied in the tray automatically
- 🎂 **Whole-cake orders** 2 days ahead with a message on top (`/cakes`)
- 🥗 **Build your own** bowl or sandwich, and **tasting flights** (pick 3 coffees, matchas or mocktails)
- 🧸 **Kids** section, **half portions** of pastas and bowls, and high chairs when booking
- 🥐 **"Goes well with"**: the drink pop-up suggests the bake most often ordered with it
- 🛵 **Delivery areas** by pincode, each with its own fee, minimum and time
- 🛍 **Café shop**: beans (choose the grind), mugs (choose the colour), a reusable cup, tote, home brew kit and gift box, with stock that sells out by itself
- 🎡 **"Surprise me" wheel**: spin for a random drink, sometimes with a 10% code for today
- 🎛 **Drink builder**: size, hot/iced, ice level, extra hot, whole/oat/almond/soy milk, sweetness, syrups, toppings, extra shot or decaf, with a little cup that fills up as you choose
- ☕ **"My usual"**: one-tap reorder of the drink you order most, exactly how you like it
- 🎙 **Voice ordering**: say "two iced oat lattes and a croissant" (or "my usual")
- 🔁 **Regular orders**: "my oat latte every weekday at 8:30", placed by itself 15 minutes before
- 🎁 **Buy a friend a coffee**: gift a drink as customised, send the link, they claim it from their phone
- 🥜 **Allergens and calories** on every item, updating as you customise, with nut-free and egg-free filters
- 👯 **Group orders**: share a link, friends add their own drinks from their phones, the host checks out once, everyone pays their own part
- 🛍 Tray with promo codes (`BLOOM10`, `FIRSTSIP`, `PINKMOON`), gift cards, tips, pickup times and **delivery**
- 💳 **Pay online** with Razorpay (UPI / cards) or at the counter; **split the bill** with friends
- 🪑 **Order from your table** by scanning its QR code, and **call staff** from the table
- 📍 Live order tracking, "it's ready" **push notifications**, PDF **receipts**
- ✨ Golden hour (20% off bakes 3–5pm), stamp card (10 stamps = free drink)
- ☕ **Bean subscription**: a bag every 2 or 4 weeks, pickup or delivery, pay on handover; pause, skip or cancel any time
- 🖥 **Self-order kiosk** (`/kiosk`): a counter tablet signed in as staff, with big tiles and an automatic reset
- 🧺 **Catering** (`/catering`): requests for 10+ guests, a quote from the owner, then accept and pay online or on the day
- 🏠 **More than one café**: guests pick a branch when ordering or booking
- 🌙 **Last-hour deals**: leftover bakes get cheaper just before closing
- 👛 **Coffee wallet**: top up ₹500 / ₹1000 / ₹2000 with a bonus; checkout uses it automatically
- 🎓 **Student discount**: verify a college email for 10% off drinks on weekdays
- 🏢 **Company tabs**: office staff join with a code, order on the company's account, one monthly invoice (PDF, with GST)
- 🔔 **"Tell me when it's back"** emails for sold-out items
- 💬 **WhatsApp button** in the chat and footer
- 👋 **"I'm here"** button for pickups (counter, door or car)
- 👍 **Rate each item**; well-loved items show "Loved by N%" on the menu
- 🌸 **"A year with us"** anniversary emails with the guest's year in coffee
- 🔒 **Your data**: guests download everything or delete their account themselves (DPDP Act)

**Guests & community**
- 👤 **Accounts** with a sign-in code by email: favourites on every device, order history, birthday treat, referrals with credit, a monthly **Coffee Pass**
- 🏅 **Streaks and badges**: 16 badges like Early bird, Matcha lover and Kind soul
- 🥇 **Loyalty tiers**: Silver (10 visits a year) gets a free size upgrade each order; Gold (30) gets free upgrades on every drink and jumps the queue
- 🥗 **Dietary profile**: save vegan, gluten-free and allergens to avoid; the menu filters itself and warns about clashes
- 💌 **"We miss you" emails**: regulars who stop coming get a one-off 15% code (with unsubscribe)
- 📌 **Community noticeboard**: lost & found, study buddies and book swaps, approved by staff
- 📰 **Journal**: blog posts with their own pages, in the sitemap for Google
- ✉️ **Emails from "Moss & Moon"** to any guest: order confirmed (with the ready time), it's ready, pickup reminder, PDF receipt, "How was it?" review request, booking confirmation with a calendar invite, and a reminder before the booking. Sent through the café Gmail via Gmail's API (works on Railway's Hobby plan), or Resend with your own domain
- ⭐ Verified-visit reviews from those emails
- 📅 Table booking with real availability and a **waitlist** that emails you when a table frees up
- 🗺 **Pick your table** on a floor plan, and **pre-order** your tray to be ready when you arrive
- 💳 **Deposits for groups of 6+**: paid online, taken off the bill as a gift card, kept on a no-show
- 🔁 **Repeating events** (every week, 2 weeks or month)
- ⭐ **Google review nudge** after a happy review
- 🎟 **Events**: free RSVPs, and **paid tickets** for classes with a QR code checked at the door
- 🌿 **"How busy is it?"** meter with today's forecast and the quietest time to visit
- 🤖 **Ask the barista**: AI chat (free Google Gemini, or Claude) that recommends drinks from the live menu
- 👋 **Talk to a person**: hand the chat over to staff, with live replies (emailed if the guest has left)
- ⭐ Reviews with photos, 🎁 gift cards, 💌 newsletter, 🔮 "find your drink" quiz, café ambience sounds
- 🎉 **Seasonal themes**: Diwali, monsoon, Christmas and Valentine's, each with a banner, animation and special drink
- 🌸 Day and ☾ night themes, English / हिन्दी, installable app that works offline

**For staff (`/admin`, `/staff`, `/board`)**
- Overview, **analytics** (busiest hours, categories, drink options, channels), order queue, bookings, CSV export
- **Barista screen** (`/staff`) with live orders, table calls, printable **kitchen tickets** and your next shift
- 📺 **Now serving** TV board (`/board`)
- **Roles**: the owner sees everything; baristas get the counter tools
- Menu editor, ingredient **stock** (items sell out by themselves), seasonal and festival items
- **Rota**: weekly staff shifts
- **Refunds** through Razorpay, gift cards, emails sent, reviews
- 🏷 **Promo code manager**: % or ₹ off, dates, usage limits, once per guest
- 🕰 **Hours, holidays & golden hour editor**: everything (ordering, bookings, the busy meter) follows
- 🎤 **Events editor**: add events, ticket prices or free RSVPs, with photos
- 🧾 **GST tax invoices**: GSTIN, running invoice numbers, CGST/SGST on receipts, and a monthly GST report
- 💌 **Newsletter composer**: AI first draft, preview, test send, then send to subscribers with one-click unsubscribe
- 👥 **Guest list**: visits, spend, favourites, birthdays, VIP stars (shown on the barista screen) and notes
- ⏱ **Clock-in & timesheets**: hours worked vs the rota, and tips split by hours worked
- 📦 **Supplier reorders**: low stock makes a draft order; approve it to email the supplier, then mark it received
- 💰 **Profit tracking** from ingredient costs, per day and per item; 🧺 **waste log** with tomorrow's bake plan
- 📒 **Monthly P&L**: sales, tickets, catering, cost of goods, waste and your expenses (rent, wages, bills) for a true net profit
- 💵 **Daily cash-up**: count the till against what the counter should have taken; the nightly email flags any difference
- 🔁 **Repeat-customer chart**: how many of each month's new guests come back within 30 days
- 📶 **Wi-Fi QR** on receipts and table cards
- 💬 **Guest chats inbox** on the barista screen and dashboard
- 📖 **Recipe cards**: tap any drink on a barista-screen ticket to see how to make it
- ✅ **Opening & closing checklists** with fridge temperatures, signed by whoever ticked them
- ⇄ **Shift swaps**: ask a teammate to cover, they accept, the owner approves
- 🔧 **Equipment log**: service reminders and repairs (costs go into P&L)
- 👥 **Staffing suggestions**: people needed each hour vs who's on the rota
- ✨ **Special of the day**: AI ideas that use up overstocked ingredients or often-wasted bakes
- 🧮 **Price "what if"**: try a new price and see the effect on profit
- 🧭 **Menu engineering** chart (stars, plowhorses, puzzles, dogs) and 😢 **missed sales** from sold-out items
- 📅 **Use-by dates** for milk, cream and bakes, oldest first
- 💹 **Supplier price tracking**: rises are flagged with what they cost a month
- 🎓 **Training tracker** with a recipe quiz
- 📸 **Instagram story images** for menu items, specials and events
- 🧭 **Grouped dashboard** with a "Jump to" search, and a **setup checklist** of what's left to connect
- 🚦 **Rush mode**: longer ready times when busy (automatic at 12+ orders), or pause online orders for 15/30 min
- 📡 **Offline-proof barista screen**: taps are saved without Wi-Fi and sent when it's back
- 📺 **TV menu board** (`/board/menu`) and 🥜 **allergen chart** (`/print/allergens`)
- ✨ **AI menu writer**: description, allergens, calories and Hindi text for new items
- 🖨 **Printable menu** and counter poster (`/print/menu`) made from the live menu, with an order-ahead QR
- ✨ **AI weekly insights**: review summary and practical ideas from your numbers (Claude or free Gemini)
- 👀 **Visitor stats** without cookies or trackers
- 🔐 **Two-step login** for owners, and a security check-up in the Health tab (see [SECURITY.md](SECURITY.md))
- 📬 **Nightly summary email**, 🗄 **automatic backups** (download and restore), 🚨 **error alerts** and a Health tab
- 🟢 **Uptime monitor**: GitHub checks the site every 10 minutes and opens an issue (and emails you) if it's down
- 🤖 **Demo barista** moves orders along by itself when nobody is behind the counter

## Tests

```bash
npm test           # 95 tests: price maths, the whole API against a real server, payments against a fake Razorpay, and Gmail against a fake Google
npm run test:e2e   # 9 browser tests: ordering, booking, group orders, tickets, gifting a drink, phone layout, security headers
```

Both run on GitHub for every push, and Railway only deploys once they pass.


The browser tests include an automatic accessibility check (axe) of the main guest pages, so a change that hurts screen-reader or contrast support fails the build.

## Where things live

| What | File |
| --- | --- |
| Menu | edit it at **/admin → Menu** (the starting menu is in `src/lib/menu.ts`) |
| AI barista | `src/app/api/barista/route.ts` |
| Push notifications | `src/lib/push.ts`, `public/sw.js` |
| TV board | `src/app/board/page.tsx` |
| Payments (Razorpay) | `src/lib/payments.ts` |
| Emails & their templates | `src/lib/email.ts` |
| Sending through Gmail | `src/lib/gmailApi.ts`, `src/app/api/admin/gmail/…` |
| Pickup & booking reminders | `src/lib/reminders.ts` |
| Privacy & terms pages | `src/app/privacy`, `src/app/terms` |
| Drink options, promo codes, happy hour, price maths | `src/lib/pricing.ts` |
| Opening hours, events, gallery | `src/lib/cafe.ts` |
| Colours (day + night themes) | top of `src/app/globals.css` |
| Database tables | `src/lib/db.ts` (data saved in `data/cafe.db`) |
| Group orders | `src/lib/groups.ts`, `src/app/g/[code]/page.tsx` |
| Seasonal themes | `src/lib/seasons.ts`, `src/components/SeasonLayer.tsx` |
| Event tickets | `src/lib/tickets.ts`, `src/app/ticket/[code]/page.tsx` |
| Nightly summary, backups, error alerts | `src/lib/summary.ts`, `src/lib/backup.ts`, `src/lib/errors.ts` |
| Background jobs (demo barista, summary, backups) | `src/lib/jobs.ts` |
| Receipts | `src/lib/receipt.ts`, `src/app/print/[code]/page.tsx` |
| Browser tests | `e2e/` |
| API routes | `src/app/api/…` |
| Page sections | `src/components/…` |

Prices are always recalculated on the server, so they can't be changed from the browser.
To reset all data, stop the server and delete `data/cafe.db`.

The first simple HTML version is kept in `legacy-static/`.

Photos from [Unsplash](https://unsplash.com).
