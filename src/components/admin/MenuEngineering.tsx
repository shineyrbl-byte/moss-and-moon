"use client";
import { useEffect, useMemo, useState } from "react";
import { rupees } from "@/lib/pricing";

type Item = { name: string; cat: string; qty: number; revenue: number; cost: number };
type Group = "star" | "plowhorse" | "puzzle" | "dog";
const GROUPS: Record<Group, { label: string; icon: string; tip: string }> = {
  star: { label: "Stars", icon: "⭐", tip: "Popular and profitable. Keep them exactly as they are and put them first on the menu." },
  plowhorse: { label: "Plowhorses", icon: "🐴", tip: "Popular but thin margins. Try a small price rise, a smaller portion or a cheaper ingredient." },
  puzzle: { label: "Puzzles", icon: "🧩", tip: "Profitable but rarely ordered. Move them up the menu, rename them, or suggest them at the counter." },
  dog: { label: "Dogs", icon: "🐶", tip: "Neither popular nor profitable. Rework them, or take them off to keep the menu tidy." },
};

/** Owner: menu engineering — every item by how often it sells and how much it makes per sale */
export default function MenuEngineering() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [tab, setTab] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/profit?days=30").then((r) => r.json()).then((d) => setItems((d.items as Item[]).filter((i) => i.qty > 0 && i.cat !== "shop"))).catch(() => {});
  }, []);
  const data = useMemo(() => {
    if (!items || items.length < 4) return null;
    const total = items.reduce((s, i) => s + i.qty, 0);
    // Popular = sells at least 70% of an equal share; profitable = earns more per sale than the average sale
    const popLine = (total / items.length) * 0.7;
    const avgMargin = items.reduce((s, i) => s + (i.revenue - i.cost), 0) / total;
    const rows = items.map((i) => {
      const margin = (i.revenue - i.cost) / i.qty;
      const group: Group = i.qty >= popLine ? (margin >= avgMargin ? "star" : "plowhorse") : margin >= avgMargin ? "puzzle" : "dog";
      return { ...i, margin, group };
    });
    return { rows, popLine, avgMargin, maxQ: Math.max(...rows.map((r) => r.qty)), maxM: Math.max(...rows.map((r) => r.margin)), minM: Math.min(0, ...rows.map((r) => r.margin)) };
  }, [items]);
  if (!items) return null;
  if (!data) return <section className="card viz-card"><h3>🧭 Menu engineering</h3><p className="small muted">Needs at least four items sold in the last 30 days.</p></section>;

  const W = 560, H = 300, P = 36;
  const x = (q: number) => P + (q / data.maxQ) * (W - P * 1.5);
  const y = (m: number) => H - P - ((m - data.minM) / (data.maxM - data.minM || 1)) * (H - P * 1.5);
  const hovered = data.rows.find((r) => r.name === hover);

  return (
    <section className="card viz-card viz-root">
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3>🧭 Menu engineering</h3>
        <button className="link-btn small" onClick={() => setTab(tab === "chart" ? "table" : "chart")}>{tab === "chart" ? "Show as table" : "Show as chart"}</button>
      </div>
      <p className="small muted">The last 30 days. Across: how many sold. Up: profit per sale after ingredient costs. Lines show the average.</p>
      {tab === "chart" ? (
        <div className="me-chart">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Menu items by popularity and profit per sale">
            <rect x={x(data.popLine)} y={P / 2} width={W - P / 2 - x(data.popLine)} height={y(data.avgMargin) - P / 2} className="me-zone" />
            <line x1={x(data.popLine)} x2={x(data.popLine)} y1={P / 2} y2={H - P} className="me-axis" />
            <line x1={P} x2={W - P / 2} y1={y(data.avgMargin)} y2={y(data.avgMargin)} className="me-axis" />
            <line x1={P} x2={W - P / 2} y1={H - P} y2={H - P} className="me-base" />
            <text x={W - P / 2} y={P / 2 + 12} textAnchor="end" className="me-q">⭐ Stars</text>
            <text x={P + 4} y={P / 2 + 12} className="me-q">🧩 Puzzles</text>
            <text x={W - P / 2} y={H - P - 6} textAnchor="end" className="me-q">🐴 Plowhorses</text>
            <text x={P + 4} y={H - P - 6} className="me-q">🐶 Dogs</text>
            <text x={W / 2} y={H - 8} textAnchor="middle" className="me-label">sold →</text>
            <text x={10} y={H / 2} transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle" className="me-label">profit per sale →</text>
            {data.rows.map((r) => (
              <g key={r.name} onMouseEnter={() => setHover(r.name)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r.name)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${r.name}: ${r.qty} sold, ${rupees(Math.round(r.margin))} profit each, ${GROUPS[r.group].label}`}>
                <circle cx={x(r.qty)} cy={y(r.margin)} r={12} fill="transparent" />
                <circle cx={x(r.qty)} cy={y(r.margin)} r={hover === r.name ? 6 : 4.5} className={`me-dot ${r.group}`} />
              </g>
            ))}
          </svg>
          {hovered && <div className="me-tip" role="status"><b>{hovered.name}</b> · {GROUPS[hovered.group].icon} {GROUPS[hovered.group].label}<br />{hovered.qty} sold · {rupees(Math.round(hovered.margin))} profit each</div>}
        </div>
      ) : (
        <div className="rota-wrap">
          <table className="rota" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Item</th><th scope="col">Sold</th><th scope="col">Profit each</th><th scope="col">Group</th></tr></thead>
            <tbody>{[...data.rows].sort((a, b) => b.qty - a.qty).map((r) => <tr key={r.name}><th scope="row">{r.name}</th><td>{r.qty}</td><td>{rupees(Math.round(r.margin))}</td><td>{GROUPS[r.group].icon} {GROUPS[r.group].label}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="me-groups">
        {(Object.keys(GROUPS) as Group[]).map((g) => {
          const list = data.rows.filter((r) => r.group === g).sort((a, b) => b.qty - a.qty);
          return (
            <div key={g} className={`me-group ${g}`}>
              <b>{GROUPS[g].icon} {GROUPS[g].label} <span className="muted">· {list.length}</span></b>
              <p className="tiny muted">{GROUPS[g].tip}</p>
              <p className="small">{list.length ? list.slice(0, 6).map((r) => r.name).join(", ") + (list.length > 6 ? ` +${list.length - 6} more` : "") : "None"}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
