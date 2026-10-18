import { savePhoto } from "@/lib/uploads";
import { clientIp } from "@/lib/site";

// Guests: attach a photo to a review. 5 uploads per hour per visitor, 3 MB max.
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 5) return Response.json({ error: "That's a lot of photos! Try again later." }, { status: 429 });
  hits.set(ip, [...recent, now]);
  const form = await req.formData().catch(() => null);
  const r = await savePhoto(form?.get("file"), 3);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
