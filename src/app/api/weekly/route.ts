import { submitWeekly, weeklyBoard } from "@/lib/weeklyStore";
import { limited, tooMany } from "@/lib/rateLimit";

// The puzzle of the week's board (?voter=)
export async function GET(req: Request) {
  return Response.json(weeklyBoard(new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
// { ms, name, voter }
export async function POST(req: Request) {
  if (limited(req, "weekly", 30, 3600_000)) return tooMany();
  const r = submitWeekly(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
