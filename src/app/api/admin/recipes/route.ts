import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import { menuLookup } from "@/lib/menuStore";
import { SIZE_GUIDE, allRecipes, saveRecipe, seedRecipes } from "@/lib/recipes";

// Staff: every drink recipe
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  // Starting recipes, plus ones for drinks added later (never over an owner's edit)
  if (getSetting("seeded_recipes_v2") !== "1") { seedRecipes(); setSetting("seeded_recipes", "1"); setSetting("seeded_recipes_v2", "1"); }
  return Response.json({ recipes: allRecipes(), sizeGuide: SIZE_GUIDE });
}

// Owner: change one ({ itemId, text }); empty text removes it
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  if (!menuLookup()(String(b?.itemId ?? ""))) return Response.json({ error: "That item isn't on the menu." }, { status: 404 });
  saveRecipe(String(b.itemId), String(b?.text ?? ""));
  return Response.json({ ok: true, recipes: allRecipes() });
}
