import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const g = globalThis as { __mmJobsPoked?: number };

/** On Vercel nothing runs between requests, so visits nudge the background jobs (at most every 30s per server) */
function pokeJobs(req: NextRequest, event: NextFetchEvent) {
  if (!process.env.VERCEL || req.nextUrl.pathname === "/api/cron") return;
  const now = Date.now();
  if (now - (g.__mmJobsPoked ?? 0) < 30_000) return;
  g.__mmJobsPoked = now;
  const headers: Record<string, string> = process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
  event.waitUntil(fetch(new URL("/api/cron", req.url), { headers }).catch(() => {}));
}

// Runs before every API request. Anything that changes data (POST, PATCH, PUT, DELETE)
// must come from this site's own pages, so another website can't make a visitor's
// browser place orders or change settings behind their back.
export function proxy(req: NextRequest, event: NextFetchEvent) {
  pokeJobs(req, event);
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return NextResponse.next();
  const origin = req.headers.get("origin");
  if (!origin) return NextResponse.next(); // not from a browser page (e.g. our own tests)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return NextResponse.next();
  } catch {}
  return NextResponse.json({ error: "Requests must come from the Moss & Moon site." }, { status: 403 });
}

export const config = { matcher: "/api/:path*" };
