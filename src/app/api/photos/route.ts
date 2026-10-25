import { isAdmin, unauthorized } from "@/lib/auth";
import { addGuestPhoto, allPhotos, approvedPhotos, doodlePrompts, photoKind, promptDoodles, reviewPhoto } from "@/lib/guestPhotos";
import { promptFor } from "@/lib/doodlePrompts";
import { toDateStr } from "@/lib/cafe";
import { savePhoto } from "@/lib/uploads";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// The photo wall (?kind=pup for the regular pups, ?kind=doodle for the doodle wall; ?all=1 for staff: every photo, waiting ones first)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ photos: allPhotos() });
  }
  // Doodle of the day: ?prompts=1 for today's prompt and past ones; ?prompt= for one prompt's doodles
  if (q.get("prompts") === "1") return Response.json({ today: promptFor(toDateStr(new Date())), prompts: doodlePrompts() });
  if (q.get("prompt")) return Response.json({ photos: promptDoodles(q.get("prompt")!.slice(0, 80)) });
  const kind = photoKind(q.get("kind"));
  return Response.json({ photos: approvedPhotos(kind === "cafe" ? 24 : 48, kind) });
}

// Guests: share a photo (form fields: file, caption, name, kind = cafe | pup). It waits for a staff member to approve it.
export async function POST(req: Request) {
  if (limited(req, "guest-photo", 5, 3600_000)) return tooMany();
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  const saved = await savePhoto(form.get("file"), 5);
  if ("error" in saved) return Response.json(saved, { status: 400 });
  const kind = photoKind(form.get("kind"));
  const r = addGuestPhoto(saved.url, { name: form.get("name"), caption: form.get("caption"), kind, prompt: form.get("prompt") });
  if ("error" in r) return Response.json(r, { status: 400 });
  alertOwner("review", kind === "pup" ? "🐾 A guest shared their dog" : kind === "doodle" ? "🎨 A guest drew a doodle" : "📸 A guest shared a photo", "Have a look and approve it", "/admin#Reviews");
  return Response.json({ ok: true });
}

// Staff: { id, approve: true | false }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewPhoto(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
