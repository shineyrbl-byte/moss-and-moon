import type { Metadata } from "next";

export const metadata: Metadata = { title: "Café clubs", description: "Start or join a café club and pool your puzzles on a weekly board." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
