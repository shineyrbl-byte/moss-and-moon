import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL || "http://localhost:3000";
  return ["", "/gift-cards", "/loyalty", "/account"].map((p) => ({ url: `${site}${p}`, changeFrequency: "weekly", priority: p ? 0.6 : 1 }));
}
