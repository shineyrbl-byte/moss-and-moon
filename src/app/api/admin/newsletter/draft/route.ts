import { ownerGate } from "@/lib/auth";
import { cleanText } from "@/lib/db";
import { draft } from "@/lib/newsletter";
import { limited, tooMany } from "@/lib/rateLimit";

// Owner: a first draft from an idea
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  if (limited(req, "newsletter-draft", 10, 600_000)) return tooMany();
  const b = await req.json().catch(() => null);
  return Response.json(await draft(cleanText(b?.idea, 300)));
}
