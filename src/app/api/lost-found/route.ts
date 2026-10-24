import { isAdmin, unauthorized } from "@/lib/auth";
import { addLost, claimLost, closeLost, lostForStaff, lostItems } from "@/lib/lostFoundStore";
import { savePhoto } from "@/lib/uploads";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// What's waiting to go home (?staff=1: everything open, with claims)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("staff") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ items: lostForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ items: lostItems() }, { headers: { "Cache-Control": "no-store" } });
}

// Staff: post a found thing. JSON { what, where, foundOn } or a form with the same fields plus an optional photo (file)
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  let b: Record<string, unknown> = {}, img: string | null = null;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return Response.json({ error: "That didn't upload. Try again?" }, { status: 400 });
    b = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    const file = form.get("file");
    if (file && typeof file !== "string" && file.size > 0) {
      const saved = await savePhoto(file, 5);
      if ("error" in saved) return Response.json(saved, { status: 400 });
      img = saved.url;
    }
  } else b = (await req.json().catch(() => null)) ?? {};
  const r = addLost(b, img);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Guests: { id, name, detail } "that's mine"
export async function PUT(req: Request) {
  if (limited(req, "lost-claim", 6, 3600_000)) return tooMany();
  const r = claimLost((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "🧣 Someone's claimed a lost thing", "Check their description before handing it over", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, status: "returned" | "removed" }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = closeLost(Number(b.id), b.status === "removed" ? "removed" : "returned");
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
