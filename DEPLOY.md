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

## 4. Turn on real emails (Resend)

Until you do this, emails are saved and shown in **/admin → Emails** but not sent.

1. Sign up at **https://resend.com** (free: 3,000 emails/month).
2. **API Keys → Create** and add `RESEND_API_KEY=re_...` to your variables.
3. Without your own domain, Resend only delivers to **your own sign-up email**,
   which is fine for testing. To email anyone: **Domains → Add domain**,
   follow the DNS steps, then set `EMAIL_FROM=Moss & Moon <hello@yourdomain.com>`.

## Running it on your computer

```bash
cp .env.example .env.local   # optional, then edit
npm install
npm run dev                  # http://localhost:3000
```
