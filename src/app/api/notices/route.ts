import crypto from "node:crypto";
import { db, cleanText } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { toDateStr } from "@/lib/cafe";
import { publish } from "@/lib/live";
import { clientIp } from "@/lib/site";

const NOTICE_KINDS = ["lost", "study", "swap", "plant", "event", "other"] as const;
const DAYS = 14;
const hash = (ip: string) => crypto.createHash("sha256").update(`notice:${ip}`).digest("hex").slice(0, 16);

// The café noticeboard: approved notes that haven't expired (staff see everything with ?all=1)
export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all) {
    if (!(await isAdmin())) return unauthorized();
    return Response.json(db.prepare("SELECT id, kind, name, text, contact, status, expires, created_at FROM notices ORDER BY status = 'pending' DESC, id DESC LIMIT 100").all());
  }
  return Response.json(db.prepare("SELECT id, kind, name, text, contact, created_at FROM notices WHERE status = 'approved' AND expires >= ? ORDER BY id DESC LIMIT 40").all(toDateStr(new Date())));
}

// Guests: pin a note (staff approve it before it shows)
export async function POST(req: Request) {
  const ip = clientIp(req);
  const b = await req.json().catch(() => null);
  const kind = (NOTICE_KINDS as readonly string[]).includes(b?.kind) ? b.kind : "other";
  const name = cleanText(b?.name, 30);
  const text = cleanText(b?.text, 280);
  const contact = cleanText(b?.contact, 60);
  if (!name || text.length < 10) return Response.json({ error: "Add your name and a few words (at least 10 letters)." }, { status: 400 });
  if (/https?:\/\/|www\./i.test(text + contact)) return Response.json({ error: "Links aren't allowed on the board. Leave a name or Instagram handle instead." }, { status: 400 });
  const recent = (db.prepare("SELECT COUNT(*) AS n FROM notices WHERE ip_hash = ? AND created_at >= datetime('now','localtime','-1 day')").get(hash(ip)) as { n: number }).n;
  if (recent >= 3) return Response.json({ error: "That's three notes today. Try again tomorrow ✿" }, { status: 429 });
  const expires = toDateStr(new Date(Date.now() + DAYS * 86_400_000));
  db.prepare("INSERT INTO notices (kind, name, text, contact, ip_hash, expires) VALUES (?, ?, ?, ?, ?, ?)").run(kind, name, text, contact || null, hash(ip), expires);
  publish({ type: "notice" });
  return Response.json({ ok: true });
}

// Staff: approve, hide or delete a note
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = await req.json().catch(() => null);
  const status = ["approved", "rejected", "pending"].includes(b?.status) ? b.status : null;
  if (!status) return Response.json({ error: "Approve or reject?" }, { status: 400 });
  const r = db.prepare("UPDATE notices SET status = ? WHERE id = ?").run(status, Number(b?.id));
  if (!r.changes) return Response.json({ error: "Note not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = await req.json().catch(() => null);
  db.prepare("DELETE FROM notices WHERE id = ?").run(Number(b?.id));
  return Response.json({ ok: true });
}
