import { getMenu } from "@/lib/menuStore";
import { parseVoiceOrder, type VoiceLine } from "@/lib/voiceParse";
import { askJSON, type JsonSchema } from "@/lib/ai";
import { cleanText } from "@/lib/db";
import { cleanOptions } from "@/lib/pricing";
import { clientIp } from "@/lib/site";

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

// Voice ordering: what someone said → tray lines (AI first, simple matching as a backup)
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (limited(ip)) return Response.json({ error: "That's a lot of talking! Try again in a few minutes." }, { status: 429 });
  const b = await req.json().catch(() => null);
  const text = cleanText(b?.text, 300);
  if (!text) return Response.json({ error: "We didn't catch that. Try again?" }, { status: 400 });
  const menu = getMenu().filter((m) => !m.soldOut);
  const ids = new Map(menu.map((m) => [m.id, m]));

  const schema: JsonSchema = {
    type: "object",
    properties: {
      usual: { type: "boolean", description: "They asked for their usual" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string", enum: menu.map((m) => m.id) },
            qty: { type: "integer" },
            size: { type: "string", enum: ["small", "regular", "large", "unspecified"] },
            temp: { type: "string", enum: ["hot", "iced", "unspecified"] },
            milk: { type: "string", enum: ["whole", "oat", "almond", "soy", "none", "unspecified"] },
            syrup: { type: "string", enum: ["none", "vanilla", "caramel", "hazelnut", "rose", "unspecified"] },
            toppings: { type: "array", items: { type: "string", enum: ["whipped", "caramel-drizzle", "cinnamon", "cocoa"] } },
            ice: { type: "string", enum: ["light", "normal", "extra", "unspecified"] },
            decaf: { type: "boolean" },
            extraHot: { type: "boolean" },
            addons: { type: "array", description: "Food add-on ids from the menu, if they asked for any", items: { type: "string" } },
            sweet: { type: "string", enum: ["none", "less", "normal", "extra", "unspecified"] },
            shot: { type: "boolean" },
          },
          required: ["itemId", "qty", "size", "temp", "milk", "sweet", "shot", "syrup", "toppings", "ice", "decaf", "extraHot", "addons"],
        },
      },
    },
    required: ["usual", "lines"],
  };
  type AiLine = { itemId: string; qty: number; size: string; temp: string; milk: string; sweet: string; shot: boolean; syrup: string; toppings: string[]; ice: string; decaf: boolean; extraHot: boolean; addons: string[] };
  const ai = await askJSON<{ usual: boolean; lines: AiLine[] }>(
    "You take café orders spoken aloud (often Indian English or Hinglish) and map them to menu item ids. Only include items they clearly asked for. Use 'unspecified' for options they didn't mention. Menu:\n" +
      menu.map((m) => `${m.id}: ${m.name} (${m.cat})${m.addons?.length ? ` · add-ons: ${m.addons.map((a) => `${a.id} = ${a.label}`).join(", ")}` : ""}`).join("\n"),
    `They said: "${text}"`,
    schema
  );

  let lines: VoiceLine[];
  let usual: boolean;
  let missed: string[] = [];
  if (ai) {
    usual = ai.data.usual;
    lines = ai.data.lines
      .filter((l) => ids.has(l.itemId))
      .map((l) => {
        const o: Record<string, unknown> = {};
        for (const k of ["size", "temp", "milk", "sweet", "syrup", "ice"] as const) if (l[k] && l[k] !== "unspecified") o[k] = l[k];
        for (const k of ["shot", "decaf", "extraHot"] as const) if (l[k]) o[k] = true;
        if (l.toppings?.length) o.toppings = l.toppings;
        if (l.addons?.length) o.addons = l.addons;
        return { itemId: l.itemId, qty: Math.min(10, Math.max(1, Math.round(l.qty) || 1)), opts: o };
      });
  } else {
    ({ lines, usual, missed } = parseVoiceOrder(text, menu));
  }
  // Fill in each drink's usual defaults for anything they didn't say
  const out = lines.map((l) => {
    const item = ids.get(l.itemId)!;
    return { itemId: l.itemId, qty: l.qty, opts: cleanOptions(item, l.opts), name: item.name };
  });
  return Response.json({ text, lines: out, usual, missed, by: ai ? ai.provider : "simple" });
}
