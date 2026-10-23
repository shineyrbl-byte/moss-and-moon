import { isAdmin, unauthorized } from "@/lib/auth";
import { addStory, heartStory, listStories, reviewStory, storiesForStaff, storyOfWeek } from "@/lib/storyStore";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// Stories (?sort=top|new&voter=), ?week=1 for the story of the week, ?all=1 for staff
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ stories: storiesForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ stories: q.get("week") === "1" ? [] : listStories(q.get("voter"), q.get("sort")), week: storyOfWeek() }, { headers: { "Cache-Control": "no-store" } });
}

// Guests: { text, name? } (six words exactly)
export async function POST(req: Request) {
  if (limited(req, "story", 5, 3600_000)) return tooMany();
  const r = addStory((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "✍️ A new six-word story", "Have a look before it shows", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Guests: { id, voter, on } heart (or un-heart) a story
export async function PUT(req: Request) {
  if (limited(req, "story-heart", 120, 3600_000)) return tooMany();
  const r = heartStory((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewStory(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
