import QRCode from "qrcode";
import { db } from "@/lib/db";
import { origin } from "@/lib/site";

// QR code that opens the gift page (to show at the counter)
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  if (!db.prepare("SELECT 1 FROM drink_gifts WHERE code = ? AND paid = 1").get(code)) return new Response("Unknown gift", { status: 404 });
  const svg = await QRCode.toString(`${origin(req)}/d/${code}`, { type: "svg", margin: 1, color: { dark: "#3b2720", light: "#ffffff" } });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" } });
}
