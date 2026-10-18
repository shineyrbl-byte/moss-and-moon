/** The site's public address (works behind Railway's proxy too) */
export function origin(req: Request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * The visitor's IP address. Railway's proxy sets X-Real-IP; otherwise use the LAST
 * X-Forwarded-For entry (the one our proxy added). The first entry can be faked by anyone.
 */
export function clientIp(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return fwd?.length ? fwd[fwd.length - 1] : "local";
}
