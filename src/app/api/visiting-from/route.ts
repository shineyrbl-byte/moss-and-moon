import { addOrigin, originStats } from "@/lib/originsStore";
import { limited, tooMany } from "@/lib/rateLimit";

// This month's places (?voter=)
export async function GET(req: Request) {
  return Response.json(originStats(new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { place, voter }
export async function POST(req: Request) {
  if (limited(req, "visiting-from", 10, 3600_000)) return tooMany();
  const r = addOrigin((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
