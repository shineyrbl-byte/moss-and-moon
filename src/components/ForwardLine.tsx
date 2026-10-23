"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fill } from "@/lib/i18n";
import { useStore } from "./Store";

/** "☕ 6 coffees waiting for whoever needs one" (hidden when there are none) */
export default function ForwardLine() {
  const { t } = useStore();
  const [n, setN] = useState(0);
  useEffect(() => { fetch("/api/pay-forward").then((r) => r.json()).then((d) => setN(d.waiting)).catch(() => {}); }, []);
  if (!n) return null;
  return <p className="forward-line">☕ <Link href="/pay-it-forward">{fill(t(n === 1 ? "forward.one" : "forward.many"), { n })}</Link></p>;
}
