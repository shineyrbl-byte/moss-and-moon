"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/components/Store";
import { CAFE_SPOT, FROM_AFAR, MAP_SIZE, ORIGINS, coastPath, project } from "@/lib/origins";
import { defaultOptions, rupees } from "@/lib/pricing";

export default function Origins() {
  const { menu, add, toast } = useStore();
  const [sel, setSel] = useState(ORIGINS[0].id);
  const o = ORIGINS.find((x) => x.id === sel)!;
  const cafe = project(CAFE_SPOT.lat, CAFE_SPOT.lon);
  const items = o.usedIn.map((id) => menu.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m && !m.hidden);

  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">bean to cup</p>
      <h1 className="h2">Where our <em>coffee</em> comes from</h1>
      <p className="lead">Almost all our beans grow in the hills of South India, a day&apos;s drive from Goa. Tap a place to find out more, and collect a stamp for each one in your <Link href="/passport" className="link-btn">origins passport</Link> 🛂</p>

      <div className="origins">
        <svg viewBox={`0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}`} className="origins-map" role="group" aria-label="Map of South India with our coffee regions">
          <defs>
            <linearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--bg)" stopOpacity="1" /><stop offset="0.14" stopColor="var(--bg)" stopOpacity="0" /></linearGradient>
          </defs>
          <path d={coastPath()} className="land" />
          <rect x="0" y="0" width={MAP_SIZE.w} height={MAP_SIZE.h} fill="url(#fadeTop)" pointerEvents="none" />
          {ORIGINS.map((x) => { const p = project(x.lat, x.lon); return <path key={`l-${x.id}`} d={`M${cafe.x},${cafe.y} Q${(cafe.x + p.x) / 2 + 20},${(cafe.y + p.y) / 2 - 20} ${p.x},${p.y}`} className={`route ${x.id === sel ? "on" : ""}`} />; })}
          <g className="cafe-spot" transform={`translate(${cafe.x},${cafe.y})`}><circle r="7" /><text x="-10" y="4" textAnchor="end">☾ us</text></g>
          {ORIGINS.map((x) => {
            const p = project(x.lat, x.lon);
            const pos = { left: { x: -10, y: 4, a: "end" }, right: { x: 10, y: 4, a: "start" }, above: { x: 0, y: -11, a: "middle" }, aboveRight: { x: 2, y: -10, a: "start" }, below: { x: 0, y: 19, a: "middle" } }[x.label];
            return (
              <g key={x.id} transform={`translate(${p.x},${p.y})`} className={`origin-pin ${x.id === sel ? "on" : ""}`} role="button" tabIndex={0} aria-pressed={x.id === sel} aria-label={`${x.name}, ${x.state}`}
                onClick={() => setSel(x.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(x.id))}>
                <circle r="14" className="hit" />
                <circle r={x.id === sel ? 7 : 5.5} className="dot" />
                <text x={pos.x} y={pos.y} textAnchor={pos.a as "start" | "middle" | "end"}>{x.name}</text>
              </g>
            );
          })}
        </svg>

        <section className="card origin-card" aria-live="polite">
          <p className="eyebrow" style={{ margin: 0 }}>{o.state} · {o.altitude}</p>
          <h2 className="h3">{o.name}</h2>
          <p><b>Tastes like:</b> {o.taste}</p>
          <p className="small">{o.story}</p>
          {items.length > 0 && (
            <>
              <h3 className="small" style={{ marginTop: "0.8rem" }}>In your cup</h3>
              <ul className="check-list">
                {items.map((m) => (
                  <li key={m.id}>
                    <span style={{ flex: 1 }}>{m.name} <span className="muted small">{rupees(m.price)}</span></span>
                    <button className="btn btn-ghost btn-sm" disabled={!!m.soldOut} onClick={() => { add(m.id, defaultOptions(m), 1); toast(`${m.name} added ✿`); }}>+ Add</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="chips" style={{ justifyContent: "flex-start", marginTop: "0.8rem" }}>
            {ORIGINS.map((x) => <button key={x.id} className={`chip ${x.id === sel ? "on" : ""}`} onClick={() => setSel(x.id)}>{x.name}</button>)}
          </div>
        </section>
      </div>

      <h2 className="h3" style={{ marginTop: "2rem" }}>From further away</h2>
      <ul className="afar">
        {FROM_AFAR.map((f) => (
          <li key={f.what} className="card"><b>{f.what}</b><span className="muted small">{f.where}</span><span className="small">for {f.for}</span></li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: "1rem" }}>The map is a sketch, not to scale. <Link href="/brew">Brew some at home →</Link></p>
    </div>
  );
}
