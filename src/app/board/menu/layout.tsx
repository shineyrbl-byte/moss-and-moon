import type { Metadata } from "next";

export const metadata: Metadata = { title: "Menu board", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
