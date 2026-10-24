import { isAdmin, unauthorized } from "@/lib/auth";
import { addRecipe, heartRecipe, listRecipes, recipesForStaff, reviewRecipe } from "@/lib/guestRecipeStore";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// Approved recipes (?sort=top|new&voter=&limit=), ?all=1 for staff
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ recipes: recipesForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ recipes: listRecipes(q.get("voter"), q.get("sort"), Number(q.get("limit")) || 60) }, { headers: { "Cache-Control": "no-store" } });
}

// Guests: { title, name?, intro?, ingredients, steps } (one per line)
export async function POST(req: Request) {
  if (limited(req, "guest-recipe", 5, 3600_000)) return tooMany();
  const r = addRecipe((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "📝 A guest shared a recipe", "Have a read before it goes up", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Guests: { id, voter, on }
export async function PUT(req: Request) {
  if (limited(req, "recipe-heart", 120, 3600_000)) return tooMany();
  const r = heartRecipe((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewRecipe(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
