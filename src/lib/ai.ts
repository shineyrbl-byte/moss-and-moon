// One small helper for "ask the AI for structured JSON", used by the weekly
// insights and the review summary. Claude if ANTHROPIC_API_KEY is set, otherwise
// Google Gemini's free tier if GEMINI_API_KEY is set, otherwise null (callers
// then fall back to a simple summary made without AI).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = "claude-opus-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export type JsonSchema = { type: "object"; properties: Record<string, unknown>; required: string[] };
export const aiProvider = () => (process.env.ANTHROPIC_API_KEY ? "claude" : process.env.GEMINI_API_KEY ? "gemini" : null);

/** Ask for JSON matching the schema. Returns null if no AI is set up or it fails. */
export async function askJSON<T>(system: string, prompt: string, schema: JsonSchema): Promise<{ data: T; provider: "claude" | "gemini" } | null> {
  const provider = aiProvider();
  try {
    if (provider === "claude") {
      const client = new Anthropic();
      const res = await client.beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: strict(schema) } },
        system,
        messages: [{ role: "user", content: prompt }],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (res.stop_reason === "refusal") return null;
      const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
      return { data: JSON.parse(text) as T, provider };
    }
    if (provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: geminiSchema(schema), maxOutputTokens: 3000 },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) {
        console.error("Gemini error", r.status, (await r.text()).slice(0, 300));
        return null;
      }
      const d = await r.json();
      const text: string = (d?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      return { data: JSON.parse(text) as T, provider };
    }
  } catch (e) {
    console.error("AI request failed", e);
  }
  return null;
}

/** Claude's structured output needs additionalProperties: false on every object */
function strict(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(strict);
  if (s && typeof s === "object") {
    const o = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, strict(v)]));
    if (o.type === "object") o.additionalProperties = false;
    return o;
  }
  return s;
}

/** Gemini's schema format: same shape, but type names in capitals (the format the barista uses) */
function geminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (s && typeof s === "object") {
    return Object.fromEntries(
      Object.entries(s)
        .filter(([k]) => k !== "additionalProperties")
        .map(([k, v]) => [k, k === "type" && typeof v === "string" ? v.toUpperCase() : geminiSchema(v)])
    );
  }
  return s;
}
