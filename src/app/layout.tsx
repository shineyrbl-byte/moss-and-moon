import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/components/Store";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import CustomizeModal from "@/components/CustomizeModal";
import { PaymentProvider } from "@/components/Payment";
import BaristaChat from "@/components/BaristaChat";
import { Suspense } from "react";
import TableBanner from "@/components/TableBanner";
import PwaSetup from "@/components/PwaSetup";
import { getMenu } from "@/lib/menuStore";
import SeasonLayer from "@/components/SeasonLayer";
import ErrorReporter from "@/components/ErrorReporter";
import StatsBeacon from "@/components/StatsBeacon";
import { currentSeason } from "@/lib/seasonStore";
import { fullConfig } from "@/lib/cafeConfig";

// Pages read the live menu from the database, so render them on each request
export const dynamic = "force-dynamic";

// Variable fonts: one file covers every weight, so fewer downloads before the page shows
const serif = Cormorant_Garamond({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif" });
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

const SITE = process.env.SITE_URL || "http://localhost:3000";
const DESCRIPTION = "Hand-poured coffee, pink lattes and warm bakes. Order ahead, book a table, collect stamps.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Moss & Moon · slow coffee café", template: "%s · Moss & Moon" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Moss & Moon", title: "Moss & Moon · slow coffee café", description: DESCRIPTION, locale: "en_IN", url: "/" },
  twitter: { card: "summary_large_image", title: "Moss & Moon · slow coffee café", description: DESCRIPTION },
  applicationName: "Moss & Moon",
  appleWebApp: { capable: true, title: "Moss & Moon", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6eee7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a120e" },
  ],
};

// Sets the theme before the page paints, so there's no flash of the wrong colours.
const themeScript = `try{var t=localStorage.getItem('mm-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const season = currentSeason();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} data-season={season ?? undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StoreProvider initialMenu={getMenu()} config={fullConfig()}>
          <PaymentProvider>
            <SeasonLayer season={season} />
            <TableBanner />
            <Nav />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <CustomizeModal />
            <Suspense fallback={null}><BaristaChat /></Suspense>
            <PwaSetup />
            <ErrorReporter />
            <StatsBeacon />
          </PaymentProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
