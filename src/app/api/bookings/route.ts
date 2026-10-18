import { db, makeCode, cleanPhone, cleanText, cleanEmail } from "@/lib/db";
import { bookingEmail, bookingInvite, sendLater, waitlistEmail } from "@/lib/email";
import { activeBranches, findBranch, slotsFor, parseDate, toDateStr, TABLES_PER_SLOT } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";
import { limited, tooMany } from "@/lib/rateLimit";
import { checkTable, cleanPreorder } from "@/lib/preorders";
import { rupees } from "@/lib/pricing";
import { depositFor, markNoShow } from "@/lib/deposits";

/** Tables used in a slot. Groups of 5+ take two tables. */
function tablesUsed(date: string, time: string, branch: string) {
  const r = db
    .prepare("SELECT COALESCE(SUM(CASE WHEN guests >= 5 THEN 2 ELSE 1 END), 0) AS n FROM bookings WHERE date = ? AND time = ? AND branch = ? AND status IN ('confirmed','pending')")
    .get(date, time, branch) as { n: number };
  return r.n;
}

export async function POST(req: Request) {
  if (limited(req, "bookings", 30, 600000)) return tooMany();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Invalid request." }, { status: 400 });

  const name = cleanText(b.name, 40);
  const phone = cleanPhone(b.phone);
  const date = String(b.date ?? "");
  const time = String(b.time ?? "");
  const guests = Math.floor(Number(b.guests));
  const note = cleanText(b.note, 200);
  const highChairs = Math.min(3, Math.max(0, Math.floor(Number(b.highChairs) || 0)));
  const email = cleanEmail(b.email);
  const branch = findBranch(b.branch);
  if (b.branch && branch.id !== b.branch) return Response.json({ error: "That branch isn't taking bookings right now." }, { status: 400 });
  if (b.email && !email) return Response.json({ error: "That email doesn't look right." }, { status: 400 });

  if (!name) return Response.json({ error: "Please tell us your name." }, { status: 400 });
  if (phone.length !== 10) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  if (!(guests >= 1 && guests <= 8)) return Response.json({ error: "We can seat 1–8 guests online. Call us for bigger groups!" }, { status: 400 });
  const d = parseDate(date);
  if (!d || date < toDateStr(new Date())) return Response.json({ error: "Please pick a date from today onwards." }, { status: 400 });
  if (!slotsFor(date, branch.id).includes(time)) return Response.json({ error: "That time isn't available — please pick another." }, { status: 400 });

  const need = guests >= 5 ? 2 : 1;
  if (tablesUsed(date, time, branch.id) + need > TABLES_PER_SLOT)
    return Response.json({ error: "That slot just filled up. Try another time?" }, { status: 409 });

  // Optional: a table from the floor plan, and food to have ready on arrival
  const table = b.table ? Math.floor(Number(b.table)) : null;
  if (table && branch.id !== "main") return Response.json({ error: `Table picking is only at ${findBranch("main").name} for now.` }, { status: 400 });
  if (table) {
    const problem = checkTable(table, date, time, guests);
    if (problem) return Response.json({ error: problem }, { status: 409 });
  }
  const pre = cleanPreorder(b.preorder);
  if (Array.isArray(b.preorder) && b.preorder.length && !pre.lines.length) return Response.json({ error: "Those pre-order items aren't on the menu any more." }, { status: 400 });

  const code = makeCode("TB", 6);
  // Big groups hold the table with a deposit, paid next
  const deposit = depositFor(guests);
  if (deposit && !email) return Response.json({ error: "For groups this size we need an email for the deposit receipt." }, { status: 400 });
  db.prepare("INSERT INTO bookings (code, name, phone, email, date, time, guests, note, table_no, preorder, branch, status, deposit, deposit_status, high_chairs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    code, name, phone, email || null, date, time, guests, note, table, pre.lines.length ? JSON.stringify(pre.lines) : null, branch.id,
    deposit ? "pending" : "confirmed", deposit, deposit ? "due" : null, highChairs,
  );
  if (deposit) return Response.json({ code, name, date, time, guests, table, needsDeposit: true, deposit });
  const extra = { table, preorder: pre.items, preorderTotal: pre.total, ...(activeBranches().length > 1 ? { branch: branch.name, address: branch.address } : {}) };
  if (email) sendLater(email, ...bookingEmail({ code, name, date, time, guests, ...extra }), [bookingInvite({ code, name, date, time, guests })]);
  return Response.json({ code, name, date, time, guests, ...extra, preorderText: pre.items.length ? `${pre.items.join(", ")} · about ${rupees(pre.total)}, pay at the café` : null });
}

// Staff: upcoming bookings
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const rows = db
    .prepare("SELECT * FROM bookings WHERE date >= ? ORDER BY date, time LIMIT 200")
    .all(toDateStr(new Date())) as { preorder: string | null }[];
  // Spell out pre-orders for the staff list
  return Response.json(rows.map((r) => ({ ...r, preorder: r.preorder ? cleanPreorder(JSON.parse(r.preorder)).items.join(", ") : null })));
}

// Staff: cancel a booking
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { code, status } = await req.json().catch(() => ({}));
  if (!["confirmed", "cancelled", "seated", "no-show"].includes(status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  db.prepare("UPDATE bookings SET status = ? WHERE code = ?").run(status, String(code));
  if (status === "no-show") markNoShow(String(code));
  if (status === "cancelled") {
    const b = db.prepare("SELECT date, time, branch FROM bookings WHERE code = ?").get(String(code)) as { date: string; time: string; branch: string } | undefined;
    const w = b && (db.prepare("SELECT id, name, email, date, time FROM waitlist WHERE date = ? AND time = ? AND branch = ? AND status = 'waiting' ORDER BY id LIMIT 1").get(b.date, b.time, b.branch) as
      | { id: number; name: string; email: string; date: string; time: string }
      | undefined);
    if (w) {
      db.prepare("UPDATE waitlist SET status = 'offered' WHERE id = ?").run(w.id);
      sendLater(w.email, ...waitlistEmail(w));
    }
  }
  return Response.json({ ok: true });
}
