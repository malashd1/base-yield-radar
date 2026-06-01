import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Base Yield Radar",
    template: "%s · Base Yield Radar",
  },
  description:
    "Best yields on Base, with safety alerts and one-click stake. Built for retail DeFi.",
  openGraph: {
    title: "Base Yield Radar",
    description: "Best yields on Base. Without the rugs.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Yield Radar",
    description: "Best yields on Base. Without the rugs.",
    images: ["/api/og"],
  },
  // Project verification: Talent Protocol expects this exact meta on the root
  // page to confirm we own the domain claimed in the Talent app.
  other: {
    "talentapp:project_verification":
      "173987e10278285fb27baa43f7c442ce65adfa74e63626ce5227f0f91ccf97f295e4a4402fc86d171f21a0dea96c09c115ff2f864fbe4dbf860ec65b722315e2",
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
      <body className="min-h-full flex flex-col">
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
