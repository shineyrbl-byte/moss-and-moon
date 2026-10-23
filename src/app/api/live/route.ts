import { subscribe, type LiveEvent } from "@/lib/live";
import { isAdmin } from "@/lib/auth";
import { chatToken } from "@/lib/support";

export const dynamic = "force-dynamic";

// Server-Sent Events stream.
//   ?topic=order&code=MM-XXXX  → updates for one order (guests)
//   ?topic=board               → any order change (TV board, no details)
//   ?topic=group&code=GR-XXXX  → changes to one group order
//   ?topic=support&code=&token= → replies in one chat with the team (the guest who started it)
//   ?topic=staff               → everything (staff only)
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const topic = p.get("topic");
  const code = (p.get("code") ?? "").toUpperCase();
  if (topic === "staff" && !(await isAdmin())) return new Response("Please log in", { status: 401 });
  if (!["order", "board", "staff", "group", "support"].includes(topic ?? "")) return new Response("Unknown topic", { status: 400 });
  if (topic === "support" && chatToken(code) !== (p.get("token") ?? "-")) return new Response("Not found", { status: 404 });

  const wants = (e: LiveEvent) =>
    topic === "staff" ? e.type !== "group"
    : topic === "board" ? e.type === "order" || e.type === "song"
    : topic === "group" ? e.type === "group" && e.code === code
    : topic === "support" ? e.type === "support" && e.code === code
    : e.type === "order" && e.code === code;

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (s: string) => {
        try { controller.enqueue(enc.encode(s)); } catch { cleanup(); }
      };
      send("retry: 3000\n\n");
      const off = subscribe((e) => wants(e) && send(`data: ${JSON.stringify(topic === "board" ? { type: "order" } : e)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), 20_000); // keeps proxies from closing it
      cleanup = () => {
        off();
        clearInterval(ping);
        try { controller.close(); } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
