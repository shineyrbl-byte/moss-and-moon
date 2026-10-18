// Placing an order: shared by the checkout, scheduled orders and gifted drinks.
// Prices, stock, perks and promo codes are always worked out here on the server.
import "server-only";
import { db, makeCode, cleanPhone, cleanText, cleanEmail } from "./db";
import { DELIVERY, REFERRAL_CREDIT, quote, rupees } from "./pricing";
import { isLastHour, lastHour } from "./cafe";
import { recordMissed } from "./missed";
import { companyFor, spentThisMonth } from "./companies";
import { rushNow } from "./rush";
import { STAMPS_FOR_REWARD, TABLE_COUNT, closureOn, findBranch, hoursOn, toDateStr } from "./cafe";
import { perksFor } from "./perks";
import { checkStock, consumeStock } from "./stock";
import { menuLookup, shopShortfall, takeShopStock } from "./menuStore";
import type { currentCustomer } from "./account";
import { publish } from "./live";
import { orderPlacedEmail, referralRewardEmail, sendLater } from "./email";
import { readyEstimate } from "./orderTiming";
import { getGroup, isHost } from "./groups";
import { checkPromo, usePromo } from "./promos";
import { withCosts } from "./profit";
import { newBadges } from "./badgeStore";

type Customer = Awaited<ReturnType<typeof currentCustomer>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrderInput = Record<string, any>;
export type PlaceOptions = {
  /** Already paid some other way (e.g. a gifted drink): no payment needed */
  prepaid?: { method: string; ref: string };
  /** Placed on the café's self-order kiosk (a staff-signed-in tablet): phone is optional */
  kiosk?: boolean;
};

/** Place an order. Returns the same JSON response the checkout API sends. */
export async function placeOrder(body: OrderInput, me: Customer, opts: PlaceOptions = {}): Promise<Response> {
  const name = cleanText(body.name, 40);
  const phone = cleanPhone(body.phone);
  const email = cleanEmail(body.email);
  const note = opts.kiosk ? ["🖥 Kiosk", cleanText(body.note, 180)].filter(Boolean).join(" · ") : cleanText(body.note, 200);
  const tableNo = Math.floor(Number(body.table));
  const table = tableNo >= 1 && tableNo <= TABLE_COUNT ? tableNo : null;
  const delivery = !table && body.delivery ? cleanText(body.delivery.address, 200) : "";
  const pickup = table ? "table" : delivery ? "delivery" : String(body.pickup ?? "asap");
  // On a company's tab: only for signed-in members of an active company
  const company = body.payMethod === "company" && me && !opts.kiosk ? companyFor(me.id) : null;
  if (body.payMethod === "company" && !company) return Response.json({ error: "You're not on a company tab. Pay another way?" }, { status: 400 });
  const payMethod = company ? "company" : body.payMethod === "online" ? "online" : "counter";
  if (!name) return Response.json({ error: "Please tell us your name." }, { status: 400 });
  // Phone is optional when ordering from a table (it's only needed for the stamp card)
  if (phone.length !== 10 && !(table && !phone) && !(opts.prepaid && !phone) && !(opts.kiosk && !phone)) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  if (body.email && !email) return Response.json({ error: "That email doesn't look right." }, { status: 400 });
  if (body.delivery && !table && delivery.length < 10) return Response.json({ error: "Please add your full delivery address." }, { status: 400 });

  // Rush mode: online orders paused for a bit (guests already in the café can still order)
  const rush = rushNow();
  if (rush.mode === "paused" && !table && !opts.kiosk && !opts.prepaid) {
    const at = rush.until ? new Date(rush.until).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "soon";
    return Response.json({ error: `We're swamped right now, so online orders are paused until ${at}. Please try again then, or pop in ☕`, rush: "paused" }, { status: 503 });
  }

  // Which branch: table QR codes are at the main café
  const branch = table ? findBranch("main") : findBranch(typeof body.branch === "string" ? body.branch : null);
  if (body.branch && !table && branch.id !== body.branch) return Response.json({ error: "That branch isn't taking orders right now." }, { status: 400 });

  // Closed all day (a holiday or a weekly day off): no orders, except gifted drinks being claimed later
  const todayHours = hoursOn(new Date(), branch.id);
  if (!todayHours && !opts.prepaid) {
    const c = closureOn(new Date());
    return Response.json({ error: `Sorry, ${branch.id === "main" ? "we're" : `${branch.name} is`} closed today${c?.note ? ` (${c.note})` : ""}. See you soon ☕` }, { status: 409 });
  }
  const [open, close] = todayHours ?? [0, 24];
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  if (delivery && !(nowMins >= open * 60 && nowMins < close * 60 - 30))
    return Response.json({ error: "Delivery runs during opening hours (until 30 min before closing)." }, { status: 400 });
  if (!["asap", "table", "delivery"].includes(pickup)) {
    const m = /^(\d{2}):(\d{2})$/.exec(pickup);
    const mins = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
    if (!m || mins < open * 60 || mins > close * 60 - 15 || mins < nowMins)
      return Response.json({ error: "Please pick a pickup time during today's opening hours." }, { status: 400 });
  }

  // Checking out a group order: only the host can, and only once
  const group = body.groupCode ? getGroup(String(body.groupCode)) : undefined;
  if (body.groupCode) {
    if (!group || !isHost(group, body.hostToken)) return Response.json({ error: "Only the person who started the group can check out." }, { status: 403 });
    if (group.status !== "open") return Response.json({ error: "This group order has already been placed." }, { status: 409 });
  }

  const raw = Array.isArray(body.lines) ? body.lines.slice(0, group ? 60 : 30) : [];
  const find = menuLookup();
  const notHere = raw.map((l: { itemId: string }) => find(l.itemId)).find((m: { branches?: string[] } | undefined) => m?.branches?.length && !m.branches.includes(branch.id));
  if (notHere) return Response.json({ error: `Sorry, ${notHere.name} isn't available at ${branch.name}. Please remove it.` }, { status: 409 });
  if (raw.some((l: { itemId: string }) => find(l.itemId)?.soldOut)) {
    recordMissed(raw.filter((l: { itemId: string }) => find(l.itemId)?.soldOut), "sold out");
    return Response.json({ error: "Sorry, something in your tray just sold out. Please remove it." }, { status: 409 });
  }

  // Gift card (optional)
  let gift: { code: string; balance: number } | undefined;
  if (body.giftCard) {
    gift = db.prepare("SELECT code, balance FROM giftcards WHERE code = ? AND paid = 1").get(String(body.giftCard).trim().toUpperCase()) as typeof gift;
    if (!gift) return Response.json({ error: "We couldn't find that gift card." }, { status: 400 });
  }

  const card = phone ? (db.prepare("SELECT stamps FROM loyalty WHERE phone = ?").get(phone) as { stamps: number } | undefined) : undefined;
  const hasReward = (card?.stamps ?? 0) >= STAMPS_FOR_REWARD;
  const perks = perksFor(me);
  const tipAmount = body.tipAmount !== undefined && body.tipAmount !== null && body.tipAmount !== "" ? Number(body.tipAmount) : undefined;
  // Promo code: checked again here (dates, limits, once per guest)
  let promoRule = null;
  if (body.promo) {
    const p = checkPromo(body.promo, phone);
    if ("error" in p) return Response.json({ error: p.error }, { status: 400 });
    promoRule = p.rule;
  }
  const q = quote(raw, find, promoRule, hasReward, {
    giftBalance: gift?.balance ?? 0,
    credit: perks.credit,
    birthdayTreat: perks.birthdayTreat && body.useBirthday !== false,
    passDrink: perks.passDrink && body.usePass !== false,
    tipPercent: Number(body.tipPercent) || 0,
    tier: perks.tier,
    lastHour: isLastHour(new Date(), branch.id) ? lastHour() : null,
    student: perks.student,
    tipAmount: Number.isFinite(tipAmount) ? tipAmount : undefined,
    delivery: !!delivery,
  });
  if (!q.lines.length) return Response.json({ error: "Your tray is empty." }, { status: 400 });
  if (delivery && q.total < DELIVERY.minOrder) return Response.json({ error: `Delivery needs an order of at least ${rupees(DELIVERY.minOrder)}.` }, { status: 400 });

  const short = shopShortfall(q.lines);
  if (short) recordMissed(q.lines.filter((l) => l.name === short.name), "low stock");
  if (short) return Response.json({ error: short.left ? `Only ${short.left} × ${short.name} left. Please change the quantity.` : `Sorry, ${short.name} just sold out.` }, { status: 409 });
  const stock = checkStock(q.lines);
  if (stock) recordMissed(q.lines, "low stock");
  if (stock) return Response.json({ error: `Sorry, we've just run out of ${stock} for that. Please pick something else.` }, { status: 409 });

  if (company?.monthly_limit && spentThisMonth(company.id, me!.id) + q.due > company.monthly_limit)
    return Response.json({ error: `That's over your ${rupees(company.monthly_limit)} a month on the ${company.name} tab. Pay the rest another way?` }, { status: 400 });

  // Fully covered by credit / gift card = already paid
  const payStatus = q.due === 0 || opts.prepaid ? "paid" : payMethod === "online" ? "pending" : "unpaid";
  const usedPerks = [q.passDiscount && "pass", q.birthdayDiscount && "birthday", q.loyaltyDiscount && "stamps", q.creditUsed && "credit", q.tierDiscount && `${perks.tier} upgrade`, q.lastHourDiscount && "last hour", q.studentDiscount && "student"].filter(Boolean).join(",");
  const code = makeCode("MM", 6); // 1 billion possibilities, so order pages can't be guessed
  db.prepare(
    `INSERT INTO orders (code, name, phone, email, pickup, note, lines, subtotal, discount, total, promo,
       pay_method, pay_status, giftcard_code, giftcard_used, happy_hour, table_no, customer_id,
       tip, credit_used, delivery_fee, delivery_address, perks, branch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    code, name, phone, email || null, pickup, note, JSON.stringify(withCosts(q.lines, find)), q.subtotal,
    q.subtotal - q.total, q.total, q.promoCode,
    opts.prepaid ? opts.prepaid.method : q.due === 0 && q.giftUsed + q.creditUsed > 0 ? "giftcard" : payMethod, payStatus, gift?.code ?? null, q.giftUsed, q.happyHour ? 1 : 0, table, me?.id ?? null,
    q.tip, q.creditUsed, q.deliveryFee, delivery || null, usedPerks || null, branch.id
  );
  if (company) db.prepare("UPDATE orders SET company_id = ? WHERE code = ?").run(company.id, code);
  if (gift && q.giftUsed) db.prepare("UPDATE giftcards SET balance = balance - ? WHERE code = ?").run(q.giftUsed, gift.code);
  consumeStock(q.lines);
  takeShopStock(q.lines);
  if (perks.tier === "gold") db.prepare("UPDATE orders SET priority = 1 WHERE code = ?").run(code); // gold members jump the queue
  if (opts.prepaid) db.prepare("UPDATE orders SET payment_ref = ? WHERE code = ?").run(opts.prepaid.ref, code);
  if (q.promoCode && q.promoDiscount > 0) usePromo(q.promoCode);
  if (group) {
    db.prepare("UPDATE groups SET status = 'placed', order_code = ? WHERE code = ?").run(code, group.code);
    db.prepare("UPDATE orders SET group_code = ? WHERE code = ?").run(group.code, code);
    publish({ type: "group", code: group.code });
  }

  if (me) {
    if (q.creditUsed) db.prepare("UPDATE customers SET credit = credit - ? WHERE id = ?").run(q.creditUsed, me.id);
    if (q.birthdayDiscount) db.prepare("UPDATE customers SET birthday_treat_year = ? WHERE id = ?").run(new Date().getFullYear(), me.id);
    if (q.passDiscount) db.prepare("INSERT OR IGNORE INTO pass_uses (customer_id, day, order_code) VALUES (?, ?, ?)").run(me.id, toDateStr(new Date()), code);
    rewardReferrer(me);
  }

  // Loyalty: one stamp per order. Using a reward spends 10 stamps.
  const usedReward = q.loyaltyDiscount > 0;
  if (phone) db.prepare(
    `INSERT INTO loyalty (phone, name, stamps, rewards_used) VALUES (?, ?, 1, 0)
     ON CONFLICT(phone) DO UPDATE SET name = excluded.name,
       stamps = stamps + 1 - ?, rewards_used = rewards_used + ?`
  ).run(phone, name, usedReward ? STAMPS_FOR_REWARD : 0, usedReward ? 1 : 0);

  // Online orders get their email after payment goes through
  if (email && payStatus !== "pending")
    sendLater(email, ...orderPlacedEmail({ code, name, lines: q.lines, total: q.due, pickup, paid: payStatus === "paid", ready: readyEstimate({ code, pickup, table_no: table, delivery_address: delivery || null }).label, table, delivery: delivery || null }));

  publish({ type: "order", code, action: "new" });
  const badges = me ? newBadges(me) : [];
  return Response.json({ code, total: q.total, due: q.due, usedReward, perks: usedPerks, needsPayment: payStatus === "pending", newBadges: badges });
}

/** A friend who invited this guest gets their credit when the guest's first order lands */
function rewardReferrer(me: { id: number; referred_by: number | null }) {
  if (!me.referred_by) return;
  const n = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?").get(me.id) as { n: number }).n;
  if (n !== 1) return;
  db.prepare("UPDATE customers SET credit = credit + ? WHERE id = ?").run(REFERRAL_CREDIT, me.referred_by);
  const friend = db.prepare("SELECT email FROM customers WHERE id = ?").get(me.referred_by) as { email: string } | undefined;
  if (friend) sendLater(friend.email, ...referralRewardEmail());
}
