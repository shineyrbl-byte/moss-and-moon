import { db, cleanText } from "@/lib/db";
import { isAdmin, unauthorized, ownerGate } from "@/lib/auth";
import { deleteItem, getMenu, moveItem, saveItem, setShopStock } from "@/lib/menuStore";
import type { Addon, Category, Diet, MenuItem } from "@/lib/menu";
import { publish } from "@/lib/live";
import { SEASONS } from "@/lib/seasons";
import { ALLERGENS } from "@/lib/nutrition";

// The menu (with sold-out flags). Staff can add ?all=1 to include hidden items.
export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all && !(await isAdmin())) return unauthorized();
  const items = getMenu({ includeHidden: all });
  return Response.json({ items, soldOut: items.filter((m) => m.soldOut).map((m) => m.id) });
}

// Staff: mark an item sold out / back in stock
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { itemId, soldOut, stock } = await req.json().catch(() => ({}));
  if (!getMenu({ includeHidden: true }).some((m) => m.id === itemId)) return Response.json({ error: "Unknown item." }, { status: 400 });
  // Shop items: set how many are in stock
  if (stock !== undefined) {
    if (!(Number(stock) >= 0)) return Response.json({ error: "Stock should be 0 or more." }, { status: 400 });
    setShopStock(itemId, Number(stock));
    publish({ type: "menu" });
    return Response.json({ ok: true });
  }
  if (soldOut) db.prepare("INSERT OR IGNORE INTO sold_out (item_id) VALUES (?)").run(itemId);
  else db.prepare("DELETE FROM sold_out WHERE item_id = ?").run(itemId);
  publish({ type: "menu" });
  return Response.json({ ok: true });
}

const CATS: Category[] = ["coffee", "tea", "cold", "food", "bakes", "shop"];
const BADGES = ["bestseller", "new", "pink pick"] as const;
const level = (v: unknown) => (Math.max(0, Math.min(2, Math.round(Number(v) || 0))) as 0 | 1 | 2);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "item";

/** Turn whatever the form sent into a safe menu item (or an error message) */
function cleanItem(b: Record<string, unknown>): MenuItem | string {
  const name = String(b.name ?? "").trim().slice(0, 60);
  const desc = String(b.desc ?? "").trim().slice(0, 200);
  const cat = b.cat as Category;
  const price = Math.round(Number(b.price));
  let img = String(b.img ?? "").trim();
  // Accept a full Unsplash image link and keep just the photo id
  const m = /images\.unsplash\.com\/photo-([\w-]+)/.exec(img);
  if (m) img = m[1];

  if (!name) return "Please give it a name.";
  if (!CATS.includes(cat)) return "Please pick a category.";
  if (!(price >= 0 && price <= 5000)) return "Price should be between ₹0 and ₹5,000.";
  if (!img) return "Please add a photo.";
  if (!/^[\w-]+$/.test(img) && !/^\/api\/uploads\/[\w-]+\.(jpg|png|webp)$/.test(img)) return "That photo link doesn't look right.";

  const diet = (Array.isArray(b.diet) ? b.diet : []).filter((d): d is Diet => d === "vegan" || d === "gf");
  const badge = BADGES.find((x) => x === b.badge);
  const t = (b.traits ?? {}) as Record<string, unknown>;
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const from = date(b.from);
  const until = date(b.until);
  if (from && until && from > until) return "The season ends before it starts. Check the dates.";
  const uses = (Array.isArray(b.uses) ? b.uses : [])
    .map((u: { ingredient?: unknown; amount?: unknown }) => ({ ingredient: String(u?.ingredient ?? "").slice(0, 40), amount: Math.max(0, Number(u?.amount) || 0) }))
    .filter((u: { ingredient: string; amount: number }) => /^[a-z0-9-]+$/.test(u.ingredient) && u.amount > 0)
    .slice(0, 8);
  const id = typeof b.id === "string" && /^[\w-]{1,60}$/.test(b.id) ? b.id : `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id, cat, name, desc, price, img,
    ...(diet.length ? { diet } : {}),
    ...(badge ? { badge } : {}),
    ...(cat === "coffee" || cat === "tea" || cat === "cold" ? { traits: { energy: level(t.energy), sweet: level(t.sweet), temp: t.temp === "iced" ? "iced" : "hot" } } : {}),
    ...(b.hidden ? { hidden: true } : {}),
    ...(from ? { from } : {}),
    ...(until ? { until } : {}),
    ...(uses.length ? { uses } : {}),
    ...(typeof b.season === "string" && b.season in SEASONS ? { season: b.season } : {}),
    ...(Array.isArray(b.allergens) ? { allergens: ALLERGENS.map((a) => a.id).filter((a) => (b.allergens as unknown[]).includes(a)) } : {}),
    ...(b.kcal !== undefined && b.kcal !== "" && Number(b.kcal) >= 0 && Number(b.kcal) <= 3000 ? { kcal: Math.round(Number(b.kcal)) } : {}),
    ...(b.noMilk && cat !== "food" && cat !== "bakes" && cat !== "shop" ? { noMilk: true } : {}),
    ...(cat === "shop" && Array.isArray(b.variants) && b.variants.length ? { variants: cleanVariants(b.variants) } : {}),
    ...(cat === "shop" && b.stock !== undefined && b.stock !== "" && b.stock !== null && Number(b.stock) >= 0 ? { stock: Math.min(9999, Math.round(Number(b.stock))) } : {}),
    ...(Array.isArray(b.addons) && (cat === "food" || cat === "bakes") && b.addons.length ? { addons: cleanAddons(b.addons) } : {}),
    ...(b.cost !== undefined && b.cost !== "" && Number(b.cost) >= 0 && Number(b.cost) <= 5000 ? { cost: Math.round(Number(b.cost) * 100) / 100 } : {}),
  };
}

const ALLERGEN_IDS = ["milk", "nuts", "gluten", "egg", "soy", "sesame"];
/** Up to 8 choices for a shop item (grind, colour…), each with an optional extra price */
function cleanVariants(list: unknown[]) {
  return list.slice(0, 8).flatMap((raw) => {
    const v = (raw ?? {}) as Record<string, unknown>;
    const label = cleanText(v.label, 50);
    const price = Math.round(Number(v.price) || 0);
    if (!label || !(price >= 0 && price <= 5000)) return [];
    const id = typeof v.id === "string" && /^[\w-]{1,40}$/.test(v.id) ? v.id : label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    return [{ id, label, price }];
  });
}
/** Up to 8 add-ons with a name and a price; ids are kept so saved orders still match */
function cleanAddons(list: unknown[]): Addon[] {
  return list.slice(0, 8).flatMap((raw) => {
    const a = (raw ?? {}) as Record<string, unknown>;
    const label = cleanText(a.label, 50);
    const price = Math.round(Number(a.price));
    if (!label || !(price >= 0 && price <= 2000)) return [];
    const id = typeof a.id === "string" && /^[\w-]{1,40}$/.test(a.id) ? a.id : label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const only = (v: unknown) => (Array.isArray(v) ? v.filter((x) => ALLERGEN_IDS.includes(String(x))).map(String).slice(0, 3) : undefined);
    const adds = only(a.adds);
    const removes = only(a.removes);
    const kcal = Number(a.kcal);
    return [{ id, label, price, ...(adds?.length ? { adds } : {}), ...(removes?.length ? { removes } : {}), ...(kcal >= 0 && kcal <= 2000 ? { kcal: Math.round(kcal) } : {}) }];
  });
}

// Owner: create / edit an item, or move it ({ move: "up" | "down", id })
export async function POST(req: Request) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (b.move) {
    moveItem(String(b.id), b.move === "up" ? -1 : 1);
    return Response.json({ ok: true });
  }
  const item = cleanItem(b);
  if (typeof item === "string") return Response.json({ error: item }, { status: 400 });
  saveItem(item);
  publish({ type: "menu" });
  return Response.json({ ok: true, item });
}

// Owner: delete an item for good (?id=...)
export async function DELETE(req: Request) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const id = new URL(req.url).searchParams.get("id") ?? "";
  deleteItem(id);
  return Response.json({ ok: true });
}
