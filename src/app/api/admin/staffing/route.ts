import { currentStaff, unauthorized } from "@/lib/auth";
import { parseDate } from "@/lib/cafe";
import { weekStart } from "@/lib/rota";
import { staffingWeek } from "@/lib/staffing";

// Staff: people needed vs people on the rota, hour by hour (?week=any day in the week)
export async function GET(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const q = new URL(req.url).searchParams.get("week");
  return Response.json(staffingWeek(weekStart(q && parseDate(q) ? new Date(q + "T12:00") : new Date())));
}
