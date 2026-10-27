import type { Metadata } from "next";

export const metadata: Metadata = { title: "Advent puzzles", description: "Finish a daily puzzle each day from 1 to 24 December to open the advent picture." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
