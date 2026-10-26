"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type P = { id: string; hints: string[]; out: boolean };
type B = { id: string; title: string; author: string; out: boolean };
const KEY = "mm-unwrapped";

export default function BlindDate() {
  const { toast } = useStore();
  const [parcels, setParcels] = useState<P[] | null>(null);
  const [open, setOpen] = useState<Record<string, B>>({});
  useEffect(() => {
    fetch("/api/blind-date").then((r) => r.json()).then((d) => setParcels(d.parcels ?? [])).catch(() => setParcels([]));
    try { setOpen(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch {}
  }, []);
  async function unwrap(p: P) {
    const r = await fetch("/api/blind-date", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
    if (!r.ok) return toast("That one's been taken off the shelf.");
    const b = (await r.json()) as B;
    const next = { ...open, [p.id]: b };
    setOpen(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }
  return (
    <div className="page" style={{ maxWidth: "56rem" }}>
      <p className="eyebrow">don&apos;t judge a book by its cover</p>
      <h1 className="h2">Blind date with a <em>book</em></h1>
      <p className="lead">Our shelf books, wrapped in brown paper with three hints. Pick the one that sounds like you, unwrap it, then ask for it at the counter.</p>
      <div className="parcels">
        {parcels?.map((p, i) => {
          const b = open[p.id];
          return (
            <article key={p.id} className={`parcel ${b ? "open" : ""}`} style={{ ["--tilt" as string]: `${((i * 53) % 5) - 2}deg` }}>
              {!b ? (
                <>
                  <span className="parcel-tag">No. {i + 1}</span>
                  <ul>{p.hints.map((h) => <li key={h}>{h}</li>)}</ul>
                  <button className="btn btn-ghost btn-sm" onClick={() => unwrap(p)}>Unwrap it</button>
                </>
              ) : (
                <>
                  <span className="parcel-tag">It&apos;s…</span>
                  <h2 className="h3" style={{ margin: "0.3rem 0 0" }}>{b.title}</h2>
                  {b.author && <span className="small">{b.author}</span>}
                  <p className="tiny" style={{ margin: "0.6rem 0 0" }}>{p.out ? "📕 Someone's reading it right now. Ask us to keep it for you." : "📗 On the shelf. Ask for it at the counter."}</p>
                </>
              )}
            </article>
          );
        })}
        {parcels?.length === 0 && <p className="muted">Nothing wrapped right now. Check back soon ✿</p>}
      </div>
      <p className="small" style={{ marginTop: "1.2rem" }}><Link href="/book-club">📚 This month&apos;s book club →</Link> · <Link href="/shelf">Everything on the shelf</Link></p>
    </div>
  );
}
