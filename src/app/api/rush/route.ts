import { currentStaff, unauthorized } from "@/lib/auth";
import { rushNow, setRush } from "@/lib/rush";

// Anyone: is it busy, or are online orders paused?
export async function GET() {
  const r = rushNow();
  return Response.json({ mode: r.mode, until: r.until, extra: r.extra, active: r.active, auto: r.auto, autoBusy: r.autoBusy });
}

// Staff: { mode: "off" | "busy" | "paused", minutes?, auto? }
export async function PUT(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const mode = ["off", "busy", "paused"].includes(b?.mode) ? b.mode : "off";
  const minutes = b?.minutes ? Math.min(180, Math.max(5, Math.round(Number(b.minutes)))) : mode === "paused" ? 15 : null;
  return Response.json(setRush(mode, minutes, me.name, typeof b?.auto === "boolean" ? b.auto : undefined));
}
