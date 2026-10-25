import { currentCustomer } from "@/lib/account";
import { hiveToday, playHive } from "@/lib/hiveStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's hive so far (?voter=)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(hiveToday(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { word, voter? }
export async function POST(req: Request) {
  if (limited(req, "hive", 400, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = playHive(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
