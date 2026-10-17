import type { MetadataRoute } from "next";

// Makes the site installable as an app ("Add to Home Screen")
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moss & Moon Café",
    short_name: "Moss & Moon",
    description: "Order ahead, pay, collect stamps and get pinged when your coffee is ready.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6eee7",
    theme_color: "#3b2720",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Menu", url: "/#menu" },
      { name: "My orders", url: "/orders" },
      { name: "Stamp card", url: "/loyalty" },
    ],
  };
}
