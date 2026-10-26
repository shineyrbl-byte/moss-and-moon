import { currentCustomer } from "@/lib/account";
import { pushSync, readSync } from "@/lib/syncStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Your saved game progress, when you're signed in
export async function GET() {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Sign in to sync your games." }, { status: 401 });
  return Response.json({ data: readSync(me.id) }, { headers: { "Cache-Control": "no-store" } });
}

// { voter, data: { key: { v, t } } }: merge this device's progress in, and get everything back
export async function POST(req: Request) {
  if (limited(req, "sync", 240, 3600_000)) return tooMany();
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Sign in to sync your games." }, { status: 401 });
  const r = pushSync(me.id, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200, headers: { "Cache-Control": "no-store" } });
}
