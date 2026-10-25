import { currentCustomer } from "@/lib/account";
import { allRounderBoard, joinAllRounder } from "@/lib/allRounderStore";
import { limited, tooMany } from "@/lib/rateLimit";

// This week's all-rounders (?voter=)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(allRounderBoard(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { voter, name } to join, { voter, leave: true } to leave
export async function POST(req: Request) {
  if (limited(req, "allrounder", 30, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = joinAllRounder(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
