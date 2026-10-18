import { ownerGate } from "@/lib/auth";
import { cleanText } from "@/lib/db";
import { draftPost } from "@/lib/posts";
import { limited, tooMany } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  if (limited(req, "post-draft", 10, 600_000)) return tooMany();
  const b = await req.json().catch(() => null);
  return Response.json(await draftPost(cleanText(b?.idea, 300)));
}
