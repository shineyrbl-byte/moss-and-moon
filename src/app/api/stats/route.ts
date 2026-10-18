import { recordHit } from "@/lib/visitors";

// A page was viewed (sent by components/StatsBeacon.tsx). No cookies, no personal data kept.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (typeof b?.path === "string")
    recordHit({
      path: b.path,
      ref: typeof b.ref === "string" ? b.ref : "",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
      ua: req.headers.get("user-agent") ?? "",
      host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
    });
  return new Response(null, { status: 204 });
}
