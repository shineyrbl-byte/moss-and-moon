import { cleanEmail, cleanText } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { limited, tooMany } from "@/lib/rateLimit";
import { inbox, startChat } from "@/lib/support";
import { hoursOn } from "@/lib/cafe";

// A guest asks to talk to a person ({ name, email?, text, context? })
export async function POST(req: Request) {
  if (limited(req, "support-start", 5, 3600_000)) return tooMany();
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 40) || "Guest";
  const email = cleanEmail(b?.email);
  if (b?.email && !email) return Response.json({ error: "That email doesn't look right." }, { status: 400 });
  const text = cleanText(b?.text, 800);
  if (!text) return Response.json({ error: "Type a message first." }, { status: 400 });
  // What the guest and the AI barista said, so staff don't have to ask again
  const context = Array.isArray(b?.context)
    ? b.context.slice(-6).map((m: { role?: string; content?: string }) => `${m.role === "user" ? "Guest" : "Mo"}: ${cleanText(m.content, 300)}`).join("\n").slice(0, 2000)
    : null;
  const open = !!hoursOn(new Date());
  const { code, token } = startChat(name, email || null, context, text);
  return Response.json({ code, token, open });
}

// Staff: the inbox
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(inbox());
}
