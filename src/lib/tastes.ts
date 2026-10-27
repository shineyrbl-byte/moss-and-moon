// My tastes: a few likes kept on this device (less sweet, low caffeine, iced, dairy-free...) that pick out the drinks
// and dishes that suit you. Only uses what the menu says about each dish. Pure.
export type Tastes = { sweet?: "less" | "more"; caffeine?: "low" | "high"; temp?: "hot" | "iced"; dairyFree?: boolean };
export const TASTES_KEY = "mm-tastes";
type Dish = { id: string; traits?: { energy: number; sweet: number; temp: "hot" | "iced" }; allergens?: string[]; soldOut?: boolean; hidden?: boolean; pup?: boolean; kids?: boolean };

export const anyTaste = (t: Tastes) => !!(t.sweet || t.caffeine || t.temp || t.dairyFree);
/** Does this dish fit every taste you've picked? A dish we know nothing about for a taste doesn't count as a fit. */
export function suits(m: Dish, t: Tastes) {
  if (t.sweet || t.caffeine || t.temp) {
    if (!m.traits) return false;
    if (t.sweet === "less" && m.traits.sweet > 0) return false;
    if (t.sweet === "more" && m.traits.sweet < 2) return false;
    if (t.caffeine === "low" && m.traits.energy > 0) return false;
    if (t.caffeine === "high" && m.traits.energy < 2) return false;
    if (t.temp && m.traits.temp !== t.temp) return false;
  }
  if (t.dairyFree && (!m.allergens || m.allergens.includes("milk"))) return false;
  return true;
}
/** Dishes on today's menu that suit you (none if you haven't picked anything) */
export const tastePicks = <T extends Dish>(menu: T[], t: Tastes, n = 6) => (anyTaste(t) ? menu.filter((m) => !m.soldOut && !m.hidden && !m.pup && !m.kids && suits(m, t)).slice(0, n) : []);
export function loadTastes(): Tastes {
  try { const v = JSON.parse(localStorage.getItem(TASTES_KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
