import { endSession } from "@/lib/account";

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
