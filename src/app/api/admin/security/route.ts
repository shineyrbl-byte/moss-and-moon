import { ownerGate, currentStaff } from "@/lib/auth";
import { twoStepOn } from "@/lib/twoStep";
import { ownerEmail } from "@/lib/owner";
import { listBackups } from "@/lib/backup";
import { paymentMode } from "@/lib/payments";
import { db } from "@/lib/db";

type Check = { ok: boolean; label: string; fix?: string };

// Owner: a quick security check-up of the live site's settings
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  const me = (await currentStaff())!;
  const pass = process.env.ADMIN_PASSCODE ?? "";
  const site = process.env.SITE_URL ?? "";
  const last = listBackups()[0];
  const ownersWithout = (db.prepare("SELECT id, name FROM staff WHERE role = 'owner' AND active = 1").all() as { id: number; name: string }[]).filter((s) => !twoStepOn(s.id));

  const checks: Check[] = [
    { ok: !!pass && pass !== "moonlight", label: "Owner passcode is set (not the default)", fix: "Set ADMIN_PASSCODE in Railway → Variables." },
    { ok: pass.length >= 12, label: "Owner passcode is at least 12 characters", fix: "Use a longer passcode, e.g. three random words." },
    { ok: twoStepOn(me.id), label: "Two-step login is on for you", fix: "Turn it on in Settings → 🔐 Two-step login." },
    { ok: !ownersWithout.length, label: "Every owner account uses two-step login", fix: ownersWithout.length ? `Not yet: ${ownersWithout.map((o) => o.name).join(", ")}.` : undefined },
    { ok: site.startsWith("https://"), label: "The site address uses https", fix: "Set SITE_URL to your https:// address." },
    { ok: !!ownerEmail(), label: "Error alerts have somewhere to go", fix: "Add your email in Settings → 📬 Emails for you." },
    { ok: !!last && Date.now() - new Date(last.at).getTime() < 36 * 3600_000, label: "A backup was made in the last day and a half", fix: "Tap “Back up now” in Settings → 🗄 Backups." },
    { ok: paymentMode() === "razorpay", label: "Payments go through Razorpay (not the demo screen)", fix: "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
  ];
  return Response.json({ checks, score: checks.filter((c) => c.ok).length, total: checks.length });
}
