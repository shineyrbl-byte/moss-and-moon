// Guests' own data: download everything we hold about them, or delete their account.
// (India's DPDP Act 2023 gives people these rights; it's good manners anyway.)
import "server-only";
import { db } from "./db";
import type { Customer } from "./account";

type Row = Record<string, unknown>;
/** Run a query that might touch an optional table or column; failures just give nothing */
const all = (sql: string, ...args: (string | number)[]): Row[] => { try { return db.prepare(sql).all(...args) as Row[]; } catch { return []; } };
const run = (sql: string, ...args: (string | number | null)[]) => { try { return db.prepare(sql).run(...args).changes; } catch { return 0; } };

export function exportData(c: Customer) {
  const email = c.email.toLowerCase();
  const orders = all("SELECT code, name, phone, email, created_at, status, pickup, note, lines, total, pay_method, pay_status, table_no, delivery_address FROM orders WHERE customer_id = ? OR lower(email) = ? ORDER BY id", c.id, email)
    .map((o) => ({ ...o, lines: JSON.parse(String(o.lines)) }) as Row);
  const codes = orders.map((o) => String(o.code));
  const inCodes = (sql: string) => (codes.length ? all(sql.replace("(?)", `(${codes.map(() => "?").join(",")})`), ...codes) : []);
  const chats = all("SELECT code, name, email, status, created_at FROM support_chats WHERE lower(email) = ?", email).map((ch) => ({ ...ch, messages: all("SELECT sender, staff_name, text, created_at FROM support_messages WHERE chat_code = ? ORDER BY id", String(ch.code)) }));
  return {
    exportedAt: new Date().toISOString(),
    about: "Everything Moss & Moon holds about you. Ask us at the counter or by email if anything looks wrong.",
    account: { email: c.email, name: c.name, phone: c.phone, birthday: c.birthday, favourites: c.favs, credit: c.credit, referralCode: c.referral_code, memberSince: c.created_at, diet: c.diet ? JSON.parse(c.diet) : null, studentUntil: c.student_until ?? null, studentEmail: c.student_email ?? null },
    orders,
    itemRatings: inCodes("SELECT order_code, item_id, up, created_at FROM item_ratings WHERE order_code IN (?)"),
    reviews: inCodes("SELECT name, rating, text, photo, created_at FROM reviews WHERE order_code IN (?)"),
    bookings: all("SELECT code, name, phone, email, date, time, guests, note, status, table_no, deposit, created_at FROM bookings WHERE lower(email) = ? ORDER BY id", email),
    waitlist: all("SELECT name, phone, email, date, time, guests, status, created_at FROM waitlist WHERE lower(email) = ?", email),
    loyalty: c.phone ? all("SELECT phone, name, stamps, rewards_used FROM loyalty WHERE phone = ?", c.phone) : [],
    regularOrders: all("SELECT name, phone, lines, days, time, active, created_at FROM schedules WHERE customer_id = ?", c.id),
    beanSubscriptions: all("SELECT item_id, variant, qty, every_days, method, address, next_date, status, created_at FROM bean_subs WHERE customer_id = ?", c.id),
    coffeeDiary: all("SELECT name, place, rating, note, caffeine, flavours, created_at FROM coffee_diary WHERE customer_id = ? ORDER BY id", c.id),
    coffeePasses: all("SELECT starts, ends, price, paid, created_at FROM passes WHERE customer_id = ?", c.id),
    walletTopUps: all("SELECT amount, bonus, paid, created_at FROM wallet_topups WHERE customer_id = ?", c.id),
    giftCardsReceived: all("SELECT code, amount, balance, from_name, message, created_at FROM giftcards WHERE lower(to_email) = ? AND paid = 1", email),
    eventTickets: all("SELECT code, event_id, name, qty, amount, paid, created_at FROM tickets WHERE lower(email) = ?", email),
    rsvps: all("SELECT event_id, name, created_at FROM rsvps WHERE lower(email) = ?", email),
    catering: all("SELECT code, name, phone, event_date, event_time, guests, details, status, amount, created_at FROM catering WHERE lower(email) = ?", email),
    chatsWithTheTeam: chats,
    backInStockAlerts: all("SELECT item_id, created_at, sent_at FROM stock_alerts WHERE lower(email) = ?", email),
    newsletter: all("SELECT email, created_at, unsubscribed_at FROM subscribers WHERE lower(email) = ?", email),
    company: all("SELECT co.name, m.joined_at FROM company_members m JOIN companies co ON co.id = m.company_id WHERE m.customer_id = ?", c.id),
  };
}

/**
 * Delete the account. Orders and bookings are kept for the café's accounts (tax law needs them),
 * but with the name, phone, email and address taken off.
 */
export function deleteAccount(c: Customer) {
  const email = c.email.toLowerCase();
  const phone = c.phone ?? "";
  const tx = db.prepare("BEGIN");
  tx.run();
  try {
    run("UPDATE orders SET name = 'Deleted guest', phone = '', email = NULL, delivery_address = CASE WHEN delivery_address IS NULL THEN NULL ELSE '(removed)' END, note = '', customer_id = NULL WHERE customer_id = ? OR lower(email) = ?", c.id, email);
    run("UPDATE bookings SET name = 'Deleted guest', phone = '', email = NULL, note = '' WHERE lower(email) = ?", email);
    run("DELETE FROM waitlist WHERE lower(email) = ?", email);
    if (phone) { run("DELETE FROM loyalty WHERE phone = ?", phone); run("DELETE FROM guest_notes WHERE guest_key = ?", `p${phone}`); }
    run("DELETE FROM guest_notes WHERE guest_key IN (?, ?)", `c${c.id}`, `e${email}`);
    for (const t of ["schedules", "bean_subs", "wallet_topups", "pass_uses", "company_members", "coffee_diary"]) run(`DELETE FROM ${t} WHERE customer_id = ?`, c.id);
    run("UPDATE passes SET payment_ref = NULL WHERE customer_id = ?", c.id);
    run("UPDATE tickets SET name = 'Deleted guest', email = '' WHERE lower(email) = ?", email);
    run("DELETE FROM rsvps WHERE lower(email) = ?", email);
    run("UPDATE catering SET name = 'Deleted guest', email = '', phone = '', address = NULL WHERE lower(email) = ?", email);
    for (const ch of all("SELECT code FROM support_chats WHERE lower(email) = ?", email)) { run("DELETE FROM support_messages WHERE chat_code = ?", String(ch.code)); run("DELETE FROM support_chats WHERE code = ?", String(ch.code)); }
    for (const t of ["stock_alerts", "winbacks", "subscribers", "login_codes"]) run(`DELETE FROM ${t} WHERE lower(email) = ?`, email);
    run("DELETE FROM outbox WHERE lower(to_email) = ?", email);
    run("INSERT OR IGNORE INTO no_marketing (email) VALUES (?)", email); // so a stray list never emails them again
    run("DELETE FROM customer_sessions WHERE customer_id = ?", c.id);
    run("DELETE FROM customers WHERE id = ?", c.id);
    db.prepare("COMMIT").run();
  } catch (e) {
    db.prepare("ROLLBACK").run();
    throw e;
  }
}
