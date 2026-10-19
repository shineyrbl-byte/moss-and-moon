import { ownerGate } from "@/lib/auth";
import { demoReset } from "@/lib/demoData";
import { publish } from "@/lib/live";
import { limited, tooMany } from "@/lib/rateLimit";

// Owner: clear test activity and fill in a month of sample orders ({ confirm: "RESET" }). Backs up first.
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  if (limited(req, "demo-reset", 5, 3600_000)) return tooMany();
  const b = await req.json().catch(() => null);
  if (b?.confirm !== "RESET") return Response.json({ error: "Type RESET to confirm." }, { status: 400 });
  const r = demoReset();
  publish({ type: "menu" });
  return Response.json({ ok: true, ...r });
}
