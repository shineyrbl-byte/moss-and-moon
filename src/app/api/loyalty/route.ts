import { db, cleanPhone } from "@/lib/db";
import { STAMPS_FOR_REWARD } from "@/lib/cafe";
import { limited, tooMany } from "@/lib/rateLimit";

// Look up a stamp card by phone number: ?phone=9876543210
export async function GET(req: Request) {
  if (limited(req, "loyalty", 40, 600000)) return tooMany();
  const phone = cleanPhone(new URL(req.url).searchParams.get("phone"));
  if (phone.length !== 10) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  const row = db.prepare("SELECT name, stamps, rewards_used FROM loyalty WHERE phone = ?").get(phone) as
    | { name: string; stamps: number; rewards_used: number }
    | undefined;
  return Response.json({
    found: !!row,
    // Only the first letter: anyone can type any phone number here, so don't reveal who it belongs to
    name: row?.name ? `${row.name.trim()[0]?.toUpperCase() ?? ""}.` : null,
    stamps: row?.stamps ?? 0,
    rewardsUsed: row?.rewards_used ?? 0,
    needed: STAMPS_FOR_REWARD,
    hasReward: (row?.stamps ?? 0) >= STAMPS_FOR_REWARD,
  });
}
