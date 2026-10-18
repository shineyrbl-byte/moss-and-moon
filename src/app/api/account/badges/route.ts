import { currentCustomer } from "@/lib/account";
import { badgesFor } from "@/lib/badgeStore";

// Signed-in guest: their badges and streak
export async function GET() {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Please sign in." }, { status: 401 });
  return Response.json(badgesFor(me));
}
