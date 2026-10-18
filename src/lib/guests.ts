// The guest list: everyone who has ordered, grouped by account, phone or email,
// with visits, spend, favourite item and the owner's own notes and VIP stars.
import "server-only";
import { db } from "./db";
import type { QuoteLine } from "./pricing";

type Row = { code: string; name: string; phone: string; email: string | null; customer_id: number | null; created_at: string; total: number; lines: string };
export type Guest = {
  key: string; name: string; phone: string | null; email: string | null; visits: number; spend: number; avg: number;
  first: string; last: string; favourite: string | null; birthday: string | null; stamps: number; vip: boolean; note: string | null; account: boolean;
};

/** Same person = same account, else same phone, else same email */
export const guestKey = (o: { customer_id: number | null; phone: string; email: string | null }) =>
  o.customer_id ? `c${o.customer_id}` : o.phone ? `p${o.phone}` : o.email ? `e${o.email.toLowerCase()}` : null;

export function guestList(): Guest[] {
  const rows = db.prepare("SELECT code, name, phone, email, customer_id, created_at, total, lines FROM orders ORDER BY id").all() as Row[];
  const byKey = new Map<string, Guest & { items: Map<string, number> }>();
  // Phones and emails seen on an account join that account's history
  const accountOf = new Map<string, string>();
  for (const r of rows) if (r.customer_id) for (const k of [r.phone && `p${r.phone}`, r.email && `e${r.email.toLowerCase()}`]) if (k) accountOf.set(k, `c${r.customer_id}`);
  for (const r of rows) {
    let key = guestKey(r);
    if (!key) continue;
    key = accountOf.get(key) ?? key;
    const g = byKey.get(key) ?? { key, name: r.name, phone: r.phone || null, email: r.email, visits: 0, spend: 0, avg: 0, first: r.created_at, last: r.created_at, favourite: null, birthday: null, stamps: 0, vip: false, note: null, account: key.startsWith("c"), items: new Map() };
    g.visits++;
    g.spend += r.total;
    g.last = r.created_at;
    g.name = r.name || g.name;
    g.phone = r.phone || g.phone;
    g.email = r.email || g.email;
    for (const l of JSON.parse(r.lines) as QuoteLine[]) g.items.set(l.name, (g.items.get(l.name) ?? 0) + l.qty);
    byKey.set(key, g);
  }
  const customers = new Map((db.prepare("SELECT id, name, email, phone, birthday FROM customers").all() as { id: number; name: string | null; email: string; phone: string | null; birthday: string | null }[]).map((c) => [`c${c.id}`, c]));
  const stamps = new Map((db.prepare("SELECT phone, stamps FROM loyalty").all() as { phone: string; stamps: number }[]).map((s) => [s.phone, s.stamps]));
  const notes = new Map((db.prepare("SELECT guest_key, vip, note FROM guest_notes").all() as { guest_key: string; vip: number; note: string | null }[]).map((n) => [n.guest_key, n]));
  return [...byKey.values()].map(({ items, ...g }) => {
    const c = customers.get(g.key);
    const n = notes.get(g.key);
    const fav = [...items].sort((a, b) => b[1] - a[1])[0];
    return {
      ...g,
      name: c?.name || g.name,
      email: c?.email || g.email,
      phone: g.phone || c?.phone || null,
      birthday: c?.birthday ?? null,
      avg: Math.round(g.spend / g.visits),
      favourite: fav ? fav[0] : null,
      stamps: g.phone ? stamps.get(g.phone) ?? 0 : 0,
      vip: !!n?.vip,
      note: n?.note ?? null,
    };
  });
}

/** Is the person behind this order a VIP? (shown on the barista screen) */
export function vipKeys() {
  return new Set((db.prepare("SELECT guest_key FROM guest_notes WHERE vip = 1").all() as { guest_key: string }[]).map((r) => r.guest_key));
}
