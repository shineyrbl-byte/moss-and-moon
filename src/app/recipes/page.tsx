import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { photo } from "@/lib/menu";
import { getMenu } from "@/lib/menuStore";
import { HOME_RECIPES } from "@/lib/homeRecipes";

export const metadata: Metadata = { title: "Make it at home", description: "Home versions of our favourite drinks. No espresso machine needed." };
export const dynamic = "force-dynamic";

export default function Recipes() {
  const menu = new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m]));
  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">from our counter to your kitchen</p>
      <h1 className="h2">Make it <em>at home</em></h1>
      <p className="lead">Our favourite drinks, rewritten for a home kitchen. No espresso machine needed.</p>
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
    </div>
  );
}
