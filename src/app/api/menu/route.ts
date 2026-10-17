import { db } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { deleteItem, getMenu, moveItem, saveItem } from "@/lib/menuStore";
import type { Category, Diet, MenuItem } from "@/lib/menu";

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
  const { itemId, soldOut } = await req.json().catch(() => ({}));
  if (!getMenu({ includeHidden: true }).some((m) => m.id === itemId)) return Response.json({ error: "Unknown item." }, { status: 400 });
  if (soldOut) db.prepare("INSERT OR IGNORE INTO sold_out (item_id) VALUES (?)").run(itemId);
  else db.prepare("DELETE FROM sold_out WHERE item_id = ?").run(itemId);
  return Response.json({ ok: true });
}

const CATS: Category[] = ["coffee", "tea", "bakes"];
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
  const id = typeof b.id === "string" && /^[\w-]{1,60}$/.test(b.id) ? b.id : `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id, cat, name, desc, price, img,
    ...(diet.length ? { diet } : {}),
    ...(badge ? { badge } : {}),
    ...(cat !== "bakes" ? { traits: { energy: level(t.energy), sweet: level(t.sweet), temp: t.temp === "iced" ? "iced" : "hot" } } : {}),
    ...(b.hidden ? { hidden: true } : {}),
  };
}

// Staff: create / edit an item, or move it ({ move: "up" | "down", id })
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (b.move) {
    moveItem(String(b.id), b.move === "up" ? -1 : 1);
    return Response.json({ ok: true });
  }
  const item = cleanItem(b);
  if (typeof item === "string") return Response.json({ error: item }, { status: 400 });
  saveItem(item);
  return Response.json({ ok: true, item });
}

// Staff: delete an item for good (?id=...)
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  deleteItem(id);
  return Response.json({ ok: true });
}
