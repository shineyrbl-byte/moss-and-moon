import { cleanEmail } from "@/lib/db";
import { requestCode } from "@/lib/account";

// Step 1 of signing in: email me a code
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const e = cleanEmail(email);
  if (!e) return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  const r = await requestCode(e);
  return Response.json(r, { status: "error" in r ? 429 : 200 });
}
