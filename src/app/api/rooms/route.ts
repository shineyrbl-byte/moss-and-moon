import { createRoom, joinRoom, moveRoom, readRoom } from "@/lib/roomsStore";
import { limited, tooMany } from "@/lib/rateLimit";

// A live room's state (?code=)
export async function GET(req: Request) {
  const r = readRoom(new URL(req.url).searchParams.get("code"));
  return Response.json(r, { status: "error" in r ? 404 : 200, headers: { "Cache-Control": "no-store" } });
}
// { create: game, state } · { join: code, token? } · { code, token, version, state, reset? }
export async function POST(req: Request) {
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if ("create" in b && limited(req, "rooms-new", 30, 3600_000)) return tooMany();
  if (limited(req, "rooms", 1200, 3600_000)) return tooMany();
  const r = "create" in b ? createRoom(b.create, b.state) : "join" in b ? joinRoom(b.join, b.token) : moveRoom(b);
  const status = "error" in r ? ("version" in r ? 409 : 400) : 200;
  return Response.json(r, { status });
}
