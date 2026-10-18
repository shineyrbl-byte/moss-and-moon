import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { emailMode, emailProvider, sendingAddress } from "@/lib/email";
import { paymentMode } from "@/lib/payments";

// Staff: every email the site has sent (or would have sent), newest first
export async function GET() {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const emails = db.prepare("SELECT * FROM outbox ORDER BY id DESC LIMIT 100").all();
  return Response.json({ emails, emailMode: emailMode(), emailProvider: emailProvider(), emailFrom: sendingAddress(), paymentMode: paymentMode() });
}
