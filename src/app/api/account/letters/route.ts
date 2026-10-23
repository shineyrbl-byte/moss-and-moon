import { currentCustomer } from "@/lib/account";
import { myLetters, writeLetter } from "@/lib/letterStore";
import { limited, tooMany } from "@/lib/rateLimit";

const signIn = () => Response.json({ error: "Sign in to write to future you." }, { status: 401 });

// Your letters: sealed ones show only when they open
export async function GET() {
  const me = await currentCustomer();
  if (!me) return signIn();
  return Response.json({ letters: myLetters(me.id) }, { headers: { "Cache-Control": "no-store" } });
}

// { body, months: 3 | 6 | 12 }
export async function POST(req: Request) {
  if (limited(req, "letters", 10, 3600_000)) return tooMany();
  const me = await currentCustomer();
  if (!me) return signIn();
  const r = writeLetter(me, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
