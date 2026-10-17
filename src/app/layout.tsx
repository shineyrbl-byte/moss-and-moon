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
import TableBanner from "@/components/TableBanner";
import PwaSetup from "@/components/PwaSetup";
import { getMenu } from "@/lib/menuStore";

// Pages read the live menu from the database, so render them on each request
export const dynamic = "force-dynamic";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-serif" });
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Moss & Moon — slow coffee café",
  description: "Hand-poured coffee, pink lattes and warm bakes. Order ahead, book a table, collect stamps.",
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
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StoreProvider initialMenu={getMenu()}>
          <PaymentProvider>
            <TableBanner />
            <Nav />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <CustomizeModal />
            <BaristaChat />
            <PwaSetup />
          </PaymentProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
