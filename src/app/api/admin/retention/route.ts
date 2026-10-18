import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { guestKey } from "@/lib/guests";

// Owner: of the guests who first ordered each month, how many came back within 30 days?
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  const rows = db.prepare("SELECT customer_id, phone, email, created_at FROM orders ORDER BY id").all() as { customer_id: number | null; phone: string; email: string | null; created_at: string }[];
  const visits = new Map<string, number[]>();
  for (const r of rows) {
    const k = guestKey(r);
    if (!k) continue;
    const list = visits.get(k) ?? [];
    list.push(new Date(r.created_at.replace(" ", "T")).getTime());
    visits.set(k, list);
  }
  const months = new Map<string, { newGuests: number; returned: number; tooSoon: number }>();
  const now = Date.now();
  for (const times of visits.values()) {
    const first = times[0];
    const d = new Date(first);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = months.get(m) ?? { newGuests: 0, returned: 0, tooSoon: 0 };
    row.newGuests++;
    // Came back on a later day, within 30 days of their first visit
    if (times.some((t) => t - first > 6 * 3600_000 && t - first <= 30 * 86_400_000)) row.returned++;
    else if (now - first < 30 * 86_400_000) row.tooSoon++; // still within their first 30 days
    months.set(m, row);
  }
  const list = [...months].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([month, r]) => ({
    month,
    ...r,
    rate: r.newGuests ? Math.round((r.returned / r.newGuests) * 100) : 0,
  }));
  return Response.json({ months: list });
}
