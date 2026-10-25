import { currentCustomer } from "@/lib/account";
import { crackToday, guessCrack } from "@/lib/crackStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's game so far (?voter=)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(crackToday(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { guess, voter? }
export async function POST(req: Request) {
  if (limited(req, "crack", 60, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = guessCrack(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
