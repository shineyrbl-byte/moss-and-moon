import { currentCustomer } from "@/lib/account";
import { trophyData } from "@/lib/allRounderStore";

// What you've played, for the trophy shelf (?voter=)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(trophyData(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
