import type { Metadata, Viewport } from "next";
import {
  SITE_URL,
  SITE_DESCRIPTION,
  SITE_ROBOTS,
  pageMetadata,
} from "@/lib/seo";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import PageTransition from "@/components/PageTransition";
import { SpeedInsights } from "@vercel/speed-insights/next";
import HeaderBar from "@/components/HeaderBar";
import GuidePanel from "@/components/GuidePanel";
import { BootstrapProvider } from "@/lib/hooks/useBootstrap";
import { SheetProvider } from "@/components/SheetProvider";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  ...pageMetadata(
    "Predpulse | Prediction Market Indices & Intelligence",
    SITE_DESCRIPTION,
    "/",
  ),
  metadataBase: new URL(SITE_URL),
  robots: SITE_ROBOTS,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <BootstrapProvider>
            <SheetProvider>
              <HeaderBar />
              <PageTransition>{children}</PageTransition>
              <GuidePanel />
            </SheetProvider>
          </BootstrapProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
