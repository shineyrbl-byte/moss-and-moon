import type { Metadata } from "next";

export const metadata: Metadata = { title: "Where in Goa?", description: "A daily photo of somewhere in Goa. Where was it taken?" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
