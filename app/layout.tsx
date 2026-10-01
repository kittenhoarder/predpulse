import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import PageTransition from "@/components/PageTransition";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://predpulse.xyz"),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  title: "Predpulse — Prediction Market Intelligence",
  description:
    "Hourly prediction market observations across Polymarket, Kalshi and Manifold, with visual indices of changes in market expectations.",
  openGraph: {
    title: "Predpulse — Prediction Market Intelligence",
    description: "Prediction market observations and visual Belief Shift indices.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Predpulse — Prediction Market Intelligence",
    description: "Prediction market observations and visual Belief Shift indices.",
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
          <PageTransition>{children}</PageTransition>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
