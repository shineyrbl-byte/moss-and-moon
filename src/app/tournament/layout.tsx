import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mini tournaments", description: "A knockout for friends on a daily puzzle, one round a day." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
