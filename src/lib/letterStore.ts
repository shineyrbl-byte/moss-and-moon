// Letters to future you: sealed notes that open on a date, with what you ordered the day you wrote it.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { LETTER_MAX, LETTER_MONTHS, SEALED_MAX, daysUntil, isOpen, openOn } from "./letters";
import type { QuoteLine } from "./pricing";

type Row = { id: number; body: string; ordered: string; open_on: string; created_at: string };

export function myLetters(customerId: number, now = new Date()) {
  const today = toDateStr(now);
  return (db.prepare("SELECT id, body, ordered, open_on, created_at FROM future_letters WHERE customer_id = ? ORDER BY open_on, id").all(customerId) as Row[]).map((r) =>
    isOpen(r.open_on, today)
      ? { id: r.id, open: true as const, openOn: r.open_on, written: r.created_at.slice(0, 10), body: r.body, ordered: JSON.parse(r.ordered) as string[] }
      : { id: r.id, open: false as const, openOn: r.open_on, written: r.created_at.slice(0, 10), days: daysUntil(r.open_on, today) });
}

export function writeLetter(customer: { id: number; email: string }, b: Record<string, unknown>, now = new Date()) {
  const body = String(b.body ?? "").trim();
  const months = Number(b.months);
  if (body.length < 3) return { error: "Write a little more first ✿" };
  if (body.length > LETTER_MAX) return { error: `Keep it under ${LETTER_MAX} characters.` };
  if (!(LETTER_MONTHS as readonly number[]).includes(months)) return { error: "Pick when it opens." };
  const today = toDateStr(now);
  const sealed = (db.prepare("SELECT COUNT(*) AS n FROM future_letters WHERE customer_id = ? AND open_on > ?").get(customer.id, today) as { n: number }).n;
  if (sealed >= SEALED_MAX) return { error: `You have ${SEALED_MAX} letters waiting already. Let one open first.` };
  // What you had today, so the letter brings the day back
  const orders = db.prepare("SELECT lines FROM orders WHERE (customer_id = ? OR lower(email) = lower(?)) AND date(created_at) = ? AND status != 'cancelled' AND sim = 0").all(customer.id, customer.email, today) as { lines: string }[];
  const ordered = [...new Set(orders.flatMap((o) => (JSON.parse(o.lines) as QuoteLine[]).map((l) => l.name)))].slice(0, 8);
  const open = openOn(today, months);
  db.prepare("INSERT INTO future_letters (customer_id, body, ordered, open_on) VALUES (?, ?, ?, ?)").run(customer.id, body, JSON.stringify(ordered), open);
  return { ok: true, openOn: open, ordered, letters: myLetters(customer.id, now) };
}
