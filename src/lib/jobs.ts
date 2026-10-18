// Background jobs, started once when the server boots (see instrumentation.ts)
import "server-only";
import { demoTick } from "./orderFlow";
import { summaryTick } from "./summary";

const g = globalThis as { __mmJobs?: NodeJS.Timeout[] };

function every(ms: number, name: string, fn: () => unknown) {
  const t = setInterval(async () => {
    try { await fn(); } catch (e) { console.error(`Background job "${name}" failed`, e); }
  }, ms);
  t.unref?.();
  return t;
}

export function startJobs() {
  if (g.__mmJobs) return;
  g.__mmJobs = [
    every(15_000, "demo barista", () => demoTick()),
    every(60_000, "nightly summary", () => summaryTick()),
  ];
}
