"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { voterId } from "@/components/LabCard";
import { todayStr } from "@/lib/archive";
import { addFlag } from "@/lib/trophyFlags";

// The picture: a snowy night outside the café, drawn here and split into 24 tiles (6 across, 4 down)
function Scene() {
  return (
    <g>
      <defs><linearGradient id="ap-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b1d3a" /><stop offset="1" stopColor="#6b4a6e" /></linearGradient></defs>
      <rect width="600" height="400" fill="url(#ap-sky)" />
      <circle cx="510" cy="70" r="34" fill="#f6eee7" /><circle cx="498" cy="62" r="34" fill="#3a2848" />
      {[[60, 40], [140, 90], [250, 30], [330, 80], [420, 40], [560, 150], [90, 150], [380, 140]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={2.2} fill="#fff8d6" />)}
      <rect x="0" y="300" width="600" height="100" fill="#f3f0f6" />
      {/* The café */}
      <rect x="330" y="170" width="220" height="140" fill="#8a5a40" />
      <polygon points="320,170 440,110 560,170" fill="#5a3a2c" />
      <rect x="350" y="200" width="70" height="60" rx="6" fill="#f6da9e" /><rect x="460" y="200" width="70" height="60" rx="6" fill="#f6da9e" />
      <rect x="425" y="240" width="30" height="70" fill="#3b2720" />
      <text x="440" y="160" textAnchor="middle" fontSize="16" fill="#f6eee7" fontFamily="Georgia, serif">Moss &amp; Moon</text>
      {/* The tree */}
      <polygon points="150,120 210,220 90,220" fill="#3f7a4f" /><polygon points="150,170 230,290 70,290" fill="#356b44" />
      <rect x="138" y="290" width="24" height="24" fill="#5a3a2c" />
      <polygon points="150,98 157,114 174,114 160,124 165,140 150,130 135,140 140,124 126,114 143,114" fill="#f6da9e" />
      {[[130, 200, "#e391a8"], [170, 210, "#f6da9e"], [120, 260, "#e8873a"], [180, 255, "#e391a8"], [150, 240, "#a5c8e8"], [100, 280, "#f6da9e"], [200, 280, "#a5c8e8"]].map(([x, y, c], k) => <circle key={k} cx={x as number} cy={y as number} r={7} fill={c as string} />)}
      {/* Presents */}
      <rect x="215" y="285" width="44" height="34" fill="#e391a8" /><rect x="233" y="285" width="8" height="34" fill="#f6eee7" />
      <rect x="265" y="295" width="34" height="24" fill="#a5c8e8" /><rect x="279" y="295" width="6" height="24" fill="#c25b78" />
      {/* Snow */}
      {[...Array(40).keys()].map((k) => <circle key={k} cx={(k * 97) % 600} cy={(k * 53) % 300} r={1.6 + (k % 3) * 0.6} fill="#fff" opacity={0.85} />)}
    </g>
  );
}

export default function AdventPuzzles() {
  const [played, setPlayed] = useState<Set<string> | null>(null);
  useEffect(() => {
    fetch(`/api/trophies?voter=${voterId()}`).then((r) => r.json()).then((d: { played: Record<string, string[]> }) => setPlayed(new Set(Object.values(d.played).flat()))).catch(() => setPlayed(new Set()));
  }, []);
  const today = todayStr(), [y, m, d] = today.split("-").map(Number);
  // In December it's this year's calendar; the rest of the year shows the last one
  const year = m === 12 ? y : y - 1, inDec = m === 12 && d <= 24;
  const dayStr = (n: number) => `${year}-12-${String(n).padStart(2, "0")}`;
  const open = played ? [...Array(24).keys()].map((k) => played.has(dayStr(k + 1))) : Array(24).fill(false);
  const count = open.filter(Boolean).length;
  useEffect(() => { if (count === 24) addFlag("advent-picture"); }, [count]);
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">advent puzzles</p>
      <h1 className="h2">The advent <em>picture</em></h1>
      <p className="small muted">From 1 to 24 December, finish any daily puzzle and that day&apos;s square of the picture opens. Do all 24 and you&apos;ll see the whole Christmas scene. {inDec ? `Today is door ${d}.` : m === 12 ? "December's doors are all done for this year." : `This is your ${year} picture: it starts again on 1 December.`}</p>
      <p className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{count}</b>/24 squares</span></p>
      <svg viewBox="0 0 600 400" className="ap-svg" role="img" aria-label={`The advent picture, ${count} of 24 squares open`}>
        <defs><clipPath id="ap-open">{open.map((o, k) => (o ? <rect key={k} x={(k % 6) * 100} y={Math.floor(k / 6) * 100} width={100} height={100} /> : null))}</clipPath></defs>
        <rect width="600" height="400" fill="#e6cfbd" />
        <g clipPath="url(#ap-open)"><Scene /></g>
        {open.map((o, k) => (o ? null : (
          <g key={k}>
            <rect x={(k % 6) * 100 + 3} y={Math.floor(k / 6) * 100 + 3} width={94} height={94} rx={10} className={`ap-door ${inDec && k + 1 === d ? "today" : ""}`} />
            <text x={(k % 6) * 100 + 50} y={Math.floor(k / 6) * 100 + 62} textAnchor="middle" className="ap-num">{k + 1}</text>
          </g>
        )))}
      </svg>
      {inDec && !open[d - 1] && <p className="center"><Link className="btn btn-pink btn-sm" href="/games">Open today&apos;s square: play a puzzle →</Link></p>}
      <p className="tiny muted">Only puzzles you save to the board count, so it follows you across devices if you&apos;re signed in. Looking for the café&apos;s daily treats instead? That&apos;s the <Link href="/advent">advent calendar</Link>.</p>
    </div>
  );
}
