import { NextResponse, type NextRequest } from "next/server";

// Runs before every API request. Anything that changes data (POST, PATCH, PUT, DELETE)
// must come from this site's own pages, so another website can't make a visitor's
// browser place orders or change settings behind their back.
export function proxy(req: NextRequest) {
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
