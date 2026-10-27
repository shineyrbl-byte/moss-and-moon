import "../games/page.css";
import Link from "next/link";
import { getMenu } from "@/lib/menuStore";
import { rupees } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Things for little ones, in one place: the kids' menu, things to draw and find, and easy games
const PLAY = [
  { href: "/colouring", emoji: "🖍", title: "Colouring pages", blurb: "Print one, or colour it in on the screen" },
  { href: "/i-spy", emoji: "🔍", title: "I spy", blurb: "Find things around the café" },
  { href: "/memory", emoji: "🃏", title: "Memory match", blurb: "Turn over the cards and find the pairs" },
  { href: "/slide", emoji: "🧩", title: "Slide puzzle", blurb: "Slide the squares back into the picture" },
  { href: "/pop-the-cupcakes", emoji: "🧁", title: "Pop the cupcakes", blurb: "Tap them before they float away" },
  { href: "/cake-stacker", emoji: "🎂", title: "Cake stacker", blurb: "Stack the layers as high as you can" },
  { href: "/bean-snake", emoji: "🐍", title: "Bean snake", blurb: "Gobble the beans, don't bump your tail" },
  { href: "/spot-the-difference", emoji: "👀", title: "Spot the difference", blurb: "Two pictures, a few changes" },
];

export default function Kids() {
  const kids = getMenu().filter((m) => m.kids && !m.hidden);
  return (
    <div className="page" style={{ maxWidth: "46rem" }}>
      <p className="eyebrow">for little ones</p>
      <h1 className="h2">Kids&apos; <em>corner</em></h1>
      <p className="lead">Something to eat, something to draw and something to play while the grown-ups finish their coffee.</p>
      {kids.length > 0 && (
        <section className="card" style={{ padding: "1rem 1.2rem", margin: "1rem 0" }} aria-labelledby="kids-menu">
          <h2 className="h3" id="kids-menu" style={{ marginTop: 0 }}>🥞 The kids&apos; menu</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {kids.map((m) => <li key={m.id} style={{ marginBottom: "0.3rem" }}><b>{m.name}</b> · {rupees(m.price)}<br /><span className="muted">{m.desc}</span></li>)}
          </ul>
          <p className="small" style={{ margin: "0.6rem 0 0" }}><Link href="/#menu">Order from the menu →</Link></p>
        </section>
      )}
      <h2 className="h3">🎨 Draw, find and play</h2>
      <ul className="games-grid" style={{ marginTop: "0.6rem" }}>
        {PLAY.map((p) => (
          <li key={p.href} className="games-li">
            <Link href={p.href} className="card games-tile"><span className="games-emoji" aria-hidden="true">{p.emoji}</span><b>{p.title}</b><span className="small muted">{p.blurb}</span></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
