import { currentStaff, unauthorized } from "@/lib/auth";
import { clockIn, clockOut, openEntry } from "@/lib/timesheets";

// Staff: am I clocked in?
export async function GET() {
  const me = await currentStaff();
  if (!me) return unauthorized();
  if (!me.id) return Response.json({ canClock: false });
  const e = openEntry(me.id);
  return Response.json({ canClock: true, clockedIn: !!e, since: e?.clock_in ?? null });
}

// Staff: clock in or out ({ action: "in" | "out" })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  if (!me.id) return Response.json({ error: "Clocking in is for team accounts (the owner passcode doesn't clock in)." }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const r = b.action === "out" ? clockOut(me.id) : clockIn(me.id);
  return Response.json(r, { status: "error" in r ? 409 : 200 });
}
