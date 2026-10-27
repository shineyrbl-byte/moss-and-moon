"use client";
import { useState } from "react";
import { showDaily } from "@/lib/scoreFormat";

type Pt = { date: string; ms: number };
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** One puzzle's times over the last couple of months: a single line, quicker at the top, with a hover readout
 * and the numbers as a table underneath for anyone who'd rather read them */
export default function TimeChart({ game, points }: { game: string; points: Pt[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 200, L = 52, R = 12, T = 12, B = 28;
  const lo = Math.min(...points.map((p) => p.ms)), hi = Math.max(...points.map((p) => p.ms));
  const pad = Math.max(1000, (hi - lo) * 0.12), y0 = Math.max(0, lo - pad), y1 = hi + pad;
  // Quicker is better, so quicker times sit higher up
  const y = (ms: number) => T + ((ms - y0) / (y1 - y0)) * (H - T - B);
  const t0 = Date.parse(points[0].date), t1 = Math.max(t0 + 86400_000, Date.parse(points[points.length - 1].date));
  const x = (d: string) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R);
  const ticks = [y0 + (y1 - y0) * 0.1, (y0 + y1) / 2, y1 - (y1 - y0) * 0.1];
  const best = points.reduce((a, p) => (p.ms < a.ms ? p : a));
  const h = hover !== null ? points[hover] : null;
  return (
    <figure className="tc">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Your times over ${points.length} days, best ${showDaily(game, best.ms)} on ${nice(best.date)}`} onPointerLeave={() => setHover(null)}>
        {ticks.map((v, k) => <g key={k}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="tc-grid" /><text x={L - 6} y={y(v) + 4} textAnchor="end" className="tc-axis">{showDaily(game, v).split(",")[0]}</text></g>)}
        <text x={L} y={H - 8} className="tc-axis">{nice(points[0].date)}</text>
        <text x={W - R} y={H - 8} textAnchor="end" className="tc-axis">{nice(points[points.length - 1].date)}</text>
        <text x={4} y={T + 4} className="tc-axis">quicker ↑</text>
        <polyline points={points.map((p) => `${x(p.date)},${y(p.ms)}`).join(" ")} className="tc-line" />
        {points.map((p, k) => (
          <g key={p.date}>
            {/* A big invisible target so it's easy to hover or tap */}
            <circle cx={x(p.date)} cy={y(p.ms)} r={12} className="tc-hit" onPointerEnter={() => setHover(k)} onClick={() => setHover(k)} />
            <circle cx={x(p.date)} cy={y(p.ms)} r={p === best ? 5.5 : 4} className={`tc-dot ${p === best ? "best" : ""} ${hover === k ? "on" : ""}`} />
          </g>
        ))}
        {h && <g className="tc-tip" transform={`translate(${Math.min(W - 130, Math.max(L, x(h.date) - 60))},${Math.max(2, y(h.ms) - 38)})`}><rect width={120} height={28} rx={6} /><text x={60} y={18} textAnchor="middle">{nice(h.date)}: {showDaily(game, h.ms)}</text></g>}
      </svg>
      <figcaption className="tiny muted">Best: <b>{showDaily(game, best.ms)}</b> on {nice(best.date)}. The bigger dot is your best.</figcaption>
      <details className="tc-table"><summary className="tiny">See the numbers</summary>
        <table><thead><tr><th scope="col">Day</th><th scope="col">Time</th></tr></thead><tbody>{[...points].reverse().map((p) => <tr key={p.date}><td>{nice(p.date)}</td><td>{showDaily(game, p.ms)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}
