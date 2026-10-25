"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { toDateStr } from "@/lib/cafe";
import { SHOUT_DAYS_AHEAD, SHOUT_IDEAS, SHOUT_MAX } from "@/lib/shoutouts";

export default function ShoutOuts() {
  const { toast } = useStore();
  const [today, setToday] = useState<{ id: number; text: string; from_name: string }[] | null>(null);
  const [f, setF] = useState({ date: "", text: "", from: "" });
  const [busy, setBusy] = useState(false);
  const [min, setMin] = useState(""), [max, setMax] = useState("");
  useEffect(() => {
    const d = new Date(); setMin(toDateStr(d)); setF((x) => ({ ...x, date: toDateStr(d) }));
    setMax(toDateStr(new Date(Date.now() + SHOUT_DAYS_AHEAD * 86400_000)));
    fetch("/api/shoutouts").then((r) => r.json()).then((x) => setToday(x.shouts)).catch(() => setToday([]));
  }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/shoutouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setF({ ...f, text: "" });
    toast("🎉 Got it! Once we've had a look, it'll be on the screen that day.");
  }
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">make someone&apos;s day</p>
      <h1 className="h2">Shout-<em>outs</em></h1>
      <p className="lead">Birthday, anniversary, new job, just because: put a message on the big screen by the counter, on the day you choose. Bring them in for a coffee and watch their face.</p>
      <form className="card kind-form" onSubmit={send}>
        <label className="field">Your message<input className="input" maxLength={SHOUT_MAX} required value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder={SHOUT_IDEAS[0]} /></label>
        <span className="tiny muted">{f.text.length}/{SHOUT_MAX} · e.g. {SHOUT_IDEAS.slice(1).join(" · ")}</span>
        <div className="row" style={{ alignItems: "end", flexWrap: "wrap" }}>
          <label className="field" style={{ maxWidth: "11rem" }}>Show it on<input className="input" type="date" required min={min} max={max} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="field" style={{ maxWidth: "11rem" }}>From <span className="muted small">· optional</span><input className="input" maxLength={20} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy || f.text.trim().length < 5}>{busy ? "Sending…" : "Send it 🎉"}</button>
        </div>
        <span className="tiny muted">We read every one before it goes up. It shows all day, taking turns with any others.</span>
      </form>
      {today && today.length > 0 && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">On the screen today</h2>
          <ul className="story-list">{today.map((s) => <li key={s.id} className="card shout-card">🎉 {s.text}{s.from_name && <span className="tiny muted"> · from {s.from_name}</span>}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
