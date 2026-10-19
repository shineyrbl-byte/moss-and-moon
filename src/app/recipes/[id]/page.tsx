import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { photo } from "@/lib/menu";
import { getMenu } from "@/lib/menuStore";
import { HOME_RECIPES, NO_MACHINE, findHomeRecipe } from "@/lib/homeRecipes";
import { rupees } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = findHomeRecipe((await params).id);
  return r ? { title: `${r.title} at home`, description: `How to make our ${r.title} in your own kitchen, in about ${r.minutes} minutes.` } : {};
}

export default async function Recipe({ params }: { params: Promise<{ id: string }> }) {
  const r = findHomeRecipe((await params).id);
  if (!r) notFound();
  const m = getMenu({ includeHidden: true }).find((x) => x.id === r.id);
  const usesEspresso = r.ingredients.some((i) => /espresso/i.test(i));
  const others = HOME_RECIPES.filter((x) => x.id !== r.id).slice(0, 3);
  return (
    <article className="page narrow recipe">
      <Link href="/recipes" className="small muted">← All recipes</Link>
      <p className="eyebrow" style={{ marginTop: "0.8rem" }}>make it at home</p>
      <h1 className="h2">{r.title}</h1>
      <p className="small muted">⏱ {r.minutes} min · {r.makes}</p>
      {m && <div className="recipe-photo"><Image src={photo(m.img, 1000)} alt={r.title} fill sizes="(max-width: 700px) 100vw, 40rem" priority /></div>}
      <div className="recipe-cols">
        <section>
          <h2 className="h3">You&apos;ll need</h2>
          <ul>{r.ingredients.map((i) => <li key={i}>{i}</li>)}</ul>
          <h3 className="small" style={{ marginTop: "0.8rem" }}>Kit</h3>
          <ul className="small">{r.kit.map((k) => <li key={k}>{k}</li>)}</ul>
        </section>
        <section>
          <h2 className="h3">How to</h2>
          <ol>{r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      </div>
      <p className="reward-banner small">💡 {r.tip}</p>
      {usesEspresso && <p className="small muted">☕ {NO_MACHINE}</p>}
      {m && !m.hidden && (
        <p className="small" style={{ marginTop: "1rem" }}>Rather we made it? <Link href="/#menu" className="link-btn">Order one</Link> ({rupees(m.price)}).</p>
      )}
      <h2 className="h3" style={{ marginTop: "1.5rem" }}>More to try</h2>
      <ul className="small">{others.map((o) => <li key={o.id}><Link href={`/recipes/${o.id}`}>{o.title}</Link></li>)}</ul>
    </article>
  );
}
