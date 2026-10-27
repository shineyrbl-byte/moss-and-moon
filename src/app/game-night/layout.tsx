import type { Metadata } from "next";

export const metadata: Metadata = { title: "Board-game night", description: "Book seats for the café's weekly board-game night and say which game you'd like to play." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
