import { db, cleanEmail, cleanPhone, cleanText } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { saveItem, getMenu } from "@/lib/menuStore";
import type { Category, MenuItem } from "@/lib/menu";
import { publish } from "@/lib/live";

const CATS: Category[] = ["coffee", "tea", "cold", "food", "bakes", "shop"];
const yes = (v: unknown) => /^(y|yes|true|1|haan|ha)$/i.test(String(v ?? "").trim());
/** Match a spreadsheet category word to ours */
function catFor(v: unknown): Category | null {
  const s = String(v ?? "").toLowerCase();
  if (/coffee|latte|espresso/.test(s)) return "coffee";
  if (/tea|chai|matcha/.test(s)) return "tea";
  if (/cold|juice|smoothie|shake|iced|mocktail|drink/.test(s)) return "cold";
  if (/bake|cake|dessert|sweet|pastry|cookie/.test(s)) return "bakes";
  if (/shop|merch|retail|beans/.test(s)) return "shop";
  if (/food|meal|snack|breakfast|sandwich|bowl|toast/.test(s)) return "food";
  return CATS.includes(s as Category) ? (s as Category) : null;
}

// Owner: import rows from a spreadsheet ({ kind: "guests" | "menu", rows: [{...columns}] }); { dryRun: true } only checks
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const rows = (Array.isArray(b?.rows) ? b.rows : []).slice(0, 2000) as Record<string, unknown>[];
  if (!rows.length) return Response.json({ error: "No rows found. Is the first row the column names?" }, { status: 400 });
  const problems: string[] = [];
  let added = 0, updated = 0, skipped = 0, subscribed = 0;

  if (b.kind === "guests") {
    const upsert = db.prepare(`INSERT INTO loyalty (phone, name, stamps, rewards_used) VALUES (?, ?, ?, 0)
      ON CONFLICT(phone) DO UPDATE SET name = COALESCE(NULLIF(excluded.name, ''), name), stamps = MAX(stamps, excluded.stamps)`);
    const sub = db.prepare("INSERT OR IGNORE INTO subscribers (email) VALUES (?)");
    rows.forEach((r, i) => {
      const phone = cleanPhone(r.phone ?? r.mobile ?? r.number);
      const email = cleanEmail(r.email);
      const name = cleanText(r.name, 40);
      const stamps = Math.max(0, Math.min(50, Math.floor(Number(r.stamps ?? r.visits ?? 0)) || 0));
      if (phone.length !== 10 && !email) { skipped++; if (problems.length < 10) problems.push(`Row ${i + 2}: needs a 10-digit phone or an email`); return; }
      if (phone.length === 10) {
        if (!b.dryRun) { const had = db.prepare("SELECT 1 FROM loyalty WHERE phone = ?").get(phone); upsert.run(phone, name, stamps); had ? updated++ : added++; }
        else added++;
      }
      // Only people who said yes to emails join the newsletter
      if (email && yes(r.newsletter ?? r.subscribed ?? r.marketing)) { if (!b.dryRun) sub.run(email); subscribed++; }
    });
    return Response.json({ ok: true, added, updated, skipped, subscribed, problems, dryRun: !!b.dryRun });
  }

  if (b.kind === "menu") {
    const have = new Set(getMenu({ includeHidden: true }).map((m) => m.name.toLowerCase()));
    rows.forEach((r, i) => {
      const name = cleanText(r.name ?? r.item, 60);
      const price = Math.round(Number(String(r.price ?? "").replace(/[^\d.]/g, "")));
      const cat = catFor(r.category ?? r.section ?? r.type);
      if (!name || !(price > 0 && price <= 5000) || !cat) { skipped++; if (problems.length < 10) problems.push(`Row ${i + 2}: needs a name, a price and a category we recognise`); return; }
      if (have.has(name.toLowerCase())) { skipped++; if (problems.length < 10) problems.push(`Row ${i + 2}: “${name}” is already on the menu`); return; }
      have.add(name.toLowerCase());
      const item: MenuItem = {
        id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`,
        cat, name, desc: cleanText(r.description ?? r.desc, 200), price,
        img: "1495474472287-4d71bcdd2085", hidden: true, // stays hidden until it has its own photo
        ...(yes(r.vegan) ? { diet: ["vegan" as const] } : {}),
        ...(cat === "coffee" || cat === "tea" || cat === "cold" ? { traits: { energy: 1, sweet: 1, temp: cat === "cold" ? "iced" as const : "hot" as const } } : {}),
      };
      if (!b.dryRun) saveItem(item);
      added++;
    });
    if (!b.dryRun && added) publish({ type: "menu" });
    return Response.json({ ok: true, added, skipped, problems, dryRun: !!b.dryRun });
  }
  return Response.json({ error: "Pick what you're importing." }, { status: 400 });
}
