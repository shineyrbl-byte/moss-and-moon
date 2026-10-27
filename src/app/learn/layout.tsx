import type { Metadata } from "next";

export const metadata: Metadata = { title: "Learn to play", description: "Tiny step-by-step versions of the logic puzzles, with tips, for first-timers." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
