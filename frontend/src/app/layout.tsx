import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jerry — Your AI Budget Assistant",
  description: "Track expenses, manage budgets, and get AI-powered financial insights with Jerry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative">
        {/* Animated mesh gradient background */}
        <div className="mesh-bg" aria-hidden="true">
          <div className="mesh-orb" />
        </div>
        {/* Page content above the background */}
        <div className="relative z-10 flex-1 flex flex-col min-h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
