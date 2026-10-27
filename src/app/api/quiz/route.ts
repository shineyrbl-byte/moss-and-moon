import { isAdmin, unauthorized } from "@/lib/auth";
import { answerQuiz, hostQuiz, joinQuiz, quizSeason, quizState } from "@/lib/quizStore";
import { limited, tooMany } from "@/lib/rateLimit";

// The quiz on now (?voter=; staff can add ?host=1 to see the answer while a question is open), or ?season=1 for the standings
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("season") === "1") return Response.json(quizSeason(), { headers: { "Cache-Control": "no-store" } });
  const staff = q.get("host") === "1" && (await isAdmin());
  return Response.json(quizState(q.get("voter"), staff), { headers: { "Cache-Control": "no-store" } });
}

// Guests: { action: "join", name, voter } or { action: "answer", choice, voter }
export async function POST(req: Request) {
  if (limited(req, "quiz", 200, 3600_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  const r = b.action === "join" ? joinQuiz(b) : b.action === "answer" ? answerQuiz(b) : { error: "Join or answer?" };
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { action: "start" | "next" | "end", title?, size? }
export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const r = hostQuiz((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
