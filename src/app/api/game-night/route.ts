import { ownerGate } from "@/lib/auth";
import { bookNight, gameNight, markCame, nightAlerts, nightBookings, nightSettings, setNightSettings } from "@/lib/cafeExtras";
import { limited, tooMany } from "@/lib/rateLimit";

// Board-game night (?voter=), or ?admin=1 for the owner: the settings and who's coming
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("admin") === "1") { const gate = await ownerGate(); if (gate) return gate; return Response.json({ settings: nightSettings(), ...nightBookings() }); }
  return Response.json(gameNight(q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
// Guests: { voter, date, name, party, game? } to book (again to change it), { voter, date, cancel: true },
// or { voter, subscription } for a reminder the day before (null turns it off)
export async function POST(req: Request) {
  if (limited(req, "game-night", 20, 3600_000)) return tooMany();
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = "subscription" in b ? nightAlerts(b) : bookNight(b);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
// Owner: { on, day, time, seats, note }
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = setNightSettings(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: { id, came: true | false } ticks off who came (each tick is a stamp for that guest)
export async function PATCH(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = markCame(b.id, b.came === true);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
