import { isAdmin, unauthorized } from "@/lib/auth";
import { addGuestPhoto, allPhotos, approvedPhotos, photoKind, reviewPhoto } from "@/lib/guestPhotos";
import { savePhoto } from "@/lib/uploads";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// The photo wall (?kind=pup for the regular pups; ?all=1 for staff: every photo, waiting ones first)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ photos: allPhotos() });
  }
  return Response.json({ photos: approvedPhotos(q.get("kind") === "pup" ? 48 : 24, photoKind(q.get("kind"))) });
}

// Guests: share a photo (form fields: file, caption, name, kind = cafe | pup). It waits for a staff member to approve it.
export async function POST(req: Request) {
  if (limited(req, "guest-photo", 5, 3600_000)) return tooMany();
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  const saved = await savePhoto(form.get("file"), 5);
  if ("error" in saved) return Response.json(saved, { status: 400 });
  const kind = photoKind(form.get("kind"));
  const r = addGuestPhoto(saved.url, { name: form.get("name"), caption: form.get("caption"), kind });
  if ("error" in r) return Response.json(r, { status: 400 });
  alertOwner("review", kind === "pup" ? "🐾 A guest shared their dog" : "📸 A guest shared a photo", "Have a look and approve it", "/admin#Reviews");
  return Response.json({ ok: true });
}

// Staff: { id, approve: true | false }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewPhoto(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
