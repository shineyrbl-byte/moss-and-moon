import { publicTeam } from "@/lib/team";

export async function GET() {
  return Response.json({ team: publicTeam() });
}
