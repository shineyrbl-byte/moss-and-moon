import { cleanEmail, setSetting } from "@/lib/db";
import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { DEMO_TIMES, demoBaristaOn, setDemoBarista } from "@/lib/orderFlow";
import { seasonSetting, currentSeason } from "@/lib/seasonStore";
import { isSeasonSetting } from "@/lib/seasons";
import { publish } from "@/lib/live";
import { ownerEmail, ownerPref, setOwnerEmail, setOwnerPref } from "@/lib/owner";

const PREFS = { dailySummary: "daily_summary", errorAlerts: "error_alerts", backupEmail: "backup_email" } as const;

const current = (owner: boolean) => ({
  demoBarista: demoBaristaOn(),
  demoTimes: DEMO_TIMES,
  season: seasonSetting(),
  seasonNow: currentSeason(),
  // Owner-only details
  ...(owner
    ? { ownerEmail: ownerEmail(), dailySummary: ownerPref("daily_summary"), errorAlerts: ownerPref("error_alerts"), backupEmail: ownerPref("backup_email") }
    : {}),
});

export async function GET() {
  const staff = await currentStaff();
  if (!staff) return unauthorized();
  return Response.json(current(staff.role === "owner"));
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
  if ("ownerEmail" in b) {
    const email = cleanEmail(b.ownerEmail);
    if (b.ownerEmail && !email) return Response.json({ error: "That email doesn't look right." }, { status: 400 });
    setOwnerEmail(email);
  }
  for (const [k, key] of Object.entries(PREFS)) {
    if (k in b) {
      if (typeof b[k] !== "boolean") return Response.json({ error: "Say on or off." }, { status: 400 });
      setOwnerPref(key, b[k]);
    }
  }
  return Response.json(current(true));
}
