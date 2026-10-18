import { db, cleanText, makeCode } from "@/lib/db";
import { hashToken, newToken } from "@/lib/groups";

// Start a group order. The host gets a secret token so only they can check out.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 40);
  if (!name) return Response.json({ error: "Please tell us your name." }, { status: 400 });
  const code = makeCode("GR");
  const token = newToken();
  db.prepare("INSERT INTO groups (code, host_name, host_token) VALUES (?, ?, ?)").run(code, name, hashToken(token));
  return Response.json({ code, hostToken: token });
}
