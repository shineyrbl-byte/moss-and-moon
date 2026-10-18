import { ownerGate } from "@/lib/auth";
import { setSetting } from "@/lib/db";
import { winbackStats } from "@/lib/winback";
import { anniversaryOn, dueToday } from "@/lib/anniversary";
import { db as database } from "@/lib/db";

const stats = () => ({ ...winbackStats(), anniversary: { on: anniversaryOn(), due: dueToday().length, sent: (database.prepare("SELECT COUNT(*) AS n FROM anniversaries WHERE sent_at >= datetime('now','localtime','-90 days')").get() as { n: number }).n } });

// Owner: "we miss you" emails: how many went out, how many came back, on/off
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(stats());
}

export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  if (typeof b?.on === "boolean") setSetting("winback", b.on ? "on" : "off");
  if (typeof b?.anniversary === "boolean") setSetting("anniversary", b.anniversary ? "on" : "off");
  return Response.json(stats());
}
