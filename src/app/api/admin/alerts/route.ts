import { ownerGate } from "@/lib/auth";
import { OWNER_ALERTS, notifyOrder, forgetOwnerDevices, ownerAlertPrefs, ownerDevices, saveOwnerDevice, setOwnerAlertPrefs, vapidKeys } from "@/lib/push";

// Owner: phone alerts (which kinds, and how many devices get them)
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ kinds: OWNER_ALERTS, prefs: ownerAlertPrefs(), devices: ownerDevices(), publicKey: vapidKeys().publicKey });
}

// Owner: add this device ({ subscription }), change which alerts ({ prefs }), send a test ({ test: true }) or forget devices ({ forget: true })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const s = b?.subscription;
  if (s) {
    if (typeof s.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return Response.json({ error: "That notification setup didn't work." }, { status: 400 });
    saveOwnerDevice({ endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } });
  }
  if (b?.prefs && typeof b.prefs === "object") setOwnerAlertPrefs(Object.fromEntries(OWNER_ALERTS.filter((a) => typeof b.prefs[a.id] === "boolean").map((a) => [a.id, b.prefs[a.id]])));
  if (b?.forget) forgetOwnerDevices();
  if (b?.test) void notifyOrder("OWNER", { title: "Moss & Moon alerts are on ✿", body: "This is what an alert looks like.", url: "/admin" }).catch(() => {});
  return Response.json({ prefs: ownerAlertPrefs(), devices: ownerDevices() });
}
