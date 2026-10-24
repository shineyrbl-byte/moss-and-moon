import { currentCustomer } from "@/lib/account";
import { dishToday, guessDish } from "@/lib/emojiDishStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's five (?voter=)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(dishToday(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { i, guess, voter? }
export async function POST(req: Request) {
  if (limited(req, "guess-dish", 60, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = guessDish(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
