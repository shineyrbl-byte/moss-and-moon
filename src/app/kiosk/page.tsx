"use client";
import "./page.css";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { CATEGORIES, inTab, photo, type MenuTab } from "@/lib/menu";
import { describeOptions, rupees, unitPrice } from "@/lib/pricing";

const IDLE_MS = 90_000; // no taps for this long: ask "still there?"
const WARN_S = 15;
const DONE_S = 20;

/** Self-order kiosk: a tablet on the counter, signed in as staff. Guests order and pay at the counter. */
export default function Kiosk() {
  const { menu, find, lines, setQty, clear, setCustomizing, customizing, soldOut, branch } = useStore();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [stage, setStage] = useState<"start" | "order" | "done">("start");
  const [tab, setTab] = useState<MenuTab>("coffee");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<{ code: string; due: number } | null>(null);
  const [warn, setWarn] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(DONE_S);
  const lastTap = useRef(Date.now());

  useEffect(() => { fetch("/api/admin/me").then((r) => setAuthed(r.ok)).catch(() => setAuthed(false)); }, []);

  const reset = useCallback(() => {
    clear();
    setCustomizing(null);
    setName(""); setPhone(""); setError(""); setPlaced(null); setWarn(null);
    setTab("coffee");
    setStage("start");
  }, [clear, setCustomizing]);

  // Any tap keeps the session alive
  useEffect(() => {
    const tap = () => { lastTap.current = Date.now(); setWarn(null); };
    window.addEventListener("pointerdown", tap);
    window.addEventListener("keydown", tap);
    return () => { window.removeEventListener("pointerdown", tap); window.removeEventListener("keydown", tap); };
  }, []);
  useEffect(() => {
    if (stage !== "order") return;
    const t = setInterval(() => {
      const idle = Date.now() - lastTap.current;
      if (idle < IDLE_MS) return;
      const left = WARN_S - Math.floor((idle - IDLE_MS) / 1000);
      if (left <= 0) reset();
      else setWarn(left);
    }, 1000);
    return () => clearInterval(t);
  }, [stage, reset]);
  // After ordering, go back to the start screen by itself
  useEffect(() => {
    if (stage !== "done") return;
    setCountdown(DONE_S);
    const t = setInterval(() => setCountdown((c) => { if (c <= 1) { reset(); return DONE_S; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [stage, reset]);

  const tabs = CATEGORIES.filter((c) => c.id !== "all" && c.id !== "shop");
  const items = useMemo(() => menu.filter((m) => m.cat !== "shop" && inTab(m, tab) && (!m.branches?.length || m.branches.includes(branch))), [menu, tab, branch]);
  const tray = lines.filter((l) => find(l.itemId));
  const subtotal = tray.reduce((s, l) => s + unitPrice(find(l.itemId)!, l.opts) * l.qty, 0);
  const count = tray.reduce((s, l) => s + l.qty, 0);

  async function place() {
    if (!name.trim()) return setError("Add a name so we can call you.");
    setBusy(true);
    setError("");
    const r = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kiosk: true, branch, name, phone, lines: tray.map(({ itemId, opts, qty }) => ({ itemId, opts, qty })) }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    clear();
    setPlaced({ code: d.code, due: d.due });
    setStage("done");
  }

  if (authed === null) return <div className="kiosk kiosk-center"><p className="muted">Loading…</p></div>;
  if (!authed)
    return (
      <div className="kiosk kiosk-center">
        <h1 className="h2">Kiosk mode</h1>
        <p className="lead">Sign in on the staff dashboard on this tablet first, then open this page again.</p>
        <Link className="btn btn-pink" href="/admin">Staff sign-in</Link>
      </div>
    );

  if (stage === "start")
    return (
      <button className="kiosk kiosk-center kiosk-start" onClick={() => { clear(); lastTap.current = Date.now(); setStage("order"); }}>
        <span className="logo" style={{ fontSize: "3.2rem" }}>Moss <em>&amp;</em> Moon</span>
        <span className="kiosk-big">Tap to order ☕</span>
        <span className="muted">Order here, pay at the counter</span>
      </button>
    );

  if (stage === "done" && placed)
    return (
      <div className="kiosk kiosk-center" role="status">
        <span style={{ fontSize: "4rem" }} aria-hidden>🌸</span>
        <h1 className="h2">Thank you, {name.split(" ")[0]}!</h1>
        <p className="lead">Your order number</p>
        <span className="kiosk-code">{placed.code}</span>
        <p className="lead">Please pay <b>{rupees(placed.due)}</b> at the counter. We&apos;ll call your name when it&apos;s ready.</p>
        <button className="btn btn-pink" onClick={reset}>Done</button>
        <p className="small muted">Starting over in {countdown}s</p>
      </div>
    );

  return (
    <div className="kiosk">
      <header className="kiosk-head">
        <span className="logo" style={{ fontSize: "1.8rem" }}>Moss <em>&amp;</em> Moon</span>
        <nav className="kiosk-tabs" aria-label="Menu sections">
          {tabs.map((c) => <button key={c.id} className={`chip ${tab === c.id ? "on" : ""}`} aria-pressed={tab === c.id} onClick={() => setTab(c.id)}>{c.label}</button>)}
        </nav>
        <button className="btn btn-ghost btn-sm" onClick={reset}>Start over</button>
      </header>
      <div className="kiosk-body">
        <div className="kiosk-grid">
          {items.map((m) => {
            const out = soldOut.has(m.id);
            return (
              <button key={m.id} className="kiosk-tile" disabled={out} onClick={() => setCustomizing(m)} aria-label={`${m.name}, ${rupees(m.price)}${out ? ", sold out" : ""}`}>
                <span className="kiosk-ph"><Image src={photo(m.img, 500)} alt="" fill sizes="(max-width: 900px) 45vw, 22vw" /></span>
                <b>{m.name}</b>
                <span className="muted">{out ? "Sold out" : rupees(m.price)}</span>
              </button>
            );
          })}
        </div>
        <aside className="kiosk-tray card" aria-label="Your order">
          <h2 style={{ fontSize: "1.4rem" }}>Your order {count > 0 && <span className="muted">· {count}</span>}</h2>
          {!tray.length ? <p className="muted">Tap something delicious to add it.</p> : (
            <ul className="kiosk-lines">
              {tray.map((l) => {
                const item = find(l.itemId)!;
                const d = describeOptions(item, l.opts);
                return (
                  <li key={l.key}>
                    <div><b>{item.name}</b>{d && <small className="muted">{d}</small>}</div>
                    <div className="stepper">
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label={`One less ${item.name}`}>−</button>
                      <strong>{l.qty}</strong>
                      <button onClick={() => setQty(l.key, Math.min(20, l.qty + 1))} aria-label={`One more ${item.name}`}>+</button>
                    </div>
                    <span>{rupees(unitPrice(item, l.opts) * l.qty)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {tray.length > 0 && (
            <>
              <div className="sum-row"><span>Total</span><b>{rupees(subtotal)}</b></div>
              <label className="field">Your name<input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
              <label className="field">Phone <span className="muted small">· optional, for your stamp card</span><input className="input" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="off" /></label>
              {error && <p className="error">{error}</p>}
              <button className="btn btn-pink full kiosk-go" disabled={busy || !!customizing} onClick={place}>{busy ? "Placing…" : `Order · pay ${rupees(subtotal)} at the counter`}</button>
              <p className="tiny muted">Golden hour and stamp rewards are applied automatically.</p>
            </>
          )}
        </aside>
      </div>
      {warn !== null && (
        <div className="kiosk-warn" role="alertdialog" aria-label="Still there?">
          <div className="card"><h2>Still there?</h2><p>Starting over in {warn}s.</p><button className="btn btn-pink">I&apos;m still here</button></div>
        </div>
      )}
    </div>
  );
}
