import { currentStaff, unauthorized } from "@/lib/auth";
import { QUIZ_PASS, gradeQuiz, makeQuiz } from "@/lib/training";

// Staff: a new recipe quiz
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json({ questions: makeQuiz(), pass: QUIZ_PASS });
}

// Staff: hand it in ({ answers: [{ key, choice }] })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const answers = Array.isArray(b?.answers) ? b.answers.map((a: { key?: unknown; choice?: unknown }) => ({ key: String(a?.key ?? ""), choice: String(a?.choice ?? "") })) : [];
  if (!answers.length) return Response.json({ error: "Answer the questions first." }, { status: 400 });
  return Response.json(gradeQuiz(me.id, answers));
}
