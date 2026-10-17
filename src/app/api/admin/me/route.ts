import { currentStaff } from "@/lib/auth";

// Who's signed in on the staff side (or 401)
export async function GET() {
  const s = await currentStaff();
  if (!s) return Response.json({ error: "Please log in as staff." }, { status: 401 });
  return Response.json(s);
}
