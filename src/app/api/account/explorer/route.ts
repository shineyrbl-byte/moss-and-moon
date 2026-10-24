import { currentCustomer } from "@/lib/account";
import { explorerFor } from "@/lib/explorerStore";

// The dishes you've tried, by category (signed in only)
export async function GET() {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Sign in to see what you've tried." }, { status: 401 });
  return Response.json(explorerFor(me.id), { headers: { "Cache-Control": "no-store" } });
}
