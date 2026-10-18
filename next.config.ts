import type { NextConfig } from "next";

// Security headers for every page. The content policy only allows scripts, frames and
// connections from this site, Razorpay (payments) and OpenStreetMap (the map).
function securityHeaders() {
  const https = (process.env.SITE_URL ?? "").startsWith("https://");
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.razorpay.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.razorpay.com",
    "frame-src https://*.razorpay.com https://www.openstreetmap.org",
    "media-src 'self' blob: data:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  return [
    // Next.js's own development tools need looser rules, so the policy is for the live site only
    ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: 'camera=(), geolocation=(), microphone=(self), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com"), interest-cohort=()' },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native Node packages used by API routes
  serverExternalPackages: ["web-push"],
  async headers() {
    return [
      // The service worker must always be fresh
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/:path*", headers: securityHeaders() },
    ];
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
