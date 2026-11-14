import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DisclaimerBanner } from "@/components/public/disclaimer-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nagrik | Civic Intelligence & Grievance Coordination",
  description:
    "Telegram-first civic reporting and accountability platform for Sector 4, Kharghar, Navi Mumbai.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased flex flex-col min-h-screen selection:bg-brand-500 selection:text-white">
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
