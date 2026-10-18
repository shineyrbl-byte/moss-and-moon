"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { photo } from "@/lib/menu";
import { openStatus } from "@/lib/cafe";
import { BusyBadge } from "./BusyMeter";
import { useStore } from "./Store";

export default function Hero() {
  const [status, setStatus] = useState<{ open: boolean; text: string } | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const { t } = useStore();
  useEffect(() => {
    const f = () => setStatus(openStatus());
    const w = () => fetch("/api/queue").then((r) => r.json()).then((d) => setWait(d.minutes)).catch(() => {});
    f();
    w();
    const t = setInterval(() => { f(); w(); }, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="section hero" id="top">
      <div>
        <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
          <div className="status-pill" style={{ visibility: status ? "visible" : "hidden" }}>
            <span className={`dot ${status?.open ? "" : "closed"}`} />
            {status?.text ?? "…"}
          </div>
          <BusyBadge />
        </div>
        <h1>
          {t("hero.title1")} <br />
          <em>{t("hero.title2")}</em>
        </h1>
        <p className="lead">
          {t("hero.lead")}
        </p>
        <div className="hero-actions">
          <Link href="#menu" className="btn btn-pink">{t("hero.order")}</Link>
          <Link href="#visit" className="btn btn-ghost">{t("hero.book")}</Link>
        </div>
      </div>

      <div className="hero-art" aria-hidden>
        <div className="blob b1" />
        <div className="blob b2" />
        <span className="moon">☾</span>
        <div className="arch-img">
          <Image src={photo("1600093463592-8e36ae95ef56", 1200)} alt="" fill priority sizes="(max-width: 900px) 70vw, 35vw" style={{ objectFit: "cover" }} />
        </div>
        <div className="round-img">
          <Image src={photo("1569864358642-9d1684040f43", 600)} alt="" fill sizes="240px" style={{ objectFit: "cover" }} />
        </div>
        <div className="sticker s1">
          <span className="ico">🌸</span>
          <div><strong>Rose Pistachio Latte</strong><span className="muted">this season&apos;s pink pick</span></div>
        </div>
        <div className="sticker s2">
          <span className="ico">🥐</span>
          <div><strong>Baked at 6am</strong><span className="muted">every single day</span></div>
        </div>
        <div className="sticker s3">
          <span className="ico">⏱</span>
          <div><strong>{wait === null ? "…" : `~${wait} min`}</strong><span className="muted">{t("hero.wait")}</span></div>
        </div>
      </div>
    </section>
  );
}
