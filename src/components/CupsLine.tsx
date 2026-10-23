"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fill } from "@/lib/i18n";
import { useStore } from "./Store";

/** "♻️ 42 cups saved this month by guests who brought their own" (hidden until there's one) */
export default function CupsLine() {
  const { t } = useStore();
  const [n, setN] = useState(0);
  useEffect(() => { fetch("/api/cups").then((r) => r.json()).then((d) => setN(d.thisMonth)).catch(() => {}); }, []);
  if (!n) return null;
  return <p className="forward-line">♻️ <Link href="/cups-saved">{fill(t(n === 1 ? "cups.one" : "cups.many"), { n })}</Link></p>;
}
