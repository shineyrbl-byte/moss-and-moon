import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminToken, checkPasscode } from "@/lib/auth";

export async function POST(req: Request) {
  const { passcode } = await req.json().catch(() => ({}));
  if (!checkPasscode(String(passcode ?? ""))) return Response.json({ error: "Wrong passcode." }, { status: 401 });
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminToken(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
