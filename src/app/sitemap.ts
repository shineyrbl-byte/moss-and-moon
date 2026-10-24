import { HOME_RECIPES } from "@/lib/homeRecipes";
import type { MetadataRoute } from "next";
import { publishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL || "http://localhost:3000";
  const pages = ["", "/journal", "/recipes", "/brew", "/origins", "/passport", "/lab", "/shelf", "/play", "/team", "/postcard", "/advent", "/bingo", "/focus", "/songs", "/pups", "/trivia", "/plants", "/colouring", "/pay-it-forward", "/word", "/fortune", "/letters", "/bring-it-back", "/nearby", "/doodles", "/book-club", "/konkani", "/memory", "/wish-tree", "/sunset", "/cups-saved", "/moon", "/blind-date", "/poll", "/stories", "/connections", "/slide", "/scoreboard", "/fruit-calendar", "/kind-notes", "/lost-found", "/menu-explorer", "/latte-art", "/word-search", "/sudoku", "/i-spy", "/recipe-swap", "/gift-cards", "/loyalty", "/account", "/noticeboard", "/gift-a-drink", "/catering", "/cakes", "/privacy", "/terms"].map((p) => ({ url: `${site}${p}`, changeFrequency: "weekly" as const, priority: p ? 0.6 : 1 }));
  const recipes = HOME_RECIPES.map((r) => ({ url: `${site}/recipes/${r.id}`, changeFrequency: "monthly" as const, priority: 0.5 }));
  const posts = publishedPosts(200).map((p) => ({ url: `${site}/journal/${p.slug}`, lastModified: p.updated_at.replace(" ", "T"), changeFrequency: "monthly" as const, priority: 0.5 }));
  return [...pages, ...recipes, ...posts];
}
