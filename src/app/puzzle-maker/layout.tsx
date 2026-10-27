import type { Metadata } from "next";

export const metadata: Metadata = { title: "Puzzle maker", description: "Make a mini sudoku with exactly one answer and share it with a friend." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
