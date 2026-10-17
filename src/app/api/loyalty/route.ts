import { db, cleanPhone } from "@/lib/db";
import { STAMPS_FOR_REWARD } from "@/lib/cafe";

// Look up a stamp card by phone number: ?phone=9876543210
export async function GET(req: Request) {
  const phone = cleanPhone(new URL(req.url).searchParams.get("phone"));
  if (phone.length !== 10) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  const row = db.prepare("SELECT name, stamps, rewards_used FROM loyalty WHERE phone = ?").get(phone) as
    | { name: string; stamps: number; rewards_used: number }
    | undefined;
  return Response.json({
    found: !!row,
    name: row?.name ?? null,
    stamps: row?.stamps ?? 0,
    rewardsUsed: row?.rewards_used ?? 0,
    needed: STAMPS_FOR_REWARD,
    hasReward: (row?.stamps ?? 0) >= STAMPS_FOR_REWARD,
  });
}
