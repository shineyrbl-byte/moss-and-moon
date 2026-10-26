import "./page.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { photo } from "@/lib/menu";
import { renderMarkdown } from "@/lib/markdown";
import { excerpt, getPost, publishedPosts, readMinutes } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getPost((await params).slug);
  if (!p || p.status !== "published") return { title: "Journal" };
  return {
    title: p.title,
    description: excerpt(p),
    openGraph: { type: "article", title: p.title, description: excerpt(p), publishedTime: p.published_at ?? undefined, ...(p.cover ? { images: [photo(p.cover, 1200)] } : {}) },
  };
}

export default async function PostPage({ params }: Props) {
  const p = getPost((await params).slug);
  if (!p || p.status !== "published") notFound();
  const more = publishedPosts(4).filter((x) => x.slug !== p.slug).slice(0, 2);
  return (
    <article className="page narrow post">
      <Link href="/journal" className="small muted">← The journal</Link>
      <h1 className="h2" style={{ marginTop: "0.6rem" }}>{p.title}</h1>
      <p className="small muted">{p.published_at && new Date(p.published_at.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {readMinutes(p)} min read</p>
      {p.cover && <div className="post-cover"><Image src={photo(p.cover, 1200)} alt="" fill sizes="(max-width: 700px) 100vw, 40rem" preload /></div>}
      {/* The text was escaped by the formatter, so this HTML is safe */}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.body) }} />
      {more.length > 0 && (
        <aside className="post-more" aria-label="More from the journal">
          <b className="small">More from the journal</b>
          {more.map((m) => <Link key={m.slug} href={`/journal/${m.slug}`}>{m.title} →</Link>)}
        </aside>
      )}
    </article>
  );
}
