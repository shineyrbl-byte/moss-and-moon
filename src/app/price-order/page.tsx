"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { TRIES, isRight, marks, pack, priceFor, type PItem } from "@/lib/priceOrder";
import { rupees } from "@/lib/pricing";
import { photo } from "@/lib/menu";
import { addFlag } from "@/lib/trophyFlags";

type S = { goes: string[][]; failed: boolean };

export default function PriceOrder() {
  const { toast } = useStore();
  const d = useDaily<S>("price", "mm-price", () => ({ goes: [], failed: false }));
  const [menu, setMenu] = useState<PItem[] | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/menu").then((r) => r.json()).then((x: { items: (PItem & { cat: string; pup?: boolean })[] }) => setMenu(x.items.filter((m) => m.cat !== "shop" && !m.pup && m.price > 0).map(({ id, name, price, img }) => ({ id, name, price, img })))).catch(() => setMenu([]));
  }, []);
  const items = useMemo(() => (d.date && menu ? priceFor(d.date, menu) : null), [d.date, menu]);
  // Start from your last go, or the order the menu came in
  useEffect(() => { if (items && d.state && !order.length) setOrder(d.state.goes[d.state.goes.length - 1] ?? items.map((x) => x.id)); }, [items, d.state]); // eslint-disable-line react-hooks/exhaustive-deps
  if (menu && !items) return <div className="page"><p className="muted">The menu&apos;s too short for today&apos;s puzzle. Check back soon.</p></div>;
  if (!items || !d.state || !order.length) return <div className="page"><p className="muted">Reading the menu…</p></div>;
  const s = d.state, done = d.doneMs !== null, over = done || s.failed, past = isPast(d.date);
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const lastMarks = s.goes.length ? marks(items, s.goes[s.goes.length - 1]) : null;
  function swap(k: number) {
    if (over) return;
    if (pick === null) return setPick(k);
    const o = [...order]; [o[pick], o[k]] = [o[k], o[pick]]; setOrder(o); setPick(null);
  }
  function shift(k: number, by: number) { if (over) return; const j = k + by; if (j < 0 || j >= order.length) return; const o = [...order]; [o[k], o[j]] = [o[j], o[k]]; setOrder(o); }
  function submit() {
    const t = d.tick(), goes = [...s.goes, order];
    if (isRight(items!, order)) { d.setState({ ...s, goes }); d.setDoneMs(Date.now() - t); if (goes.length === 1) addFlag("price-first-go"); toast(goes.length === 1 ? "First go! You know your menu 💸🎉" : `Right in ${goes.length} goes! 🎉`); return; }
    const right = marks(items!, order).filter(Boolean).length;
    if (goes.length >= TRIES) { d.setState({ goes, failed: true }); toast("Out of goes: here's the right order."); return; }
    d.setState({ ...s, goes }); toast(`${right} of ${items!.length} in the right place.`);
  }
  const shown = over ? [...items].sort((a, b) => a.price - b.price).map((x) => x.id) : order;
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily menu game</p>
      <ArchiveNote date={d.date} path="/price-order" />
      <h1 className="h2">Price <em>order</em></h1>
      <p className="small muted">Five things from our menu. Put them in order of price, cheapest at the top. After each go you&apos;ll see which places are right. You have {TRIES} goes. Tap two to swap them, or use the arrows.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Go <b>{Math.min(TRIES, s.goes.length + (over ? 0 : 1))}</b>/{TRIES}</span><span className="mm-clock">⏱ {clock(d.elapsed)}</span></div>
      <ol className="po-list" aria-label="Cheapest first">
        {shown.map((id, k) => {
          const it = byId[id], ok = over || (lastMarks && s.goes[s.goes.length - 1][k] === id && lastMarks[k]);
          return (
            <li key={id} className={`po-item ${pick === k ? "on" : ""} ${ok ? "right" : ""}`}>
              <button className="po-main" onClick={() => swap(k)} disabled={over} aria-pressed={pick === k} aria-label={`${k + 1}: ${it.name}${ok && !over ? ", right place" : ""}. Tap to swap.`}>
                <span className="po-rank" aria-hidden="true">{k + 1}</span>
                {it.img && <span className="po-img" style={{ backgroundImage: `url(${photo(it.img, 160)})` }} aria-hidden="true" />}
                <span className="po-name">{it.name}</span>
                {over && <b className="po-price">{rupees(it.price)}</b>}
              </button>
              {!over && <span className="po-move"><button className="btn btn-ghost btn-sm" onClick={() => shift(k, -1)} disabled={k === 0} aria-label={`Move ${it.name} up`}>▲</button><button className="btn btn-ghost btn-sm" onClick={() => shift(k, 1)} disabled={k === order.length - 1} aria-label={`Move ${it.name} down`}>▼</button></span>}
            </li>
          );
        })}
      </ol>
      {!over && <p className="center"><button className="btn btn-pink" onClick={submit}>Check my order</button></p>}
      {s.goes.length > 0 && !done && <p className="center small" aria-live="polite">{s.goes.map((g, k) => <span key={k} className="po-go">{marks(items, g).map((m) => (m ? "🟩" : "⬜")).join("")}</span>)}</p>}
      {s.failed && !done && <p className="center small">No score today, but now you know. A new five tomorrow.</p>}
      {done && <DoneCard replay={d.replay} proof={s.goes} game="price" title="Price order" date={d.date} past={past} headline={`Got it in ${s.goes.length} go${s.goes.length === 1 ? "" : "es"}, ${clock(d.doneMs ?? 0)} 🎉`} score={pack(s.goes.length, d.doneMs ?? 0)} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={(v) => `${Math.floor(v / 1_000_000)} go${Math.floor(v / 1_000_000) === 1 ? "" : "es"} · ${clock(v % 1_000_000)}`} note="Fewest goes wins; time breaks a tie." />}
    </div>
  );
}
