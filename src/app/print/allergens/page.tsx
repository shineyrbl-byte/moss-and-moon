import type { Metadata } from "next";
import { getMenu } from "@/lib/menuStore";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/menu";
import { ALLERGENS, allergensFor } from "@/lib/nutrition";
import { defaultOptions, drinkChoices, isDrink } from "@/lib/pricing";
import PrintButton from "../menu/PrintButton";

export const metadata: Metadata = { title: "Allergen chart", robots: { index: false } };
export const dynamic = "force-dynamic";

// Every item and the allergens it contains (as normally made), for the counter and inspections
export default function AllergenChart() {
  const menu = getMenu({ includeHidden: false }).filter((m) => m.cat !== "shop");
  const sections = CATEGORY_ORDER.filter((c) => c !== "shop").map((c) => ({ id: c, label: CATEGORIES.find((x) => x.id === c)?.label ?? c, items: menu.filter((m) => m.cat === c) })).filter((s) => s.items.length);
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="menu-card allergen-card">
      <PrintButton />
      <header className="mc-head">
        <h1>Moss <em>&amp;</em> Moon</h1>
        <p>Allergen chart · as made by default · updated {today}</p>
      </header>
      <table className="al-table">
        <thead>
          <tr><th scope="col">Item</th>{ALLERGENS.map((a) => <th key={a.id} scope="col">{a.icon}<br />{a.label}</th>)}<th scope="col">🌱<br />Vegan</th><th scope="col">GF</th></tr>
        </thead>
        {sections.map((s) => (
          <tbody key={s.id}>
            <tr className="al-section"><th colSpan={ALLERGENS.length + 3} scope="colgroup">{s.label}</th></tr>
            {s.items.map((m) => {
              const al = allergensFor(m, defaultOptions(m));
              const milkSwap = isDrink(m.cat) && drinkChoices(m).milk && al.includes("milk");
              return (
                <tr key={m.id}>
                  <th scope="row">{m.name}{milkSwap && <small> · plant milk on request</small>}</th>
                  {ALLERGENS.map((a) => <td key={a.id}>{al.includes(a.id) ? "●" : ""}</td>)}
                  <td>{m.diet?.includes("vegan") ? "✓" : ""}</td>
                  <td>{m.diet?.includes("gf") ? "✓" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
      <footer className="mc-foot" style={{ display: "block" }}>
        <p>● = contains. Toppings, syrups and add-ons can add allergens: please ask. Our kitchen handles nuts, gluten, milk, egg, soy and sesame, so traces are possible in anything. Tell us about severe allergies before ordering.</p>
      </footer>
    </div>
  );
}
