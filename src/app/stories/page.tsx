"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { useStore } from "@/components/Store";
import { STORY_WORDS, storyWords } from "@/lib/stories";

type S = { id: number; text: string; name: string; hearts: number; mine: boolean };

export default function Stories() {
  const { toast } = useStore();
  const [list, setList] = useState<S[] | null>(null);
  const [week, setWeek] = useState<{ id: number; text: string; name: string; hearts: number } | null>(null);
  const [sort, setSort] = useState<"top" | "new">("top");
  const [f, setF] = useState({ text: "", name: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/stories?sort=${sort}&voter=${voterId()}`).then((r) => r.json()).then((d) => { setList(d.stories); setWeek(d.week); }).catch(() => setList([])); }, [sort]);
  const n = storyWords(f.text).length;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setF({ ...f, text: "" });
    toast("✍️ Lovely. It'll show here once we've read it.");
  }
  async function heart(s: S) {
    const r = await fetch("/api/stories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id, voter: voterId(), on: !s.mine }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setList((l) => l!.map((x) => (x.id === s.id ? { ...x, mine: !s.mine, hearts: d.hearts } : x)));
  }
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">write small</p>
      <h1 className="h2">Six-word <em>stories</em></h1>
      <p className="lead">A whole story in exactly six words. About coffee, the café, your week, anything. The week&apos;s favourite goes up on the screen by the counter.</p>
      {week && <blockquote className="card story-week"><span className="tiny muted">✨ Story of the week</span><p>{week.text}</p><span className="small muted">{week.name || "Anonymous"} · ♥ {week.hearts}</span></blockquote>}
      <form className="card story-form" onSubmit={send}>
        <label className="field">Your six words<input className="input" maxLength={120} required value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Ordered decaf. Regretted it. Ordered espresso." /></label>
        <span className={`story-count ${n === STORY_WORDS ? "ok" : ""}`} aria-live="polite">{n}/{STORY_WORDS} words{n === STORY_WORDS ? " ✓" : ""}</span>
        <div className="row" style={{ alignItems: "end", flexWrap: "wrap" }}>
          <label className="field" style={{ maxWidth: "12rem" }}>Name <span className="muted small">· optional</span><input className="input" maxLength={20} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy || n !== STORY_WORDS}>{busy ? "Sending…" : "Share it"}</button>
        </div>
      </form>
      <div className="row" style={{ gap: "0.4rem", margin: "1.2rem 0 0.6rem" }}>
        <button className={`chip ${sort === "top" ? "on" : ""}`} aria-pressed={sort === "top"} onClick={() => setSort("top")}>Most loved</button>
        <button className={`chip ${sort === "new" ? "on" : ""}`} aria-pressed={sort === "new"} onClick={() => setSort("new")}>Newest</button>
      </div>
      <ul className="story-list">
        {list?.map((s) => (
          <li key={s.id} className="card">
            <p className="story-text">{s.text}</p>
            <span className="sum-row" style={{ alignItems: "center" }}>
              <span className="tiny muted">{s.name || "Anonymous"}</span>
              <button className={`chip story-heart ${s.mine ? "on" : ""}`} aria-pressed={s.mine} aria-label={`${s.mine ? "Unheart" : "Heart"} this story`} onClick={() => heart(s)}>♥ {s.hearts}</button>
            </span>
          </li>
        ))}
        {list?.length === 0 && <li className="muted" style={{ listStyle: "none" }}>No stories yet. Six words. Go.</li>}
      </ul>
    </div>
  );
}
