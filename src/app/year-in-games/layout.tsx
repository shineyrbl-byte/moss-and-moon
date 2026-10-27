import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your year in games", description: "Your last twelve months of puzzles and arcade scores at Moss & Moon." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
