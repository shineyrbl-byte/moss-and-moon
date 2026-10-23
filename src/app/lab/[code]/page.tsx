"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import LabCard, { type LabCreation } from "@/components/LabCard";

export default function Creation() {
  const { code } = useParams<{ code: string }>();
  const [c, setC] = useState<LabCreation | null | false>(null);
  useEffect(() => { fetch(`/api/lab/${code}`).then((r) => (r.ok ? r.json() : false)).then(setC).catch(() => setC(false)); }, [code]);
  return (
    <div className="page narrow">
      <p className="eyebrow">from the drink lab</p>
      {c === null && <p className="muted">Mixing…</p>}
      {c === false && <><h1 className="h2">That drink has gone</h1><p className="lead">It may have been taken down. <Link href="/lab">Make your own →</Link></p></>}
      {c && <LabCard c={c} big />}
      <p className="small" style={{ marginTop: "1rem" }}><Link href="/lab">🧪 Make your own in the drink lab →</Link></p>
    </div>
  );
}
