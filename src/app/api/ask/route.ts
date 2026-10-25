import { currentStaff, isAdmin, unauthorized } from "@/lib/auth";
import { answered, answerQuestion, askQuestion, questionsForStaff } from "@/lib/askStore";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// Answered questions (?all=1 for staff: everything, waiting ones first)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ questions: questionsForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ questions: answered() }, { headers: { "Cache-Control": "no-store" } });
}

// Guests: { q, name? }
export async function POST(req: Request) {
  if (limited(req, "ask", 5, 3600_000)) return tooMany();
  const r = askQuestion((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "💬 A guest asked a question", "Answer it and it joins the FAQ", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, answer } or { id, remove: true }
export async function PATCH(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const r = answerQuestion((await req.json().catch(() => null)) ?? {}, me.id === 0 ? "" : me.name);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
