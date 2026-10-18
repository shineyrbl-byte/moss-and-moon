"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";

// The tray, the drink pop-up and the barista chat aren't needed for the first paint,
// so their code loads just after the page shows.
const CartDrawer = dynamic(() => import("./CartDrawer"), { ssr: false });
const CustomizeModal = dynamic(() => import("./CustomizeModal"), { ssr: false });
const BaristaChat = dynamic(() => import("./BaristaChat"), { ssr: false });

export default function Overlays() {
  return (
    <>
      <CartDrawer />
      <CustomizeModal />
      <Suspense fallback={null}><BaristaChat /></Suspense>
    </>
  );
}
