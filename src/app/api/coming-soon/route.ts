import { ownerGate } from "@/lib/auth";
import { comingSoon, setComingSoon } from "@/lib/cafeExtras";

// The owner's "coming soon" countdown, if there is one
export async function GET() {
  return Response.json({ soon: comingSoon() }, { headers: { "Cache-Control": "no-store" } });
}
// Owner: { title, date, blurb? } or { clear: true }
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = setComingSoon(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
