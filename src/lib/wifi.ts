// Café Wi-Fi: a QR code guests scan to join, printed on receipts and table cards.
// (Never shown on the public website.)
import "server-only";
import QRCode from "qrcode";
import { getSetting, setSetting, cleanText } from "./db";

export type Wifi = { ssid: string; password: string; security: "WPA" | "WEP" | "nopass"; onReceipts: boolean; onTables: boolean };
const DEFAULT: Wifi = { ssid: "", password: "", security: "WPA", onReceipts: true, onTables: true };

export function wifiSettings(): Wifi {
  try { return { ...DEFAULT, ...JSON.parse(getSetting("wifi") ?? "{}") }; } catch { return DEFAULT; }
}
export function saveWifi(b: Record<string, unknown>): Wifi | { error: string } {
  const security = b.security === "WEP" || b.security === "nopass" ? b.security : "WPA";
  const w: Wifi = { ssid: cleanText(b.ssid, 32), password: String(b.password ?? "").slice(0, 63), security, onReceipts: !!b.onReceipts, onTables: !!b.onTables };
  if (w.ssid && security !== "nopass" && w.password.length < 8 && security === "WPA") return { error: "WPA passwords are at least 8 characters." };
  setSetting("wifi", JSON.stringify(w));
  return w;
}

/** The standard Wi-Fi QR text (phones join when they scan it) */
const esc = (s: string) => s.replace(/([\;,:"])/g, "\\$1");
export const wifiText = (w: Wifi) => `WIFI:T:${w.security};S:${esc(w.ssid)};${w.security === "nopass" ? "" : `P:${esc(w.password)};`};`;

export const wifiQrSvg = (w: Wifi) => QRCode.toString(wifiText(w), { type: "svg", margin: 1, color: { dark: "#3b2720", light: "#ffffff" } });
export const wifiQrPng = (w: Wifi) => QRCode.toBuffer(wifiText(w), { type: "png", margin: 1, width: 220, color: { dark: "#3b2720", light: "#ffffff" } });
