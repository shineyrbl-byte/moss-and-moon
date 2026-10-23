import { makePostcard } from "@/lib/postcards";
import { limited, tooMany } from "@/lib/rateLimit";

// Make a postcard ({ design, from, to, message, gift? })
export async function POST(req: Request) {
  if (limited(req, "postcard", 15, 3600_000)) return tooMany();
  const r = makePostcard((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
