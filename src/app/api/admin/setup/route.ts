import { currentStaff, ownerGate } from "@/lib/auth";
import { emailProvider } from "@/lib/email";
import { paymentMode } from "@/lib/payments";
import { ownerEmail } from "@/lib/owner";
import { gstSettings } from "@/lib/gst";
import { wifiSettings } from "@/lib/wifi";
import { twoStepOn } from "@/lib/twoStep";
import { cafeLinks } from "@/lib/cafe";
import { aiProvider } from "@/lib/ai";
import { db, getSetting } from "@/lib/db";

type Item = { id: string; ok: boolean; label: string; why: string; tab: string; optional?: boolean };

// Owner: what's set up and what isn't, with where to fix it
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  const me = (await currentStaff())!;
  const links = cafeLinks();
  const items: Item[] = [
    { id: "email", ok: emailProvider() !== null, label: "Emails reach guests", why: "Order confirmations, receipts and booking emails.", tab: "Settings" },
    { id: "payments", ok: paymentMode() === "razorpay", label: "Real online payments", why: "Add your Razorpay keys in Railway so guests can pay by UPI and card.", tab: "Settings" },
    { id: "owner", ok: !!ownerEmail(), label: "Your email for the nightly summary and alerts", why: "So you hear how the day went and if anything breaks.", tab: "Settings" },
    { id: "2fa", ok: !!me.id && twoStepOn(me.id), label: "Two-step login", why: "Stops anyone with your password from getting in.", tab: "Settings" },
    { id: "hours", ok: !!getSetting("cafe_config"), label: "Opening hours checked", why: "Ordering, bookings and the busy meter follow them.", tab: "Settings" },
    { id: "team", ok: !!(db.prepare("SELECT 1 FROM staff WHERE active = 1 AND role = 'barista'").get()), label: "Baristas have their own logins", why: "So you know who did what, and they don't need the owner passcode.", tab: "Team" },
    { id: "google", ok: !!links.googleReview, label: "Google review link", why: "Happy guests get a button to review you on Google.", tab: "Settings" },
    { id: "wifi", ok: !!wifiSettings().ssid, label: "Wi-Fi on receipts and table cards", why: "Guests join with a scan instead of asking.", tab: "Settings", optional: true },
    { id: "whatsapp", ok: !!links.whatsapp, label: "WhatsApp number", why: "A “Message us” button in the chat and footer.", tab: "Settings", optional: true },
    { id: "gst", ok: gstSettings().on, label: "GST invoices", why: "Only if you're GST-registered: receipts become tax invoices.", tab: "Settings", optional: true },
    { id: "ai", ok: aiProvider() !== null, label: "AI for the barista chat and insights", why: "A free Gemini key makes Mo, specials and weekly insights smarter.", tab: "Settings", optional: true },
  ];
  const needed = items.filter((i) => !i.optional);
  return Response.json({ items, done: needed.filter((i) => i.ok).length, total: needed.length, dismissed: getSetting("setup_dismissed") === "1" });
}

// Owner: hide the card ({ dismissed })
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const { setSetting } = await import("@/lib/db");
  setSetting("setup_dismissed", b?.dismissed ? "1" : "0");
  return Response.json({ ok: true });
}
