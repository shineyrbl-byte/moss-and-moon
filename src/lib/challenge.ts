// Challenge links: your result on a daily puzzle, packed into the address so a friend can try to beat it. Pure.
export type Challenge = { n: string; s: number; h: string; d: string; m?: string };
export const CHALLENGE_PARAM = "vs";
export const challengeKey = (path: string) => `mm-vs:${path}`;

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export function encodeChallenge(c: Challenge) {
  return b64url(JSON.stringify({ n: c.n.slice(0, 20), s: c.s, h: c.h.slice(0, 120), d: c.d, ...(c.m ? { m: c.m.slice(0, 12) } : {}) }));
}
/** Read a challenge back; anything that doesn't look right is ignored */
export function decodeChallenge(raw: unknown): Challenge | null {
  if (typeof raw !== "string" || raw.length > 600 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const v = JSON.parse(unb64url(raw));
    if (typeof v?.n !== "string" || typeof v.h !== "string" || typeof v.d !== "string" || !Number.isFinite(v.s)) return null;
    if (!/^\d{4}-\d\d-\d\d$/.test(v.d) || v.m !== undefined && typeof v.m !== "string") return null;
    return { n: v.n.slice(0, 20).replace(/[<>]/g, "") || "A friend", s: v.s, h: v.h.slice(0, 120), d: v.d, ...(v.m ? { m: v.m.slice(0, 12) } : {}) };
  } catch { return null; }
}
/** Every daily board is lowest-first, so a lower stored score is better */
export const verdict = (mine: number, theirs: number): "win" | "lose" | "tie" => (mine < theirs ? "win" : mine > theirs ? "lose" : "tie");
