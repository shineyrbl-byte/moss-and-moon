import { currentCustomer } from "@/lib/account";
import { isAdmin, unauthorized } from "@/lib/auth";
import { pollNow, setPoll, votePoll } from "@/lib/pollStore";
import { limited, tooMany } from "@/lib/rateLimit";

// This week's poll (?voter=). Results come once you've voted; staff (?staff=1) always see them.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("staff") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json(pollNow(null, null, new Date(), true), { headers: { "Cache-Control": "no-store" } });
  }
  const me = await currentCustomer();
  return Response.json(pollNow(me?.id ?? null, q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { choice, voter? }
export async function POST(req: Request) {
  if (limited(req, "poll", 30, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = votePoll(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { q, choices } for this week
export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const r = setPoll((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
