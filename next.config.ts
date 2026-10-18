import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Node packages used by API routes
  serverExternalPackages: ["web-push"],
  async headers() {
    // The service worker must always be fresh
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    // AVIF is about 20% smaller than WebP for photos; browsers that can't show it get WebP
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75],
    // Resized photos are kept for 30 days instead of being remade
    minimumCacheTTL: 2_592_000,
  },
  experimental: {
    // Put the (small) stylesheet straight into the page so it doesn't block the first paint
    inlineCss: true,
  },
};

export default nextConfig;
