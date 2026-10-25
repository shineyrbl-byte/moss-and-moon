import { currentCustomer } from "@/lib/account";
import { gamesFor } from "@/lib/gamesStore";

// Which daily games you've played today, with streaks (?voter=)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(gamesFor(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
