import type { Metadata } from "next";

export const metadata: Metadata = { title: "Practice puzzles", description: "Unlimited practice puzzles from old days: off the boards, as many as you like." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
