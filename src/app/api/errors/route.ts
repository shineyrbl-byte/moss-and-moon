import { reportError, recentErrors, clearErrors } from "@/lib/errors";
import { ownerGate } from "@/lib/auth";
import { cleanText } from "@/lib/db";
import { clientIp } from "@/lib/site";

// A few reports per visitor is plenty
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 10;
}

// Browsers report errors here (see components/ErrorReporter.tsx)
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (limited(ip)) return new Response(null, { status: 204 });
  const b = await req.json().catch(() => null);
  const message = cleanText(b?.message, 300);
  const stack = String(b?.stack ?? "").slice(0, 1500);
  // Errors from browser extensions and harmless browser noise aren't ours
  if (!message || /extension:\/\/|ResizeObserver loop|Script error\.?$|NotAllowedError|AbortError/.test(message + stack)) return new Response(null, { status: 204 });
  reportError("browser", message, `page: ${cleanText(b?.url, 200)}\nbrowser: ${(req.headers.get("user-agent") ?? "").slice(0, 160)}\n${stack}`);
  return new Response(null, { status: 204 });
}

// Owner: recent problems
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ errors: recentErrors() });
}

// Owner: clear the list once things are fixed
export async function DELETE() {
  const gate = await ownerGate();
  if (gate) return gate;
  clearErrors();
  return Response.json({ ok: true });
}
