"use client";
import { useEffect, useMemo, useState } from "react";
import { rupees } from "@/lib/pricing";

type Item = { name: string; qty: number; revenue: number; cost: number };
/** Rough guess: a 10% price rise loses about 5% of sales of that item */
const ELASTICITY = -0.5;

/** Owner: "if I change this price, what happens to profit?" from the last 30 days */
export default function PriceWhatIf() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [pick, setPick] = useState("");
  const [price, setPrice] = useState("");
  const [sales, setSales] = useState<number | null>(null); // % change in how many sell; null = our guess
  useEffect(() => {
    fetch("/api/admin/profit?days=30").then((r) => r.json()).then((d) => {
      const list = (d.items as Item[]).filter((i) => i.qty > 0).sort((a, b) => b.qty - a.qty);
      setItems(list);
      if (list[0]) { setPick(list[0].name); setPrice(String(Math.round(list[0].revenue / list[0].qty) + 20)); }
    }).catch(() => {});
  }, []);
  const it = items?.find((i) => i.name === pick);
  const calc = useMemo(() => {
    if (!it) return null;
    const p = it.revenue / it.qty, c = it.cost / it.qty, np = Number(price) || 0;
    const priceChange = p ? (np - p) / p : 0;
    const salesChange = sales !== null ? sales / 100 : Math.max(-0.9, ELASTICITY * priceChange);
    const nq = it.qty * (1 + salesChange);
    const now = it.qty * (p - c), then = nq * (np - c);
    const breakEven = np > c && p > c ? 1 - (p - c) / (np - c) : null; // how many fewer could sell for the same profit
    return { p, c, np, priceChange, salesChange, nq, now, then, breakEven };
  }, [it, price, sales]);
  if (!items) return null;
  if (!items.length) return null;

  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
      <h3 style={{ fontSize: "1.2rem" }}>🧮 Price “what if”</h3>
      <p className="small muted">Try a new price on anything sold in the last 30 days and see what it does to that item&apos;s profit.</p>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field">Item
          <select className="input" value={pick} onChange={(e) => { setPick(e.target.value); const x = items.find((i) => i.name === e.target.value); if (x) setPrice(String(Math.round(x.revenue / x.qty) + 20)); setSales(null); }}>
            {items.map((i) => <option key={i.name} value={i.name}>{i.name} ({i.qty} sold)</option>)}
          </select>
        </label>
        <label className="field" style={{ maxWidth: "9rem" }}>New price (₹)<input className="input" inputMode="numeric" value={price} onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setSales(null); }} /></label>
      </div>
      {calc && (
        <>
          <label className="field" style={{ marginTop: "0.6rem" }}>
            <span>Sales would change by <b>{Math.round(calc.salesChange * 100)}%</b> <span className="muted small">{sales === null ? "· our guess, drag to change" : <button className="link-btn small" onClick={() => setSales(null)}>use our guess</button>}</span></span>
            <input type="range" min={-60} max={30} step={1} value={Math.round(calc.salesChange * 100)} onChange={(e) => setSales(Number(e.target.value))} aria-label="Change in sales, percent" />
          </label>
          <table className="rota pnl-table" style={{ minWidth: 0, marginTop: "0.6rem" }}>
            <thead><tr><th scope="col" /><th scope="col">Now</th><th scope="col">With {rupees(calc.np)}</th></tr></thead>
            <tbody>
              <tr><th scope="row">Average price</th><td>{rupees(Math.round(calc.p))}</td><td>{rupees(calc.np)}</td></tr>
              <tr><th scope="row">Cost to make</th><td>{rupees(Math.round(calc.c))}</td><td>{rupees(Math.round(calc.c))}</td></tr>
              <tr><th scope="row">Sold a month</th><td>{it!.qty}</td><td>{Math.round(calc.nq)}</td></tr>
              <tr className="pnl-total"><th scope="row">Profit a month</th><td>{rupees(Math.round(calc.now))}</td><td className={calc.then < calc.now ? "cashup-bad" : "success"}>{rupees(Math.round(calc.then))}</td></tr>
            </tbody>
          </table>
          <p className="small" style={{ marginTop: "0.5rem" }}>
            {calc.then >= calc.now ? `About ${rupees(Math.round(calc.then - calc.now))} more a month.` : `About ${rupees(Math.round(calc.now - calc.then))} less a month.`}
            {calc.breakEven !== null && calc.np > calc.p && ` You could sell up to ${Math.round(calc.breakEven * 100)}% fewer and still make the same.`}
          </p>
          <p className="tiny muted">Sales guesses are rough. Change the price for real in the Menu tab.</p>
        </>
      )}
    </section>
  );
}
