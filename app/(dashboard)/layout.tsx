import type { Viewport } from "next";
import { BottomNav } from "@/components/nav/bottom-nav";
import { getEnabledModules } from "@/core/modules/guard";
import { requireBusinessMembership } from "@/core/auth/tenant";
import { BusinessConfigProvider } from "@/lib/config/context";
import { getTerminology } from "@/lib/config/terminology";

// Default status bar color for all dashboard pages (background surface).
// Pages with a distinct top section (e.g. home hero) override this via their
// own viewport export in a thin server wrapper page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
    { media: "(prefers-color-scheme: light)", color: "#f0f4f8" },
  ],
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ business }, enabledModules] = await Promise.all([
    requireBusinessMembership(),
    getEnabledModules(),
  ]);
  const terminology = getTerminology(business.industry_type);

  return (
    <BusinessConfigProvider
      config={{
        industryType: business.industry_type,
        enabledModules,
        terminology,
      }}
    >
      <div className="min-h-screen max-w-lg mx-auto pb-24 bg-background text-foreground">
        {children}
        <BottomNav enabledModules={enabledModules} />
      </div>
    </BusinessConfigProvider>
  );
}
