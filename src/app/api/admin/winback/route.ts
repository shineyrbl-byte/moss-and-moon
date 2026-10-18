import { ownerGate } from "@/lib/auth";
import { setSetting } from "@/lib/db";
import { winbackStats } from "@/lib/winback";

// Owner: "we miss you" emails: how many went out, how many came back, on/off
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(winbackStats());
}

export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  setSetting("winback", b?.on ? "on" : "off");
  return Response.json(winbackStats());
}
