import { ownerGate } from "@/lib/auth";
import { SIM_SPEEDS, clearSim, simState, startSim, stopSim, type SimSpeed } from "@/lib/simulate";

export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(simState());
}

// Owner: { action: "start", minutes, speed } | { action: "stop" } | { action: "clear" }
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = (await req.json().catch(() => null)) ?? {};
  if (b.action === "start") {
    const speed: SimSpeed = b.speed in SIM_SPEEDS ? b.speed : "busy";
    return Response.json(startSim(Number(b.minutes) || 30, speed));
  }
  if (b.action === "stop") return Response.json(stopSim());
  if (b.action === "clear") { stopSim(); const cleared = clearSim(); return Response.json({ ...simState(), cleared }); }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
