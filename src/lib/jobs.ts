// Background jobs, started once when the server boots (see instrumentation.ts)
import "server-only";
import { demoTick } from "./orderFlow";
import { summaryTick } from "./summary";
import { backupTick } from "./backup";
import { reportError } from "./errors";
import { reviewTick } from "./reviewRequests";
import { weeklyTick } from "./insights";
import { scheduleTick } from "./schedules";
import { reminderTick } from "./reminders";
import { newsletterTick } from "./newsletter";
import { autoClockOut } from "./timesheets";
import { reorderTick } from "./reorders";
import { preorderTick } from "./preorders";
import { subsTick } from "./beanSubs";
import { winbackTick } from "./winback";
import { stockAlertTick } from "./missed";
import { depositTick } from "./deposits";
import { anniversaryTick } from "./anniversary";
import { laterTick } from "./laterOrders";
import { simTick } from "./simulate";
import { gameReminderTick } from "./gameReminders";
import { tidyTick } from "./tidyUp";
import { monthlyTick } from "./monthlyReport";

const g = globalThis as { __mmJobs?: NodeJS.Timeout[]; __mmLastRun?: Map<string, number>; __mmRunning?: boolean };

/** Every background job: how often it runs, its name, and what it does */
const JOBS: [ms: number, name: string, fn: () => unknown][] = [
  [15_000, "demo barista", () => demoTick()],
  [60_000, "nightly summary", () => summaryTick()],
  [60_000, "backups", () => backupTick()],
  [60_000, "review requests", () => reviewTick()],
  [5 * 60_000, "weekly report", () => weeklyTick()],
  [20_000, "regular orders", () => scheduleTick()],
  [30_000, "reminders", () => reminderTick()],
  [20_000, "newsletter", () => newsletterTick()],
  [5 * 60_000, "auto clock-out", () => autoClockOut()],
  [10 * 60_000, "supplier reorders", () => reorderTick()],
  [20_000, "booking pre-orders", () => preorderTick()],
  [10 * 60_000, "bean subscriptions", () => subsTick()],
  [60 * 60_000, "we miss you emails", () => winbackTick()],
  [3 * 60_000, "back in stock emails", () => stockAlertTick()],
  [60_000, "unpaid deposits", () => depositTick()],
  [60 * 60_000, "anniversary emails", () => anniversaryTick()],
  [20_000, "orders for tomorrow", () => laterTick()],
  [10_000, "a day in the life", () => simTick()],
  [60_000, "puzzle reminders", () => gameReminderTick()],
  [60 * 60_000, "tidy up old rows", () => tidyTick()],
  [10 * 60_000, "monthly report", () => monthlyTick()],
];

async function runJob(name: string, fn: () => unknown) {
  try {
    await fn();
  } catch (e) {
    console.error(`Background job "${name}" failed`, e);
    reportError("job", `${name}: ${e instanceof Error ? e.message : String(e)}`, e instanceof Error ? e.stack ?? "" : "");
  }
}

/** Is this a host where the server only runs while answering a request (Vercel)? Then timers can't be trusted. */
export const serverless = () => !!process.env.VERCEL;

/** On a normal server: run each job on its own timer */
export function startJobs() {
  if (g.__mmJobs || serverless()) return;
  g.__mmJobs = JOBS.map(([ms, name, fn]) => {
    const t = setInterval(() => runJob(name, fn), ms);
    t.unref?.();
    return t;
  });
}

/**
 * On serverless hosts: run every job whose time has come since it last ran here. Called by /api/cron,
 * which visits and a schedule both trigger. Each job checks the database itself before doing anything
 * once-a-day, so running one a little early or twice is harmless.
 */
export async function runDueJobs(now = Date.now()) {
  if (g.__mmRunning) return { ran: [] as string[] };
  g.__mmRunning = true;
  const last = (g.__mmLastRun ??= new Map());
  const ran: string[] = [];
  try {
    for (const [ms, name, fn] of JOBS) {
      if (now - (last.get(name) ?? 0) < ms) continue;
      last.set(name, now);
      await runJob(name, fn);
      ran.push(name);
    }
  } finally {
    g.__mmRunning = false;
  }
  return { ran };
}
