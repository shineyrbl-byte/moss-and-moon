import { currentStaff, unauthorized } from "@/lib/auth";
import { addArt, addGuestArt, latteForBoard, latteWeek, pendingArt, removeArt, reviewArt, voteArt } from "@/lib/latteStore";
import { alertOwner } from "@/lib/push";
import { savePhoto } from "@/lib/uploads";
import { limited, tooMany } from "@/lib/rateLimit";

// This week's entries (?voter=), ?board=1 for the TV board, or ?pending=1 for staff: guests' pours waiting for a look
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("pending") === "1") { if (!(await currentStaff())) return unauthorized(); return Response.json({ pending: pendingArt() }); }
  if (q.get("board") === "1") return Response.json({ art: latteForBoard() }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(latteWeek(q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// Staff: a form with a photo (file) and a caption. Guests: the same plus their name; it waits for staff to approve it.
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me && limited(req, "latte-guest", 3, 3600_000)) return tooMany();
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  if (!me && !String(form.get("name") ?? "").trim()) return Response.json({ error: "Add your first name so we can credit you." }, { status: 400 });
  const saved = await savePhoto(form.get("file"), 5);
  if ("error" in saved) return Response.json(saved, { status: 400 });
  const r = me ? addArt(me, saved.url, form.get("caption")) : addGuestArt(saved.url, { name: form.get("name"), caption: form.get("caption") });
  if (!me && !("error" in r)) alertOwner("review", "☕ A guest sent their latte art", "Have a look and approve it", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve: true | false } for a guest's pour
export async function PATCH(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const ok = reviewArt(Math.floor(Number(b.id)), b.approve === true);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}

// Guests: { id, voter } one vote a week (you can change it)
export async function PUT(req: Request) {
  if (limited(req, "latte-vote", 30, 3600_000)) return tooMany();
  const r = voteArt((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: take one down (?id=); baristas their own, owners any
export async function DELETE(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const ok = removeArt(Number(new URL(req.url).searchParams.get("id")), me);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
