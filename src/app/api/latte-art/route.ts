import { currentStaff, unauthorized } from "@/lib/auth";
import { addArt, latteForBoard, latteWeek, removeArt, voteArt } from "@/lib/latteStore";
import { savePhoto } from "@/lib/uploads";
import { limited, tooMany } from "@/lib/rateLimit";

// This week's entries (?voter=), or ?board=1 for the TV board
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("board") === "1") return Response.json({ art: latteForBoard() }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(latteWeek(q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// Staff: a form with a photo (file) and a caption
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  const saved = await savePhoto(form.get("file"), 5);
  if ("error" in saved) return Response.json(saved, { status: 400 });
  const r = addArt(me, saved.url, form.get("caption"));
  return Response.json(r, { status: "error" in r ? 400 : 200 });
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
