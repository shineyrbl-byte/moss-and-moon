import { addFriend, board, removeFriend, setName } from "@/lib/friendsStore";
import { limited, tooMany } from "@/lib/rateLimit";

// You and your friends' times today (?voter=)
export async function GET(req: Request) {
  return Response.json(board(new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { voter, name } to get or rename your code, { voter, add: code }, or { voter, remove: code }
export async function POST(req: Request) {
  if (limited(req, "friends", 60, 3600_000)) return tooMany();
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = "add" in b ? addFriend(b.voter, b.add) : "remove" in b ? removeFriend(b.voter, b.remove) : setName(b.voter, b.name);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
