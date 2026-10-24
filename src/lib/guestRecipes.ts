// Recipe swap: home recipes shared by guests. Pure checks, so the page, server and tests share them.
export const RECIPE_LIMITS = { title: 60, intro: 200, ingredients: 12, steps: 10, line: 120 };
/** One per line, blanks dropped, capped */
export const recipeLines = (v: unknown, max: number) => String(v ?? "").split("\n").map((l) => l.replace(/[<>]/g, "").replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim().slice(0, RECIPE_LIMITS.line)).filter(Boolean).slice(0, max);
export function recipeProblem(r: { title: string; ingredients: string[]; steps: string[] }) {
  if (r.title.length < 3) return "Give your recipe a name.";
  if (r.ingredients.length < 2) return "List at least two ingredients, one per line.";
  if (!r.steps.length) return "Add the steps, one per line.";
  return null;
}
