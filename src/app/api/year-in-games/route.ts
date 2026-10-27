import { currentCustomer } from "@/lib/account";
import { yearInGames } from "@/lib/yearInGames";

// ?voter=: the last twelve months of games
export async function GET(req: Request) {
  const voter = new URL(req.url).searchParams.get("voter");
  const me = await currentCustomer();
  return Response.json({ ...yearInGames(me?.id ?? null, voter), name: me?.name ?? null }, { headers: { "Cache-Control": "no-store" } });
}
