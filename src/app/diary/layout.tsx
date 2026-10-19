import type { Metadata } from "next";

export const metadata: Metadata = { title: "Coffee diary", description: "Log the coffees you try, rate them and discover your taste." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
