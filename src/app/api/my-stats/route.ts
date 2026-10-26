import { currentCustomer } from "@/lib/account";
import { myStats } from "@/lib/statsStore";

// Your days played and times across the daily games (?voter=)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(myStats(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
