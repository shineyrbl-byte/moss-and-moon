"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Postcard, { type Design } from "@/components/Postcard";

type P = { design: Design; from: string; to: string; message: string; gift: { code: string; item: string; claimed: boolean } | null };

export default function ViewPostcard() {
  const { code } = useParams<{ code: string }>();
  const [p, setP] = useState<P | null | false>(null);
  useEffect(() => { fetch(`/api/postcards/${code}`).then((r) => (r.ok ? r.json() : false)).then(setP).catch(() => setP(false)); }, [code]);
  return (
    <div className="page narrow center">
      {p === null && <p className="muted">The postman is on his way…</p>}
      {p === false && <><h1 className="h2">No postcard here</h1><p className="lead">The link may be wrong. <Link href="/postcard">Send one yourself →</Link></p></>}
      {p && (
        <>
          <p className="eyebrow">💌 for {p.to}</p>
          <h1 className="h2">{p.from} sent you <em>a postcard</em></h1>
          <div style={{ margin: "1.2rem 0" }}><Postcard c={p} /></div>
          <p className="small"><Link href="/postcard">Send one back →</Link> · <Link href="/#menu">See the menu</Link></p>
        </>
      )}
    </div>
  );
}
