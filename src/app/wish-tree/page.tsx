"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { RIBBONS, WISH_MAX, ribbonSpot } from "@/lib/wishes";

type Tree = { since: number; nextFull: number; wishes: { id: number; colour: number; text?: string; name?: string }[]; total: number; letGo: number };
const MINE = "mm-wishes";
const readMine = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(MINE) ?? "{}"); } catch { return {}; } };

export default function WishTree() {
  const { toast } = useStore();
  const [tree, setTree] = useState<Tree | null>(null);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [f, setF] = useState({ text: "", name: "", colour: 0 });
  const [busy, setBusy] = useState(false);
  const [showing, setShowing] = useState<number | null>(null);
  useEffect(() => { setMine(readMine()); fetch("/api/wishes").then((r) => r.json()).then(setTree).catch(() => {}); }, []);
  async function tie(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/wishes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't work. Try again?");
    const m = { ...readMine(), [d.id]: f.text };
    try { localStorage.setItem(MINE, JSON.stringify(m)); } catch {}
    setMine(m); setTree(d.tree); setShowing(d.id); setF({ ...f, text: "" });
    toast("🎀 Tied to the tree");
  }
  if (!tree) return <div className="page narrow"><p className="muted">Walking out to the tree…</p></div>;
  const next = new Date(tree.nextFull).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const shown = tree.wishes.find((w) => w.id === showing);
  const shownText = shown ? shown.text ?? mine[shown.id] : undefined;
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">🌕 next full moon: {next}</p>
      <h1 className="h2">The wish <em>tree</em></h1>
      <p className="lead">Tie a little wish to the tree. On the next full moon it lets every wish go, and starts again with bare branches.</p>
      <figure className="card wish-tree">
        <svg viewBox="0 0 400 300" role="img" aria-label={`The wish tree with ${tree.wishes.length} wish${tree.wishes.length === 1 ? "" : "es"} on it`}>
          <path className="wish-trunk" d="M190,300 C192,240 186,200 196,160 L204,160 C214,200 208,240 210,300 Z" />
          <g className="wish-branches">
            <path d="M198,175 C160,150 120,140 85,118" /><path d="M200,165 C180,120 160,100 138,82" /><path d="M200,160 C200,120 200,95 200,66" />
            <path d="M202,165 C222,120 240,100 262,82" /><path d="M202,175 C240,150 280,140 315,118" /><path d="M199,185 C170,170 140,160 118,150" /><path d="M201,185 C230,170 260,160 282,150" />
          </g>
          <g className="wish-leaves">{[[85, 110, 30], [140, 75, 34], [200, 58, 36], [262, 75, 34], [315, 110, 30], [118, 145, 24], [282, 145, 24]].map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}</g>
          {tree.wishes.map((w, i) => {
            const { x, y } = ribbonSpot(i);
            return (
              <g key={w.id} className={`wish-ribbon ${showing === w.id ? "on" : ""}`} transform={`translate(${x} ${y})`} onClick={() => setShowing(w.id)} role="button" tabIndex={0} aria-label={`Wish ${i + 1}`} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowing(w.id)}>
                <path d="M0,0 q-4,10 -1,22 l4,-3 l3,4 q2,-12 -1,-23 Z" fill={RIBBONS[w.colour] ?? RIBBONS[0]} />
                <circle r="2.5" fill="#3b2a24" />
              </g>
            );
          })}
        </svg>
        <figcaption className="small center">{tree.wishes.length ? `${tree.wishes.length} wish${tree.wishes.length === 1 ? "" : "es"} on the tree` : "Bare branches. Be the first to tie one."} · {tree.total} held since we planted it{tree.letGo ? `, ${tree.letGo} already let go` : ""}</figcaption>
      </figure>
      {shown && (
        <p className="card wish-read" aria-live="polite">
          {shownText ? <>🎀 &ldquo;{shownText}&rdquo;{shown.text && shown.name ? <span className="muted"> · {shown.name}</span> : ""}{!shown.text && <span className="tiny muted"><br />Your wish. Others will see the words once we&apos;ve had a look.</span>}</> : <span className="muted">🎀 A wish, kept quiet for now.</span>}
        </p>
      )}
      <form className="card wish-form" onSubmit={tie}>
        <label className="field">Your wish<input className="input" maxLength={WISH_MAX} required value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="I wish for a calm month and more beach mornings" /></label>
        <div className="row" style={{ alignItems: "end", flexWrap: "wrap" }}>
          <label className="field" style={{ maxWidth: "12rem" }}>Name <span className="muted small">· optional</span><input className="input" maxLength={20} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <span className="ribbon-pick" role="radiogroup" aria-label="Ribbon colour">
            {RIBBONS.map((c, i) => <button type="button" key={c} role="radio" aria-checked={f.colour === i} aria-label={`Ribbon colour ${i + 1}`} className={`crayon ${f.colour === i ? "on" : ""}`} style={{ background: c }} onClick={() => setF({ ...f, colour: i })} />)}
          </span>
          <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy || f.text.trim().length < 3}>{busy ? "Tying…" : "🎀 Tie it on"}</button>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>Other people see the words once we&apos;ve had a look. Leave out anything private.</p>
      </form>
    </div>
  );
}
