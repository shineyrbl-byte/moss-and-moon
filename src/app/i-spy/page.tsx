"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "mm-ispy";

export default function ISpy() {
  const [items, setItems] = useState<string[] | null>(null);
  const [got, setGot] = useState<string[]>([]);
  const [name, setName] = useState("");
  useEffect(() => {
    fetch("/api/ispy").then((r) => r.json()).then((d) => setItems(d.items)).catch(() => setItems([]));
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (s) { setGot(s.got ?? []); setName(s.name ?? ""); } } catch {}
  }, []);
  const save = (g: string[], n = name) => { setGot(g); try { localStorage.setItem(KEY, JSON.stringify({ got: g, name: n })); } catch {} };
  if (!items) return <div className="page"><p className="muted">Looking around…</p></div>;
  const ticked = items.filter((i) => got.includes(i));
  const all = items.length > 0 && ticked.length === items.length;
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="page ispy-page" style={{ maxWidth: "40rem" }}>
      <div className="no-print">
        <p className="eyebrow">for little explorers</p>
        <h1 className="h2">I <em>spy</em></h1>
        <p className="lead">Can you find all of these around the café? Tap each one when you spot it. Find them all and you&apos;ll get a certificate to print.</p>
        <p className="small"><b>{ticked.length}</b> of {items.length} spotted</p>
        <ul className="ispy-list">
          {items.map((i) => {
            const on = got.includes(i);
            return <li key={i}><button className={`ispy-item ${on ? "on" : ""}`} aria-pressed={on} onClick={() => save(on ? got.filter((x) => x !== i) : [...got, i])}><span className="ispy-box" aria-hidden="true">{on ? "✓" : ""}</span>{i}</button></li>;
          })}
        </ul>
        <div className="row" style={{ justifyContent: "center", gap: "0.4rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
          {got.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => save([])}>Start again</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨 Print the list</button>
          <Link className="btn btn-ghost btn-sm" href="/colouring">🖍 Colouring pages</Link>
        </div>
      </div>
      {all && (
        <section className="ispy-cert" aria-live="polite">
          <span className="ispy-star" aria-hidden="true">🌙</span>
          <p className="eyebrow">Moss &amp; Moon</p>
          <h2 className="h2">Café <em>explorer</em></h2>
          <p>This is to say that</p>
          <label className="field no-print" style={{ maxWidth: "16rem", margin: "0 auto" }}>Explorer&apos;s name<input className="input" maxLength={30} value={name} onChange={(e) => { setName(e.target.value); save(got, e.target.value); }} placeholder="Your name" /></label>
          <p className="ispy-name print-only">{name || "_______________"}</p>
          <p>found all {items.length} things in the café, with very sharp eyes.</p>
          <p className="small muted">{today}</p>
          <button className="btn btn-pink btn-sm no-print" onClick={() => window.print()}>🖨 Print my certificate</button>
        </section>
      )}
      <ol className="print-only ispy-print">{!all && items.map((i) => <li key={i}>☐ {i}</li>)}</ol>
    </div>
  );
}
