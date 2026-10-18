import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { menuLookup } from "@/lib/menuStore";
import { cleanOptions, describeOptions, isDrink, lineKey, unitPrice, type QuoteLine } from "@/lib/pricing";
import { limited, tooMany } from "@/lib/rateLimit";

// "My usual": the drink someone orders most, exactly how they like it.
// Signed-in guests: from their account. Everyone else: from the order codes saved in their browser.
export async function GET(req: Request) {
  if (limited(req, "usual", 120, 600000)) return tooMany();
  const me = await currentCustomer();
  const codes = (new URL(req.url).searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^MM-[A-Z0-9]{4,8}$/.test(c))
    .slice(0, 30);

  const rows = (
    me
      ? db.prepare("SELECT lines FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 50").all(me.id)
      : codes.length
        ? db.prepare(`SELECT lines FROM orders WHERE code IN (${codes.map(() => "?").join(",")}) ORDER BY id DESC`).all(...codes)
        : []
  ) as { lines: string }[];

  const find = menuLookup();
  const tally = new Map<string, { line: QuoteLine; orders: number; rank: number }>();
  rows.forEach((r, i) => {
    const seen = new Set<string>();
    for (const l of JSON.parse(r.lines) as QuoteLine[]) {
      const item = find(l.itemId);
      if (!item || !isDrink(item.cat)) continue;
      const key = lineKey(l.itemId, cleanOptions(item, l.opts ?? {}));
      if (seen.has(key)) continue; // count each order once
      seen.add(key);
      const t = tally.get(key) ?? { line: l, orders: 0, rank: i };
      t.orders++;
      tally.set(key, t);
    }
  });
  // Most orders wins; ties go to the most recent
  const best = [...tally.values()].sort((a, b) => b.orders - a.orders || a.rank - b.rank)[0];
  if (!best) return Response.json({ usual: null });
  const item = find(best.line.itemId)!;
  const opts = cleanOptions(item, best.line.opts ?? {});
  return Response.json({
    usual: {
      itemId: item.id,
      name: item.name,
      img: item.img,
      opts,
      note: describeOptions(item, opts),
      price: unitPrice(item, opts),
      orders: best.orders,
      soldOut: !!item.soldOut,
    },
  });
}
