import { db, cleanText } from "@/lib/db";
import { GROUP_MAX_ITEMS, GROUP_MAX_PEOPLE, getGroup, groupSummary, isHost } from "@/lib/groups";
import { menuLookup } from "@/lib/menuStore";
import { cleanOptions, type Options } from "@/lib/pricing";
import { publish } from "@/lib/live";
import { limited, tooMany } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

// Add your drinks to the group tray
export async function POST(req: Request, { params }: Ctx) {
  if (limited(req, "group-items", 120, 600000)) return tooMany();
  const g = getGroup((await params).code);
  if (!g) return Response.json({ error: "We couldn't find that group order." }, { status: 404 });
  if (g.status !== "open") return Response.json({ error: "This group order has already been placed." }, { status: 409 });
  const b = await req.json().catch(() => null);
  const person = cleanText(b?.person, 30);
  if (!person) return Response.json({ error: "Please add your name first." }, { status: 400 });
  const raw = Array.isArray(b?.lines) ? b.lines.slice(0, 20) : [];
  const find = menuLookup();
  const lines = raw
    .map((l: { itemId?: string; opts?: Options; qty?: number }) => {
      const item = find(String(l.itemId));
      const qty = Math.floor(Number(l.qty));
      if (!item || item.soldOut || !(qty >= 1 && qty <= 20)) return null;
      return { itemId: item.id, opts: cleanOptions(item, l.opts ?? {}), qty };
    })
    .filter(Boolean) as { itemId: string; opts: Options; qty: number }[];
  if (!lines.length) return Response.json({ error: "Nothing to add. Pick something from the menu first." }, { status: 400 });

  const s = groupSummary(g.code)!;
  if (s.itemCount + lines.length > GROUP_MAX_ITEMS) return Response.json({ error: "This group tray is full." }, { status: 409 });
  if (!s.people.some((p) => p.person === person) && s.people.length >= GROUP_MAX_PEOPLE)
    return Response.json({ error: `Group orders are for up to ${GROUP_MAX_PEOPLE} people.` }, { status: 409 });

  const add = db.prepare("INSERT INTO group_items (group_code, person, item_id, opts, qty) VALUES (?, ?, ?, ?, ?)");
  for (const l of lines) add.run(g.code, person, l.itemId, JSON.stringify(l.opts), l.qty);
  publish({ type: "group", code: g.code });
  return Response.json(groupSummary(g.code));
}

// Take something out again (your own items, or anything if you're the host)
export async function DELETE(req: Request, { params }: Ctx) {
  if (limited(req, "group-items", 120, 600000)) return tooMany();
  const g = getGroup((await params).code);
  if (!g) return Response.json({ error: "We couldn't find that group order." }, { status: 404 });
  if (g.status !== "open") return Response.json({ error: "This group order has already been placed." }, { status: 409 });
  const b = await req.json().catch(() => null);
  const row = db.prepare("SELECT person FROM group_items WHERE id = ? AND group_code = ?").get(Number(b?.id), g.code) as { person: string } | undefined;
  if (!row) return Response.json({ error: "That item isn't in the tray." }, { status: 404 });
  if (row.person !== cleanText(b?.person, 30) && !isHost(g, b?.hostToken)) return Response.json({ error: "You can only remove your own items." }, { status: 403 });
  db.prepare("DELETE FROM group_items WHERE id = ?").run(Number(b.id));
  publish({ type: "group", code: g.code });
  return Response.json(groupSummary(g.code));
}
