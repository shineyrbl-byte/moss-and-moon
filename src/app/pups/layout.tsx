import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pups at Moss & Moon", description: "Dog treats, pup cups and the wall of regular pups. Dogs are welcome on the terrace." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
