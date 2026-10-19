"use client";
import { useState } from "react";
import { useStore } from "./Store";

const PLACES = ["At the counter", "Outside, by the door", "In my car outside"];

/** Order page: "I'm here" so staff can bring it out */
export default function ImHere({ code, arrived, note: saved, onDone }: { code: string; arrived: string | null; note: string | null; onDone: () => void }) {
  const { toast, t } = useStore();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(PLACES[1]);
  const [extra, setExtra] = useState("");
  if (arrived) return <p className="reward-banner small">👋 We know you&apos;re here{saved ? ` (${saved})` : ""}. We&apos;ll bring it out as soon as it&apos;s ready.</p>;
  async function send() {
    const r = await fetch(`/api/orders/${code}/here`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: [note, extra.trim()].filter(Boolean).join(": ") }) });
    if (!r.ok) return toast((await r.json()).error);
    toast("Thanks! We'll bring it to you 🌸");
    onDone();
  }
  if (!open) return <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>{t("order.here")}</button>;
  return (
    <div className="card" style={{ padding: "0.9rem 1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <b>Where are you?</b>
      <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="Where are you">
        {PLACES.map((p) => <button key={p} role="radio" aria-checked={note === p} className={`chip ${note === p ? "on" : ""}`} onClick={() => setNote(p)}>{p}</button>)}
      </div>
      <input className="input" maxLength={40} placeholder={note.includes("car") ? "Car colour or number" : "Anything to help us find you (optional)"} aria-label="More detail" value={extra} onChange={(e) => setExtra(e.target.value)} />
      <div className="row"><button className="btn btn-pink btn-sm" onClick={send}>Tell the team</button><button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </div>
  );
}
