import { slideBoard, submitSlide } from "@/lib/slideStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's quickest times (?mode=easy|hard&voter=)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return Response.json(slideBoard(q.get("mode"), q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { mode, ms, moves, name, voter }
export async function POST(req: Request) {
  if (limited(req, "slide", 60, 3600_000)) return tooMany();
  const r = submitSlide((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
