# Security

What protects Moss & Moon, and what was checked in the security review (October 2026).

## Logins
- **Staff:** the owner signs in with `ADMIN_PASSCODE`; staff get their own username and password (stored as scrypt hashes). Sessions are signed (HMAC) httpOnly cookies, `SameSite=Strict` and `Secure` on https.
- **Two-step login** (Admin → Settings): owners can require a 6-digit authenticator code. Codes can't be reused; 8 one-time backup codes.
- **Guests:** a 6-digit code by email (hashed, 10 minutes, 5 tries, 5 emails an hour per address).
- Staff login allows 10 tries per 15 minutes per address.

## Payments
- Prices are always worked out on the server; the browser only says what's in the tray.
- Razorpay signatures are checked, **and** each Razorpay order is tied to exactly what it was started for (order, share, gift card, ticket, pass or gifted drink) and can only be used once. So a real payment for something cheap can't mark something expensive as paid. Tested against a fake Razorpay in `tests/payments.test.ts`.
- The demo payment screen is switched off as soon as Razorpay keys are set.

## Requests
- Anything that changes data (POST/PATCH/PUT/DELETE to `/api`) must come from the site's own pages (`src/proxy.ts`), so other sites can't act on a visitor's behalf.
- Rate limits on every public form and lookup (`src/lib/rateLimit.ts`), keyed by the real visitor address (`X-Real-IP` / the last `X-Forwarded-For` entry, which can't be faked).
- Order, group, booking, ticket and gift codes are 6 characters (about a billion possibilities), so pages can't be found by guessing.
- The stamp-card lookup only shows the first letter of a name.
- CSV exports neutralise spreadsheet formulas.

## Browser
- Headers on every page: a Content-Security-Policy (scripts, frames and connections only from this site, Razorpay and OpenStreetMap; no framing by other sites), `nosniff`, `Referrer-Policy`, `Permissions-Policy` (microphone only for voice ordering; no camera or location), HSTS on https.
- User text is escaped everywhere (React on pages, an escape helper in emails).
- Photo uploads are checked by their file contents (JPEG/PNG/WebP only, size-limited) and stored under random names.

## Data
- Nightly backups (14 kept) plus a weekly emailed copy; restores save the current data first.
- Visitor stats use a daily-changing hash: no cookies, no trackers, Do Not Track respected.
- AI features (barista, voice ordering, insights) only ever return menu item ids or text for the owner; their output is checked before use.

## Check-up
**Admin → Health → 🛡 Security check-up** lists what's still worth doing (passcode length, two-step login, https, backups, alerts).

Found a problem? Email the owner rather than posting it publicly.
