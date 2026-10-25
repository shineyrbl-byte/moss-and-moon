"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { CRAYONS } from "@/lib/colouring";

type P = { id: number; url: string; caption: string; name: string };
const SIZE = 600; // drawn at 600×600, shown smaller
const BRUSHES = [4, 10, 22];

export default function Doodles() {
  const { toast } = useStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<ImageData[]>([]);
  const [colour, setColour] = useState(CRAYONS[7]);
  const [brush, setBrush] = useState(BRUSHES[1]);
  const [drawn, setDrawn] = useState(false);
  const [name, setName] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [wall, setWall] = useState<P[] | null>(null);
  const [prompts, setPrompts] = useState<{ today: string; prompts: { prompt: string; n: number }[] } | null>(null);
  const [usePrompt, setUsePrompt] = useState(true);
  const [view, setView] = useState("");
  useEffect(() => {
    fetch("/api/photos?prompts=1").then((r) => r.json()).then(setPrompts).catch(() => {});
  }, []);
  useEffect(() => {
    const u = view ? `/api/photos?prompt=${encodeURIComponent(view)}` : "/api/photos?kind=doodle";
    fetch(u).then((r) => r.json()).then((d) => setWall(d.photos ?? [])).catch(() => setWall([]));
  }, [view]);
  useEffect(() => { clear(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = () => canvas.current!.getContext("2d")!;
  function clear() {
    const c = ctx();
    c.fillStyle = "#fffaf6"; c.fillRect(0, 0, SIZE, SIZE);
    history.current = []; setDrawn(false);
  }
  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  function down(e: React.PointerEvent) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    history.current = [...history.current.slice(-19), ctx().getImageData(0, 0, SIZE, SIZE)];
    last.current = pos(e);
    move(e);
  }
  function move(e: React.PointerEvent) {
    if (!last.current) return;
    const p = pos(e), c = ctx();
    c.strokeStyle = colour; c.lineWidth = brush; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(last.current.x, last.current.y); c.lineTo(p.x + 0.01, p.y); c.stroke();
    last.current = p; setDrawn(true);
  }
  const up = () => { last.current = null; };
  function undo() {
    const h = history.current.pop();
    if (h) ctx().putImageData(h, 0, 0);
    if (!history.current.length) setDrawn(false);
  }
  async function send() {
    if (!drawn) return toast("Draw something first ✿");
    setBusy(true);
    const blob: Blob | null = await new Promise((res) => canvas.current!.toBlob(res, "image/png"));
    if (!blob) { setBusy(false); return toast("That didn't work. Try again?"); }
    const f = new FormData();
    f.set("file", new File([blob], "doodle.png", { type: "image/png" }));
    f.set("kind", "doodle"); f.set("name", name || "A guest"); f.set("caption", caption);
    if (usePrompt && prompts) f.set("prompt", "1");
    const r = await fetch("/api/photos", { method: "POST", body: f });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    clear(); setCaption("");
    toast("🎨 Lovely! It'll go up on the wall once we've had a look.");
  }

  return (
    <div className="page" style={{ maxWidth: "56rem" }}>
      <p className="eyebrow">draw us something</p>
      <h1 className="h2">The doodle <em>wall</em></h1>
      <p className="lead">Your latte, your dog, the view from the window: anything goes. We&apos;ll pin the best ones up here and on the screen by the counter.</p>
      {prompts && <p className="doodle-prompt">✏️ Doodle of the day: <b>{prompts.today}</b></p>}
      <div className="doodle-layout">
        <section className="card doodle-pad">
          <canvas ref={canvas} width={SIZE} height={SIZE} className="doodle-canvas" aria-label="Drawing area" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
          <div className="crayons" role="radiogroup" aria-label="Colour">
            {CRAYONS.map((c) => <button key={c} role="radio" aria-checked={colour === c} aria-label={c === "#ffffff" ? "White (rubber)" : `Colour ${c}`} className={`crayon ${colour === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColour(c)} />)}
          </div>
          <div className="row" style={{ gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
            {BRUSHES.map((b, i) => <button key={b} className={`chip ${brush === b ? "on" : ""}`} aria-pressed={brush === b} onClick={() => setBrush(b)}>{["Thin", "Medium", "Thick"][i]}</button>)}
            <button className="chip" onClick={undo} disabled={!drawn}>↶ Undo</button>
            <button className="chip" onClick={clear} disabled={!drawn}>Clear</button>
          </div>
          <div className="row">
            <label className="field">Your name<input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Asha" /></label>
            <label className="field">What is it? <span className="muted small">· optional</span><input className="input" value={caption} maxLength={120} onChange={(e) => setCaption(e.target.value)} placeholder="My dog Biscuit" /></label>
          </div>
          {prompts && <label className="small" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}><input type="checkbox" checked={usePrompt} onChange={(e) => setUsePrompt(e.target.checked)} /> I drew today&apos;s prompt: &ldquo;{prompts.today}&rdquo;</label>}
          <button className="btn btn-pink" disabled={busy || !drawn} onClick={send}>{busy ? "Sending…" : "📌 Pin it to the wall"}</button>
          <p className="tiny muted center" style={{ margin: 0 }}>We have a look before it goes up.</p>
        </section>
        <section>
          <h2 className="h3">{view ? <>&ldquo;{view}&rdquo;</> : "On the wall"}</h2>
          {prompts && (prompts.prompts.length > 0 || view) && (
            <label className="field small" style={{ maxWidth: "18rem" }}>Show
              <select className="input" value={view} onChange={(e) => setView(e.target.value)}>
                <option value="">Every doodle</option>
                {!prompts.prompts.some((p) => p.prompt === prompts.today) && <option value={prompts.today}>Today: {prompts.today}</option>}
                {prompts.prompts.map((p) => <option key={p.prompt} value={p.prompt}>{p.prompt === prompts.today ? "Today: " : ""}{p.prompt} · {p.n}</option>)}
              </select>
            </label>
          )}
          <div className="doodle-wall">
            {wall?.map((p, i) => (
              <figure key={p.id} className="doodle-pin" style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ? `${p.caption}, a doodle by ${p.name}` : `A doodle by ${p.name}`} loading="lazy" />
                <figcaption className="tiny"><b>{p.name}</b>{p.caption ? ` · ${p.caption}` : ""}</figcaption>
              </figure>
            ))}
            {wall?.length === 0 && <p className="muted">{view ? "Nobody's drawn this one yet. Be the first ✏️" : "The wall is empty. Be the first ✏️"}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
