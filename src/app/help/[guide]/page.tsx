import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES } from "@/lib/guides";
import { renderMarkdown } from "@/lib/markdown";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Guide", robots: { index: false } };

// /help/barista and /help/owner: the staff guides, printable
export default async function Guide({ params }: { params: Promise<{ guide: string }> }) {
  const g = GUIDES[(await params).guide];
  if (!g) notFound();
  return (
    <div className="page narrow guide">
      <p className="eyebrow">staff help</p>
      <h1 className="h2">{g.title}</h1>
      <p className="lead">{g.intro}</p>
      <PrintButton />
      <article className="post-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(g.body) }} />
      <p className="small muted" style={{ marginTop: "2rem" }}>Also see the <Link href={`/help/${(await params).guide === "owner" ? "barista" : "owner"}`}>{(await params).guide === "owner" ? "barista" : "owner"} guide</Link>.</p>
    </div>
  );
}
