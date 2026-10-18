// The journal: posts the owner writes in Admin → Journal
import "server-only";
import { db, cleanText } from "./db";
import { askJSON, type JsonSchema } from "./ai";
import { plainText } from "./markdown";

export type Post = { slug: string; title: string; body: string; cover: string | null; status: "draft" | "published"; published_at: string | null; updated_at: string };

export const publishedPosts = (limit = 50) =>
  db.prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ?").all(limit) as Post[];
export const allPosts = () => db.prepare("SELECT * FROM posts ORDER BY COALESCE(published_at, updated_at) DESC").all() as Post[];
export const getPost = (slug: string) => db.prepare("SELECT * FROM posts WHERE slug = ?").get(slug) as Post | undefined;
export const excerpt = (p: Pick<Post, "body">, n = 160) => {
  const t = plainText(p.body).replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n).replace(/\s\S*$/, "")}…` : t;
};
export const readMinutes = (p: Pick<Post, "body">) => Math.max(1, Math.round(plainText(p.body).split(/\s+/).length / 200));

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post";

export function savePost(b: Record<string, unknown>): Post | { error: string } {
  const title = cleanText(b.title, 120);
  const body = String(b.body ?? "").slice(0, 20000).trim();
  if (!title || body.length < 20) return { error: "Add a title and at least a couple of sentences." };
  let cover = String(b.cover ?? "").trim() || null;
  const m = cover && /images\.unsplash\.com\/photo-([\w-]+)/.exec(cover);
  if (m) cover = m[1];
  if (cover && !/^[\w-]+$/.test(cover) && !/^\/api\/uploads\/[\w-]+\.(jpg|png|webp)$/.test(cover)) return { error: "That cover photo link doesn't look right." };
  const status = b.status === "published" ? "published" : "draft";
  let slug = typeof b.slug === "string" && getPost(b.slug) ? b.slug : null;
  if (!slug) {
    slug = slugify(title);
    for (let i = 2; getPost(slug); i++) slug = `${slugify(title)}-${i}`;
    db.prepare("INSERT INTO posts (slug, title, body, cover, status, published_at) VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now','localtime') END)").run(slug, title, body, cover, status, status);
  } else {
    db.prepare(
      `UPDATE posts SET title = ?, body = ?, cover = ?, status = ?, updated_at = datetime('now','localtime'),
         published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now','localtime')) ELSE published_at END WHERE slug = ?`
    ).run(title, body, cover, status, status, slug);
  }
  return getPost(slug)!;
}

export const deletePost = (slug: string) => db.prepare("DELETE FROM posts WHERE slug = ?").run(slug);

export async function draftPost(idea: string) {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      title: { type: "string", description: "A warm, specific title under 70 characters" },
      body: { type: "string", description: "300–500 words in simple marks: '## ' headings, **bold**, '- ' lists, [links](/#menu), blank lines between paragraphs. Friendly, concrete, no made-up facts about the café." },
    },
    required: ["title", "body"],
  };
  const ai = await askJSON<{ title: string; body: string }>(
    "You write blog posts for Moss & Moon, a cosy café with plants, pink lattes and warm bakes. Write like a friendly barista: concrete, a little playful, useful. Don't invent prices, awards or people.",
    `Write a journal post about: ${idea}`,
    schema
  );
  if (ai) return { ...ai.data, by: ai.provider };
  return { title: idea.slice(0, 70) || "A note from the café", body: `Write a few lines about ${idea || "what's new"} here.\n\n## What's new\n- One thing\n- Another\n\n[See the menu](/#menu) ✿`, by: "simple" };
}
