import { ownerGate } from "@/lib/auth";
import { bookNight, gameNight, nightBookings, nightSettings, setNightSettings } from "@/lib/cafeExtras";
import { limited, tooMany } from "@/lib/rateLimit";

// Board-game night (?voter=), or ?admin=1 for the owner: the settings and who's coming
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("admin") === "1") { const gate = await ownerGate(); if (gate) return gate; return Response.json({ settings: nightSettings(), nights: nightBookings() }); }
  return Response.json(gameNight(q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
// Guests: { voter, date, name, party, game? } to book (again to change it), or { voter, date, cancel: true }
export async function POST(req: Request) {
  if (limited(req, "game-night", 20, 3600_000)) return tooMany();
  const r = bookNight(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
// Owner: { on, day, time, seats, note }
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = setNightSettings(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
