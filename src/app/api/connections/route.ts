import { currentCustomer } from "@/lib/account";
import { connectionsToday, guessConnections } from "@/lib/connectionsStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's board so far (?voter= a random id kept in the browser, when not signed in)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(connectionsToday(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { words: [four words], voter? }
export async function POST(req: Request) {
  if (limited(req, "connections", 60, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = guessConnections(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
