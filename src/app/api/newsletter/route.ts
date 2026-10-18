import { db, cleanText } from "@/lib/db";
import { sendLater, welcomeEmail } from "@/lib/email";
import { limited, tooMany } from "@/lib/rateLimit";

export async function POST(req: Request) {
  if (limited(req, "newsletter", 15, 600000)) return tooMany();
  const b = await req.json().catch(() => null);
  const email = cleanText(b?.email, 100).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  const r = db.prepare("INSERT OR IGNORE INTO subscribers (email) VALUES (?)").run(email);
  if (r.changes) sendLater(email, ...welcomeEmail());
  return Response.json({ ok: true });
}
