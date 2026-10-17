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
