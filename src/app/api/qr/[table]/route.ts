import QRCode from "qrcode";
import { TABLE_COUNT } from "@/lib/cafe";
import { origin } from "@/lib/site";

// QR code (SVG) that opens the menu for one table, e.g. /api/qr/5
export async function GET(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const n = Math.floor(Number((await params).table));
  if (!(n >= 1 && n <= TABLE_COUNT)) return new Response("Unknown table", { status: 404 });
  const svg = await QRCode.toString(`${origin(req)}/t/${n}`, { type: "svg", margin: 1, color: { dark: "#3b2720", light: "#00000000" } });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
}
