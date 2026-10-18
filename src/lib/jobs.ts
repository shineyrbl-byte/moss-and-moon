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

const g = globalThis as { __mmJobs?: NodeJS.Timeout[] };

function every(ms: number, name: string, fn: () => unknown) {
  const t = setInterval(async () => {
    try {
      await fn();
    } catch (e) {
      console.error(`Background job "${name}" failed`, e);
      reportError("job", `${name}: ${e instanceof Error ? e.message : String(e)}`, e instanceof Error ? e.stack ?? "" : "");
    }
  }, ms);
  t.unref?.();
  return t;
}

export function startJobs() {
  if (g.__mmJobs) return;
  g.__mmJobs = [
    every(15_000, "demo barista", () => demoTick()),
    every(60_000, "nightly summary", () => summaryTick()),
    every(60_000, "backups", () => backupTick()),
    every(60_000, "review requests", () => reviewTick()),
    every(5 * 60_000, "weekly report", () => weeklyTick()),
    every(20_000, "regular orders", () => scheduleTick()),
    every(30_000, "reminders", () => reminderTick()),
    every(20_000, "newsletter", () => newsletterTick()),
    every(5 * 60_000, "auto clock-out", () => autoClockOut()),
    every(10 * 60_000, "supplier reorders", () => reorderTick()),
    every(20_000, "booking pre-orders", () => preorderTick()),
    every(10 * 60_000, "bean subscriptions", () => subsTick()),
    every(60 * 60_000, "we miss you emails", () => winbackTick()),
    every(3 * 60_000, "back in stock emails", () => stockAlertTick()),
    every(60_000, "unpaid deposits", () => depositTick()),
    every(60 * 60_000, "anniversary emails", () => anniversaryTick()),
    every(20_000, "orders for tomorrow", () => laterTick()),
  ];
}
