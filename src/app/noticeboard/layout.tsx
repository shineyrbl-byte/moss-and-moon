import type { Metadata } from "next";

export const metadata: Metadata = { title: "Noticeboard", description: "Lost & found, study buddies and book swaps at Moss & Moon." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
