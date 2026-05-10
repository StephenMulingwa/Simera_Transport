import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConditionalTowerProvider } from "@/components/simera/ConditionalTowerProvider";
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
  title: "Simera Transport · Control Tower",
  description: "Fleet monitoring and operations for Simera Transport Ltd",
  icons: {
    icon: [{ url: "/SimeraLogo.png", type: "image/png" }],
    apple: "/SimeraLogo.png",
  },
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
      <body className="flex min-h-full flex-col">
        <ConditionalTowerProvider>{children}</ConditionalTowerProvider>
      </body>
    </html>
  );
}
