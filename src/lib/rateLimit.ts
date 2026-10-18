// Simple in-memory rate limits (one server process, so a Map is enough)
import { clientIp } from "./site";

const buckets = new Map<string, number[]>();

/** true if this visitor has done `name` more than `max` times in the last `windowMs` */
// Automated tests send everything from one address, so they raise the limits
const SCALE = Math.max(1, Number(process.env.RATE_LIMIT_SCALE) || 1);

export function limited(req: Request, name: string, max: number, windowMs: number) {
  const key = `${name}:${clientIp(req)}`;
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 20_000) buckets.clear(); // never grows without bound
  return recent.length > max * SCALE;
}

export const tooMany = (msg = "Slow down a little ☕ Try again in a few minutes.") => Response.json({ error: msg }, { status: 429 });

/** Rate-limit a handler: wraps a route function */
export function withLimit<A extends unknown[]>(name: string, max: number, windowMs: number, fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A) => (limited(req, name, max, windowMs) ? tooMany() : fn(req, ...rest));
}
