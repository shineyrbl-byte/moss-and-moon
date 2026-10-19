import { currentWeather } from "@/lib/weather";

// The weather outside the café, for "what suits today" picks on the home page
export async function GET() {
  const w = await currentWeather();
  if (!w) return Response.json({ off: true });
  return Response.json(w, { headers: { "Cache-Control": "public, max-age=600" } });
}
