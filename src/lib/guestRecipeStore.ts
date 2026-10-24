// Recipe swap: guests share home recipes; staff approve them; other guests heart them.
import "server-only";
import { db, cleanText } from "./db";
import { RECIPE_LIMITS as L, recipeLines, recipeProblem } from "./guestRecipes";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
type Row = { id: number; title: string; name: string; intro: string; ingredients: string; steps: string; created_at: string; hearts: number; mine?: number };
const shape = (r: Row) => ({ ...r, ingredients: JSON.parse(r.ingredients) as string[], steps: JSON.parse(r.steps) as string[], mine: !!r.mine });

export function listRecipes(voter: unknown, sort: unknown, limit = 60) {
  const v = cleanVoter(voter) ?? "";
  const order = sort === "new" ? "g.id DESC" : "hearts DESC, g.id DESC";
  return (db.prepare(`SELECT g.id, g.title, g.name, g.intro, g.ingredients, g.steps, g.created_at, (SELECT COUNT(*) FROM recipe_hearts h WHERE h.recipe_id = g.id) AS hearts,
    EXISTS(SELECT 1 FROM recipe_hearts h WHERE h.recipe_id = g.id AND h.voter = ?) AS mine
    FROM guest_recipes g WHERE g.status = 'approved' ORDER BY ${order} LIMIT ?`).all(v, Math.min(60, limit)) as Row[]).map(shape);
}

export function addRecipe(b: Record<string, unknown>) {
  const r = {
    title: cleanText(b.title, L.title).replace(/[<>]/g, ""),
    name: cleanText(b.name, 20).replace(/[<>]/g, ""),
    intro: cleanText(b.intro, L.intro).replace(/[<>]/g, ""),
    ingredients: recipeLines(b.ingredients, L.ingredients),
    steps: recipeLines(b.steps, L.steps),
  };
  const problem = recipeProblem(r);
  if (problem) return { error: problem };
  if ((db.prepare("SELECT COUNT(*) AS n FROM guest_recipes WHERE status = 'pending'").get() as { n: number }).n >= 100) return { error: "We've got lots to read right now. Try again tomorrow ✿" };
  db.prepare("INSERT INTO guest_recipes (title, name, intro, ingredients, steps) VALUES (?, ?, ?, ?, ?)").run(r.title, r.name, r.intro, JSON.stringify(r.ingredients), JSON.stringify(r.steps));
  return { ok: true as const };
}

export function heartRecipe(b: Record<string, unknown>) {
  const v = cleanVoter(b.voter);
  const id = Math.floor(Number(b.id));
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  if (!db.prepare("SELECT 1 FROM guest_recipes WHERE id = ? AND status = 'approved'").get(id)) return { error: "That recipe is gone." };
  if (b.on === false) db.prepare("DELETE FROM recipe_hearts WHERE recipe_id = ? AND voter = ?").run(id, v);
  else db.prepare("INSERT OR IGNORE INTO recipe_hearts (recipe_id, voter) VALUES (?, ?)").run(id, v);
  return { ok: true as const, hearts: (db.prepare("SELECT COUNT(*) AS n FROM recipe_hearts WHERE recipe_id = ?").get(id) as { n: number }).n };
}

export const recipesForStaff = () => (db.prepare("SELECT id, title, name, intro, ingredients, steps, status, created_at, 0 AS hearts FROM guest_recipes ORDER BY status = 'pending' DESC, id DESC LIMIT 100").all() as (Row & { status: string })[]).map((r) => ({ ...shape(r), status: r.status }));
export function reviewRecipe(id: number, approve: boolean) {
  if (!approve) db.prepare("DELETE FROM recipe_hearts WHERE recipe_id = ?").run(id);
  const r = approve ? db.prepare("UPDATE guest_recipes SET status = 'approved' WHERE id = ?").run(id) : db.prepare("DELETE FROM guest_recipes WHERE id = ?").run(id);
  return r.changes > 0;
}
