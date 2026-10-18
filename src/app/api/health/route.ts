import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// For uptime checks: is the server up and can it read the database?
export async function GET() {
  try {
    db.prepare("SELECT 1").get();
    return Response.json({ ok: true, uptime: Math.round(process.uptime()) });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
