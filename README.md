# Moss & Moon ☾ — an aesthetic café website

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

**For guests**
- 🌸 Latte-brown & blush-pink day theme + ☾ **night café** espresso mode (remembers your choice)
- 🌧 Café ambience sounds — rain + vinyl crackle, generated in the browser
- ☕ Menu with photos, search, category tabs and vegan / gluten-free filters
- 🎛 Drink customiser — size, hot/iced, milk, sweetness, extra shot (prices update live)
- 🛍 Order tray with promo codes (`BLOOM10`, `FIRSTSIP`, `PINKMOON`), gift cards and pickup time
- 💳 **Pay online** with Razorpay (UPI / cards), or pay at the counter. Demo payment screen until keys are added
- ✉️ **Emails**: order receipt, "your order is ready", booking confirmation, RSVP, newsletter welcome, gift cards
- 🎁 **Gift cards**: 3 designs, any amount ₹200–10,000, emailed to the recipient, balance carries over
- ✨ **Golden hour**: 20% off bakes every day 3–5pm, applied automatically
- ⏱ Live wait-time estimate (homepage, checkout, order page)
- ♥ Favourites filter, and **My orders** with one-tap "order again"
- 📍 Live order tracking page (received → brewing → ready → collected), refreshes itself
- 🎁 Stamp card — every order = 1 stamp, 10 stamps = a free drink, applied automatically
- 🔮 "Find your drink" quiz
- 📅 Table booking with real availability (6 tables per slot, groups of 5+ take two)
- 🎤 Events with RSVP and spots left
- ⭐ Reviews with star ratings
- 💌 Newsletter sign-up, photo gallery with lightbox, open-now indicator

**For staff (`/admin`)**
- Today's orders, revenue, bookings, rating, members, 7-day revenue chart, best sellers
- Order queue — move orders along with one click
- Bookings list — seat or cancel
- Menu stock — mark items sold out (shows instantly on the site and blocks ordering)
- Remove reviews
- New-order chime + count in the tab title
- Payment status on every order, CSV export of all orders
- Gift card list, and an **Emails** tab to preview every email the site sent

## Where things live

| What | File |
| --- | --- |
| Menu items, prices, photos | `src/lib/menu.ts` |
| Payments (Razorpay) | `src/lib/payments.ts` |
| Emails & their templates | `src/lib/email.ts` |
| Drink options, promo codes, happy hour, price maths | `src/lib/pricing.ts` |
| Opening hours, events, gallery | `src/lib/cafe.ts` |
| Colours (day + night themes) | top of `src/app/globals.css` |
| Database tables | `src/lib/db.ts` (data saved in `data/cafe.db`) |
| API routes | `src/app/api/…` |
| Page sections | `src/components/…` |

Prices are always recalculated on the server, so they can't be changed from the browser.
To reset all data, stop the server and delete `data/cafe.db`.

The first simple HTML version is kept in `legacy-static/`.

Photos from [Unsplash](https://unsplash.com).
