import Image from "next/image";
import { PLANTS } from "@/lib/plants";
import { photo } from "@/lib/menu";
import Noticeboard from "@/components/Noticeboard";

export default function Plants() {
  return (
    <div className="page" style={{ maxWidth: "64rem" }}>
      <p className="eyebrow">the moss in moss &amp; moon</p>
      <h1 className="h2">Plant <em>corner</em></h1>
      <p className="lead">Meet the plants you sit beside, and how to keep one happy at home. Got a spare cutting? Swap it on the board below.</p>
      <div className="plant-grid">
        {PLANTS.map((p) => (
          <article key={p.id} className="card plant">
            <div className="plant-photo"><Image src={photo(p.img, 500)} alt={p.name} fill sizes="(max-width: 600px) 90vw, 300px" style={{ objectFit: "cover" }} /></div>
            <div style={{ padding: "0.9rem 1rem 1rem" }}>
              <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{p.name}</h2>
              {p.also && <span className="tiny muted">{p.also}</span>}
              <p className="small muted" style={{ margin: "0.3rem 0 0.5rem" }}>📍 {p.where}</p>
              <ul className="plant-care small">
                <li>☀️ {p.light}</li>
                <li>💧 {p.water}</li>
                <li>{p.petSafe ? "🐾 Safe for cats and dogs" : "⚠️ Keep away from pets"}</li>
                {p.cuttings && <li>✂️ Grows from cuttings: ask us for one</li>}
              </ul>
              <p className="small" style={{ margin: "0.5rem 0 0" }}>{p.tip}</p>
            </div>
          </article>
        ))}
      </div>
      <h2 className="h3" style={{ marginTop: "2.2rem" }}>Cutting swap 🌿</h2>
      <p className="small muted">Pin what you can offer or what you&apos;re after. Leave cuttings at the counter with your name on, and we&apos;ll pass them on.</p>
      <div style={{ marginTop: "1rem" }}><Noticeboard only="plant" /></div>
    </div>
  );
}
