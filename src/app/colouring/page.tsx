"use client";
import { useEffect, useState } from "react";
import { COLOUR_PAGES, CRAYONS } from "@/lib/colouring";

const KEY = "mm-colouring";

export default function Colouring() {
  const [pageId, setPageId] = useState(COLOUR_PAGES[0].id);
  const [crayon, setCrayon] = useState(CRAYONS[0]);
  const [fills, setFills] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => { try { setFills(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch {} }, []);
  const save = (f: Record<string, Record<string, string>>) => { setFills(f); try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {} };
  const page = COLOUR_PAGES.find((p) => p.id === pageId)!;
  const mine = fills[pageId] ?? {};
  const paint = (id: string) => save({ ...fills, [pageId]: { ...mine, [id]: crayon } });

  return (
    <div className="page colouring-page" style={{ maxWidth: "46rem" }}>
      <p className="eyebrow no-print">for little ones</p>
      <h1 className="h2 no-print">Colouring <em>pages</em></h1>
      <p className="lead no-print">Pick a colour, then tap a shape to fill it. Or print one for the table: ask us for crayons 🖍</p>
      <div className="chips no-print" role="radiogroup" aria-label="Picture" style={{ justifyContent: "flex-start" }}>
        {COLOUR_PAGES.map((p) => <button key={p.id} role="radio" aria-checked={p.id === pageId} className={`chip ${p.id === pageId ? "on" : ""}`} onClick={() => setPageId(p.id)}>{p.title}</button>)}
      </div>
      <div className="crayons no-print" role="radiogroup" aria-label="Colour">
        {CRAYONS.map((c) => <button key={c} role="radio" aria-checked={crayon === c} aria-label={c === "#ffffff" ? "White (rubber)" : `Colour ${c}`} className={`crayon ${crayon === c ? "on" : ""}`} style={{ background: c }} onClick={() => setCrayon(c)} />)}
      </div>
      <svg className="colour-svg" viewBox="0 0 200 200" role="img" aria-label={`Colouring page: ${page.title}`}>
        {page.areas.map((a) => (
          <path key={a.id} d={a.d} fill={mine[a.id] ?? "#ffffff"} className="colour-area" onClick={() => paint(a.id)} />
        ))}
        {page.lines?.map((d, i) => <path key={i} d={d} className="colour-line" />)}
      </svg>
      <p className="print-only center">Moss &amp; Moon · {page.title}</p>
      <div className="row no-print" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.8rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => save({ ...fills, [pageId]: {} })}>Start again</button>
        <button className="btn btn-pink btn-sm" onClick={() => window.print()}>🖨 Print</button>
      </div>
    </div>
  );
}
