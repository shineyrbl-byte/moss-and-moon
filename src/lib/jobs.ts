// Background jobs, started once when the server boots (see instrumentation.ts)
import "server-only";
import { demoTick } from "./orderFlow";
import { summaryTick } from "./summary";
import { backupTick } from "./backup";
import { reportError } from "./errors";
import { reviewTick } from "./reviewRequests";
import { weeklyTick } from "./insights";

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
    every(5 * 60_000, "review requests", () => reviewTick()),
    every(5 * 60_000, "weekly report", () => weeklyTick()),
  ];
}
