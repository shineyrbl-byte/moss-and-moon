"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import DrinkCup from "@/components/DrinkCup";
import LabCard, { type LabCreation } from "@/components/LabCard";
import { ICE, MILKS, SHOT_PRICE, SIZES, SWEETS, SYRUPS, TEMPS, TOPPINGS, cleanOptions, defaultOptions, describeOptions, drinkChoices, rupees, unitPrice, type Options } from "@/lib/pricing";
import type { TKey } from "@/lib/i18n";

export default function Lab() {
  const { menu, t, toast } = useStore();
  const bases = useMemo(() => menu.filter((m) => ["coffee", "tea", "cold"].includes(m.cat) && !m.groups?.length && !m.kids && !m.hidden).sort((a, b) => a.name.localeCompare(b.name)), [menu]);
  const [baseId, setBaseId] = useState("");
  const base = bases.find((b) => b.id === baseId) ?? bases.find((b) => b.id === "cold-brew") ?? bases[0];
  const [opts, setOpts] = useState<Options>({});
  const [name, setName] = useState("");
  const [creator, setCreator] = useState("");
  const [saved, setSaved] = useState<LabCreation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<{ top: LabCreation[]; newest: LabCreation[] } | null>(null);
  const [tab, setTab] = useState<"top" | "newest">("top");

  useEffect(() => { fetch("/api/lab").then((r) => r.json()).then((b) => { setBoard(b); if (!b.top.length) setTab("newest"); }).catch(() => {}); try { setCreator(localStorage.getItem("mm-lab-name") ?? ""); } catch {} }, []);
  useEffect(() => { if (base) setOpts(defaultOptions(base)); }, [base?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!base) return <div className="page narrow"><p className="muted">Warming up the lab…</p></div>;
  const can = drinkChoices(base);
  const o = cleanOptions(base, opts);
  const set = (k: keyof Options, v: unknown) => setOpts((x) => cleanOptions(base, { ...x, [k]: v }));
  const group = <V extends string>(title: string, key: keyof Options, list: { value: V; label: string; extra: number }[]) => (
    <div className="opt-group">
      <h4>{title}</h4>
      <div className="chips" style={{ justifyContent: "flex-start" }}>
        {list.map((c) => <button key={c.value} type="button" className={`chip ${o[key] === c.value ? "on" : ""}`} onClick={() => set(key, c.value)}>{t(`${String(key)}.${c.value}` as TKey)}{c.extra > 0 && <span className="extra"> +₹{c.extra}</span>}</button>)}
      </div>
    </div>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { localStorage.setItem("mm-lab-name", creator); } catch {}
    const r = await fetch("/api/lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, creator, baseId: base.id, opts: o }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "That didn't save.");
    setSaved(d.creation);
    setBoard((b) => (b ? { ...b, newest: [d.creation, ...b.newest].slice(0, 12) } : b));
  }
  const link = saved ? `${location.origin}/lab/${saved.code}` : "";
  async function share() {
    const text = `Try my drink "${saved!.name}" at Moss & Moon 🌸`;
    try { if (navigator.share) return await navigator.share({ title: saved!.name, text, url: link }); } catch { return; }
    try { await navigator.clipboard.writeText(link); toast("Link copied ✿"); } catch {}
  }

  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">make it yours</p>
      <h1 className="h2">Drink <em>lab</em></h1>
      <p className="lead">Start from any drink, mix it your way, give it a name and share it. Anyone can order your creation in one tap, and the most-loved rise to the top.</p>

      <div className="lab-builder">
        <section className="card lab-mix">
          <label className="field">Start from
            <select className="input" value={base.id} onChange={(e) => { setBaseId(e.target.value); setSaved(null); }}>
              {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          {group(t("opt.size"), "size", SIZES)}
          {can.temp && group(t("opt.temp"), "temp", TEMPS)}
          {o.temp === "iced" && group(t("opt.ice"), "ice", ICE)}
          {can.milk && group(t("opt.milk"), "milk", MILKS)}
          {group(t("opt.sweet"), "sweet", SWEETS)}
          {can.syrup && group(t("opt.syrup"), "syrup", SYRUPS)}
          {can.toppings && (
            <div className="opt-group">
              <h4>{t("opt.toppings")}</h4>
              <div className="chips" style={{ justifyContent: "flex-start" }}>
                {TOPPINGS.map((tp) => { const on = !!o.toppings?.includes(tp.value); return <button key={tp.value} type="button" aria-pressed={on} className={`chip ${on ? "on" : ""}`} onClick={() => set("toppings", on ? o.toppings!.filter((x) => x !== tp.value) : [...(o.toppings ?? []), tp.value])}>{t(`toppings.${tp.value}` as TKey)}{tp.extra > 0 && <span className="extra"> +₹{tp.extra}</span>}</button>; })}
              </div>
            </div>
          )}
          {can.shot && <div className="toggle-row"><span>{t("opt.shot")} <span className="muted small">+₹{SHOT_PRICE}</span></span><button className={`switch ${o.shot ? "" : "off"}`} aria-pressed={!!o.shot} aria-label={t("opt.shot")} onClick={() => set("shot", !o.shot)} /></div>}
        </section>

        <section className="card lab-preview">
          <DrinkCup item={base} opts={o} />
          <p className="small" style={{ textAlign: "center" }}>{describeOptions(base, o) || "As it comes"}<br /><b>{rupees(unitPrice(base, o))}</b></p>
          {saved ? (
            <div className="reward-banner small" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <b>🧪 “{saved.name}” is in the lab!</b>
              <code className="tiny" style={{ wordBreak: "break-all" }}>{link}</code>
              <span className="row" style={{ gap: "0.4rem" }}>
                <button className="btn btn-pink btn-sm" onClick={share}>Share it</button>
                <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`Try my drink "${saved.name}" at Moss & Moon 🌸 ${link}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <button className="btn btn-ghost btn-sm" onClick={() => { setSaved(null); setName(""); }}>Make another</button>
              </span>
            </div>
          ) : (
            <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: "100%" }}>
              <label className="field">Name your drink<input className="input" required minLength={3} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monsoon Moonbeam" /></label>
              <label className="field">Your first name <span className="muted small">· shown with it</span><input className="input" maxLength={20} value={creator} onChange={(e) => setCreator(e.target.value)} /></label>
              {error && <p className="error small">{error}</p>}
              <button className="btn btn-pink" disabled={busy}>{busy ? "Saving…" : "🧪 Save & share"}</button>
            </form>
          )}
        </section>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <div className="sum-row" style={{ alignItems: "center" }}>
          <h2 className="h3">Community creations</h2>
          <div className="chips" role="tablist" aria-label="Sort">
            <button role="tab" aria-selected={tab === "top"} className={`chip ${tab === "top" ? "on" : ""}`} onClick={() => setTab("top")}>♥ Most loved</button>
            <button role="tab" aria-selected={tab === "newest"} className={`chip ${tab === "newest" ? "on" : ""}`} onClick={() => setTab("newest")}>✨ Newest</button>
          </div>
        </div>
        {board && !board[tab].length && <p className="muted small">{tab === "top" ? "No votes yet. Be the first to ♥ one!" : "Nothing yet. Yours could be the first ✿"}</p>}
        <div className="lab-grid">{board?.[tab].map((c) => <LabCard key={c.code} c={c} />)}</div>
      </section>
    </div>
  );
}
