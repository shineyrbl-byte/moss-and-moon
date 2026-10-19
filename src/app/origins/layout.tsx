import type { Metadata } from "next";

export const metadata: Metadata = { title: "Where our coffee comes from", description: "A map of the South Indian hills our beans grow in, and what each one tastes like." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
