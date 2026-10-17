import { cleanEmail } from "@/lib/db";
import { startSession, verifyCode } from "@/lib/account";

// Step 2 of signing in: check the code and start a session
export async function POST(req: Request) {
  const { email, code } = await req.json().catch(() => ({}));
  const e = cleanEmail(email);
  if (!e || !/^\d{6}$/.test(String(code ?? "").trim())) return Response.json({ error: "Please enter the 6-digit code." }, { status: 400 });
  const r = verifyCode(e, String(code));
  if ("error" in r) return Response.json(r, { status: 400 });
  await startSession(r.id);
  return Response.json({ ok: true });
}
