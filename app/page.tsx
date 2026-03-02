import type { Viewport } from "next";
import { HomeDashboardClient } from "@/features/home/ui";

// Hero top section is the blue gradient — match the start color of --hero-bg.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#007fff" },
    { media: "(prefers-color-scheme: light)", color: "#007fff" },
  ],
};

export default function HomePage() {
  return <HomeDashboardClient />;
}
