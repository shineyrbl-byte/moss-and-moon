import { db, cleanText } from "@/lib/db";

export async function GET() {
  const rows = db.prepare("SELECT id, name, rating, text, created_at FROM reviews ORDER BY id DESC LIMIT 30").all();
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
  db.prepare("INSERT INTO reviews (name, rating, text) VALUES (?, ?, ?)").run(name, rating, text);
  return Response.json({ ok: true });
}
