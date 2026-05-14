import type { Metadata, Viewport } from "next";
import { PropsWithChildren } from "react";

import "./globals.css";
import { FloatingCreateMenu } from "@/components/ui/floating-create-menu";
import { MobileBottomNav } from "@/components/ui/nav-links";
import { MainNav } from "@/components/ui/main-nav";

export const metadata: Metadata = {
  title: "Direct Democracy",
  description: "A civic platform for voters, trusted citizens, and officials.",
  applicationName: "Direct Democracy",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Direct Democracy",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body className="bg-[#050b16] text-slate-100 antialiased">
        <div className="app-shell mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 sm:px-5 lg:px-8">
          <MainNav />
          <main className="flex-1">{children}</main>
          <FloatingCreateMenu />
          <MobileBottomNav />
        </div>
      </body>
    </html>
  );
}
