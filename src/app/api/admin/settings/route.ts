import { setSetting } from "@/lib/db";
import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { DEMO_TIMES, demoBaristaOn, setDemoBarista } from "@/lib/orderFlow";
import { seasonSetting, currentSeason } from "@/lib/seasonStore";
import { isSeasonSetting } from "@/lib/seasons";
import { publish } from "@/lib/live";

const current = () => ({ demoBarista: demoBaristaOn(), demoTimes: DEMO_TIMES, season: seasonSetting(), seasonNow: currentSeason() });

export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json(current());
}

// Owner: change café settings
export async function PATCH(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  if ("demoBarista" in b) {
    if (typeof b.demoBarista !== "boolean") return Response.json({ error: "Say on or off." }, { status: 400 });
    setDemoBarista(b.demoBarista);
  }
  if ("season" in b) {
    if (!isSeasonSetting(b.season)) return Response.json({ error: "Unknown season." }, { status: 400 });
    setSetting("season", b.season);
    publish({ type: "menu" }); // seasonal drinks come and go
  }
  return Response.json(current());
}
