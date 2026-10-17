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
  },
};

export default nextConfig;
