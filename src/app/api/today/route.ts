import { todayStats } from "@/lib/today";

export async function GET() {
  return Response.json(todayStats(), { headers: { "Cache-Control": "public, max-age=60" } });
}
