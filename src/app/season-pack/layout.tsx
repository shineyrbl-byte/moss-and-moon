import type { Metadata } from "next";

export const metadata: Metadata = { title: "Season pack", description: "Themed puzzles for Diwali, Christmas and the monsoon, with a board for each season." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
