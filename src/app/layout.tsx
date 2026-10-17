import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/components/Store";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import CustomizeModal from "@/components/CustomizeModal";
import { PaymentProvider } from "@/components/Payment";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-serif" });
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Moss & Moon — slow coffee café",
  description: "Hand-poured coffee, pink lattes and warm bakes. Order ahead, book a table, collect stamps.",
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
        <StoreProvider>
          <PaymentProvider>
            <Nav />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <CustomizeModal />
          </PaymentProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
