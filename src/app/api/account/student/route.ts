import crypto from "node:crypto";
import { db, cleanEmail } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { emailMode, sendEmail } from "@/lib/email";
import { STUDENT, isStudentEmail } from "@/lib/pricing";
import { toDateStr } from "@/lib/cafe";
import { limited, tooMany } from "@/lib/rateLimit";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const until = () => { const d = new Date(); d.setMonth(d.getMonth() + STUDENT.months); return toDateStr(d); };
const verified = (id: number, email: string) => {
  const u = until();
  db.prepare("UPDATE customers SET student_until = ?, student_email = ?, student_code = NULL WHERE id = ?").run(u, email, id);
  return Response.json({ ok: true, verified: true, until: u });
};

// Student discount: { email } sends a code to a college email (or verifies at once if it's the account email);
// { code } checks it. Verified students get 10% off drinks on weekdays for a year.
export async function POST(req: Request) {
  if (limited(req, "student", 10, 600_000)) return tooMany();
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const b = await req.json().catch(() => null);

  if (b?.code !== undefined) {
    const [hash, exp, email, tries] = String(me.student_code ?? "").split("|");
    if (!hash || Number(exp) < Date.now()) return Response.json({ error: "That code has expired. Ask for a new one." }, { status: 400 });
    if (Number(tries) >= 5) return Response.json({ error: "Too many tries. Ask for a new code." }, { status: 400 });
    if (sha(`${email}:${String(b.code).trim()}`) !== hash) {
      db.prepare("UPDATE customers SET student_code = ? WHERE id = ?").run(`${hash}|${exp}|${email}|${Number(tries) + 1}`, me.id);
      return Response.json({ error: "That code isn't right." }, { status: 400 });
    }
    return verified(me.id, email);
  }

  const email = cleanEmail(b?.email) || me.email;
  if (!isStudentEmail(email)) return Response.json({ error: "Use your college email (ending in .ac.in or .edu)." }, { status: 400 });
  // Their sign-in email already proves they own it
  if (email === me.email) return verified(me.id, email);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  db.prepare("UPDATE customers SET student_code = ? WHERE id = ?").run(`${sha(`${email}:${code}`)}|${Date.now() + 15 * 60_000}|${email}|0`, me.id);
  await sendEmail(email, `Your Moss & Moon student code: ${code}`, `<p>Enter this code on your account page to turn on your student discount (10% off drinks on weekdays):</p><p style="font-family:monospace;font-size:24px;letter-spacing:4px">${code}</p><p style="color:#8a6a5c;font-size:13px">It works for 15 minutes. Didn't ask for it? Just ignore this email.</p>`);
  return Response.json({ ok: true, sent: true, ...(emailMode() === "live" ? {} : { demoCode: code }) });
}
