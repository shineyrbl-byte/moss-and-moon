import type { Metadata } from "next";

export const metadata: Metadata = { title: "Game profile", description: "A player's picture, favourite game and trophies, and your record against them.", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
