"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rupees } from "@/lib/pricing";

type Y = {
  name: string | null; since: string; visits: number; cups: number; spent: number; when: string | null;
  top: { name: string; times: number }[]; tried: number; busiestMonth: { month: string; visits: number } | null;
  bestStreak: number; badges: number; badgesTotal: number; stamps: number; bingos: number; triviaBest: number; caffeine: number; forward: number;
};

/** Draw the share card: 1080×1350, café colours */
function drawCard(c: HTMLCanvasElement, y: Y, serif: string, sans: string) {
  const W = 1080, H = 1350, x = c.getContext("2d")!;
  c.width = W; c.height = H;
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#fbe3ea"); g.addColorStop(1, "#f3e6d8");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(194,91,120,0.12)";
  x.beginPath(); x.arc(900, 180, 260, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#3b2a24"; x.font = `600 46px ${serif}`; x.fillText("Moss & Moon", 80, 130);
  x.fillStyle = "#8a6a5c"; x.font = `500 30px ${sans}`; x.fillText(`${y.name ? `${y.name}'s` : "My"} year in coffee`, 80, 185);
  x.fillStyle = "#c25b78"; x.font = `italic 600 120px ${serif}`; x.fillText(`${y.cups}`, 80, 360);
  const numW = x.measureText(`${y.cups}`).width;
  x.fillStyle = "#3b2a24"; x.font = `500 40px ${sans}`; x.fillText(y.cups === 1 ? "drink" : "drinks", 80 + numW + 22, 350);
  const stats: [string, string][] = [
    [`${y.visits}`, "visits"], [`${y.tried}`, "different things tried"], [`${y.bestStreak}`, "best day streak"],
    [`${y.badges}`, "badges"], [`${y.stamps}/8`, "passport stamps"], [y.busiestMonth?.month ?? "–", "busiest month"],
  ];
  stats.forEach(([v, l], i) => {
    const cx = 80 + (i % 2) * 470, cy = 440 + Math.floor(i / 2) * 190;
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.beginPath(); x.roundRect(cx, cy, 440, 160, 28); x.fill();
    x.fillStyle = "#3b2a24"; x.font = `600 60px ${serif}`; x.fillText(v, cx + 32, cy + 82);
    x.fillStyle = "#8a6a5c"; x.font = `400 28px ${sans}`; x.fillText(l, cx + 32, cy + 128);
  });
  if (y.top[0]) {
    x.fillStyle = "#3b2a24"; x.font = `500 32px ${sans}`; x.fillText("Your favourite", 80, 1060);
    x.fillStyle = "#c25b78"; x.font = `600 56px ${serif}`;
    let fav = y.top[0].name; while (x.measureText(fav).width > 900 && fav.length > 4) fav = fav.slice(0, -2);
    x.fillText(fav === y.top[0].name ? fav : `${fav}…`, 80, 1130);
    x.fillStyle = "#8a6a5c"; x.font = `400 28px ${sans}`; x.fillText(`${y.top[0].times} times${y.when ? ` · ${y.when}` : ""}`, 80, 1178);
  }
  x.fillStyle = "#8a6a5c"; x.font = `400 26px ${sans}`; x.fillText("14 Willow Lane ☾", 80, H - 70);
}

export default function Year() {
  const [y, setY] = useState<Y | null>(null);
  const [out, setOut] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { fetch("/api/account/year").then(async (r) => { if (r.status === 401) return setOut(true); setY(await r.json()); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!y || !canvas.current) return;
    const h1 = document.querySelector("h1");
    const serif = h1 ? getComputedStyle(h1).fontFamily : "Georgia, serif";
    const sans = getComputedStyle(document.body).fontFamily;
    document.fonts.ready.then(() => canvas.current && drawCard(canvas.current, y, serif, sans));
  }, [y]);
  async function save() {
    const c = canvas.current!;
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) return;
    const file = new File([blob], "my-year-at-moss-and-moon.png", { type: "image/png" });
    try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: "My year at Moss & Moon" }); } catch { return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  if (out) return (
    <div className="page narrow center">
      <span style={{ fontSize: "3rem" }}>🗓</span>
      <h1 className="h2">Your year at <em>Moss &amp; Moon</em></h1>
      <p className="lead">Your last 12 months in coffee: favourites, streaks and badges.</p>
      <Link className="btn btn-pink" href="/account">Sign in to see yours</Link>
      <p className="small" style={{ marginTop: "1rem" }}><Link href="/year-in-games">🎮 Or see your year in games →</Link></p>
    </div>
  );
  if (!y) return <div className="page narrow"><p className="muted">Counting your cups…</p></div>;
  if (!y.visits) return (
    <div className="page narrow center">
      <h1 className="h2">Your year at <em>Moss &amp; Moon</em></h1>
      <p className="lead">No orders in the last 12 months yet. Come say hi, and this page will fill up ✿</p>
      <Link className="btn btn-pink" href="/#menu">See the menu</Link>
      <p className="small" style={{ marginTop: "1rem" }}><Link href="/year-in-games">🎮 Your year in games →</Link></p>
    </div>
  );
  const tile = (v: React.ReactNode, l: string) => <div className="year-tile"><b>{v}</b><span className="small muted">{l}</span></div>;
  return (
    <div className="page" style={{ maxWidth: "52rem" }}>
      <p className="eyebrow">the last 12 months</p>
      <h1 className="h2">{y.name ? `${y.name}, your` : "Your"} year at <em>Moss &amp; Moon</em></h1>
      <p className="small"><Link href="/year-in-games">🎮 And your year in games →</Link></p>
      <p className="lead">{y.cups} drinks over {y.visits} visits{y.when ? `. You're ${y.when}` : ""} ☕</p>
      <div className="year-grid">
        {tile(y.tried, "different things tried")}
        {tile(rupees(y.spent), "of treats")}
        {tile(y.bestStreak, "best day streak")}
        {tile(y.busiestMonth?.month ?? "–", "busiest month")}
        {tile(`${y.badges} / ${y.badgesTotal}`, "badges earned")}
        {tile(`${y.stamps} / 8`, "passport stamps")}
        {y.bingos > 0 && tile(y.bingos, "bingo treats")}
        {y.triviaBest > 0 && tile(y.triviaBest, "trivia days in a row")}
        {y.caffeine > 0 && tile(`${Math.round(y.caffeine / 1000 * 10) / 10} g`, "caffeine logged")}
        {y.forward > 0 && tile(y.forward, "coffees paid forward 💛")}
      </div>
      {y.top.length > 0 && (
        <section className="card" style={{ padding: "1rem 1.2rem", marginTop: "1rem" }}>
          <h2 style={{ fontSize: "1.2rem", margin: "0 0 0.5rem" }}>Your top three</h2>
          <ol className="year-top">{y.top.map((t) => <li key={t.name}><b>{t.name}</b> <span className="muted small">· {t.times} times</span></li>)}</ol>
        </section>
      )}
      <h2 className="h3" style={{ marginTop: "1.8rem" }}>Your card</h2>
      <canvas ref={canvas} className="year-card" aria-label={`Share card: ${y.cups} drinks, ${y.visits} visits`} />
      <div className="row" style={{ justifyContent: "center", marginTop: "0.8rem" }}>
        <button className="btn btn-pink" onClick={save}>⬇ Save or share the card</button>
      </div>
      <p className="tiny muted center">Member since {new Date(`${y.since}T12:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}. Only you can see this page.</p>
    </div>
  );
}
