import { memoryBoard, submitMemory } from "@/lib/memoryStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's quickest times (?mode=easy|full&voter=)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return Response.json(memoryBoard(q.get("mode"), q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { mode, ms, moves, name, voter }
export async function POST(req: Request) {
  if (limited(req, "memory", 60, 3600_000)) return tooMany();
  const r = submitMemory((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
