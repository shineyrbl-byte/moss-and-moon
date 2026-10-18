import { pairings } from "@/lib/pairings";

// For each drink, the bake or dish people most often order with it
export async function GET() {
  return Response.json(pairings(), { headers: { "Cache-Control": "public, max-age=300" } });
}
