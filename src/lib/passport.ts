// Origins passport: one stamp for each coffee region, earned by ordering a drink made with its beans.
// Stamps come from real orders (not diary entries), so the reward can't be typed into existence.
import "server-only";
import { db } from "./db";
import { ORIGINS } from "./origins";
import { getMenu } from "./menuStore";

export const PASSPORT_REWARD = 250; // ₹ of credit: a free drink

export function passportFor(customerId: number) {
  const orders = db.prepare("SELECT code, lines, created_at FROM orders WHERE customer_id = ? AND status != 'cancelled' AND sim = 0 ORDER BY id").all(customerId) as { code: string; lines: string; created_at: string }[];
  const menu = new Map(getMenu().map((m) => [m.id, m]));
  const stamps = ORIGINS.map((o) => {
    let hit: { date: string; drink: string } | null = null;
    for (const r of orders) {
      const line = (JSON.parse(r.lines) as { itemId: string; name: string }[]).find((l) => o.usedIn.includes(l.itemId));
      if (line) { hit = { date: r.created_at.slice(0, 10), drink: line.name }; break; }
    }
    const tryThese = o.usedIn.map((id) => menu.get(id)).filter((m) => m && !m.soldOut).map((m) => ({ id: m!.id, name: m!.name, price: m!.price }));
    return { id: o.id, name: o.name, state: o.state, stamped: !!hit, date: hit?.date ?? null, drink: hit?.drink ?? null, tryThese };
  });
  const claimed = (db.prepare("SELECT passport_claimed FROM customers WHERE id = ?").get(customerId) as { passport_claimed: string | null } | undefined)?.passport_claimed ?? null;
  const done = stamps.filter((s) => s.stamped).length;
  return { stamps, done, total: stamps.length, complete: done === stamps.length, claimed, reward: PASSPORT_REWARD };
}

/** All eight stamps: add the free drink as credit, once */
export function claimPassport(customerId: number): { ok: true; credit: number } | { error: string; status: number } {
  const p = passportFor(customerId);
  if (!p.complete) return { error: `You have ${p.done} of ${p.total} stamps so far.`, status: 400 };
  const r = db.prepare("UPDATE customers SET credit = credit + ?, passport_claimed = date('now','localtime') WHERE id = ? AND passport_claimed IS NULL").run(PASSPORT_REWARD, customerId);
  if (!r.changes) return { error: "You've already claimed this one ✿", status: 409 };
  const c = db.prepare("SELECT credit FROM customers WHERE id = ?").get(customerId) as { credit: number };
  return { ok: true, credit: c.credit };
}
