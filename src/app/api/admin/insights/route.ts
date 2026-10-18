import { ownerGate } from "@/lib/auth";
import { cached, refresh } from "@/lib/insights";
import { aiProvider } from "@/lib/ai";

const last = new Map<string, number>();

// Owner: the latest review summary and business ideas (?kind=reviews|business)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const kind = new URL(req.url).searchParams.get("kind") === "reviews" ? "reviews" : "business";
  const saved = cached(kind === "reviews" ? "insights_reviews" : "insights_business");
  return Response.json({ ai: aiProvider(), ...(saved ?? (await refresh(kind))) });
}

// Owner: make a fresh one now (at most once a minute)
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const kind = new URL(req.url).searchParams.get("kind") === "reviews" ? "reviews" : "business";
  if (Date.now() - (last.get(kind) ?? 0) < 60_000) return Response.json({ error: "Give it a minute before refreshing again." }, { status: 429 });
  last.set(kind, Date.now());
  return Response.json({ ai: aiProvider(), ...(await refresh(kind)) });
}
