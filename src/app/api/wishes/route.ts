import { isAdmin, unauthorized } from "@/lib/auth";
import { addWish, reviewWish, treeNow, wishesForStaff } from "@/lib/wishStore";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// The tree since the last full moon. Staff: ?all=1 for every wish with its words.
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ wishes: wishesForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(treeNow(), { headers: { "Cache-Control": "no-store" } });
}

// Guests: { text, name?, colour }
export async function POST(req: Request) {
  if (limited(req, "wish", 5, 3600_000)) return tooMany();
  const r = addWish((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "🌳 A new wish on the tree", "Have a look before it shows", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewWish(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
