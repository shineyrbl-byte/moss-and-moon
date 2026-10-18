import { db, cleanEmail, cleanText } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { companiesOverview, invoicePaid, newJoinCode, sendInvoice, type Company } from "@/lib/companies";
import { monthKey, validMonth } from "@/lib/pnl";

const month = (m: unknown) => (validMonth(m) ? m : monthKey(new Date()));

// Owner: every company, with this month's tab (?month=YYYY-MM)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const m = month(new URL(req.url).searchParams.get("month"));
  return Response.json({ month: m, companies: companiesOverview(m) });
}

// Owner: add a company ({ name, billingEmail, gstin?, monthlyLimit? })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 60);
  const email = cleanEmail(b?.billingEmail);
  const gstin = cleanText(b?.gstin, 15).toUpperCase();
  const limit = Number(b?.monthlyLimit) > 0 ? Math.round(Number(b.monthlyLimit)) : null;
  if (!name || !email) return Response.json({ error: "Add the company name and the email for invoices." }, { status: 400 });
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return Response.json({ error: "That GSTIN doesn't look right." }, { status: 400 });
  db.prepare("INSERT INTO companies (name, billing_email, gstin, join_code, monthly_limit) VALUES (?, ?, ?, ?, ?)").run(name, email, gstin || null, newJoinCode(), limit);
  return Response.json({ ok: true });
}

// Owner: { id, action: "invoice" | "paid" | "removeMember" | "toggle", month?, customerId? }
export async function PATCH(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const c = db.prepare("SELECT * FROM companies WHERE id = ?").get(Number(b?.id)) as Company | undefined;
  if (!c) return Response.json({ error: "Not found." }, { status: 404 });
  const m = month(b?.month);
  if (b?.action === "invoice") {
    const r = await sendInvoice(c, m);
    if ("error" in r) return Response.json(r, { status: 400 });
    return Response.json(r);
  }
  if (b?.action === "paid") invoicePaid(c.id, m);
  else if (b?.action === "removeMember") db.prepare("DELETE FROM company_members WHERE company_id = ? AND customer_id = ?").run(c.id, Number(b?.customerId));
  else if (b?.action === "toggle") db.prepare("UPDATE companies SET active = 1 - active WHERE id = ?").run(c.id);
  else return Response.json({ error: "Unknown action." }, { status: 400 });
  return Response.json({ ok: true });
}
