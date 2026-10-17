import { cookies } from "next/headers";
import { ADMIN_COOKIE, checkLogin, startStaffSession } from "@/lib/auth";

// Small brute-force guard: 10 tries per 15 minutes per address
const tries = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  if (recent.length >= 10) return Response.json({ error: "Too many tries. Please wait 15 minutes." }, { status: 429 });

  const { username, passcode, password } = await req.json().catch(() => ({}));
  const staff = checkLogin(String(username ?? ""), String(password ?? passcode ?? ""));
  if (!staff) {
    tries.set(ip, [...recent, now]);
    return Response.json({ error: username ? "Wrong username or password." : "Wrong passcode." }, { status: 401 });
  }
  tries.delete(ip);
  await startStaffSession(staff);
  return Response.json({ ok: true, staff });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
