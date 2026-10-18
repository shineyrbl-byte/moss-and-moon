import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { DEMO_TIMES, demoBaristaOn, setDemoBarista } from "@/lib/orderFlow";

export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json({ demoBarista: demoBaristaOn(), demoTimes: DEMO_TIMES });
}

// Owner: switch the demo barista on or off
export async function PATCH(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  if (typeof b?.demoBarista !== "boolean") return Response.json({ error: "Say on or off." }, { status: 400 });
  setDemoBarista(b.demoBarista);
  return Response.json({ demoBarista: demoBaristaOn() });
}
