import { focusEvent, focusNow } from "@/lib/focusStore";
import { limited, tooMany } from "@/lib/rateLimit";

// How many people are focusing right now, and sessions finished today
export async function GET() {
  return Response.json(focusNow(), { headers: { "Cache-Control": "no-store" } });
}

// { voter, event: "ping" | "stop" | "done", minutes? }
export async function POST(req: Request) {
  if (limited(req, "focus", 240, 3600_000)) return tooMany();
  const r = focusEvent((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
