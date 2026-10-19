// The barista and owner guides (shown at /help/barista and /help/owner, printable)
export const GUIDES: Record<string, { title: string; intro: string; body: string }> = {
  barista: {
    title: "Barista guide",
    intro: "Everything you need for a shift, on one page. Keep it by the counter.",
    body: `## Starting your shift
- Sign in at /admin with your own username (ask the owner if you don't have one).
- Tap **Clock in** on the barista screen.
- Open **Checklists → Opening** and tick each task. Write in the fridge temperatures; anything above 5 °C is flagged.
- Read the **notes from the last shift** at the top of the barista screen, and tap **Done ✓** when you've dealt with one.

## The barista screen (/staff)
- New orders appear in **New** with a chime. Tap **Start brewing**, then **Ready ✓** (the guest gets a message), then **Handed over**.
- Gold members and VIPs are tagged. Make Gold orders first.
- **Tap a drink's name** on a ticket to see its recipe card.
- **👋 Here now** on a ticket means the guest is waiting (at the counter, door or in their car). Take it out to them.
- **Table calls** show at the top. Tap one when you've helped.
- If the Wi-Fi drops, keep tapping: changes are saved on the tablet and sent when it's back.

## When it's busy
- Tap **🚦 Normal** to choose **Busy** (adds 10 minutes to ready times) or **Pause online orders** for 15 or 30 minutes. Table QR and kiosk orders still come in.
- It switches to Busy by itself at 12 or more open orders.

## Payments
- "Collect ₹…" on a ticket means it's paid at the counter. Take cash, UPI or card, then hand it over.
- "Paid" means it was paid online. "Company tab" means the company is invoiced; take nothing.
- Big-group bookings have paid a deposit: it's on a gift card that comes off their bill.

## Guests
- **Chats**: guests who tapped "talk to a person" in the barista chat. Reply from the 💬 Chats button.
- Allergies: check the item's allergens in the menu, and the allergen chart at /print/allergens. When unsure, say so and offer something safer.
- Sold out? Mark it in **Menu & stock → Menu** so guests can't order it. Guests can ask to be told when it's back.

## Closing
- **Waste**: log leftover bakes (this plans tomorrow's baking).
- **Cash-up**: count the till (float, cash, UPI, card). The screen says if it matches.
- **Checklists → Closing**: tick each task.
- Leave a **note for the next shift** if anything needs doing.
- Tap **Clock out**.`,
  },
  owner: {
    title: "Owner guide",
    intro: "Where everything lives in the staff dashboard, and what to set up first.",
    body: `## First things to set up
- Open **Today → Overview**: the **setup checklist** shows what's connected and what's left, with a button for each.
- **Settings**: opening hours and holidays, golden hour and the last-hour deal, branches, delivery areas, your Google review link and WhatsApp number, Gmail for emails, GST, Wi-Fi, phone alerts, your email for the nightly summary, backups and two-step login.
- **Team → Team**: give each barista their own login.

## Every day
- The **nightly summary email** has the day's sales, the cash-up, unfinished checklists, fridge warnings, cakes to bake tomorrow, use-by dates and maintenance due.
- **Phone alerts** (Settings) ping you for bad reviews, big orders, catering and cakes, sold-out items and cash-ups that are out.

## Menu & stock
- **Menu**: edit items, prices, photos, allergens and Hindi text (✨ Write it for me drafts it). Mark staff picks, kids' items and seasonal items. The **seasonal menu** follows the calendar or a season you pick.
- **Menu tidy-up** suggests slow, low-margin items to hide. **Special of the day** suggests ideas that use up stock. **Combo deals** apply in the tray by themselves.
- **Stock**: ingredient levels, supplier prices (rises are flagged), use-by dates and supplier reorders.

## Guests
- **Guests**: regulars, VIPs, "we miss you" and anniversary emails (each can be switched off).
- **Reviews, Events, Catering, Companies, Promos, Gift cards, Newsletter, Notices, Journal**: one tab each.

## Money
- **Analytics**: profit per item, menu engineering, missed sales, price what-if, visitors and repeat guests.
- **P&L**: add rent, wages and bills for your true monthly profit.
- **Cash-up**: each day's count against what the counter took.

## Screens around the café
- **/staff**: the barista screen (tablet behind the counter).
- **/kiosk**: a self-order tablet on the counter (sign it in as staff first).
- **/board**: "now serving" on a TV. **/board/menu**: the menu on a TV.
- **/print/menu** and **/print/allergens**: print or save as PDF.

## Keeping things safe
- Backups run every night (Settings → Backups); download one now and then.
- Turn on **two-step login** for every owner account.
- **Demo reset** wipes real orders: only use it on a demo site.`,
  },
};
