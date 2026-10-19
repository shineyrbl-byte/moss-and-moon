import type { Metadata } from "next";

export const metadata: Metadata = { title: "Games & books", description: "Board games and books to borrow while you sip. Reserve a game with your table." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
