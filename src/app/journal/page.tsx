import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { photo } from "@/lib/menu";
import { excerpt, publishedPosts, readMinutes } from "@/lib/posts";

export const metadata: Metadata = { title: "Journal", description: "Notes from Moss & Moon: new drinks, how we brew, and what's coming up." };

const when = (d: string | null) => (d ? new Date(d.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

export default function Journal() {
  const posts = publishedPosts();
  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">the journal</p>
      <h1 className="h2">Notes from <em>the counter</em></h1>
      <p className="lead">New drinks, how we brew, and what&apos;s coming up at Moss &amp; Moon.</p>
      <div className="journal-grid">
        {posts.map((p) => (
          <Link key={p.slug} href={`/journal/${p.slug}`} className="journal-card card">
            {p.cover && <div className="journal-cover"><Image src={photo(p.cover, 700)} alt="" fill sizes="(max-width: 700px) 100vw, 30rem" /></div>}
            <div className="journal-body">
              <span className="small muted">{when(p.published_at)} · {readMinutes(p)} min read</span>
              <h2 className="h3">{p.title}</h2>
              <p className="small">{excerpt(p)}</p>
            </div>
          </Link>
        ))}
        {!posts.length && <p className="muted">Nothing here yet. Check back soon ✿</p>}
      </div>
    </div>
  );
}
