import type { Metadata } from "next";

export const metadata: Metadata = { title: "Drink lab", description: "Mix your own drink, name it, share it. Friends can order it in one tap." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
