import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { companyFor, spentThisMonth } from "@/lib/companies";
import { limited, tooMany } from "@/lib/rateLimit";

const signIn = () => Response.json({ error: "Please sign in first." }, { status: 401 });
const mine = (id: number) => {
  const c = companyFor(id);
  return c ? { name: c.name, limit: c.monthly_limit, spent: Math.round(spentThisMonth(c.id, id)) } : null;
};

// Your company tab (if any)
export async function GET() {
  const me = await currentCustomer();
  if (!me) return signIn();
  return Response.json({ company: mine(me.id) });
}

// Join with the code your office was given ({ code })
export async function POST(req: Request) {
  if (limited(req, "company-join", 10, 3600_000)) return tooMany();
  const me = await currentCustomer();
  if (!me) return signIn();
  const b = await req.json().catch(() => null);
  const c = db.prepare("SELECT id, name FROM companies WHERE join_code = ? AND active = 1").get(String(b?.code ?? "").trim().toUpperCase()) as { id: number; name: string } | undefined;
  if (!c) return Response.json({ error: "That code didn't work. Check it with your office." }, { status: 404 });
  db.prepare("DELETE FROM company_members WHERE customer_id = ?").run(me.id);
  db.prepare("INSERT INTO company_members (company_id, customer_id) VALUES (?, ?)").run(c.id, me.id);
  return Response.json({ ok: true, company: mine(me.id) });
}

// Leave the company tab
export async function DELETE() {
  const me = await currentCustomer();
  if (!me) return signIn();
  db.prepare("DELETE FROM company_members WHERE customer_id = ?").run(me.id);
  return Response.json({ ok: true });
}
