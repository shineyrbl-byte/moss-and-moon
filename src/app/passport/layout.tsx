import type { Metadata } from "next";

export const metadata: Metadata = { title: "Origins passport", description: "Collect a stamp for every coffee region we buy from. All eight earns a free drink." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
