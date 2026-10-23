import { getMenu } from "@/lib/menuStore";
import { allFound } from "@/lib/secret";
import { limited, tooMany } from "@/lib/rateLimit";

// { found: [moon ids] } → the secret menu, once all five moons are found
export async function POST(req: Request) {
  if (limited(req, "secret", 60, 3600_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  if (!allFound(b.found)) return Response.json({ error: "Keep looking ✿ There are more moons hidden around the site." }, { status: 403 });
  return Response.json({ items: getMenu({ includeSecret: true }).filter((m) => m.secret) });
}
