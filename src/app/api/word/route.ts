import { currentCustomer } from "@/lib/account";
import { guessWord, wordToday } from "@/lib/wordStore";
import { limited, tooMany } from "@/lib/rateLimit";

// Today's board so far (?voter= a random id kept in the browser, when not signed in)
export async function GET(req: Request) {
  const me = await currentCustomer();
  return Response.json(wordToday(me?.id ?? null, new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { guess, voter? }
export async function POST(req: Request) {
  if (limited(req, "word", 60, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = guessWord(me?.id ?? null, (await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
