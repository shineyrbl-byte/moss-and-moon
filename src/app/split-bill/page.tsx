"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { splitBill, type SplitItem } from "@/lib/split";

type MenuLite = { id: string; name: string; price: number; cat: string };
const KEY = "mm-split";
const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function SplitBill() {
  const { toast } = useStore();
  const [people, setPeople] = useState<string[]>(["Me", "Friend"]);
  const [items, setItems] = useState<SplitItem[]>([]);
  const [tip, setTip] = useState(0);
  const [menu, setMenu] = useState<MenuLite[]>([]);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState({ name: "", price: "" });
  const [newName, setNewName] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (s?.people?.length) { setPeople(s.people); setItems(s.items ?? []); setTip(s.tip ?? 0); } } catch {}
    setReady(true);
    fetch("/api/menu").then((r) => r.json()).then((d) => setMenu(d.items.filter((m: MenuLite & { pup?: boolean }) => !m.pup && m.cat !== "shop"))).catch(() => {});
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify({ people, items, tip })); } catch {} }, [ready, people, items, tip]);
  const result = useMemo(() => splitBill(items, people.length, tip), [items, people.length, tip]);
  const matches = q.trim().length >= 2 ? menu.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];

  const everyone = () => [...people.keys()];
  function addItem(name: string, price: number) {
    if (!name.trim() || !(price > 0)) return toast("Add a name and a price");
    setItems([...items, { name: name.trim().slice(0, 40), price: Math.round(price), qty: 1, people: everyone() }]);
    setQ(""); setCustom({ name: "", price: "" });
  }
  function addPerson() {
    const n = newName.trim().slice(0, 16);
    if (!n) return;
    if (people.length >= 12) return toast("Twelve people at most");
    setPeople([...people, n]); setNewName("");
  }
  function removePerson(i: number) {
    if (people.length <= 1) return;
    setPeople(people.filter((_, k) => k !== i));
    // Shift everyone after them down one
    setItems(items.map((it) => ({ ...it, people: it.people.filter((p) => p !== i).map((p) => (p > i ? p - 1 : p)) })));
  }
  const toggle = (it: number, p: number) => setItems(items.map((x, k) => (k !== it ? x : { ...x, people: x.people.includes(p) ? x.people.filter((y) => y !== p) : [...x.people, p].sort((a, b) => a - b) })));
  async function share() {
    const lines = people.map((p, i) => `${p}: ${rs(result.shares[i])}`);
    const text = `Our Moss & Moon bill 🧾\n${lines.join("\n")}\nTotal ${rs(result.total)}${result.tip ? ` (incl. ${rs(result.tip)} tip)` : ""}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("Copied. Paste it in your group chat 📋"); }
    } catch {}
  }
  function clear() { setItems([]); setTip(0); }

  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">for groups</p>
      <h1 className="h2">Split the <em>bill</em></h1>
      <p className="small muted">Add who&apos;s at the table and what you had. Tap names on each item to say who shared it; shared things split evenly. It all stays on this phone.</p>

      <section className="card split-sec">
        <h2 className="h3">Who&apos;s at the table</h2>
        <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
          {people.map((p, i) => (
            <span key={i} className="chip on split-person">
              <input aria-label={`Person ${i + 1} name`} value={p} maxLength={16} onChange={(e) => setPeople(people.map((x, k) => (k === i ? e.target.value : x)))} size={Math.max(3, p.length)} />
              {people.length > 1 && <button onClick={() => removePerson(i)} aria-label={`Remove ${p}`}>×</button>}
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: "0.4rem", marginTop: "0.6rem" }}>
          <input className="input" style={{ flex: 1 }} maxLength={16} placeholder="Add a name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} />
          <button className="btn btn-ghost btn-sm" onClick={addPerson}>Add</button>
        </div>
      </section>

      <section className="card split-sec">
        <h2 className="h3">What you had</h2>
        <label className="field">Find it on our menu<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Latte, croissant…" /></label>
        {matches.length > 0 && <ul className="split-matches">{matches.map((m) => <li key={m.id}><button onClick={() => addItem(m.name, m.price)}><span>{m.name}</span><b>{rs(m.price)}</b></button></li>)}</ul>}
        <div className="row" style={{ gap: "0.4rem", alignItems: "end", flexWrap: "wrap" }}>
          <label className="field" style={{ flex: "2 1 10rem", marginBottom: 0 }}>Or type it in<input className="input" maxLength={40} placeholder="Something else" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></label>
          <label className="field" style={{ flex: "1 1 5rem", marginBottom: 0 }}>Price ₹<input className="input" inputMode="decimal" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value.replace(/[^\d.]/g, "") })} /></label>
          <button className="btn btn-ghost btn-sm" onClick={() => addItem(custom.name, Number(custom.price))}>Add</button>
        </div>
        {items.length > 0 && (
          <ul className="split-items">
            {items.map((it, i) => (
              <li key={i}>
                <div className="split-item-head">
                  <span className="split-qty">
                    <button onClick={() => setItems(items.map((x, k) => (k === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} aria-label={`One less ${it.name}`}>−</button>
                    <b>{it.qty}</b>
                    <button onClick={() => setItems(items.map((x, k) => (k === i ? { ...x, qty: Math.min(20, x.qty + 1) } : x)))} aria-label={`One more ${it.name}`}>+</button>
                  </span>
                  <span style={{ flex: 1 }}>{it.name}</span>
                  <b>{rs(it.price * it.qty)}</b>
                  <button className="split-x" onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label={`Remove ${it.name}`}>×</button>
                </div>
                <div className="split-who" role="group" aria-label={`Who had ${it.name}`}>
                  {people.map((p, k) => <button key={k} className={`chip ${it.people.includes(k) ? "on" : ""}`} aria-pressed={it.people.includes(k)} onClick={() => toggle(i, k)}>{p || `Person ${k + 1}`}</button>)}
                </div>
                {it.people.length === 0 && <p className="tiny" style={{ color: "var(--pink-ink)", margin: 0 }}>Nobody&apos;s picked for this yet.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card split-sec">
        <h2 className="h3">Tip for the team</h2>
        <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
          {[0, 5, 10, 15].map((t) => <button key={t} className={`chip ${tip === t ? "on" : ""}`} aria-pressed={tip === t} onClick={() => setTip(t)}>{t ? `${t}%` : "No tip"}</button>)}
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>Shared in proportion to what each person had.</p>
      </section>

      <section className="card split-sec split-total" aria-live="polite">
        <h2 className="h3">Each person pays</h2>
        <ul>{people.map((p, i) => <li key={i}><span>{p || `Person ${i + 1}`}</span><b>{rs(result.shares[i] ?? 0)}</b></li>)}</ul>
        <p className="small" style={{ margin: 0 }}>Total <b>{rs(result.total)}</b>{result.tip > 0 && <> · includes {rs(result.tip)} tip</>}</p>
        {result.unassigned > 0 && <p className="small" style={{ color: "var(--pink-ink)", margin: 0 }}>{rs(result.unassigned)} of items have nobody picked, so they&apos;re not counted yet.</p>}
        <div className="row" style={{ gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn btn-pink btn-sm" onClick={share} disabled={!items.length}>Share the split</button>
          {items.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clear}>Start a new bill</button>}
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>Amounts are rounded to whole rupees and always add up to the total. Check them against your receipt, since offers or taxes on the receipt aren&apos;t included here.</p>
      </section>
    </div>
  );
}
