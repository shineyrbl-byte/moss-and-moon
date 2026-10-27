"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type Spot = { id: number; photo: string; answer: string; wrong: string; note: string };

/** Owner: photos for "Where in Goa?" (one is shown a day, going round the list) */
export function GoaSpotsCard() {
  const { toast } = useStore();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/goa-spots?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSpots(d.spots)).catch(() => {});
  useEffect(() => { void load(); }, []);
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true);
    const form = new FormData(e.currentTarget);
    const r = await fetch("/api/goa-spots", { method: "POST", body: form });
    const d = await r.json(); setBusy(false);
    if (!r.ok) return toast(d.error);
    setSpots(d.spots); (e.target as HTMLFormElement).reset(); toast("Photo added 🌴");
  }
  async function remove(id: number) {
    const r = await fetch("/api/goa-spots", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (r.ok) setSpots((await r.json()).spots);
  }
  return (
    <section className="card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem" }}>
      <h2 className="h3" style={{ marginTop: 0 }}>🌴 Where in Goa?</h2>
      <p className="small muted">Your own photos of places around Goa for the daily guessing game. One shows a day, going round the list. Use photos you took (or have the rights to), and make sure the answer is right.</p>
      <form onSubmit={add} className="row" style={{ flexWrap: "wrap", alignItems: "end", gap: "0.5rem" }}>
        <label className="field small" style={{ maxWidth: "14rem" }}>Photo<input className="input" type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
        <label className="field small" style={{ maxWidth: "12rem" }}>Where it is<input className="input" name="answer" maxLength={60} required placeholder="Fontainhas, Panjim" /></label>
        {[1, 2, 3].map((k) => <label key={k} className="field small" style={{ maxWidth: "10rem" }}>Wrong answer {k}<input className="input" name={`wrong${k}`} maxLength={60} required /></label>)}
        <label className="field small" style={{ maxWidth: "18rem" }}>A note for after (optional)<input className="input" name="note" maxLength={200} placeholder="The old Latin quarter, all painted houses" /></label>
        <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy}>{busy ? "Uploading…" : "Add it"}</button>
      </form>
      {spots.length > 0 ? (
        <ul className="check-list">
          {spots.map((s) => (
            <li key={s.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.photo} alt="" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 6, marginRight: 8, verticalAlign: "middle" }} />
              <b>{s.answer}</b> <span className="tiny muted">vs {(JSON.parse(s.wrong) as string[]).join(", ")}</span>
              <button className="link-btn tiny" onClick={() => remove(s.id)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : <p className="small muted">No photos yet: the game says &quot;check back soon&quot; until you add one.</p>}
    </section>
  );
}
