import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { ownerEmail } from "@/lib/owner";
import { queue, sendTest } from "@/lib/newsletter";

// Owner: send a test to yourself ({ id, test: true }) or send to everyone ({ id })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const n = db.prepare("SELECT id, subject, body, status FROM newsletters WHERE id = ?").get(Number(b?.id)) as { id: number; subject: string; body: string; status: string } | undefined;
  if (!n) return Response.json({ error: "Newsletter not found." }, { status: 404 });
  if (b?.test) {
    const to = ownerEmail();
    if (!to) return Response.json({ error: "Add your email in Settings → Emails for you first." }, { status: 400 });
    await sendTest(n, to);
    return Response.json({ ok: true, to });
  }
  if (n.status !== "draft") return Response.json({ error: "This one has already been sent." }, { status: 409 });
  const count = queue(n.id);
  if (!count) {
    db.prepare("UPDATE newsletters SET status = 'draft' WHERE id = ?").run(n.id);
    return Response.json({ error: "There are no subscribers yet." }, { status: 400 });
  }
  return Response.json({ ok: true, recipients: count });
}
