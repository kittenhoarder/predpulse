import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Predmove — Polymarket Movers",
  description:
    "Real-time dashboard tracking the biggest movers, top gainers, and most active prediction markets on Polymarket.",
  openGraph: {
    title: "Predmove — Polymarket Movers",
    description: "The CNBC Movers board for prediction markets.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans bg-gray-950 text-gray-100 min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
