"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type Art = { id: number; staff_name: string; img: string; caption: string; votes: number };
type Week = { week: string; entries: Art[]; mine: number | null; lastWinner: Art | null };
const nice = (d: string) => new Date(`${d}T12:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function LatteArt() {
  const { toast } = useStore();
  const [w, setW] = useState<Week | null>(null);
  useEffect(() => { fetch(`/api/latte-art?voter=${voterId()}`).then((r) => r.json()).then(setW).catch(() => {}); }, []);
  async function vote(id: number) {
    const r = await fetch("/api/latte-art", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setW(d); toast("Vote in ☕ You can change it until Sunday.");
  }
  if (!w) return <div className="page"><p className="muted">Pouring…</p></div>;
  const sunday = new Date(Date.parse(`${w.week}T12:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10);
  return (
    <div className="page" style={{ maxWidth: "56rem" }}>
      <p className="eyebrow">from behind the counter</p>
      <h1 className="h2">Latte art <em>of the week</em></h1>
      <p className="lead">Our baristas post their best pours. Pick your favourite: one vote a week, and the winner goes up on the screen by the counter.</p>
      {w.lastWinner && (
        <section className="card latte-winner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={w.lastWinner.img} alt={`Last week's winning latte art by ${w.lastWinner.staff_name}`} />
          <div><span className="tiny muted">🏆 Last week&apos;s winner</span><b>{w.lastWinner.staff_name}</b>{w.lastWinner.caption && <span className="small">&ldquo;{w.lastWinner.caption}&rdquo;</span>}<span className="small muted">{w.lastWinner.votes} vote{w.lastWinner.votes === 1 ? "" : "s"}</span></div>
        </section>
      )}
      <h2 className="h3" style={{ marginTop: "1.4rem" }}>This week <span className="muted small">· voting closes {nice(sunday)}</span></h2>
      {w.entries.length ? (
        <ul className="latte-grid">
          {w.entries.map((a) => (
            <li key={a.id} className={`card latte-card ${w.mine === a.id ? "mine" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.img} alt={`Latte art by ${a.staff_name}${a.caption ? `: ${a.caption}` : ""}`} loading="lazy" />
              <span className="sum-row" style={{ alignItems: "center" }}>
                <span className="small"><b>{a.staff_name}</b>{a.caption && <span className="muted"> · {a.caption}</span>}</span>
                <button className={`chip ${w.mine === a.id ? "on" : ""}`} aria-pressed={w.mine === a.id} onClick={() => vote(a.id)}>{w.mine === a.id ? "♥ Your pick" : "Vote"} · {a.votes}</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="card muted center" style={{ padding: "1.4rem" }}>No pours posted yet this week ☕ Check back after the morning rush.</p>}
    </div>
  );
}
