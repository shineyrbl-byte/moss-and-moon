import Anthropic from "@anthropic-ai/sdk";
import { getMenu } from "@/lib/menuStore";
import { cafeConfig, hoursLabel, openStatus } from "@/lib/cafe";
import { HAPPY_HOUR, isHappyHour, rupees } from "@/lib/pricing";
import type { MenuItem } from "@/lib/menu";
import { clientIp } from "@/lib/site";

// "Ask the barista": chat that recommends drinks & bakes from the live menu.
// Uses Claude when ANTHROPIC_API_KEY is set, else Google Gemini (free tier) when
// GEMINI_API_KEY is set, else a simple keyword demo.

type Rec = { itemId: string; reason: string };
type Reply = { reply: string; recommendations: Rec[]; mode: "claude" | "gemini" | "demo" };

const MODEL = "claude-opus-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// ---- tiny per-visitor rate limit (protects the API bill) ----
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (limited(ip)) return Response.json({ error: "The barista needs a quick breather ☕ — try again in a few minutes." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const messages: Anthropic.Beta.BetaMessageParam[] = raw
    .filter((m: { role?: string; content?: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 800) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user")
    return Response.json({ error: "Say something to the barista first ✿" }, { status: 400 });

  // Only recommend things guests can actually order right now
  const menu = getMenu().filter((m) => !m.soldOut && !m.pup); // dog treats are never suggested to people
  const lastText = String(messages[messages.length - 1].content);
  let result: Reply | { error: string };
  if (process.env.ANTHROPIC_API_KEY) result = await askClaude(messages, menu);
  else if (process.env.GEMINI_API_KEY) result = (await askGemini(messages, menu)) ?? demoReply(lastText, menu); // free limit used up → demo
  else result = demoReply(lastText, menu);
  if ("error" in result) return Response.json(result, { status: 502 });

  // Keep only real item ids, at most 3
  const ids = new Set(menu.map((m) => m.id));
  result.recommendations = result.recommendations.filter((r) => ids.has(r.itemId)).slice(0, 3);
  return Response.json(result);
}

function systemPrompt(menu: MenuItem[]) {
  const lines = menu.map(
    (m) =>
      `- id: ${m.id} | ${m.name} (${m.cat}) | ${rupees(m.price)} | ${m.desc}` +
      (m.diet?.length ? ` | ${m.diet.map((d) => (d === "gf" ? "gluten-free" : d)).join(", ")}` : "") +
      (m.badge ? ` | ${m.badge}` : "") +
      (m.traits ? ` | caffeine/energy ${m.traits.energy}/2, sweetness ${m.traits.sweet}/2, usually ${m.traits.temp}` : "")
  );
  const now = new Date();
  return `You are the friendly barista at Moss & Moon, a cosy slow-coffee café with plants, pink lattes and warm bakes, at 14 Willow Lane.

Your job: chat warmly and briefly (2–4 short sentences, a little playful, the odd ✿ or ☕ is fine), understand what the guest is in the mood for, and suggest up to 3 items from the menu below. Explain each pick in one short, specific line in "reason". Only recommend items from this menu, using their exact id. If nothing fits, say so kindly and suggest the closest option.

Good to know:
- Drinks can be customised in the app: size, hot or iced (cold drinks are always iced, with light/normal/extra ice), whole/oat/almond/soy milk, sweetness, syrups (vanilla, caramel, hazelnut, rose), toppings (whipped cream, caramel drizzle, cinnamon, cocoa), and for coffee an extra shot or decaf.
- Food has add-ons like extra cheese, an egg, gluten-free bread or pasta, and combos with a coffee or chai.
- The menu has sections: coffee, tea & matcha, cold drinks (iced coffees, frappés, smoothies, mocktails, juices), food (toasties, sandwiches, toast, pancakes, pasta, bowls) and bakes.
- Opening hours: ${hoursLabel().map((h) => `${h.days} ${h.time}`).join("; ")}.${cafeConfig().closures.length ? ` Closed on: ${cafeConfig().closures.map((c) => `${c.date}${c.note ? ` (${c.note})` : ""}`).join(", ")}.` : ""}
- ${HAPPY_HOUR.label}.${isHappyHour(now) ? " It's golden hour right now!" : ""}
- Right now: ${now.toLocaleString("en-IN", { weekday: "long", hour: "numeric", minute: "2-digit" })} (${openStatus(now).text}).
- For allergies, give your best guess from the menu but tell them to double-check with staff.
- If asked about things unrelated to the café, answer briefly and steer back to coffee.
- Return recommendations as an empty list when you're only chatting or answering a question.

MENU
${lines.join("\n")}`;
}

async function askClaude(messages: Anthropic.Beta.BetaMessageParam[], menu: MenuItem[]): Promise<Reply | { error: string }> {
  const client = new Anthropic();
  const schema = {
    type: "object",
    properties: {
      reply: { type: "string", description: "What the barista says to the guest" },
      recommendations: {
        type: "array",
        description: "Up to 3 menu items to suggest (empty if just chatting)",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string", enum: menu.map((m) => m.id) },
            reason: { type: "string", description: "One short line on why it fits" },
          },
          required: ["itemId", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["reply", "recommendations"],
    additionalProperties: false,
  };

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // If the model declines a request, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Quick, friendly chat doesn't need deep thinking
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      cache_control: { type: "ephemeral" },
      system: systemPrompt(menu),
      messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal")
      return { reply: "Ooh, that's not something I can help with — but I'd love to find you a drink! What are you in the mood for?", recommendations: [], mode: "claude" };

    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as { reply?: string; recommendations?: Rec[] };
    return { reply: String(parsed.reply ?? ""), recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [], mode: "claude" };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { error: "The barista is swamped right now — try again in a moment ☕" };
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("Barista: ANTHROPIC_API_KEY was rejected");
      return { error: "The barista is on a break (setup issue). Please try the menu instead!" };
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Barista API error", e.status, e.message);
      return { error: "The barista got distracted by latte art. Try again?" };
    }
    if (e instanceof SyntaxError) return { error: "The barista mumbled something. Try asking again?" };
    console.error("Barista error", e);
    return { error: "Couldn't reach the barista. Try again?" };
  }
}

// ---------- Gemini (free tier) ----------
// Returns null on any failure so the chat quietly falls back to demo mode.
async function askGemini(messages: Anthropic.Beta.BetaMessageParam[], menu: MenuItem[]): Promise<Reply | null> {
  const schema = {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING", description: "What the barista says to the guest" },
      recommendations: {
        type: "ARRAY",
        description: "Up to 3 menu items to suggest (empty if just chatting)",
        items: {
          type: "OBJECT",
          properties: {
            itemId: { type: "STRING", enum: menu.map((m) => m.id) },
            reason: { type: "STRING", description: "One short line on why it fits" },
          },
          required: ["itemId", "reason"],
        },
      },
    },
    required: ["reply", "recommendations"],
  };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(menu) }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] })),
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 2000 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      console.error("Barista Gemini error", r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const d = await r.json();
    const text: string = (d?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    const parsed = JSON.parse(text) as { reply?: string; recommendations?: Rec[] };
    if (!parsed.reply) return null;
    return { reply: String(parsed.reply), recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [], mode: "gemini" };
  } catch (e) {
    console.error("Barista Gemini failed", e);
    return null;
  }
}

// ---------- demo mode: keyword matching, no API key needed ----------
const WORDS: [RegExp, (m: MenuItem) => number][] = [
  [/sweet|dessert|sugar|treat|chocolate|caramel/i, (m) => (m.traits?.sweet ?? (m.cat === "bakes" ? 2 : 0)) * 2],
  [/strong|wake|tired|sleepy|energy|study|exam|focus|caffeine/i, (m) => (m.traits?.energy ?? 0) * 2],
  [/calm|relax|decaf|no caffeine|night|sleep|cosy|cozy/i, (m) => (m.traits ? (2 - m.traits.energy) * 2 : 0)],
  [/iced|cold|hot day|summer|chill/i, (m) => (m.traits?.temp === "iced" ? 4 : 0)],
  [/warm|hot drink|winter|rain/i, (m) => (m.traits?.temp === "hot" ? 2 : 0)],
  [/vegan|dairy|plant/i, (m) => (m.diet?.includes("vegan") ? 4 : -2)],
  [/gluten|celiac|coeliac/i, (m) => (m.diet?.includes("gf") ? 4 : -2)],
  [/matcha|green/i, (m) => (/matcha/i.test(m.name) ? 5 : 0)],
  [/tea|chai/i, (m) => (m.cat === "tea" ? 3 : 0)],
  [/coffee|latte|espresso/i, (m) => (m.cat === "coffee" ? 3 : 0)],
  [/eat|food|hungry|snack|bake|pastry|cake|breakfast/i, (m) => (m.cat === "bakes" || m.cat === "food" ? 4 : 0)],
  [/lunch|meal|savoury|savory|sandwich|toast|pasta|bowl|filling|starving/i, (m) => (m.cat === "food" ? 6 : 0)],
  [/smoothie|juice|mocktail|fresh|fruit|healthy|refreshing/i, (m) => (m.cat === "cold" && m.noMilk ? 5 : 0)],
  [/frapp|milkshake|blended|cold coffee/i, (m) => (/frapp|mocha|brew/i.test(m.name) ? 5 : 0)],
  [/pink|pretty|aesthetic|rose|instagram/i, (m) => (m.badge === "pink pick" || /rose|pink|strawberry/i.test(m.name + m.desc) ? 5 : 0)],
  [/cheap|budget|broke|student/i, (m) => (m.price <= 160 ? 3 : 0)],
  [/popular|best|recommend|favourite|favorite|surprise/i, (m) => (m.badge === "bestseller" ? 4 : 0)],
];

function demoReply(text: string, menu: MenuItem[]): Reply {
  const matched = WORDS.filter(([re]) => re.test(text));
  const pool = matched.length ? menu : menu.filter((m) => m.badge);
  const scored = pool
    .map((m) => ({ m, s: matched.reduce((sum, [, f]) => sum + f(m), 0) + Math.random() }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  const reasonFor = (m: MenuItem) =>
    m.badge === "pink pick" ? "our pretty-in-pink signature" : m.badge === "bestseller" ? "a regulars' favourite" : m.desc.split(/[.—]/)[0].toLowerCase();
  return {
    reply: matched.length
      ? "Ooh, I've got just the thing ✿ Here's what I'd pour for you:"
      : "Not sure where to start? Here are a few of our favourites ☕ Tell me if you want something sweeter, stronger, iced or dairy-free!",
    recommendations: scored.map(({ m }) => ({ itemId: m.id, reason: reasonFor(m) })),
    mode: "demo",
  };
}
