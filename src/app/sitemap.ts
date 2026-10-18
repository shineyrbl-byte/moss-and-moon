import type { MetadataRoute } from "next";
import { publishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL || "http://localhost:3000";
  const pages = ["", "/journal", "/gift-cards", "/loyalty", "/account", "/noticeboard", "/gift-a-drink", "/catering", "/privacy", "/terms"].map((p) => ({ url: `${site}${p}`, changeFrequency: "weekly" as const, priority: p ? 0.6 : 1 }));
  const posts = publishedPosts(200).map((p) => ({ url: `${site}/journal/${p.slug}`, lastModified: p.updated_at.replace(" ", "T"), changeFrequency: "monthly" as const, priority: 0.5 }));
  return [...pages, ...posts];
}
