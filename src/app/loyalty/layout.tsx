import type { Metadata } from "next";

export const metadata: Metadata = { title: "Stamp card" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
