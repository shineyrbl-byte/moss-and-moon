import type { Metadata } from "next";

export const metadata: Metadata = { title: "Now serving" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
