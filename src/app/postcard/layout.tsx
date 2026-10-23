import type { Metadata } from "next";

export const metadata: Metadata = { title: "Send a postcard", description: "Send a little postcard from Moss & Moon, with a gifted drink if you like." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
