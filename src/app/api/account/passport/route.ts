import { currentCustomer } from "@/lib/account";
import { claimPassport, passportFor } from "@/lib/passport";

const signIn = () => Response.json({ error: "Sign in to collect passport stamps." }, { status: 401 });

export async function GET() {
  const me = await currentCustomer();
  if (!me) return signIn();
  return Response.json(passportFor(me.id));
}

// All stamps collected: take the free drink (as credit on your account)
export async function POST() {
  const me = await currentCustomer();
  if (!me) return signIn();
  const r = claimPassport(me.id);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r);
}
