import { isAdmin, unauthorized } from "@/lib/auth";
import { wifiQrSvg, wifiSettings } from "@/lib/wifi";

// Staff: the Wi-Fi QR code (for printing on table cards)
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const w = wifiSettings();
  if (!w.ssid) return new Response("No Wi-Fi set", { status: 404 });
  return new Response(await wifiQrSvg(w), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store" } });
}
