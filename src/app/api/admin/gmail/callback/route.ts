import { cookies } from "next/headers";
import { connect } from "@/lib/gmailApi";

// Google sends the owner back here after they allow sending.
// Only the owner can start the flow (the connect route), which sets a one-time state cookie;
// a matching state here proves this is that same flow.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const jar = await cookies();
  const expected = jar.get("mm_gmail_state")?.value;
  jar.delete("mm_gmail_state");

  let msg: string;
  if (p.get("error")) msg = `Google said: ${p.get("error")}`;
  else if (!expected || p.get("state") !== expected || !p.get("code")) msg = "That didn't match. Please try connecting again.";
  else {
    try {
      msg = `connected:${await connect(p.get("code")!)}`;
    } catch (e) {
      msg = e instanceof Error ? e.message : "Couldn't connect Gmail.";
    }
  }
  // Continue to the admin page from our own page, so the (strict) staff login cookie is sent again
  const to = `/admin?gmail=${encodeURIComponent(msg)}`;
  return new Response(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${to.replace(/"/g, "&quot;")}"><title>Moss & Moon</title><p style="font-family:sans-serif">Back to Moss &amp; Moon…</p>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
