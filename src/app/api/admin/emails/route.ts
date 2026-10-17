import { db } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { emailMode } from "@/lib/email";
import { paymentMode } from "@/lib/payments";

// Staff: every email the site has sent (or would have sent), newest first
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const emails = db.prepare("SELECT * FROM outbox ORDER BY id DESC LIMIT 100").all();
  return Response.json({ emails, emailMode: emailMode(), paymentMode: paymentMode() });
}
