import { currentStaff, unauthorized } from "@/lib/auth";
import { noShowStats } from "@/lib/deposits";

// Staff: bookings that didn't turn up in the last 30 days
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json(noShowStats());
}
