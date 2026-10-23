import type { Metadata } from "next";

export const metadata: Metadata = { title: "Coffee bingo", description: "A new 4×4 card of drinks and bakes every month. Order a square to stamp it; a full line earns a treat." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
