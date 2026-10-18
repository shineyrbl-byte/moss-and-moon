import { unsubscribe } from "@/lib/newsletter";

const page = (msg: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moss & Moon</title>
     <body style="font-family:Georgia,serif;background:#f6eee7;color:#3b2720;display:grid;place-items:center;min-height:90vh;text-align:center;padding:16px">
     <div><h1 style="font-weight:normal">${msg}</h1><p style="font-family:Helvetica,Arial,sans-serif"><a href="/" style="color:#a8455f">Back to Moss &amp; Moon</a></p></div></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

// The link in every newsletter (and Gmail's one-click "Unsubscribe" button, which POSTs)
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  return unsubscribe(p.get("e") ?? "", p.get("t") ?? "") ? page("You're unsubscribed ✿ No more Pink Post emails.") : page("That link didn't work. Please try again from the latest email.");
}
export async function POST(req: Request) {
  const p = new URL(req.url).searchParams;
  return unsubscribe(p.get("e") ?? "", p.get("t") ?? "") ? new Response(null, { status: 204 }) : new Response(null, { status: 400 });
}
