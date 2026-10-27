import { ownerGate } from "@/lib/auth";
import { tidyUp } from "@/lib/tidyUp";

// Owner: clear out old rows now (it also runs by itself once a day). Says how many of each went.
export async function POST() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ removed: tidyUp() });
}
