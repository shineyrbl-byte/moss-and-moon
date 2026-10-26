import { dropReminder, saveReminder } from "@/lib/gameReminders";
import { limited, tooMany } from "@/lib/rateLimit";

const goodSub = (s: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined) =>
  !!s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";

// { subscription, atMin, voter }: remind this browser once a day
export async function POST(req: Request) {
  if (limited(req, "game-reminder", 20, 600_000)) return tooMany();
  const { subscription: s, atMin, voter } = (await req.json().catch(() => null)) ?? {};
  if (!goodSub(s)) return Response.json({ error: "That notification setup didn't work." }, { status: 400 });
  const at = Number(atMin);
  if (!Number.isInteger(at) || at < 0 || at >= 1440) return Response.json({ error: "Pick a time for the reminder." }, { status: 400 });
  saveReminder({ endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } }, at, voter);
  return Response.json({ ok: true });
}

// { endpoint }: stop
export async function DELETE(req: Request) {
  if (limited(req, "game-reminder", 20, 600_000)) return tooMany();
  const { endpoint } = (await req.json().catch(() => null)) ?? {};
  if (typeof endpoint !== "string") return Response.json({ error: "Which reminder?" }, { status: 400 });
  return Response.json({ ok: true, removed: dropReminder(endpoint) });
}
