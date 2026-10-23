import { currentCustomer } from "@/lib/account";
import { answerTrivia, triviaToday } from "@/lib/triviaStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's question (?voter= a random id kept in the browser, when not signed in). The answer comes once you've answered.
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(triviaToday(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { choice, voter? }
export async function POST(req: Request) {
  if (limited(req, "trivia", 30, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = answerTrivia(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
