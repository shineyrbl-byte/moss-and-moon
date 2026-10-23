// "Special of the day": an idea that uses up what we have too much of, or keep throwing away
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { getIngredients } from "./stock";
import { getMenu, menuLookup, saveItem } from "./menuStore";
import { askJSON, type JsonSchema } from "./ai";
import { isDrink } from "./pricing";
import type { MenuItem } from "./menu";

export type SpecialIdea = { baseItemId: string; name: string; desc: string; price: number; why: string };

/** What there's plenty of, and what gets wasted most */
export function specialInputs() {
  const plenty = getIngredients()
    .filter((i) => i.low_at > 0 && i.qty >= i.low_at * 3)
    .map((i) => ({ id: i.id, name: i.name, ratio: Math.round((i.qty / i.low_at) * 10) / 10, qty: Math.round(i.qty), unit: i.unit }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 6);
  const wasted = db.prepare("SELECT item_id, item_name, SUM(qty) AS qty FROM waste WHERE day >= date('now','localtime','-14 days') GROUP BY item_id ORDER BY qty DESC LIMIT 4").all() as { item_id: string; item_name: string; qty: number }[];
  return { plenty, wasted };
}

/** Without AI: the drink that uses most of the most overstocked ingredient, or the bake wasted most, 10% off */
function simpleIdea(menu: MenuItem[], inputs: ReturnType<typeof specialInputs>): SpecialIdea | null {
  for (const p of inputs.plenty) {
    const m = menu.filter((x) => x.uses?.some((u) => u.ingredient === p.id)).sort((a, b) => (b.uses!.find((u) => u.ingredient === p.id)!.amount) - (a.uses!.find((u) => u.ingredient === p.id)!.amount))[0];
    if (m) return { baseItemId: m.id, name: `Today's ${m.name}`, desc: m.desc, price: Math.round((m.price * 0.9) / 5) * 5, why: `We have plenty of ${p.name.toLowerCase()} (${p.ratio}× the reorder level).` };
  }
  const w = inputs.wasted.map((x) => menu.find((m) => m.id === x.item_id)).find(Boolean);
  if (w) return { baseItemId: w.id, name: `${w.name} & a coffee`, desc: `${w.desc} With any regular coffee.`, price: w.price + 120, why: `${w.name} is the bake thrown away most in the last two weeks.` };
  const fallback = menu.find((m) => isDrink(m.cat) && m.badge === "bestseller");
  return fallback ? { baseItemId: fallback.id, name: `Today's ${fallback.name}`, desc: fallback.desc, price: Math.round((fallback.price * 0.9) / 5) * 5, why: "Nothing is overstocked or being wasted right now, so here's a bestseller treat." } : null;
}

const schema: JsonSchema = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: { baseItemId: { type: "string" }, name: { type: "string" }, desc: { type: "string" }, price: { type: "number" }, why: { type: "string" } },
        required: ["baseItemId", "name", "desc", "price", "why"],
      },
    },
  },
  required: ["ideas"],
};

export async function suggestSpecials(): Promise<{ ideas: SpecialIdea[]; provider: string | null; inputs: ReturnType<typeof specialInputs> }> {
  const menu = getMenu({ includeHidden: false }).filter((m) => m.cat !== "shop" && !m.pup);
  const inputs = specialInputs();
  const ai = await askJSON<{ ideas: SpecialIdea[] }>(
    "You're the head barista of Moss & Moon, a cosy pink café in Goa, India. Suggest specials of the day that use up overstocked ingredients or bakes that keep getting thrown away. Each special is a twist on an existing menu item (give its exact id as baseItemId) that the team can make with what's in stock. Names under 32 characters, descriptions one short sentence, prices in whole rupees close to the base item's. 'why' says in plain words what it uses up.",
    JSON.stringify({
      overstocked: inputs.plenty,
      oftenWasted: inputs.wasted,
      menu: menu.map((m) => ({ id: m.id, name: m.name, cat: m.cat, price: m.price, desc: m.desc })),
    }),
    schema,
  );
  const find = menuLookup();
  const ideas = (ai?.data.ideas ?? [])
    .filter((i) => find(i.baseItemId) && i.name && i.price > 0)
    .slice(0, 3)
    .map((i) => ({ ...i, name: i.name.slice(0, 40), desc: i.desc.slice(0, 160), why: i.why.slice(0, 200), price: Math.min(2000, Math.max(20, Math.round(i.price))) }));
  if (!ideas.length) {
    const s = simpleIdea(menu, inputs);
    return { ideas: s ? [s] : [], provider: null, inputs };
  }
  return { ideas, provider: ai!.provider, inputs };
}

/** Put a special on today's menu: a copy of the base item, only shown today */
export function addSpecial(idea: SpecialIdea) {
  const base = menuLookup()(idea.baseItemId);
  if (!base) return null;
  const today = toDateStr(new Date());
  // Tidy away specials from more than a week ago
  for (const r of db.prepare("SELECT id, data FROM menu_items WHERE id LIKE 'special-%'").all() as { id: string; data: string }[])
    if ((JSON.parse(r.data) as MenuItem).until! < toDateStr(new Date(Date.now() - 7 * 86_400_000))) db.prepare("DELETE FROM menu_items WHERE id = ?").run(r.id);
  const id = `special-${today.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const { soldOut: _s, badge: _b, season: _season, ...rest } = base;
  void _s; void _b; void _season;
  const item: MenuItem = { ...rest, id, name: idea.name.slice(0, 40), desc: idea.desc.slice(0, 160), price: Math.round(idea.price), badge: "new", from: today, until: today };
  saveItem(item);
  return item;
}
