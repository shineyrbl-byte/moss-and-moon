import type { Metadata } from "next";

export const metadata: Metadata = { title: "Slow games", description: "Play Connect four or reversi with a friend by link, one move whenever you like." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
