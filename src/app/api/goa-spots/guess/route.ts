import { checkGuess } from "@/lib/goaSpots";
import { limited, tooMany } from "@/lib/rateLimit";

// { id, guess }: right or not, and the answer
export async function POST(req: Request) {
  if (limited(req, "goa-guess", 60, 3600_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  const r = checkGuess(b.id, b.guess);
  return Response.json(r, { status: "error" in r ? 404 : 200 });
}
