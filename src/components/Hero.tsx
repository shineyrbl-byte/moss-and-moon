"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { photo } from "@/lib/menu";
import { openStatus } from "@/lib/cafe";
import { BusyBadge } from "./BusyMeter";
import TodayLine from "./TodayLine";
import { useStore } from "./Store";

export default function Hero() {
  const [status, setStatus] = useState<{ open: boolean; text: string } | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const { t, lang } = useStore();
  useEffect(() => {
    const f = () => setStatus(openStatus(new Date(), null, lang));
    const w = () => fetch("/api/queue").then((r) => r.json()).then((d) => setWait(d.minutes)).catch(() => {});
    f();
    w();
    const t = setInterval(() => { f(); w(); }, 60_000);
    return () => clearInterval(t);
  }, [lang]);

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
        <TodayLine />
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
          <Image src={photo("1600093463592-8e36ae95ef56", 1200)} alt="" fill preload fetchPriority="high" quality={60} sizes="(max-width: 900px) 70vw, 35vw" style={{ objectFit: "cover" }} />
        </div>
        <div className="round-img">
          <Image src={photo("1569864358642-9d1684040f43", 600)} alt="" fill sizes="240px" style={{ objectFit: "cover" }} />
        </div>
        <div className="sticker s1">
          <span className="ico">🌸</span>
          <div><strong>Rose Pistachio Latte</strong><span className="muted">{t("hero.sticker1Sub")}</span></div>
        </div>
        <div className="sticker s2">
          <span className="ico">🥐</span>
          <div><strong>{t("hero.sticker2")}</strong><span className="muted">{t("hero.sticker2Sub")}</span></div>
        </div>
        <div className="sticker s3">
          <span className="ico">⏱</span>
          <div><strong>{wait === null ? "…" : `~${wait} min`}</strong><span className="muted">{t("hero.wait")}</span></div>
        </div>
      </div>
    </section>
  );
}
