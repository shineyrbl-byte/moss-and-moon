// Every daily puzzle maker: fast enough to run on each request, and a different puzzle every day.
// Finds them by name (any exported xxxFor(date) in src/lib), so new games are checked without listing them here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The budget catches hangs (one day of Menu threads once took minutes), not ordinary slow days; CI machines are slower than laptops
const DAYS = 30, BUDGET_MS = Number(process.env.GEN_BUDGET_MS) || 2000;
// Makers that aren't one-a-day puzzles, or that only run on some days
const SKIP = new Set(["huntFor", "levelFor", "promptFor", "weeklyFor", "codeFor"]);
const dates = [...Array(DAYS).keys()].map((k) => new Date(Date.UTC(2026, 10, 1 + k)).toISOString().slice(0, 10));

const files = fs.readdirSync("src/lib").filter((f) => f.endsWith(".ts") && !fs.readFileSync(`src/lib/${f}`, "utf8").includes('import "server-only"'));
for (const f of files) {
  const src = fs.readFileSync(`src/lib/${f}`, "utf8");
  const names = [...src.matchAll(/export function ([a-zA-Z]+For)\(date: string\)/g)].map((m) => m[1]).filter((n) => !SKIP.has(n));
  if (!names.length) continue;
  test(`daily puzzle makers in ${f}`, async () => {
    const mod = (await import(`../src/lib/${f}`)) as Record<string, (d: string) => unknown>;
    for (const name of names) {
      const keys: string[] = [];
      let slowest = 0;
      for (const d of dates) {
        const t = performance.now(), out = mod[name](d);
        slowest = Math.max(slowest, performance.now() - t);
        assert.deepEqual(mod[name](d), out, `${name}: the same day gives the same puzzle`);
        keys.push(JSON.stringify(out));
      }
      // A repeat is only allowed as a full rotation of a fixed list: every puzzle once, then round again in the same order
      const first = keys.findIndex((k, i) => keys.indexOf(k) !== i);
      if (first >= 0) {
        const period = first - keys.indexOf(keys[first]);
        assert.ok(period >= 7, `${name}: ${dates[first]} repeats the puzzle from ${period} day${period === 1 ? "" : "s"} before`);
        assert.equal(new Set(keys.slice(0, period)).size, period, `${name}: a repeat before the list has gone round`);
        for (let i = period; i < keys.length; i++) assert.equal(keys[i], keys[i - period], `${name}: ${dates[i]} breaks the rotation`);
      }
      assert.ok(slowest < BUDGET_MS, `${name} took ${Math.round(slowest)}ms on its slowest day (budget ${BUDGET_MS}ms)`);
    }
  });
}
