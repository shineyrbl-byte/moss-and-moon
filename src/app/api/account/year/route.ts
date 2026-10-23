import { currentCustomer } from "@/lib/account";
import { yearFor } from "@/lib/yearStats";

// Your last 12 months at the café
export async function GET() {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Sign in to see your year." }, { status: 401 });
  return Response.json(yearFor(me));
}
