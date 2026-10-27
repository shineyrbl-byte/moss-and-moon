import type { Metadata } from "next";

export const metadata: Metadata = { title: "Weekend puzzle hunt", description: "Every weekend, five pages around the café site hide a key. Follow the riddles to find them all." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
