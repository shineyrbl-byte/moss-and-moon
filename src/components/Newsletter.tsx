"use client";
import { useState } from "react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "done" | string>("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json();
    setState(r.ok ? "done" : d.error);
  }

  return (
    <section className="newsletter">
      <div>
        <p className="eyebrow">the pink post</p>
        <h2 style={{ fontSize: "2.2rem", marginBottom: "0.3rem" }}>Seasonal menus, <em>straight to you</em></h2>
        <p className="muted">One cosy email a month. New drinks, events and secret promo codes.</p>
      </div>
      {state === "done" ? (
        <p className="serif" style={{ fontSize: "1.6rem" }}>You&apos;re in! Check your inbox for a little something ✿</p>
      ) : (
        <form onSubmit={submit}>
          <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-pink">Subscribe</button>
          {state !== "idle" && <p className="error small">{state}</p>}
        </form>
      )}
    </section>
  );
}
