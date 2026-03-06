import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { WelcomeSplash } from "@/components/ui/welcome-splash";
import { DEFAULT_THEME } from "@/lib/theme";
import "./globals.css";

const headingSans = Inter({
  variable: "--font-heading-sans",
  subsets: ["latin"],
  weight: ["300", "700"],
});

const codeMono = JetBrains_Mono({
  variable: "--font-code-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Vynance",
    template: "%s | Vynance",
  },
  description: "Multi-modal inventory ingestion for business operations",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/logotransparentbackground.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vynance",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={DEFAULT_THEME}
      style={{ colorScheme: DEFAULT_THEME }}
    >
      <body
        className={`${headingSans.variable} ${codeMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <WelcomeSplash />
        {children}
      </body>
    </html>
  );
}
