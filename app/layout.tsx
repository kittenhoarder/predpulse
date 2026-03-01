import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Predpulse — Prediction Market Intelligence",
  description:
    "Real-time dashboard tracking prediction market movers across Polymarket, Kalshi & Manifold. Featuring the Predpulse proprietary category sentiment index.",
  openGraph: {
    title: "Predpulse — Prediction Market Intelligence",
    description: "Real-time movers, gainers, and the Predpulse sentiment index across Polymarket & Kalshi.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Predpulse — Prediction Market Intelligence",
    description: "Real-time movers, gainers, and the Predpulse sentiment index across Polymarket & Kalshi.",
  },
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
