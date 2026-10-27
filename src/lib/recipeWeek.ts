// The owner's recipe of the week: one of the make-at-home recipes, with an optional video link and a note.
import "server-only";
import { getSetting, setSetting, cleanText } from "./db";
import { HOME_RECIPES } from "./homeRecipes";

export type RecipeWeek = { id: string; video: string; note: string };
const KEY = "recipe_week";

export function recipeWeek(): (RecipeWeek & { title: string }) | null {
  try {
    const v = JSON.parse(getSetting(KEY) ?? "null") as RecipeWeek | null;
    const r = v && HOME_RECIPES.find((x) => x.id === v.id);
    return r ? { ...v!, title: r.title } : null;
  } catch { return null; }
}
/** Only real recipes, and only https links for the video (so it opens safely in a new tab) */
export function setRecipeWeek(b: Record<string, unknown>) {
  if (b.clear) { setSetting(KEY, "null"); return { week: null }; }
  if (!HOME_RECIPES.some((r) => r.id === b.id)) return { error: "Pick one of the recipes." };
  const video = cleanText(b.video, 300).trim();
  if (video) { try { const u = new URL(video); if (u.protocol !== "https:") throw 0; } catch { return { error: "The video link should start with https://" }; } }
  const note = cleanText(b.note, 200).replace(/[<>]/g, "");
  setSetting(KEY, JSON.stringify({ id: b.id, video, note }));
  return { week: recipeWeek() };
}
