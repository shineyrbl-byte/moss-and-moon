import { ownerGate } from "@/lib/auth";
import { recipeWeek, setRecipeWeek } from "@/lib/recipeWeek";
import { HOME_RECIPES } from "@/lib/homeRecipes";

// Owner: the recipe of the week and the recipes to choose from
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ week: recipeWeek(), recipes: HOME_RECIPES.map((r) => ({ id: r.id, title: r.title })) });
}

// Owner: { id, video?, note? } or { clear: true }
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = setRecipeWeek(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
