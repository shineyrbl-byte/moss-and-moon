// Coffee bingo, saved: the month's card is fixed the first time anyone looks at it,
// and squares are stamped from real orders (made while signed in), so the treat can't be faked.
import "server-only";
import { db } from "./db";
import { getMenu } from "./menuStore";
import { BINGO_REWARD, doneLines, pickCard, type BingoSquare } from "./bingo";

export const monthOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function cardFor(month: string): BingoSquare[] {
  const row = db.prepare("SELECT items FROM bingo_cards WHERE month = ?").get(month) as { items: string } | undefined;
  if (row) return JSON.parse(row.items);
  const pool = getMenu()
    .filter((m) => m.cat !== "shop" && !m.pup && !m.fullMoon && !m.groups?.length && !m.soldOut)
    .map((m) => ({ id: m.id, name: m.name, cat: m.cat }));
  const card = pickCard(pool, month);
  db.prepare("INSERT OR IGNORE INTO bingo_cards (month, items) VALUES (?, ?)").run(month, JSON.stringify(card));
  return JSON.parse((db.prepare("SELECT items FROM bingo_cards WHERE month = ?").get(month) as { items: string }).items);
}

export function bingoFor(customerId: number | null, now = new Date()) {
  const month = monthOf(now);
  const card = cardFor(month);
  const when = new Map<string, string>();
  if (customerId) {
    const rows = db.prepare("SELECT lines, created_at FROM orders WHERE customer_id = ? AND status != 'cancelled' AND sim = 0 AND substr(created_at, 1, 7) = ? ORDER BY id").all(customerId, month) as { lines: string; created_at: string }[];
    for (const r of rows) for (const l of JSON.parse(r.lines) as { itemId: string }[]) if (!when.has(l.itemId)) when.set(l.itemId, r.created_at.slice(0, 10));
  }
  const squares = card.map((s) => ({ ...s, stamped: when.has(s.id), date: when.get(s.id) ?? null }));
  const lines = doneLines(squares.map((s) => s.stamped));
  const claimed = customerId ? !!db.prepare("SELECT 1 FROM bingo_claims WHERE customer_id = ? AND month = ?").get(customerId, month) : false;
  const orderable = new Set(getMenu().filter((m) => !m.soldOut).map((m) => m.id));
  return { month, squares: squares.map((s) => ({ ...s, orderable: orderable.has(s.id) })), lines, stamped: squares.filter((s) => s.stamped).length, claimed, reward: BINGO_REWARD, signedIn: !!customerId };
}

/** A full line: add the treat as credit, once a month */
export function claimBingo(customerId: number): { ok: true; credit: number } | { error: string; status: number } {
  const b = bingoFor(customerId);
  if (!b.lines.length) return { error: "Finish a row, column or diagonal first.", status: 400 };
  const r = db.prepare("INSERT OR IGNORE INTO bingo_claims (customer_id, month) VALUES (?, ?)").run(customerId, b.month);
  if (!r.changes) return { error: "You've already had this month's treat ✿", status: 409 };
  db.prepare("UPDATE customers SET credit = credit + ? WHERE id = ?").run(BINGO_REWARD, customerId);
  return { ok: true, credit: (db.prepare("SELECT credit FROM customers WHERE id = ?").get(customerId) as { credit: number }).credit };
}
