import { db, cleanEmail, cleanText, makeCode } from "@/lib/db";
import { findOrderable } from "@/lib/menuStore";
import { cleanOptions, describeOptions, isDrink, unitPrice } from "@/lib/pricing";
import { toDateStr } from "@/lib/cafe";

const VALID_DAYS = 90;

// "Buy a friend a coffee": price one drink, exactly as customised, to pay for now and claim later
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const item = findOrderable(String(b?.itemId ?? ""));
  if (!item || !isDrink(item.cat)) return Response.json({ error: "Pick a drink to gift." }, { status: 400 });
  const fromName = cleanText(b?.fromName, 40);
  const toName = cleanText(b?.toName, 40);
  if (!fromName || !toName) return Response.json({ error: "Add your name and your friend's name." }, { status: 400 });
  if (b?.toEmail && !cleanEmail(b.toEmail)) return Response.json({ error: "Your friend's email doesn't look right." }, { status: 400 });
  if (b?.fromEmail && !cleanEmail(b.fromEmail)) return Response.json({ error: "Your email doesn't look right." }, { status: 400 });
  const opts = cleanOptions(item, b?.opts ?? {});
  const amount = unitPrice(item, opts);
  const code = makeCode("GD", 5);
  const expires = toDateStr(new Date(Date.now() + VALID_DAYS * 86_400_000));
  db.prepare(
    "INSERT INTO drink_gifts (code, item_id, item_name, opts, note, amount, from_name, from_email, to_name, to_email, message, expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(code, item.id, item.name, JSON.stringify(opts), describeOptions(item, opts), amount, fromName, cleanEmail(b?.fromEmail) || null, toName, cleanEmail(b?.toEmail) || null, cleanText(b?.message, 140) || null, expires);
  return Response.json({ code, amount });
}
