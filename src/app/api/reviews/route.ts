import { db, cleanText } from "@/lib/db";
import { isOurPhoto } from "@/lib/uploads";

export async function GET() {
  const rows = db.prepare("SELECT id, name, rating, text, photo, created_at FROM reviews ORDER BY id DESC LIMIT 30").all();
  const s = db.prepare("SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg FROM reviews").get();
  return Response.json({ reviews: rows, ...s });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 40);
  const text = cleanText(b?.text, 400);
  const rating = Math.floor(Number(b?.rating));
  if (!name || text.length < 5) return Response.json({ error: "Please add your name and a few words." }, { status: 400 });
  if (!(rating >= 1 && rating <= 5)) return Response.json({ error: "Please choose a star rating." }, { status: 400 });
  const photo = b?.photo && isOurPhoto(b.photo) ? String(b.photo) : null;
  if (b?.photo && !photo) return Response.json({ error: "That photo didn't upload properly. Try again?" }, { status: 400 });
  db.prepare("INSERT INTO reviews (name, rating, text, photo) VALUES (?, ?, ?, ?)").run(name, rating, text, photo);
  return Response.json({ ok: true });
}
