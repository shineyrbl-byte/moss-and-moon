"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { showDaily } from "@/lib/scoreFormat";

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

type DG = { id: string; title: string; emoji: string; href: string; views: number; saves: number; players: number; finish: number | null; median: number | null; hidden: boolean };
type Report = { days: number; daily: DG[]; hard: { id: string; title: string; emoji: string; date: string; players: number; median: number; ratio: number }[]; anyTime: { id: string; title: string; emoji: string; href: string; views: number; hidden: boolean }[]; perDay: { date: string; n: number }[]; totals: { saves: number; players: number } };

/** Owner: which games get played, where people give up, the hardest days, and hiding a game from the lists */
export function GamesDashboard() {
  const { toast } = useStore();
  const [days, setDays] = useState(30);
  const [r, setR] = useState<Report | null>(null);
  const [all, setAll] = useState(false);
  const load = (d = days) => fetch(`/api/admin/games?days=${d}`).then((x) => (x.ok ? x.json() : null)).then((d) => d && setR(d)).catch(() => {});
  useEffect(() => { void load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  async function hide(id: string, title: string, h: boolean) {
    const x = await fetch("/api/admin/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, hide: h }) });
    if (!x.ok) return toast((await x.json()).error);
    toast(h ? `${title} is hidden from the games lists` : `${title} is back in the lists`); void load();
  }
  if (!r) return <section className="card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem" }}><p className="muted">Counting the plays…</p></section>;
  const max = Math.max(1, ...r.perDay.map((d) => d.n));
  const list = all ? r.daily : r.daily.slice(0, 15);
  return (
    <section className="card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.4rem" }}>
        <h2 className="h3" style={{ margin: 0 }}>🎮 Games dashboard</h2>
        <div className="row" style={{ gap: "0.3rem" }} role="group" aria-label="Time range">{[7, 30, 90].map((d) => <button key={d} className={`chip ${days === d ? "on" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>)}</div>
      </div>
      <p className="small muted">From page visits and saved scores only. <b>Finish rate</b> is saved scores divided by visits to that game&apos;s page, so a low one means people open it and leave (it can read high if people replay or visit from the archive). Visits only count browsers that allow it.</p>
      <p className="memory-stats" style={{ display: "flex", flexWrap: "wrap" }}><span><b>{r.totals.saves}</b> daily scores saved</span><span><b>{r.totals.players}</b> players</span></p>
      {r.perDay.length > 1 && (
        <div className="gd-spark" role="img" aria-label={`Scores saved per day, from ${r.perDay[0].n} to ${r.perDay[r.perDay.length - 1].n}`}>
          {r.perDay.map((d) => <span key={d.date} title={`${d.date}: ${d.n}`} style={{ height: `${Math.max(4, (d.n / max) * 100)}%` }} />)}
        </div>
      )}
      <div className="st-table-wrap"><table className="st-table">
        <caption className="sr-only">Daily games, most played first</caption>
        <thead><tr><th scope="col">Daily game</th><th scope="col">Saved</th><th scope="col">Players</th><th scope="col">Visits</th><th scope="col">Finish rate</th><th scope="col">Typical score</th><th scope="col"><span className="sr-only">Show or hide</span></th></tr></thead>
        <tbody>{list.map((g) => (
          <tr key={g.id} style={g.hidden ? { opacity: 0.6 } : undefined}>
            <th scope="row"><a href={g.href}>{g.emoji} {g.title}</a>{g.hidden && <span className="tiny muted"> · hidden</span>}</th>
            <td>{g.saves}</td><td>{g.players}</td><td>{g.views}</td>
            <td>{g.finish === null ? <span className="muted">—</span> : <span className={g.finish < 0.3 && g.views >= 20 ? "gd-low" : ""}>{Math.round(g.finish * 100)}%</span>}</td>
            <td>{g.median === null ? <span className="muted">—</span> : showDaily(g.id, g.median)}</td>
            <td><button className="link-btn tiny" onClick={() => hide(g.id, g.title, !g.hidden)}>{g.hidden ? "Show" : "Hide"}</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      {r.daily.length > 15 && <button className="link-btn small" onClick={() => setAll(!all)}>{all ? "Show the top 15" : `Show all ${r.daily.length}`}</button>}
      <h3 className="h3" style={{ fontSize: "1.05rem", marginTop: "1rem" }}>Hardest days</h3>
      {r.hard.length ? <ul className="small">{r.hard.map((h) => <li key={h.id + h.date}>{h.emoji} {h.title} on {h.date}: typical {showDaily(h.id, h.median)}, {Math.round((h.ratio - 1) * 100)}% slower than usual ({h.players} players)</li>)}</ul>
        : <p className="small muted">Nothing stands out yet. A day shows here once at least three people saved it and it went noticeably slower than usual.</p>}
      <h3 className="h3" style={{ fontSize: "1.05rem", marginTop: "1rem" }}>Any-time games by visits</h3>
      <ul className="small gd-any">{r.anyTime.slice(0, all ? undefined : 12).map((g) => <li key={g.id} style={g.hidden ? { opacity: 0.6 } : undefined}><a href={g.href}>{g.emoji} {g.title}</a> · {g.views}{g.hidden ? " · hidden" : ""} <button className="link-btn tiny" onClick={() => hide(g.id, g.title, !g.hidden)}>{g.hidden ? "Show" : "Hide"}</button></li>)}</ul>
      <p className="tiny muted">Hiding takes a game off the games page and out of Today&apos;s five from today. Its page still works by link, scores are kept, and past streaks don&apos;t change. Before retiring a game for good, give it a few weeks of numbers here.</p>
    </section>
  );
}
