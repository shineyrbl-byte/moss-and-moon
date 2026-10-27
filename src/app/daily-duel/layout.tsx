import type { Metadata } from "next";

export const metadata: Metadata = { title: "Daily duel", description: "Race a stranger on today's puzzle." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
