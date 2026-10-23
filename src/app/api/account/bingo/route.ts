import { currentCustomer } from "@/lib/account";
import { bingoFor, claimBingo } from "@/lib/bingoStore";

// This month's card. Signed in: with your stamps from this month's orders.
export async function GET() {
  const me = await currentCustomer();
  return Response.json(bingoFor(me?.id ?? null));
}

// A full line: take the treat (as credit on your account), once a month
export async function POST() {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Sign in to play bingo." }, { status: 401 });
  const r = claimBingo(me.id);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r);
}
