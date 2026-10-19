import { ownerGate, currentStaff, unauthorized } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import { rotationNow } from "@/lib/menuStore";
import { rotationFor } from "@/lib/menu";
import { publish } from "@/lib/live";

// Staff: which season's menu is on
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json({ now: rotationNow(), calendar: rotationFor(), override: getSetting("rotation") || "auto" });
}

// Owner: { rotation: "auto" | "summer" | "monsoon" | "winter" }
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const v = ["summer", "monsoon", "winter"].includes(b?.rotation) ? b.rotation : "auto";
  setSetting("rotation", v === "auto" ? "" : v);
  publish({ type: "menu" });
  return Response.json({ now: rotationNow(), calendar: rotationFor(), override: v });
}
