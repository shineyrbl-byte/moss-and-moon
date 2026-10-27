import { createRoom, joinRoom, moveRoom, reactRoom, readRoom, rematchRoom } from "@/lib/roomsStore";
import { limited, tooMany } from "@/lib/rateLimit";

// A live room's state (?code=&token=). Without a token you're watching.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const r = readRoom(q.get("code"), q.get("token"));
  return Response.json(r, { status: "error" in r ? 404 : 200, headers: { "Cache-Control": "no-store" } });
}
// { create: game, state, name } · { join: code, token?, name } · { code, token, version, state, reset? } · { code, token, action }
// · { code, token, react: emoji } · { code, token, rematch: true }
export async function POST(req: Request) {
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if ("create" in b && limited(req, "rooms-new", 30, 3600_000)) return tooMany();
  if ("react" in b && limited(req, "rooms-react", 120, 600_000)) return tooMany();
  if (limited(req, "rooms", 1500, 3600_000)) return tooMany();
  const r = "create" in b ? createRoom(b.create, b.state, b.name) : "join" in b ? joinRoom(b.join, b.token, b.name) : "react" in b ? reactRoom(b.code, b.token, b.react) : "rematch" in b ? rematchRoom(b.code, b.token) : moveRoom(b);
  const status = "error" in r ? ("version" in r ? 409 : 400) : 200;
  return Response.json(r, { status });
}
