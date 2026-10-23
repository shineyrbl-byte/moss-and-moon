import { isOwner } from "@/lib/auth";
import { adventFor } from "@/lib/advent";

// The calendar. ?preview=1 opens every door, for the owner only.
export async function GET(req: Request) {
  const preview = new URL(req.url).searchParams.get("preview") === "1" && (await isOwner());
  return Response.json(adventFor(new Date(), preview));
}
