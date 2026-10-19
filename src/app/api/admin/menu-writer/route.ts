import { ownerGate } from "@/lib/auth";
import { askJSON, aiProvider, type JsonSchema } from "@/lib/ai";
import { ALLERGENS } from "@/lib/nutrition";
import { limited, tooMany } from "@/lib/rateLimit";

const schema: JsonSchema = {
  type: "object",
  properties: {
    desc: { type: "string" },
    allergens: { type: "array", items: { type: "string", enum: ALLERGENS.map((a) => a.id) } },
    kcal: { type: "number" },
    diet: { type: "array", items: { type: "string", enum: ["vegan", "gf"] } },
    nameHi: { type: "string" },
    nameMr: { type: "string" },
    descHi: { type: "string" },
  },
  required: ["desc", "allergens", "kcal", "diet", "nameHi", "nameMr", "descHi"],
};

// Owner: draft the description, allergens, calories and Hindi text for a menu item ({ name, cat, notes? })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  if (limited(req, "menu-writer", 40, 3600_000)) return tooMany();
  if (!aiProvider()) return Response.json({ error: "Connect Gemini (free) or Claude to use the menu writer. See Settings → setup checklist." }, { status: 400 });
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim().slice(0, 60);
  if (!name) return Response.json({ error: "Give the item a name first." }, { status: 400 });
  const r = await askJSON<{ desc: string; allergens: string[]; kcal: number; diet: string[]; nameHi: string; nameMr: string; descHi: string }>(
    "You write menu copy for Moss & Moon, a cosy pink café in Goa, India. Descriptions are one warm, concrete sentence under 90 characters (ingredients and texture, no hype words like 'delicious' or 'amazing'). List likely allergens as normally made, from: milk, nuts, gluten, egg, soy, sesame. Give a sensible calorie estimate for one regular serving. Mark vegan or gf only if it clearly is as normally made. Then give a natural Hindi name (keep well-known English words like latte or croissant in Devanagari) and the description in simple Hindi. Also give the name in Marathi, the same way.",
    JSON.stringify({ name, section: String(b?.cat ?? ""), ownerNotes: String(b?.notes ?? "").slice(0, 300) }),
    schema,
  );
  if (!r) return Response.json({ error: "The AI didn't answer. Try again in a minute." }, { status: 502 });
  const d = r.data;
  const ids = ALLERGENS.map((a) => a.id) as string[];
  return Response.json({
    desc: String(d.desc ?? "").slice(0, 200),
    allergens: (d.allergens ?? []).filter((a) => ids.includes(a)),
    kcal: Math.max(0, Math.min(3000, Math.round(Number(d.kcal) || 0))),
    diet: (d.diet ?? []).filter((x) => x === "vegan" || x === "gf"),
    nameHi: String(d.nameHi ?? "").slice(0, 60),
    nameMr: String(d.nameMr ?? "").slice(0, 60),
    descHi: String(d.descHi ?? "").slice(0, 200),
    provider: r.provider,
  });
}
