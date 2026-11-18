import { runDueJobs } from "@/lib/jobs";

// Runs the background jobs that are due (used on Vercel, where nothing runs between requests).
// Called by Vercel's daily cron, the GitHub "jobs" workflow, and by the site itself as people visit.
// If CRON_SECRET is set, callers must send it as "Authorization: Bearer <secret>".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { ran, ms } = await runDueJobs();
  return Response.json({ ok: true, ran, ms });
}
