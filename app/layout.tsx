import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import BottomDock from "@/components/BottomDock";
import AdSense from "@/components/AdSense";
import AdSlot from "@/components/AdSlot";
import { getUiPrefs } from "@/lib/actions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://live-tv-puce.vercel.app"),
  title: "Kage TV — Live TV",
  description:
    "Watch free live TV channels from around the world. Public channels from iptv-org.",
  openGraph: {
    title: "Kage TV — Live TV",
    description:
      "Watch free live TV channels from around the world. Public channels from iptv-org.",
    url: "https://live-tv-puce.vercel.app",
    siteName: "Kage TV",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kage TV — Live TV",
    description:
      "Watch free live TV channels from around the world. Public channels from iptv-org.",
    images: ["/og-image.png"],
  },
};

// Every page is personalized (country + anonymous device prefs read from
// cookies), so nothing here can be statically prerendered.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  let accent = "#ff7a1a";
  let country: string | null = null;
  let autoDetected = false;

  try {
    const prefs = await getUiPrefs();
    if (prefs?.accent) accent = prefs.accent;
    country = prefs?.country ?? null;
    autoDetected = Boolean(prefs?.autoDetected);
  } catch {
    // Prefs unavailable — fall back to defaults.
  }

  return (
    <html
      lang="en"
      style={{ "--accent": accent } as CSSProperties}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <AdSense />
      </head>
      <body className="flex min-h-full flex-col bg-[#050505] text-white">
        <Header country={country} autoDetected={autoDetected} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-32 sm:px-6">
          {children}
        </main>
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
          <AdSlot />
        </div>
        <footer className="border-t border-white/10 px-3 py-8 sm:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Footer" className="flex gap-6">
              <a href="/about" className="hover:text-white">
                About
              </a>
              <a href="/privacy" className="hover:text-white">
                Privacy
              </a>
              <a href="/contact" className="hover:text-white">
                Contact
              </a>
            </nav>
            <p>Public channels from iptv-org.</p>
          </div>
        </footer>
        <BottomDock />
      </body>
    </html>
  );
}
