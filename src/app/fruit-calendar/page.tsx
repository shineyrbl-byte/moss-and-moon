"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { comingNext, dishesWith, FRUITS, inSeason, MONTHS } from "@/lib/fruits";
import { itemName } from "@/lib/menu";
import { defaultOptions } from "@/lib/pricing";

export default function FruitCalendar() {
  const { menu, lang, add, toast } = useStore();
  const [month, setMonth] = useState(0);
  useEffect(() => { setMonth(new Date().getMonth() + 1); }, []);
  if (!month) return <div className="page"><p className="muted">Checking the market…</p></div>;
  const now = new Date().getMonth() + 1;
  const here = inSeason(month), next = comingNext(month);
  return (
    <div className="page" style={{ maxWidth: "52rem" }}>
      <p className="eyebrow">what&apos;s ripe</p>
      <h1 className="h2">Goa <em>fruit</em> calendar</h1>
      <p className="lead">What&apos;s in season around Goa, month by month, and what we make with it. Pick a month to see what&apos;s ripe.</p>
      <div className="fruit-months" role="radiogroup" aria-label="Month">
        {MONTHS.map((m, i) => <button key={m} role="radio" aria-checked={month === i + 1} className={`chip ${month === i + 1 ? "on" : ""}`} onClick={() => setMonth(i + 1)}>{m}{i + 1 === now ? " ·" : ""}</button>)}
      </div>
      <ul className="fruit-list">
        {here.map((f) => {
          const dishes = dishesWith(f, menu);
          return (
            <li key={f.id} className="card fruit-card">
              <span className="fruit-emoji" aria-hidden="true">{f.emoji}</span>
              <div>
                <b>{f.name}</b>{f.months.length === 12 && <span className="tiny muted"> · all year</span>}
                <p className="small muted" style={{ margin: "0.1rem 0 0.4rem" }}>{f.note}</p>
                {dishes.length > 0 ? (
                  <span className="fruit-dishes">{dishes.map((d) => <button key={d.id} className="chip" onClick={() => { add(d.id, defaultOptions(d), 1); toast(`${itemName(d, lang)} added ${f.emoji}`); }}>+ {itemName(d, lang)} · ₹{d.price}</button>)}</span>
                ) : <span className="tiny muted">Nothing on our menu with it yet.</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {next.length > 0 && <p className="small">Coming in {MONTHS[month % 12]}: {next.map((f) => `${f.emoji} ${f.name}`).join(", ")}</p>}
      <h2 className="h3" style={{ marginTop: "1.6rem" }}>The whole year</h2>
      <div className="fruit-table-wrap">
        <table className="fruit-table">
          <thead><tr><th scope="col">Fruit</th>{MONTHS.map((m, i) => <th key={m} scope="col" className={i + 1 === month ? "on" : ""}>{m.slice(0, 1)}<span className="sr-only">{m.slice(1)}</span></th>)}</tr></thead>
          <tbody>
            {FRUITS.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.emoji} {f.name}</th>
                {MONTHS.map((m, i) => <td key={m} className={`${f.months.includes(i + 1) ? "in" : ""} ${i + 1 === month ? "on" : ""}`}>{f.months.includes(i + 1) ? <span className="sr-only">in season</span> : null}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ marginTop: "0.8rem" }}>Seasons shift a little with the rains each year. Full menu on the <Link href="/#menu">home page</Link>.</p>
    </div>
  );
}
