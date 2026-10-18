// "Your order is ready" notifications that reach the phone even when the site is closed.
// Uses standard Web Push. The signing keys (VAPID) are made automatically on first use
// and saved in the database, or you can provide VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
import "server-only";
import webpush from "web-push";
import { db, getSetting, setSetting } from "./db";

let ready = false;

export function vapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  const saved = getSetting("vapid");
  if (saved) return JSON.parse(saved) as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  setSetting("vapid", JSON.stringify(keys));
  return keys;
}

function setup() {
  if (ready) return;
  const k = vapidKeys();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@mossandmoon.cafe", k.publicKey, k.privateKey);
  ready = true;
}

export function saveSubscription(orderCode: string, sub: webpush.PushSubscription) {
  db.prepare("INSERT OR IGNORE INTO push_subs (order_code, endpoint, data) VALUES (?, ?, ?)").run(orderCode, sub.endpoint, JSON.stringify(sub));
}

/** Notify every device that asked to hear about this order. Never throws. */
export async function notifyOrder(orderCode: string, payload: { title: string; body: string; url: string }) {
  const subs = db.prepare("SELECT id, data FROM push_subs WHERE order_code = ?").all(orderCode) as { id: number; data: string }[];
  if (!subs.length) return;
  setup();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(JSON.parse(s.data), JSON.stringify(payload), { TTL: 60 * 30 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410 = the browser unsubscribed; forget it
        if (code === 404 || code === 410) db.prepare("DELETE FROM push_subs WHERE id = ?").run(s.id);
        else console.error("Push failed", code ?? e);
      }
    })
  );
}

// ----- Alerts for the owner's phone -----
export const OWNER_ALERTS = [
  { id: "review", label: "A 1–2★ review" },
  { id: "big", label: "A big order (₹2,000+)" },
  { id: "catering", label: "A new catering or cake order" },
  { id: "soldout", label: "Guests trying to order something sold out" },
  { id: "cashup", label: "A cash-up that's ₹50+ out" },
] as const;
export type OwnerAlert = (typeof OWNER_ALERTS)[number]["id"];
const OWNER_KEY = "OWNER";

export function ownerAlertPrefs(): Record<OwnerAlert, boolean> {
  let saved: Partial<Record<OwnerAlert, boolean>> = {};
  try { saved = JSON.parse(getSetting("owner_alerts") ?? "{}"); } catch {}
  return Object.fromEntries(OWNER_ALERTS.map((a) => [a.id, saved[a.id] !== false])) as Record<OwnerAlert, boolean>;
}
export const setOwnerAlertPrefs = (p: Partial<Record<OwnerAlert, boolean>>) => setSetting("owner_alerts", JSON.stringify({ ...ownerAlertPrefs(), ...p }));
export const saveOwnerDevice = (sub: webpush.PushSubscription) => saveSubscription(OWNER_KEY, sub);
export const ownerDevices = () => (db.prepare("SELECT COUNT(*) AS n FROM push_subs WHERE order_code = ?").get(OWNER_KEY) as { n: number }).n;
export const forgetOwnerDevices = () => db.prepare("DELETE FROM push_subs WHERE order_code = ?").run(OWNER_KEY);

/** Ping the owner's phones (if that kind of alert is on). Never throws; fire and forget. */
export function alertOwner(kind: OwnerAlert, title: string, body: string, url = "/admin") {
  if (!ownerAlertPrefs()[kind]) return;
  void notifyOrder(OWNER_KEY, { title, body, url }).catch(() => {});
}
