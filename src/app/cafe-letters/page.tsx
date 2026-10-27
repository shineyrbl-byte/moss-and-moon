"use client";
// The game (and the big word list it checks words against) loads just after the page, so the page shows straight away
import dynamic from "next/dynamic";

const Game = dynamic(() => import("./Game"), { ssr: false, loading: () => <div className="page"><p className="eyebrow">a word game</p><h1 className="h2">Café <em>letters</em></h1><p className="muted">Laying out the tiles…</p></div> });

export default function CafeLettersPage() {
  return <Game />;
}
