import IntakeHubClient from "@/features/intake/ui/IntakeHubClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

/**
 * Inventory Intake Hub.
 * Thin route wrapper; all logic in IntakeHubClient.
 */
export default function IntakePage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <IntakeHubClient />
      </DashboardPageContainer>
    </main>
  );
}
