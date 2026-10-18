# Putting Moss & Moon online 🌍

The site keeps its data in a small SQLite file, so it needs a host with a
**persistent disk** (a place where files survive restarts). Railway is the
easiest one, and its free trial is enough to show the project off.

> Vercel and Netlify won't work as-is: they wipe files on every request,
> so orders and bookings would disappear.

## 1. Put the code on GitHub

If Claude hasn't done this already:

```bash
gh repo create moss-and-moon --private --source=. --push
```

## 2. Deploy on Railway (about 5 minutes)

1. Go to **https://railway.com** → sign in with GitHub.
2. **New Project → Deploy from GitHub repo →** pick `moss-and-moon`.
   Railway sees the `Dockerfile` and builds it automatically.
3. Open the service → **Settings → Volumes → Add Volume**, mount path **`/data`**.
   (This is where the database lives. Without it, data resets on every deploy.)
4. **Variables** tab → add:

   | Name | Value |
   | --- | --- |
   | `ADMIN_PASSCODE` | something only you know |
   | `SITE_URL` | your Railway URL, e.g. `https://moss-and-moon.up.railway.app` |

   (`DATA_DIR=/data` and `TZ=Asia/Kolkata` are already set in the Dockerfile.)
5. **Settings → Networking → Generate Domain.** That's your live link 🎉

Every `git push` redeploys automatically. If it doesn't, Railway's GitHub app
probably can't see the repo: install it at https://github.com/apps/railway-app
(choose "Only select repositories"), then in the service settings connect the repo.

### Easier: deploy from the terminal (Railway CLI)

If you can't find the button on the website, this does the same thing:

```bash
brew install railway
railway login                      # opens the browser once
railway init --name moss-and-moon
railway add --service web --variables "ADMIN_PASSCODE=pick-something" --variables "DATA_DIR=/data" --variables "TZ=Asia/Kolkata"
railway service link web
railway volume add --mount-path /data
railway domain                     # prints your public link
railway up                         # uploads + deploys (run again after changes)
```

### Alternative: Render

New → Web Service → connect the repo → it picks up the Dockerfile.
Add a **Disk** mounted at `/data` (needs the $7 "Starter" plan) and the same variables.

## 3. Turn on real payments (Razorpay)

Until you do this the site shows a **test payment screen**, so nothing is charged.

1. Sign up at **https://razorpay.com** (free; real payouts need KYC, test mode doesn't).
2. Dashboard → **Settings → API Keys → Generate Test Key.**
3. Add the two variables to Railway (or `.env.local` on your computer):
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```
4. Restart. "Pay now" now opens the real Razorpay window (UPI, cards, wallets).
   In test mode use card `4111 1111 1111 1111`, any future expiry, any CVV,
   or UPI ID `success@razorpay`.
5. When you're ready for real money, finish KYC and swap in the **Live** keys.

## 4. Turn on real emails

Guests get order, booking, ticket and gift emails from **Moss & Moon**. Pick one:

**A. The café Gmail (free, sends to anyone, about 500 emails a day)**

Railway's Hobby plan blocks the normal email ports, so the site sends through Gmail's own
web API instead. One-time setup, about 10 minutes, signed in as the café Gmail:

1. Open **https://console.cloud.google.com** → project menu → **New project** → name it "Moss and Moon" → **Create**.
2. Search for **Gmail API** → **Enable**.
3. Open **Google Auth Platform** (or APIs & Services → OAuth consent screen) → **Get started**:
   app name **Moss & Moon**, your email as support and contact email, audience **External** → **Create**.
4. **Audience** → **Publish app** → **Confirm** (so the connection doesn't expire after 7 days).
5. **Clients** → **Create client** → type **Web application** → under **Authorized redirect URIs** add
   `https://moss-and-moon.up.railway.app/api/admin/gmail/callback` → **Create**. Copy the **Client ID** and **Client secret**.
6. In Railway → **web** → **Variables** add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
7. On the site: **/admin → Overview → ✉️ Guest emails → Connect Gmail**, sign in with the café Gmail,
   and if Google says the app isn't verified tap **Advanced → Go to Moss & Moon → Continue**.

Guests then get emails from **Moss & Moon** `<your café Gmail>`. The site only asks Google for permission to *send*, never to read the inbox.

(On a host that allows email ports, a Gmail **app password** also works: set `GMAIL_USER` and `GMAIL_APP_PASSWORD`.)

**B. Resend with your own domain (most professional)**
1. Get a domain, add it in **Resend → Domains** and add the DNS records it shows at your registrar.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` = `Moss & Moon <hello@yourdomain.com>`.
   Once `EMAIL_FROM` uses your own domain, Resend is used instead of Gmail.

(Resend without a domain only delivers to the address you signed up with, which is fine for testing.)
Every email also appears in **/admin → Emails**, sent or not.

## Running it on your computer

```bash
cp .env.example .env.local   # optional, then edit
npm install
npm run dev                  # http://localhost:3000
```

## 5. Turn on the AI barista (free with Gemini)

Until you do this, "Ask the barista" runs in **demo mode** (simple keyword matching).

**Free: Google Gemini**
1. Go to **https://aistudio.google.com/apikey** and sign in with a Google account.
2. Click **Create API key** and copy it. No card is needed for the free tier.
3. Add `GEMINI_API_KEY=...` to your Railway variables (or `.env.local`).
4. That's it: the chat header stops saying "demo mode".

It uses `gemini-3.8-flash` (change it with `GEMINI_MODEL`). If the free daily limit runs out,
the chat quietly falls back to demo mode until the limit resets. Note: on Google's free tier,
Google may use chats to improve its products, so don't put anything private in the prompt.

**Paid: Claude**
Add `ANTHROPIC_API_KEY=sk-ant-...` (from https://console.anthropic.com, with a little credit).
If both keys are set, Claude is used. It runs **Claude Opus 5.5** at low effort; each message
costs roughly ₹1–2. Set a monthly spend limit in the Anthropic console.

Every visitor is limited to 20 messages per 10 minutes either way; change that in
`src/app/api/barista/route.ts`.

## 6. Order-ready notifications & the app

Nothing to set up: notification keys are created automatically the first time they're needed
and stored in the database.

- **Android / desktop Chrome, Edge, Firefox:** guests tap "🔔 Notify me when it's ready" on their order page.
- **iPhone:** Apple only allows notifications for sites added to the Home Screen
  (Share → Add to Home Screen). The order page tells iPhone users this.
- Notifications need HTTPS, which Railway provides. On your computer, `localhost` works too.

## 7. Table QR codes & the TV board

- **/admin → Tables & QR → Print QR cards.** Each code opens the menu for that table.
  Set `SITE_URL` (step 2) so the codes point at your real address.
- Open **/board** on the café TV, click **Full screen** and **Tap for sound**.


## 8. Your own domain (e.g. mossandmoon.in)

1. Buy one from any registrar (Hostinger, GoDaddy, Namecheap, Cloudflare; a `.in` is usually ₹500–800/year).
2. Railway → your service → **Settings → Networking → Custom Domain** → type the domain.
3. Railway shows a **CNAME** record. Add it in your registrar's DNS settings and wait 5–60 minutes.
4. Update `SITE_URL` to the new address, so QR codes, emails and link previews use it.
5. If you use Resend for email, add the same domain under **Resend → Domains** too.


## 9. Emails for you, backups and error alerts

Open **/admin → Overview → 📬 Emails for you** and add your email (with Resend's free plan
and no domain, use the address you signed up to Resend with). Then you get:

- **Nightly summary**: 15 minutes after closing (orders and sales vs last week, best sellers, tips,
  reviews, low stock, tomorrow's bookings). "Preview" and "Send it now" are right there.
- **Error alerts**: one email per problem, at most once an hour. Every problem is listed in
  **/admin → Health**.
- **Weekly backup**: every Sunday night, a copy of the database as an email attachment.

You can also set the address with an `OWNER_EMAIL` variable in Railway instead.

**Backups** are made every night (after 3am) and the last 14 are kept on the server.
In **/admin → Overview → 🗄 Backups** you can back up now, download a copy, or **restore** one:
choose the `.db.gz` file and confirm. The current data is saved first, so a restore can be undone.
Uploaded photos aren't in the backup; they stay on the Railway volume.

**Health check:** Railway calls `/api/health` before switching to a new deploy (see `railway.toml`),
so a broken update never replaces a working site.


## 10. Running the café from Admin

Everything that used to need a code change is now in **/admin**:

- **Overview → 🕰 Hours, holidays & golden hour**: each day's hours, closures (guests can't order or book that day), and golden hour's time, discount and sections.
- **Overview → 🧾 GST invoices**: turn on with your GSTIN, legal name and address; receipts become tax invoices. Download a monthly GST report for your accountant.
- **Events**: add or edit events and ticket prices. **Journal**: write blog posts. **Newsletter**: write and send the Pink Post.
- **Guests**: your regulars, with VIP stars and notes. **Stock → Reorders**: supplier emails for low stock.
- **Rota**: shifts, plus timesheets and the week's tip split.

## 11. Uptime monitor

`.github/workflows/uptime.yml` checks `/api/health` every 10 minutes for free on GitHub. If the site is down it opens a
GitHub issue labelled `downtime`, and GitHub emails you; the issue closes itself when the site is back.
(GitHub pauses scheduled checks in repos with no activity for 60 days; any push turns them back on.)
