import QRCode from "qrcode";
import { getTicket } from "@/lib/tickets";
import { origin } from "@/lib/site";

// QR code for the door: it opens the ticket page, where staff tap "Check in"
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const t = getTicket((await params).code);
  if (!t) return new Response("Unknown ticket", { status: 404 });
  const svg = await QRCode.toString(`${origin(req)}/ticket/${t.code}`, { type: "svg", margin: 1, color: { dark: "#3b2720", light: "#ffffff" } });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" } });
}
