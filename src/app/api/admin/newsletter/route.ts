import { db, cleanText } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { activeSubscribers } from "@/lib/newsletter";

// Owner: newsletters and how many people will get them
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  const list = db.prepare("SELECT * FROM newsletters ORDER BY id DESC LIMIT 30").all();
  const unsub = (db.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed_at IS NOT NULL").get() as { n: number }).n;
  return Response.json({ newsletters: list, subscribers: activeSubscribers().length, unsubscribed: unsub });
}

// Owner: save a draft ({ id?, subject, body })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const subject = cleanText(b?.subject, 120);
  const body = String(b?.body ?? "").slice(0, 8000).trim();
  if (!subject || body.length < 10) return Response.json({ error: "Add a subject and a few lines." }, { status: 400 });
  if (b?.id) {
    const r = db.prepare("UPDATE newsletters SET subject = ?, body = ? WHERE id = ? AND status = 'draft'").run(subject, body, Number(b.id));
    if (!r.changes) return Response.json({ error: "Only drafts can be edited." }, { status: 409 });
    return Response.json({ ok: true, id: Number(b.id) });
  }
  const r = db.prepare("INSERT INTO newsletters (subject, body) VALUES (?, ?)").run(subject, body);
  return Response.json({ ok: true, id: Number(r.lastInsertRowid) });
}

export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  db.prepare("DELETE FROM newsletters WHERE id = ? AND status = 'draft'").run(Number(b?.id));
  return Response.json({ ok: true });
}
