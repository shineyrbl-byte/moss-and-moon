import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { photo } from "@/lib/menu";
import { getMenu } from "@/lib/menuStore";
import { HOME_RECIPES } from "@/lib/homeRecipes";
import { listRecipes } from "@/lib/guestRecipeStore";

export const metadata: Metadata = { title: "Make it at home", description: "Home versions of our favourite drinks. No espresso machine needed." };
export const dynamic = "force-dynamic";

export default function Recipes() {
  const menu = new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m]));
  const guests = listRecipes(null, "top", 3);
  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">from our counter to your kitchen</p>
      <h1 className="h2">Make it <em>at home</em></h1>
      <p className="lead">Our favourite drinks, rewritten for a home kitchen. No espresso machine needed. Brewing plain coffee? Use the <Link href="/brew" className="link-btn">brew timer</Link>, and see <Link href="/origins" className="link-btn">where our beans grow</Link>.</p>
      <div className="journal-grid">
        {HOME_RECIPES.map((r) => {
          const m = menu.get(r.id);
          return (
            <Link key={r.id} href={`/recipes/${r.id}`} className="journal-card card">
              {m && <div className="journal-cover"><Image src={photo(m.img, 700)} alt="" fill sizes="(max-width: 700px) 100vw, 30rem" /></div>}
              <div className="journal-body">
                <span className="small muted">⏱ {r.minutes} min · {r.makes}</span>
                <h2 className="h3">{r.title}</h2>
                <p className="small">{m?.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
      <section style={{ marginTop: "2rem" }}>
        <h2 className="h3">📝 From our guests</h2>
        {guests.length > 0 ? (
          <ul className="guest-recipe-row">
            {guests.map((g) => <li key={g.id} className="card"><Link href={`/recipe-swap#r${g.id}`}><b>{g.title}</b></Link><span className="tiny muted">{g.name ? `by ${g.name}` : "from a guest"} · ♥ {g.hearts}</span>{g.intro && <span className="small">{g.intro}</span>}</li>)}
          </ul>
        ) : <p className="small muted">Got a recipe you love? Be the first to share one.</p>}
        <p className="small"><Link href="/recipe-swap">Swap a recipe of your own →</Link></p>
      </section>
    </div>
  );
}
