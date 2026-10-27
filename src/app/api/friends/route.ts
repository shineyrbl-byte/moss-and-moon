import { addFriend, board, profile, removeFriend, setName, setProfile } from "@/lib/friendsStore";
import { limited, tooMany } from "@/lib/rateLimit";

// You and your friends' times today (?voter=)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  // ?profile=CODE shows someone's profile
  if (q.has("profile")) { const r = profile(q.get("profile"), q.get("voter")); return Response.json(r, { status: "error" in r ? 404 : 200, headers: { "Cache-Control": "no-store" } }); }
  return Response.json(board(q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { voter, name } to get or rename your code, { voter, add: code }, { voter, remove: code }, or { voter, profile: { avatar, fav, showcase } }
export async function POST(req: Request) {
  if (limited(req, "friends", 60, 3600_000)) return tooMany();
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = "profile" in b ? setProfile(b.voter, (b.profile ?? {}) as Record<string, unknown>) : "add" in b ? addFriend(b.voter, b.add) : "remove" in b ? removeFriend(b.voter, b.remove) : setName(b.voter, b.name);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
