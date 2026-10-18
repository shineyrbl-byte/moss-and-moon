import { ownerGate, currentStaff, unauthorized } from "@/lib/auth";
import { cleanConfig, fullConfig, saveConfig } from "@/lib/cafeConfig";
import { db } from "@/lib/db";
import { publish } from "@/lib/live";

// Staff: opening hours, holidays and golden hour
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json(fullConfig());
}

// Owner: change them. Returns any bookings that fall on newly closed days.
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const c = cleanConfig(await req.json().catch(() => null));
  if ("error" in c) return Response.json(c, { status: 400 });
  saveConfig(c);
  publish({ type: "menu" });
  const clash = (db.prepare("SELECT code, name, date, time FROM bookings WHERE status = 'confirmed' AND date >= date('now','localtime')").all() as { code: string; name: string; date: string; time: string }[])
    .filter((b) => c.closures.some((x) => x.date === b.date) || !c.hours[new Date(b.date + "T12:00").getDay()]);
  return Response.json({ ...c, clashingBookings: clash });
}
