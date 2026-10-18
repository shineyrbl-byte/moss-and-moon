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
- ☕ 50-item menu in sections (Specials, Coffee, Tea & matcha, Cold drinks, Food, Bakes) with search and vegan / gluten-free / nut-free / egg-free filters, edited live from the admin page
- 🥤 Cold drinks (cold brew, frappés, smoothies, mocktails, juices) and savoury food (toasties, sandwiches, toast, pancakes, pasta, bowls) with add-ons like an egg, extra cheese, gluten-free bread or a coffee combo
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

**Guests & community**
- 👤 **Accounts** with a sign-in code by email: favourites on every device, order history, birthday treat, referrals with credit, a monthly **Coffee Pass**
- 🏅 **Streaks and badges**: 16 badges like Early bird, Matcha lover and Kind soul
- 📌 **Community noticeboard**: lost & found, study buddies and book swaps, approved by staff
- ⭐ **"How was it?" emails** after pickup, with verified-visit reviews
- 📅 Table booking with real availability and a **waitlist** that emails you when a table frees up
- 🎟 **Events**: free RSVPs, and **paid tickets** for classes with a QR code checked at the door
- 🌿 **"How busy is it?"** meter with today's forecast and the quietest time to visit
- 🤖 **Ask the barista**: AI chat (free Google Gemini, or Claude) that recommends drinks from the live menu
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
- 💰 **Profit tracking** from ingredient costs, per day and per item; 🧺 **waste log** with tomorrow's bake plan
- ✨ **AI weekly insights**: review summary and practical ideas from your numbers (Claude or free Gemini)
- 👀 **Visitor stats** without cookies or trackers
- 🔐 **Two-step login** for owners, and a security check-up in the Health tab (see [SECURITY.md](SECURITY.md))
- 📬 **Nightly summary email**, 🗄 **automatic backups** (download and restore), 🚨 **error alerts** and a Health tab
- 🤖 **Demo barista** moves orders along by itself when nobody is behind the counter

## Tests

```bash
npm test           # 81 tests: price maths, the whole API against a real server, and payments against a fake Razorpay
npm run test:e2e   # 9 browser tests: ordering, booking, group orders, tickets, gifting a drink, phone layout, security headers
```

Both run on GitHub for every push, and Railway only deploys once they pass.

## Where things live

| What | File |
| --- | --- |
| Menu | edit it at **/admin → Menu** (the starting menu is in `src/lib/menu.ts`) |
| AI barista | `src/app/api/barista/route.ts` |
| Push notifications | `src/lib/push.ts`, `public/sw.js` |
| TV board | `src/app/board/page.tsx` |
| Payments (Razorpay) | `src/lib/payments.ts` |
| Emails & their templates | `src/lib/email.ts` |
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
