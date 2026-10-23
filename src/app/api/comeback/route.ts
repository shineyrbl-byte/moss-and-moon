import { currentCustomer } from "@/lib/account";
import { isAdmin, ownerGate, unauthorized } from "@/lib/auth";
import { comebackStatus, setComeback, voteComeback } from "@/lib/comebackStore";
import { voteTally, comebackFor } from "@/lib/comebackPick";
import { limited, tooMany } from "@/lib/rateLimit";

// This month's vote (?voter= a random id kept in the browser, when not signed in). Staff: ?staff=1 adds next month's pick.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const me = await currentCustomer();
  const s = comebackStatus(me?.id ?? null, u.searchParams.get("voter"));
  if (u.searchParams.get("staff") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ ...s, nextPick: comebackFor(s.next), tally: voteTally(s.month) }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(s, { headers: { "Cache-Control": "no-store" } });
}

// { itemId, voter? }: vote (or change your vote) for this month
export async function POST(req: Request) {
  if (limited(req, "comeback", 20, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = voteComeback(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: { month, pick: itemId | "auto" | "none" }
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = (await req.json().catch(() => null)) ?? {};
  const r = setComeback(String(b.month ?? ""), b.pick);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
