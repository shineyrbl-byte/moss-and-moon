import { currentStaff, unauthorized } from "@/lib/auth";
import { nowPlaying, requestSong, songAction, songList } from "@/lib/songs";
import { limited, tooMany } from "@/lib/rateLimit";
import { publish } from "@/lib/live";

// What's playing and up next (?all=1 for staff: every request, waiting ones included)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("all") === "1") {
    if (!(await currentStaff())) return unauthorized();
    return Response.json({ songs: songList() });
  }
  return Response.json(nowPlaying(), { headers: { "Cache-Control": "no-store" } });
}

// Guests: { title, artist?, name?, table? }. It waits for staff to approve it.
export async function POST(req: Request) {
  if (limited(req, "song", 4, 30 * 60_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  const r = requestSong(b);
  if ("error" in r) return Response.json(r, { status: 400 });
  publish({ type: "song" });
  return Response.json(r);
}

// Staff: { id, action: "approve" | "play" | "done" | "remove" }
export async function PATCH(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = songAction(Number(b.id), String(b.action));
  if (ok) publish({ type: "song" });
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
