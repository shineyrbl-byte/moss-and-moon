import { currentCustomer } from "@/lib/account";
import { claimReward, rewardStatus } from "@/lib/gameRewards";
import { limited, tooMany } from "@/lib/rateLimit";

// ?voter=: how close you are to your next stamp
export async function GET(req: Request) {
  const voter = new URL(req.url).searchParams.get("voter");
  return Response.json(rewardStatus(await currentCustomer(), voter), { headers: { "Cache-Control": "no-store" } });
}
// { voter }: collect a stamp you've earned
export async function POST(req: Request) {
  if (limited(req, "game-rewards", 20, 3600_000)) return tooMany();
  const b = ((await req.json().catch(() => null)) ?? {}) as { voter?: unknown };
  const r = claimReward(await currentCustomer(), b.voter);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
