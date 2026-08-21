import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "../components/app-providers";
import { ForumoHeader } from "../components/forumo-header";
import { ForumoFooter } from "../components/forumo-footer";
import { CookieConsent } from "../components/cookie-consent";
import { TosModal } from "../components/tos-modal";
import { Geist } from "next/font/google";
import { cn } from "../lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Forumo Marketplace",
  description: "Escrow-protected marketplace for Africa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen">
        <AppProviders>
          <ForumoHeader />
          <main>{children}</main>
          <ForumoFooter />
          <CookieConsent />
          <TosModal />
        </AppProviders>
      </body>
    </html>
  );
}
