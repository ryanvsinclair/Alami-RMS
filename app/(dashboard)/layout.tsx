import { BottomNav } from "@/components/nav/bottom-nav";
import { getEnabledModules } from "@/core/modules/guard";
import { requireBusinessMembership } from "@/core/auth/tenant";
import { BusinessConfigProvider } from "@/lib/config/context";
import { getTerminology } from "@/lib/config/terminology";

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
