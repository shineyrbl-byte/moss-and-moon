"use client";
import { useEffect, useState } from "react";

/** Order page, once it's made: a quick 👍/👎 for each thing in it */
export default function RateItems({ code, lines }: { code: string; lines: { itemId: string; name: string }[] }) {
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  useEffect(() => { fetch(`/api/orders/${code}/rate`).then((r) => r.json()).then(setVotes).catch(() => {}); }, [code]);
  const items = lines.filter((l, i) => lines.findIndex((x) => x.itemId === l.itemId) === i);
  async function vote(itemId: string, up: boolean) {
    setVotes((v) => ({ ...v, [itemId]: up }));
    await fetch(`/api/orders/${code}/rate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, up }) }).catch(() => {});
  }
  const all = items.every((l) => l.itemId in votes);
  return (
    <div className="card rate-items">
      <b>{all ? "Thanks for telling us 🌸" : "How was everything?"}</b>
      {items.map((l) => (
        <div key={l.itemId} className="rate-row">
          <span>{l.name}</span>
          <span className="row" style={{ gap: "0.3rem" }}>
            <button className={`chip ${votes[l.itemId] === true ? "on" : ""}`} aria-pressed={votes[l.itemId] === true} aria-label={`Loved the ${l.name}`} onClick={() => vote(l.itemId, true)}>👍</button>
            <button className={`chip ${votes[l.itemId] === false ? "on" : ""}`} aria-pressed={votes[l.itemId] === false} aria-label={`Didn't love the ${l.name}`} onClick={() => vote(l.itemId, false)}>👎</button>
          </span>
        </div>
      ))}
    </div>
  );
}
