"use client";
import { useEffect, useState } from "react";
import { fmt, scaleLine, scaleMakes, SCALES } from "@/lib/scale";

/** "You'll need", with a size picker and tick-off shopping list (ticks remembered on this device) */
export default function RecipeScaler({ id, makes, ingredients }: { id: string; makes: string; ingredients: string[] }) {
  const key = `mm-recipe-${id}`;
  const [k, setK] = useState(1);
  const [got, setGot] = useState<number[]>([]);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(key) ?? "null"); if (s) { setK(SCALES.includes(s.k) ? s.k : 1); setGot(s.got ?? []); } } catch {} }, [key]);
  const save = (nk: number, ng: number[]) => { setK(nk); setGot(ng); try { localStorage.setItem(key, JSON.stringify({ k: nk, got: ng })); } catch {} };
  const lines = ingredients.map((i) => scaleLine(i, k));
  async function copy() {
    const text = `${scaleMakes(makes, k)}:\n${lines.filter((_, i) => !got.includes(i)).map((l) => `- ${l}`).join("\n")}`;
    try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch {}
  }
  return (
    <>
      <h2 className="h3">You&apos;ll need</h2>
      <div className="scale-row" role="radiogroup" aria-label="How much to make">
        {SCALES.map((s) => <button key={s} role="radio" aria-checked={k === s} className={`chip ${k === s ? "on" : ""}`} onClick={() => save(s, got)}>{fmt(s)}×</button>)}
      </div>
      <p className="tiny muted" style={{ margin: "0.2rem 0 0.4rem" }}>Makes {scaleMakes(makes, k).replace(/^./, (c) => c.toLowerCase())}. Tick things off as you shop.</p>
      <ul className="shop-list">
        {lines.map((l, i) => {
          const on = got.includes(i);
          return <li key={i}><label className={on ? "on" : ""}><input type="checkbox" checked={on} onChange={() => save(k, on ? got.filter((x) => x !== i) : [...got, i])} /> <span>{l}</span></label></li>;
        })}
      </ul>
      <span className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
        <button className="link-btn tiny" onClick={copy}>📋 Copy what&apos;s left</button>
        {got.length > 0 && <button className="link-btn tiny" onClick={() => save(k, [])}>Untick all</button>}
      </span>
    </>
  );
}
