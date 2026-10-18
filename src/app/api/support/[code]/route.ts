import { db, cleanText } from "@/lib/db";
import { currentStaff } from "@/lib/auth";
import { limited, tooMany } from "@/lib/rateLimit";
import { addMessage, emailIfAway, getChat, guestOwns, messages } from "@/lib/support";
import { publish } from "@/lib/live";

type P = { params: Promise<{ code: string }> };
const notFound = () => Response.json({ error: "We couldn't find that chat." }, { status: 404 });

// The messages: for the guest (with their token) or staff. ?after=<id>
export async function GET(req: Request, { params }: P) {
  const c = getChat((await params).code);
  const q = new URL(req.url).searchParams;
  const staff = await currentStaff();
  const guest = guestOwns(c, q.get("token"));
  if (!c || (!guest && !staff)) return notFound();
  const list = messages(c.code, Number(q.get("after")) || 0);
  if (guest) db.prepare("UPDATE support_chats SET guest_seen_at = datetime('now','localtime') WHERE code = ?").run(c.code);
  else if (list.length) db.prepare("UPDATE support_chats SET staff_seen_id = MAX(staff_seen_id, ?) WHERE code = ?").run(list.at(-1)!.id, c.code);
  return Response.json({ code: c.code, name: c.name, status: c.status, messages: list, ...(staff ? { email: c.email, context: c.context } : {}) });
}

// Send a message ({ text, token? }): the guest with their token, or whoever is on staff
export async function POST(req: Request, { params }: P) {
  if (limited(req, "support-msg", 60, 600_000)) return tooMany();
  const c = getChat((await params).code);
  const b = await req.json().catch(() => null);
  const guest = guestOwns(c, b?.token);
  const staff = guest ? null : await currentStaff();
  if (!c || (!guest && !staff)) return notFound();
  const text = cleanText(b?.text, 800);
  if (!text) return Response.json({ error: "Type a message first." }, { status: 400 });
  const firstName = staff ? staff.name.split(" ")[0] || "The team" : null;
  const id = addMessage(c.code, guest ? "guest" : "staff", text, firstName);
  if (staff) {
    db.prepare("UPDATE support_chats SET staff_seen_id = ? WHERE code = ?").run(id, c.code);
    void emailIfAway(c, text, firstName!, id, process.env.SITE_URL || new URL(req.url).origin).catch(() => {});
  }
  return Response.json({ ok: true, id });
}

// Staff: close (or reopen) a chat ({ status })
export async function PATCH(req: Request, { params }: P) {
  const staff = await currentStaff();
  const c = getChat((await params).code);
  if (!c || !staff) return notFound();
  const b = await req.json().catch(() => null);
  const status = b?.status === "closed" ? "closed" : "open";
  db.prepare("UPDATE support_chats SET status = ? WHERE code = ?").run(status, c.code);
  if (status === "closed") addMessage(c.code, "system", `${staff.name.split(" ")[0]} closed the chat. Message again any time ✿`);
  else publish({ type: "support", code: c.code });
  return Response.json({ ok: true });
}
