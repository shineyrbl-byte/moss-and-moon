"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../Store";
import { rupees } from "@/lib/pricing";

type P = "swiggy" | "zomato";
type S = { on: boolean; markup: number; commission: number };
type Data = Record<P, S> & { secret?: string; summary: { platform: P; label: string; orders: number; gross: number; commission: number; net: number }[] };
const LABEL: Record<P, string> = { swiggy: "Swiggy", zomato: "Zomato" };

/** Orders tab: type in a Swiggy / Zomato order, see the week, and (owner) set the platforms up */
export default function AggregatorsCard() {
  const { menu, toast } = useStore();
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState(false);
  const [platform, setPlatform] = useState<P>("swiggy");
  const [ref, setRef] = useState("");
  const [customer, setCustomer] = useState("");
  const [total, setTotal] = useState("");
  const [lines, setLines] = useState<{ itemId: string; qty: number }[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => fetch("/api/admin/aggregators").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  const dishes = useMemo(() => menu.filter((m) => m.cat !== "shop" && !m.groups?.length).sort((a, b) => a.name.localeCompare(b.name)), [menu]);
  if (!d) return null;
  const anyOn = d.swiggy.on || d.zomato.on;
  const isOwner = d.secret !== undefined;
  if (!anyOn && !isOwner) return null;

  const addLine = (id: string) => {
    if (!id) return;
    setLines((ls) => (ls.some((l) => l.itemId === id) ? ls.map((l) => (l.itemId === id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { itemId: id, qty: 1 }]));
    setPick("");
  };
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await fetch("/api/admin/aggregators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, ref, customer, total: total ? Number(total) : undefined, lines }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error ?? "That didn't work.");
    toast(j.duplicate ? `Already on the screen as ${j.code}` : `${LABEL[platform]} order added ✿`);
    setRef(""); setCustomer(""); setTotal(""); setLines([]); setOpen(false);
    load();
  }
  async function save(change: Record<string, unknown>) {
    const r = await fetch("/api/admin/aggregators", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    if (r.ok) { load(); toast("Saved ✓"); }
  }
  const hook = typeof window !== "undefined" ? `${window.location.origin}/api/aggregators/` : "/api/aggregators/";

  return (
    <section className="card" style={{ marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "1.15rem" }}>🛵 Swiggy & Zomato</h3>
        <span className="row" style={{ gap: "0.4rem" }}>
          {anyOn && <button className="btn btn-pink btn-sm" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "+ Add an order"}</button>}
          {isOwner && <button className="btn btn-ghost btn-sm" onClick={() => setSetup((o) => !o)}>{setup ? "Hide set-up" : "Set up"}</button>}
        </span>
      </div>
      <p className="small muted">
        {d.summary.map((s) => `${s.label}: ${s.orders} order${s.orders === 1 ? "" : "s"} · ${rupees(s.gross)} in, ${rupees(s.commission)} commission, ${rupees(s.net)} to you`).join("  ·  ")} <span className="tiny">(last 7 days)</span>
      </p>

      {open && (
        <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginTop: "0.6rem" }}>
          <div className="chips" role="radiogroup" aria-label="Platform" style={{ justifyContent: "flex-start" }}>
            {(["swiggy", "zomato"] as const).filter((p) => d[p].on).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={platform === p} className={`chip ${platform === p ? "on" : ""}`} onClick={() => setPlatform(p)}>{LABEL[p]}</button>
            ))}
          </div>
          <div className="row">
            <label className="field">{LABEL[platform]} order number<input className="input" required maxLength={40} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 158823344" /></label>
            <label className="field">Guest&apos;s first name <span className="muted small">· optional</span><input className="input" maxLength={30} value={customer} onChange={(e) => setCustomer(e.target.value)} /></label>
            <label className="field">Total on {LABEL[platform]} (₹) <span className="muted small">· optional</span><input className="input" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} /></label>
          </div>
          <label className="field">Add a dish
            <select className="input" value={pick} onChange={(e) => addLine(e.target.value)}>
              <option value="">Choose…</option>
              {dishes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          {lines.length > 0 && (
            <ul className="check-list">
              {lines.map((l) => (
                <li key={l.itemId}>
                  <span style={{ flex: 1 }}>{menu.find((m) => m.id === l.itemId)?.name}</span>
                  <span className="stepper">
                    <button type="button" aria-label="One less" onClick={() => setLines((ls) => ls.flatMap((x) => (x.itemId !== l.itemId ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : [])))}>−</button>
                    <strong>{l.qty}</strong>
                    <button type="button" aria-label="One more" onClick={() => addLine(l.itemId)}>+</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="error small">{error}</p>}
          <button className="btn btn-pink" disabled={busy || !lines.length || !ref.trim()}>{busy ? "Adding…" : "Send to the barista screen"}</button>
        </form>
      )}

      {setup && isOwner && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginTop: "0.8rem" }}>
          {(["swiggy", "zomato"] as const).map((p) => (
            <div key={p} className="row" style={{ alignItems: "flex-end", gap: "0.8rem", flexWrap: "wrap" }}>
              <label className="row small" style={{ alignItems: "center", gap: "0.4rem", minWidth: 120 }}>
                <input type="checkbox" checked={d[p].on} onChange={(e) => save({ [p]: { on: e.target.checked } })} /> <b>{LABEL[p]}</b>
              </label>
              <label className="field small" style={{ maxWidth: 160 }}>Price markup %<input className="input" type="number" min={0} max={60} defaultValue={d[p].markup} onBlur={(e) => save({ [p]: { markup: Number(e.target.value) } })} /></label>
              <label className="field small" style={{ maxWidth: 160 }}>Their commission %<input className="input" type="number" min={0} max={60} defaultValue={d[p].commission} onBlur={(e) => save({ [p]: { commission: Number(e.target.value) } })} /></label>
              <a className="btn btn-ghost btn-sm" href={`/api/admin/aggregators/menu?platform=${p}`}>⬇ Menu for {LABEL[p]} (CSV)</a>
            </div>
          ))}
          <div className="small">
            <b>Automatic orders</b> <span className="muted">(needs a Swiggy/Zomato partner account or a middleware like UrbanPiper)</span>
            <p className="tiny muted" style={{ margin: "0.3rem 0" }}>Have them send each order as JSON to the address below, with the secret in an <code>x-mm-secret</code> header. Body: <code>{`{ "ref": "123", "customer": "Asha", "total": 480, "lines": [{ "name": "Iced Mocha", "qty": 2 }] }`}</code></p>
            <code className="tiny" style={{ display: "block", wordBreak: "break-all" }}>{hook}swiggy · {hook}zomato</code>
            <span className="row" style={{ gap: "0.4rem", alignItems: "center", marginTop: "0.3rem" }}>
              <code className="tiny" style={{ wordBreak: "break-all" }}>secret: {d.secret}</code>
              <button type="button" className="link-btn tiny" onClick={() => { try { navigator.clipboard.writeText(d.secret!); toast("Copied"); } catch {} }}>Copy</button>
              <button type="button" className="link-btn tiny" onClick={() => save({ newSecret: true })}>Make a new one</button>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
