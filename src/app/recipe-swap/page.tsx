"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { useStore } from "@/components/Store";
import { RECIPE_LIMITS } from "@/lib/guestRecipes";

type R = { id: number; title: string; name: string; intro: string; ingredients: string[]; steps: string[]; hearts: number; mine: boolean };
const EMPTY = { title: "", name: "", intro: "", ingredients: "", steps: "" };

export default function RecipeSwap() {
  const { toast } = useStore();
  const [list, setList] = useState<R[] | null>(null);
  const [sort, setSort] = useState<"top" | "new">("top");
  const [open, setOpen] = useState<number | null>(null);
  const [writing, setWriting] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/guest-recipes?sort=${sort}&voter=${voterId()}`).then((r) => r.json()).then((d) => setList(d.recipes)).catch(() => setList([])); }, [sort]);
  useEffect(() => { const id = Number(location.hash.replace("#r", "")); if (id) setOpen(id); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/guest-recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setF(EMPTY); setWriting(false);
    toast("📝 Thank you! It'll show here once we've had a read.");
  }
  async function heart(x: R) {
    const r = await fetch("/api/guest-recipes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: x.id, voter: voterId(), on: !x.mine }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setList((l) => l!.map((y) => (y.id === x.id ? { ...y, mine: !x.mine, hearts: d.hearts } : y)));
  }
  return (
    <div className="page" style={{ maxWidth: "46rem" }}>
      <p className="eyebrow">from your kitchen</p>
      <h1 className="h2">Recipe <em>swap</em></h1>
      <p className="lead">Home recipes from our guests: your dalgona, your aaji&apos;s bebinca, your 2am toast. Share one, and heart the ones you&apos;ll make. Ours are on <Link href="/recipes" className="link-btn">make it at home</Link>.</p>
      {!writing ? <button className="btn btn-pink btn-sm" onClick={() => setWriting(true)}>📝 Share a recipe</button> : (
        <form className="card recipe-form" onSubmit={send}>
          <label className="field">Recipe name<input className="input" maxLength={RECIPE_LIMITS.title} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Monsoon masala chai" /></label>
          <label className="field">A line about it <span className="muted small">· optional</span><input className="input" maxLength={RECIPE_LIMITS.intro} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} placeholder="What my mum makes when it pours" /></label>
          <label className="field">Ingredients <span className="muted small">· one per line</span><textarea className="input" rows={5} required value={f.ingredients} onChange={(e) => setF({ ...f, ingredients: e.target.value })} placeholder={"2 cups water\n1 cup milk\n2 tsp tea leaves"} /></label>
          <label className="field">Steps <span className="muted small">· one per line</span><textarea className="input" rows={5} required value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} placeholder={"Boil the water with the spices\nAdd tea and simmer 2 minutes"} /></label>
          <div className="row" style={{ alignItems: "end", flexWrap: "wrap" }}>
            <label className="field" style={{ maxWidth: "12rem" }}>Your name <span className="muted small">· optional</span><input className="input" maxLength={20} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <span className="row" style={{ gap: "0.4rem", marginBottom: "0.6rem" }}><button className="btn btn-pink btn-sm" disabled={busy}>{busy ? "Sending…" : "Share it"}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setWriting(false)}>Cancel</button></span>
          </div>
        </form>
      )}
      <div className="row" style={{ gap: "0.4rem", margin: "1.2rem 0 0.6rem" }}>
        <button className={`chip ${sort === "top" ? "on" : ""}`} aria-pressed={sort === "top"} onClick={() => setSort("top")}>Most loved</button>
        <button className={`chip ${sort === "new" ? "on" : ""}`} aria-pressed={sort === "new"} onClick={() => setSort("new")}>Newest</button>
      </div>
      <ul className="story-list">
        {list?.map((x) => (
          <li key={x.id} id={`r${x.id}`} className="card recipe-card">
            <span className="sum-row" style={{ alignItems: "center" }}>
              <button className="link-btn recipe-title" aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}><b>{x.title}</b></button>
              <button className={`chip story-heart ${x.mine ? "on" : ""}`} aria-pressed={x.mine} aria-label={`${x.mine ? "Unheart" : "Heart"} ${x.title}`} onClick={() => heart(x)}>♥ {x.hearts}</button>
            </span>
            <span className="tiny muted">{x.name ? `by ${x.name}` : "from a guest"}{x.intro ? ` · ${x.intro}` : ""}</span>
            {open === x.id && (
              <div className="recipe-body">
                <h3 className="small">You&apos;ll need</h3>
                <ul>{x.ingredients.map((i, k) => <li key={k}>{i}</li>)}</ul>
                <h3 className="small">Method</h3>
                <ol>{x.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
              </div>
            )}
          </li>
        ))}
        {list?.length === 0 && <p className="muted">No recipes yet. Be the first to share one!</p>}
      </ul>
    </div>
  );
}
