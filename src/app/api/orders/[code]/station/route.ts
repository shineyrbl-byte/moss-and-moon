import { db } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";
import { setOrderStatus } from "@/lib/orderFlow";
import { STATIONS, stationsFor, type StationId } from "@/lib/stations";
import { publish } from "@/lib/live";

// Staff at one station: our part of this order is done ({ station }). When every part is, the order is ready.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const code = (await params).code.toUpperCase();
  const b = await req.json().catch(() => null);
  const station = STATIONS.find((s) => s.id === b?.station)?.id as StationId | undefined;
  if (!station) return Response.json({ error: "Unknown station." }, { status: 400 });
  const o = db.prepare("SELECT lines, status, stations_done FROM orders WHERE code = ?").get(code) as { lines: string; status: string; stations_done: string | null } | undefined;
  if (!o) return Response.json({ error: "Order not found." }, { status: 404 });
  const need = stationsFor(JSON.parse(o.lines) as { cat?: string }[]);
  const done = [...new Set([...(JSON.parse(o.stations_done ?? "[]") as string[]), station])];
  db.prepare("UPDATE orders SET stations_done = ? WHERE code = ?").run(JSON.stringify(done), code);
  const all = need.every((s) => done.includes(s));
  if (all && (o.status === "received" || o.status === "brewing")) setOrderStatus(code, "ready", me.id);
  else publish({ type: "order", code, action: "status" });
  return Response.json({ ok: true, done, ready: all });
}
