import type { Metadata } from "next";
import { Mukta, Newsreader } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DisclaimerBanner } from "@/components/public/disclaimer-banner";
import "./globals.css";
import "./nagrik-ui.css";

// Mukta (Ek Type): one family that covers Latin and Devanagari, so English,
// हिन्दी and मराठी share the same voice. Self-hosted by next/font at build time.
const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-mukta",
});

// Newsreader: serif display face for section titles only.
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Nagrik | Report any civic problem in Sector 4, Kharghar",
  description:
    "Report garbage, drains, water supply, streetlights, roads, parks and any other civic problem on Telegram, and see photo proof when it's fixed. Sector 4, Kharghar, Navi Mumbai.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`scroll-smooth ${mukta.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <body className="antialiased flex flex-col min-h-screen" suppressHydrationWarning>
        <DisclaimerBanner />
        <Header />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
