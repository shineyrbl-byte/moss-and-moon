import { db, cleanText } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { guestList } from "@/lib/guests";

// Owner: the guest list (?q= search, ?sort=spend|visits|recent, ?vip=1, ?format=csv)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const p = new URL(req.url).searchParams;
  const q = (p.get("q") ?? "").trim().toLowerCase();
  const sort = p.get("sort") ?? "spend";
  let list = guestList().filter((g) => (!q || `${g.name} ${g.phone ?? ""} ${g.email ?? ""} ${g.note ?? ""}`.toLowerCase().includes(q)) && (p.get("vip") !== "1" || g.vip));
  list.sort((a, b) => (sort === "visits" ? b.visits - a.visits : sort === "recent" ? b.last.localeCompare(a.last) : b.spend - a.spend));
  if (p.get("format") === "csv") {
    const cell = (v: unknown) => `"${String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
    const head = ["Name", "Phone", "Email", "Visits", "Spend", "Average", "First visit", "Last visit", "Favourite", "Birthday", "VIP", "Note"];
    const csv = [head.map(cell).join(","), ...list.map((g) => [g.name, g.phone, g.email, g.visits, g.spend, g.avg, g.first.slice(0, 10), g.last.slice(0, 10), g.favourite, g.birthday, g.vip ? "yes" : "", g.note].map(cell).join(","))].join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="moss-and-moon-guests.csv"' } });
  }
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const birthdays = guestList().filter((g) => g.birthday?.startsWith(month)).map((g) => ({ name: g.name, birthday: g.birthday, key: g.key }));
  const total = list.length;
  list = list.slice(0, 300);
  return Response.json({ total, guests: list, birthdays });
}

// Owner: star a VIP or write a note ({ key, vip?, note? })
export async function PATCH(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const key = String(b?.key ?? "");
  if (!/^[cpe].{1,120}$/.test(key)) return Response.json({ error: "Guest not found." }, { status: 404 });
  const cur = db.prepare("SELECT vip, note FROM guest_notes WHERE guest_key = ?").get(key) as { vip: number; note: string | null } | undefined;
  const vip = b.vip === undefined ? cur?.vip ?? 0 : b.vip ? 1 : 0;
  const note = b.note === undefined ? cur?.note ?? null : cleanText(b.note, 200) || null;
  db.prepare("INSERT INTO guest_notes (guest_key, vip, note) VALUES (?, ?, ?) ON CONFLICT(guest_key) DO UPDATE SET vip = excluded.vip, note = excluded.note, updated_at = datetime('now','localtime')").run(key, vip, note);
  return Response.json({ ok: true, vip: !!vip, note });
}
